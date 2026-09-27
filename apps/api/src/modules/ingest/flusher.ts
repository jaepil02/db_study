// 단일 flusher의 배치 하나 — ⑥ 삽입 ⑦ 실패 처리 ⑧ 성공 후속(기전 정본 docs/06_pipeline/03_ingest_batch.md §적재 한 배치)
// 순서 계약: ② 삽입 성공 → ③ 대조군 COPY(SW-09 · 1회) → ④ XACK → ⑤ 최신값(SW-11) → ⑥ 판정기 인계(S7 · 06_pipeline/08 ①)
// — 04_routing §대조군 동시 적재 기전. 판정 실패는 XACK를 되돌리지 않는다(REQ-ING-13 · 인계 깊이 1 — 슬롯이 차면 여기서 기다린다).
// XACK는 삽입 성공 뒤 또는 격리(DLQ) 뒤에만 한다(REQ-GLB-05 · 상태 머신 1).
// 저장소 호출은 전부 주입받는다 — 순서 계약을 단위 테스트로 고정한다.
// 흐름 요약(EXP-FLOW · 07_api/11 §흐름 이벤트)은 배치당 1건 — 인계가 없으면 여기서 ⑤ 뒤에, 인계가 있으면 판정기가 ⑦ 뒤에 낸다.
// 표지가 없으면(flow.enabled() false — 발행기의 마지막 확인값) 재료를 만들지 않는다 · 배치 경로에 Redis 왕복을 더하지 않는다.
import type { ClickHouseSettings } from '@clickhouse/client';
import type { FlowBatchInput } from '../../common/flow/flow-publisher';
import type { DlqItem } from '../../common/redis/durable-key-client';
import type { AlarmHandoffPort } from '../alarm/eval/evaluator';
import { type BatchTokenPort, insertSettings } from './batch-token.port';
import type { ControlTableSinkPort } from './control-table-sink.port';
import { ingestMetrics as m } from './ingest.metrics';
import type { LabFault } from './lab-fault';
import type { LatestValueWritePort } from './latest-value-write.port';
import { type Piece, rowsOf, type TagRawRow } from './window-buffer';

/**
 * 지수 백오프 — 현행 참고 1 · 2 · 4 · 8 · 16초 · 재시도 5회(값 정본 06_pipeline/03 §재시도 · 격리 · DLQ · ING-05).
 * 합계 31초 < idle 기준 60초 — 재시도 중인 배치를 회수가 뺏지 않는다(§회수 금지된 대체 ②). 늘리면 이 부등식을 다시 검산한다.
 */
export const RETRY_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;

/**
 * MV 삽입 실패 판별 — ClickHouse는 종속 MV에서 난 예외에 "while pushing to view <db>.<mv>"를 덧붙인다(06_pipeline/09 §MV 실패).
 * 원시는 이미 기록됐을 수 있다(MV 원자성 없음) — 같은 토큰 재시도로 메운다(ⓑ).
 */
export function isMvError(e: unknown): boolean {
  return e instanceof Error && /while pushing to view/i.test(e.message);
}

export type PieceOutcome =
  | 'inserted' // 삽입 성공 · XACK 성공
  | 'dlq' // 재시도 소진 → DLQ → XACK
  | 'abandoned' // 종료 중 실패 · DLQ 실패 · XACK 실패 — PEL에 남아 회수 · 재기동이 다시 처리한다
  | 'empty'; // 행 없는 조각 — XACK만

/** 흐름 요약 발행 — FlowPublisher의 부분(테스트는 가짜를 넣는다) */
export interface FlowBatchSink {
  enabled(): boolean;
  publishBatch(input: FlowBatchInput): void;
}

/** 흐름 요약 stages 값 — 0.1 ms 단위(프레임 크기) */
export function flowMs(ms: number): number {
  return Math.round(Math.max(0, ms) * 10) / 10;
}

/**
 * 배치 요약 초안 — 창 버퍼 엔트리의 수신 · 디코드 시각으로 6a · 6b 최댓값을 채운다(창 대기 6c는 싣지 않는다).
 * 수신 시각이 없는 엔트리만 있으면 6a · 6b는 null — 나머지 필드는 단계가 끝날 때 채운다
 */
export function flowDraft(piece: Piece, rows: number): FlowBatchInput {
  let wait = -1;
  let decode = -1;
  for (const e of piece.entries) {
    if (e.receivedAt === undefined) continue;
    wait = Math.max(wait, e.receivedAt - e.idMs);
    decode = Math.max(decode, e.decodedAt - e.receivedAt);
  }
  return {
    rows,
    stages: {
      streamWaitMs: wait < 0 ? null : flowMs(wait),
      decodeMs: decode < 0 ? null : flowMs(decode),
      chInsertMs: null,
      controlCopyMs: null,
      latestWriteMs: null,
      alarmMs: null,
    },
    chRows: 0,
    retries: 0,
    dlqEntries: 0,
    controlCopy: null,
    latestWrites: null,
    alarm: null,
    stream: null,
  };
}

export interface FlusherDeps {
  insert(rows: TagRawRow[], settings: ClickHouseSettings): Promise<void>;
  tokens: BatchTokenPort;
  asyncInsert: boolean;
  control: ControlTableSinkPort;
  ack(ids: string[]): Promise<void>;
  dlq(items: DlqItem[]): Promise<void>;
  latest: LatestValueWritePort;
  /** ⑥ 판정기 인계 — 판정기가 없는 구성(단위 테스트)이면 null */
  alarm?: AlarmHandoffPort | null;
  labFault: LabFault;
  sleep(ms: number): Promise<void>;
  /** 종료 중 — 실패한 배치를 더 기다리지 않고 PEL에 남긴다 */
  stopping(): boolean;
  log: { warn(msg: string): void; error(msg: string): void };
  /** 흐름 요약 — 없으면(단위 테스트 · 발행기 없는 구성) 내지 않는다 */
  flow?: FlowBatchSink | null;
  /** 직전 계측 Stream 길이 · lag(1초 폴링 값) — 요약을 위해 Redis를 읽지 않는다 · 모르면 null */
  streamStat?: () => { length: number; lag: number | null } | null;
}

export class Flusher {
  constructor(private readonly d: FlusherDeps) {}

  async process(piece: Piece): Promise<PieceOutcome> {
    const ids = piece.entries.map((e) => e.id);
    const rows = rowsOf(piece);
    if (rows.length === 0) {
      return (await this.ack(ids)) ? 'empty' : 'abandoned';
    }
    const token = this.d.tokens.tokenFor(ids[0] as string, ids[ids.length - 1] as string, rows.length);
    const settings = insertSettings(this.d.tokens, token, this.d.asyncInsert);
    // 표지는 배치 시작에서 한 번 본다 — 없으면 이 배치의 재료를 만들지 않는다
    const flow = this.d.flow?.enabled() ? flowDraft(piece, rows.length) : null;
    let insertMs = 0;
    let retries = 0;

    // ⑥ ⑦ — 같은 토큰 · 지수 백오프. 재시도 동안 다음 배치를 삽입하지 않는다(윈도우를 전진시키지 않는다)
    let mvFirstError: string | null = null;
    for (let attempt = 0; ; attempt++) {
      const endTimer = m.insertDuration.startTimer();
      const a0 = performance.now();
      try {
        await this.d.insert(rows, settings);
        endTimer();
        insertMs += performance.now() - a0;
        retries = attempt;
        break;
      } catch (e) {
        endTimer();
        insertMs += performance.now() - a0;
        const msg = (e as Error).message;
        if (isMvError(e)) {
          m.mvErrors.inc({ result: 'error' });
          mvFirstError ??= msg;
        }
        if (attempt >= RETRY_BACKOFF_MS.length) {
          const out = await this.quarantine(piece, token, msg);
          if (out === 'dlq' && flow) {
            // 격리 배치도 배치 하나다 — 삽입 행 0 · 격리 엔트리 수 · 후속 단계 없음
            flow.stages.chInsertMs = flowMs(insertMs);
            flow.retries = attempt;
            flow.dlqEntries = ids.length;
            this.publishFlow(flow);
          }
          return out;
        }
        if (this.d.stopping()) {
          this.d.log.warn(
            `INSERT 실패 — 종료 중이라 재시도하지 않고 PEL에 남긴다(${ids.length} 엔트리) · ${msg}`,
          );
          return 'abandoned';
        }
        const wait = RETRY_BACKOFF_MS[attempt] as number;
        this.d.log.warn(
          `INSERT 실패(시도 ${attempt + 1}) — ${msg} · ${wait} ms 뒤 같은 토큰 재시도(${token ?? 'no-token'})`,
        );
        m.insertRetries.inc();
        await this.d.sleep(wait);
      }
    }

    // 결함 주입 — 삽입 성공 직후 · COPY · XACK 전(EXP-13)
    this.d.labFault.afterInsert();
    m.rowsInserted.inc(rows.length);
    m.routedRows.inc({ layer: 'raw' }, rows.length);
    m.batchSize.observe(rows.length);
    if (mvFirstError !== null) this.recordRollupSuspect(piece, rows, token, mvFirstError);

    if (flow) {
      flow.stages.chInsertMs = flowMs(insertMs);
      flow.chRows = rows.length;
      flow.retries = retries;
    }

    // ③ 대조군 — ② 성공 뒤 1회 · 재시도 루프 밖 · 던지지 않는다
    const c0 = performance.now();
    const copied = await this.d.control.copy(rows, { token });
    if (flow && this.d.control.implName !== 'NoopControlSink') {
      flow.stages.controlCopyMs = flowMs(performance.now() - c0);
      flow.controlCopy = { rows: rows.length, ok: copied };
    }
    // ④ XACK — ③의 성패와 무관
    if (!(await this.ack(ids))) return 'abandoned'; // 확인되지 않은 값으로 최신값을 세우지 않는다(REQ-ING-07)
    // ⑤ 최신값(SW-11 ingest) — XACK 뒤
    const l0 = performance.now();
    const accepted = await this.d.latest.write(piece.entries);
    if (flow) {
      flow.stages.latestWriteMs = flowMs(performance.now() - l0);
      flow.latestWrites = accepted;
    }
    // ⑥ 판정기 인계 — 확정 배치의 행 배열 · 원 배치 토큰(alarm_eval 재시도가 같은 토큰을 쓴다)
    // 인계 배치의 흐름 요약은 판정기가 ⑦ 뒤에 낸다(06_pipeline/08 §판정 한 배치) — 여기서 내면 점이 둘로 갈라진다
    if (this.d.alarm) {
      if (flow) flow.stream = this.d.streamStat?.() ?? null;
      await this.d.alarm.handoff({ token, rows, flow });
      m.routedRows.inc({ layer: 'alarm' }, rows.length);
    } else if (flow) {
      this.publishFlow(flow);
    }
    return 'inserted';
  }

  /** 인계 없는 배치의 요약 — 직전 계측 Stream 값을 싣고 발행기에 넘긴다(발행 실패는 발행기가 계수 · 삼킴) */
  private publishFlow(flow: FlowBatchInput): void {
    flow.stream = this.d.streamStat?.() ?? null;
    this.d.flow?.publishBatch(flow);
  }

  /** 재시도 소진 — 원 엔트리마다 DLQ(원 배치 토큰) → XACK → dlq_count */
  private async quarantine(piece: Piece, token: string | null, lastError: string): Promise<PieceOutcome> {
    const ids = piece.entries.map((e) => e.id);
    const missing = piece.entries.filter((e) => !e.payload).length;
    if (missing > 0) {
      this.d.log.error(`재시도 소진 — 원 본문 없는 엔트리 ${missing}건 · DLQ에 쓰지 않고 PEL에 남긴다`);
      return 'abandoned';
    }
    try {
      await this.d.dlq(
        piece.entries.map((e) => ({
          payload: e.payload as Buffer,
          originId: e.id,
          reason: 'retry_exhausted' as const,
          batchToken: token,
        })),
      );
    } catch (e) {
      this.d.log.error(
        `DLQ 쓰기 실패 — ${(e as Error).message} · XACK하지 않고 PEL에 남긴다(회수가 다시 시도)`,
      );
      return 'abandoned';
    }
    this.d.log.error(
      JSON.stringify({
        event: 'ingest_retry_exhausted',
        entries: ids.length,
        first_id: ids[0],
        last_id: ids[ids.length - 1],
        token,
        error: lastError,
      }),
    );
    if (!(await this.ack(ids))) return 'abandoned';
    m.dlqCount.inc({ reason: 'retry_exhausted' }, ids.length);
    return 'dlq';
  }

  /** 롤업 의심 구간 — MV 오류를 본 배치가 최종 성공한 뒤(06_pipeline/09 §MV 실패와 같은 토큰 재시도 · 로그 이벤트 rollup_suspect) */
  private recordRollupSuspect(
    piece: Piece,
    rows: TagRawRow[],
    token: string | null,
    firstError: string,
  ): void {
    m.mvErrors.inc({ result: 'retry_ok' });
    m.rollupSuspect.inc();
    let tsMin = Number.POSITIVE_INFINITY;
    let tsMax = Number.NEGATIVE_INFINITY;
    const devices = new Set<number>();
    for (const r of rows) {
      if (r[0] < tsMin) tsMin = r[0];
      if (r[0] > tsMax) tsMax = r[0];
      devices.add(r[1]);
    }
    this.d.log.warn(
      JSON.stringify({
        event: 'rollup_suspect',
        token,
        first_id: piece.entries[0]?.id,
        ts_min: tsMin,
        ts_max: tsMax,
        devices: [...devices].sort((a, b) => a - b),
        first_error: firstError,
      }),
    );
  }

  private async ack(ids: string[]): Promise<boolean> {
    try {
      await this.d.ack(ids);
      return true;
    } catch (e) {
      this.d.log.error(`XACK 실패 — ${(e as Error).message} · 엔트리는 PEL에 남는다`);
      return false;
    }
  }
}
