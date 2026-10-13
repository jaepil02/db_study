// 직접 비교 실행(run type compare · 부분 하나 = 실행 하나) — 정본 docs/06_pipeline/10_datagen_inject.md §직접 비교 실행 · docs/06_pipeline/04_routing.md §gated 게이트 판정
// 같은 센서 데이터를 Redis Stream(stream:plc:raw)으로 발행하고, Ingest flusher가 같은 배치를 ClickHouse 삽입 + PostgreSQL COPY로 받는다(SW-09 gated).
// 실행은 게이트(cache:dual:active)를 켜 둔 동안만 PostgreSQL이 받는다.
//   ingest    과거 구간(UTC D−52 00:00부터 정확히 N행 · 10만 ~ 10억 · compare-range.ts)을 카드 라인 주기대로 만들어 최대 속도로 발행 → 행 수 · 크기 · 배치 시간 대조
//             7일치를 넘는 넣기(5억 · 10억)는 PostgreSQL 압축 전 크기가 디스크 여유를 넘어 다 들어간 지난 날 칸부터 넣는 도중 압축한다(inflightCompress)
//             크기는 자리 잡은 모양에서 잰다 — ClickHouse 병합 뒤 · PostgreSQL(TimescaleDB · ADR-32)은 구간 칸 열 압축 뒤(조회 대결도 압축된 칸을 읽는다)
//   query     마지막 넣기 구간의 앞에서부터 원천 10만 ~ 10억 행 9단계(넣기 건수와 같은 스케일 · 사용자 결정 2026-10-12) — 단계마다 정확히 N행을 설비 · 태그 · 1시간 칸으로 집계
//             · 워밍업 1 + 3회 · 중간값 · 승자는 3회 모두 같을 때만(measure.ts) · 두 저장소 결과를 칸마다 맞춰 원천 행 수 · 정합성을 본다(compare-query.ts)
//   consistency 마지막 넣기 구간을 두 저장소에서 한 번씩 훑어(묶음 — 설비 · 태그 · 1시간) 네 기준(행 수 · 값 합계 · 묶음 집계 · 행 지문)으로 맞춘다
// 시작 조건(지침서 §6 · r5 M1~M3): 넣기는 설비 가동이 꺼져 있어야 한다(가동 데이터가 같은 대기줄 · 같은 배치에 섞인다 — 400 path plant).
// 조회 대결 · 데이터 정합성은 마지막 넣기가 완료여야 한다(중단 · 실패한 넣기는 사흘 창을 이미 비웠다 — 409 datagen.compare_no_data).
// 넣기는 대기줄 적체가 0이 된 뒤 구간을 비운다(앞 실행의 남은 엔트리가 비운 구간에 섞이지 않게 · 상한 30초).
// 결과는 종결 직전 PG run_result에 보관한다(archive) — 실행 메모리는 재기동이면 사라진다.
// 측정값은 실제 측정만 싣는다 — 예상과 달라도(넣기는 PostgreSQL이 더 빠를 수 있다 · 기록 045) 그대로 낸다.
import {
  COMPARE_QUERY_SIZES,
  type ComparePart,
  type CompareRunResultBody,
  compareQueryStepKey,
  compareSizeName,
} from '@db-study/shared';
import { ApiError } from '../../common/http/api-error';
import type { GroupBacklog } from '../../common/redis/durable-key-client';
import { BackpressureGate } from './backpressure-gate';
import {
  consistencyStart,
  consistencyVerdict,
  diffGroups,
  storeSummary,
  tagLabels,
} from './compare-consistency';
import { type GenDevice, genChunk, genSecondCut, pointsPerSimSecond } from './compare-gen';
import {
  backpressureStage,
  type CompareMeterSnapshot,
  histDiff,
  histQuantile,
  toMs,
} from './compare-metrics';
import { type AggRow, type CutRow, compareAgg } from './compare-query';
import { DAY_MS, ingestRange, ingestWideRange, type TimeRange, utcMidnight } from './compare-range';
import type { CompareStores, GroupSum, StorePair } from './compare-stores';
import { measureReps, speedRatio, unanimousWinner } from './measure';
import {
  type RunEnding,
  type RunExecutor,
  type RunParams,
  type RunState,
  type RunStepDef,
  RunStopped,
  runErrorOf,
} from './run-registry';
import { completeIngestRange, type RunResultStore } from './run-result';

/** 발행 계수 — 위험 단계 멈춤 · 실패 뒤 다시 보낸 횟수 · 대기줄 entries-added 기준(다시 보낼 앞부분을 센다) */
interface PublishCounters {
  pauses: number;
  retries: number;
  added: number | null;
}

/** 게이트를 켠(끈) 뒤 발행 전 기다림 — flusher의 게이트 읽기 캐시(500 ms)가 지나야 새 판정을 본다 */
export const GATE_SETTLE_MS = 1000;
/** 게이트 다시 쓰기 주기 · TTL은 CacheKeyClient(DUAL_GATE_TTL_SECONDS 10초) */
export const GATE_REFRESH_MS = 2000;
/** 발행 한 번(파이프라인 1회)에 묶는 과거 초 — 설비 30대면 엔트리 300 */
export const INGEST_CHUNK_SEC = 10;
/**
 * 넣기 발행 속도 상한(점/초) — null은 상한 없음(백프레셔 게이트만). PostgreSQL 기본 키 COPY가 타임아웃(창 폭의 절반)을 넘어
 * 실패가 나면 이 값을 낮춘다(지침서 위험 절 — 실제 속도는 결과 rowsPerSec에 남는다).
 */
export const COMPARE_INGEST_MAX_PPS: number | null = null;
/** 적체 소진 상한 — 넘으면 timedOut으로 남기고 다음으로 간다 */
export const COMPARE_DRAIN_LIMIT_MS = 180_000;
export const COMPARE_POLL_MS = 250;
/**
 * 발행 실패 뒤 다시 보내기를 이어 갈 상한 — 디스크가 몹시 바쁠 때 Redis가 1초(명령 시간 제한) 넘게 응답하지 못하는 순간이 있다
 * (2026-10-12 실측 — 1억 넣기 5,200만 행째 · SLOWLOG 비어 있음 · api 이벤트 루프 지연 60 ms). 시간 초과는 클라이언트가 기다리기를
 * 그만둔 것이라 서버에서는 실행됐을 수 있다 — entries-added로 실제로 들어간 수를 세어 나머지만 다시 보낸다.
 */
export const PUBLISH_RETRY_LIMIT_MS = 60_000;
/** 넣기 시작 전 적체 0 기다림 상한 — 넘으면 시작하지 않고 실패(앞 실행의 남은 엔트리가 비운 구간에 섞이지 않게) */
export const COMPARE_START_BACKLOG_LIMIT_MS = 30_000;

/** 설비 가동 중 넣기 시작 거절 문구(400 common.validation_failed · path plant) */
export const PLANT_ON_MESSAGE = '설비 가동을 끈 뒤 비교해 주세요 — 가동 데이터가 섞이면 비교가 흐려져요';
/** 마지막 넣기가 중단 · 실패 — 조회 대결 거절 문구(409 datagen.compare_no_data · reason ingest_incomplete) */
export const INGEST_INCOMPLETE_MESSAGE =
  '넣기가 끝까지 되지 않아 비교 데이터가 온전하지 않아요 — 다시 넣어 주세요';
/** 단계 detail 경고(결과 계약에는 싣지 않는다) */
export const DRAIN_TIMEOUT_WARNING =
  '적재 마무리가 상한을 넘었어요 — 행 수 · 초당 행은 끝까지 못 잰 값일 수 있어요';
export const OPTIMIZE_WARNING = 'ClickHouse 병합이 제한 시간을 넘었어요 — 크기는 병합 전 값이에요';
export const INFLIGHT_COMPRESS_WARNING =
  '넣는 도중 압축이 한 번 이상 실패했어요 — 남은 칸은 끝난 뒤 한꺼번에 압축했어요';
/**
 * 넣는 도중 압축을 켜는 창 길이 — 이보다 길면(카드 라인 5억 · 10억) 다 들어간 지난 날 칸부터 압축하며 넣는다.
 * 압축 전 PostgreSQL은 약 117 B/행(2026-10-11 실측 하루치)이라 10억이면 약 117 GB — 노트북 디스크 여유(약 75 GB)를 넘는다.
 */
export const INFLIGHT_COMPRESS_MIN_MS = 7 * DAY_MS;
export const COMPRESS_WARNING = 'TimescaleDB 압축이 실패했어요 — 크기는 압축 전 값이에요';

/** datagen.compare_no_data의 details.reason — 넣기 없음 · 마지막 넣기 미완료 · 구간에 행 없음(지우기 뒤 등) */
export type CompareNoDataReason = 'no_ingest' | 'ingest_incomplete' | 'no_rows';

export const COMPARE_STEPS: Record<ComparePart, RunStepDef[]> = {
  ingest: [
    { key: 'prepare', label: '구간 · 태그 준비' },
    { key: 'clear', label: '구간 비우기' },
    { key: 'publish', label: 'Redis로 발행' },
    { key: 'drain', label: '두 DB 적재 마무리' },
    { key: 'verify', label: '행 수 · 크기 대조' },
  ],
  query: [
    { key: 'prepare', label: '넣은 구간 · 자를 자리 확인' },
    ...COMPARE_QUERY_SIZES.map((n) => ({
      key: compareQueryStepKey(n),
      label: `원천 ${compareSizeName(n)} 행 집계`,
    })),
  ],
  consistency: [
    { key: 'prepare', label: '넣은 구간 확인' },
    { key: 'clickhouse', label: 'ClickHouse에서 재기' },
    { key: 'postgres', label: 'PostgreSQL에서 재기' },
    { key: 'compare', label: '두 DB 맞춰 보기' },
  ],
};

export interface CompareClock {
  nowMs(): number;
  monoMs(): number;
  /** ms 동안 또는 abort가 풀릴 때까지 */
  sleep(ms: number, abort?: Promise<void>): Promise<void>;
}
export const systemCompareClock: CompareClock = {
  nowMs: () => Date.now(),
  monoMs: () => performance.now(),
  sleep: (ms, abort) =>
    new Promise<void>((resolve) => {
      const h = setTimeout(resolve, Math.max(0, ms));
      void abort?.then(() => {
        clearTimeout(h);
        resolve();
      });
    }),
};

export interface CompareDeps {
  stores: CompareStores;
  results: RunResultStore;
  meter(): Promise<CompareMeterSnapshot>;
  plantOn(): Promise<boolean>;
  /** 지금 스위치 값(health switches의 value) */
  switches(): Record<string, string | number>;
  commitHash: string | null;
  /** SW-09 값 — off면 PostgreSQL이 받지 않아 넣기가 성립하지 않는다 */
  sw09: 'off' | 'on' | 'gated';
  /** 대조군 COPY 타임아웃(ms) — 마지막 배치의 COPY가 끝났다고 볼 기다림의 상한 */
  copyTimeoutMs: number;
  /** 이벤트 루프 양보 — 큰 구간 생성 사이에 표면 요청이 끼어들게 */
  yieldLoop?: () => Promise<void>;
}

type Part = ComparePart;
const partOf = (p: RunParams): Part => p.part as Part;

const iso = (ms: number) => new Date(ms).toISOString();

export class CompareRunExecutor implements RunExecutor {
  readonly type = 'compare' as const;
  private readonly yieldLoop: () => Promise<void>;

  constructor(
    private readonly deps: CompareDeps,
    private readonly clock: CompareClock = systemCompareClock,
  ) {
    this.yieldLoop = deps.yieldLoop ?? (() => new Promise<void>((r) => setImmediate(r)));
  }

  steps(params: RunParams): RunStepDef[] {
    return COMPARE_STEPS[partOf(params)].map((s) => ({ ...s }));
  }

  /**
   * 시작 전 확인 — ① 넣기는 SW-09가 off면 PostgreSQL이 아무것도 받지 않아 틀린 비교가 된다 → 400(새 코드 없이
   * common.validation_failed · fields SW-09 enum). 조회 대결 · 데이터 정합성은 이미 실린 데이터를 읽으므로 막지 않는다.
   * ② 넣기는 설비 가동이 꺼져 있어야 한다 → 400 common.validation_failed · fields plant enum(r5 M3). 읽기 부분은 막지 않는다.
   * 가동 상태를 읽지 못하면(Redis 불가) 503 realtime.latest_unavailable — 설비 가동 표면과 같은 코드.
   * ③ 조회 대결 · 데이터 정합성은 온전한 비교 데이터가 있어야 한다 — comparableRange(409 datagen.compare_no_data · details.reason).
   */
  async precheck(params: RunParams): Promise<void> {
    if (partOf(params) === 'ingest') {
      if (this.deps.sw09 === 'off')
        throw new ApiError(
          'common.validation_failed',
          '동시 적재 스위치(SW-09)가 꺼져 있어요 — .env의 CONTROL_TABLE_ENABLED를 gated로 바꾸고 api를 다시 띄워 주세요',
          { fields: [{ path: 'SW-09', reason: 'enum' }] },
        );
      let on: boolean;
      try {
        on = await this.deps.plantOn();
      } catch {
        throw new ApiError(
          'realtime.latest_unavailable',
          'Redis에 접속할 수 없어 설비 가동 상태를 읽지 못했어요 — 비교를 시작하지 않았어요',
        );
      }
      if (on)
        throw new ApiError('common.validation_failed', PLANT_ON_MESSAGE, {
          fields: [{ path: 'plant', reason: 'enum' }],
        });
      return;
    }
    await this.comparableRange(partOf(params) === 'consistency' ? 'consistency' : 'query');
  }

  /**
   * 조회 대결 · 데이터 정합성의 대상 구간 — 마지막 넣기(상태 무관)가 완료이고 그 구간에 두 저장소 모두 행이 있어야 한다.
   * 마지막 넣기가 중단 · 실패면 그 전 완료 구간도 쓰지 않는다 — 시작하자마자 사흘 창을 비웠으므로 앞 구간 데이터가 이미 없거나 반쯤이다(r5 M1).
   */
  private async comparableRange(part: 'query' | 'consistency' = 'query'): Promise<TimeRange> {
    const last = await this.deps.results.lastIngest();
    const noData = (reason: CompareNoDataReason, message: string, range: TimeRange | null) =>
      new ApiError('datagen.compare_no_data', message, {
        part,
        reason,
        range: range ? { start: iso(range.start), end: iso(range.end) } : null,
      });
    if (last && last.status !== 'completed')
      throw noData('ingest_incomplete', INGEST_INCOMPLETE_MESSAGE, null);
    const range = completeIngestRange(last);
    if (!range) throw noData('no_ingest', '비교할 데이터가 없다 — 먼저 넣기(ingest)를 끝까지 돌린다', null);
    const has = await this.deps.stores.hasRows(range);
    if (!has.clickhouse || !has.postgres)
      throw noData('no_rows', '비교할 데이터가 없다 — 지우기 뒤에는 다시 넣는다', range);
    return range;
  }

  async archive(state: RunState, ending: RunEnding, endedAtMs: number): Promise<void> {
    const plantAtEnd = await this.deps.plantOn().catch(() => false);
    await this.deps.results.insert({
      runId: state.runId,
      part: partOf(state.params),
      params: { ...state.params },
      status: ending.status,
      result: ending.status === 'completed' ? ((state.result as CompareRunResultBody | null) ?? null) : null,
      startedAt: state.startedAt,
      endedAt: endedAtMs,
      commitHash: this.deps.commitHash,
      switches: this.deps.switches(),
      plantOn: this.plantAtStart.get(state.runId) === true || plantAtEnd,
    });
    this.plantAtStart.delete(state.runId);
  }

  private readonly plantAtStart = new Map<string, boolean>();

  async execute(state: RunState): Promise<RunEnding> {
    const part = partOf(state.params);
    this.plantAtStart.set(state.runId, await this.deps.plantOn().catch(() => false));
    const gate = new GateHolder(this.deps.stores, state.runId, this.clock);
    try {
      if (part === 'ingest' && this.deps.sw09 === 'off')
        throw new Error(
          'SW-09(CONTROL_TABLE_ENABLED)가 off다 — PostgreSQL이 센서 배치를 받지 않는다(gated · on에서 다시)',
        );
      if (part === 'ingest') await this.ingest(state, gate);
      else if (part === 'query') await this.query(state);
      else await this.consistency(state);
    } catch (e) {
      state.skipPending();
      await gate.off().catch(() => undefined);
      backpressureStage.set({ publisher: 'compare' }, 0);
      if (e instanceof RunStopped) return { status: 'stopped', error: null };
      return { status: 'failed', error: runErrorOf(e) };
    }
    await gate.off().catch(() => undefined);
    backpressureStage.set({ publisher: 'compare' }, 0);
    return { status: 'completed', error: null };
  }

  private checkStop(state: RunState): void {
    if (state.stopRequested) throw new RunStopped();
  }

  // ── 적체 · 발행

  private async backlogNow(): Promise<number | null> {
    const b = await this.deps.stores.backlog().catch(() => null);
    return b && b.lag !== null ? b.lag + b.pending : null;
  }

  /**
   * 발행 하나 — 위험 단계면 풀릴 때까지 기다렸다 보낸다(비교 행은 버리지 않는다) · 보낸 점 수.
   * 묶음이 실패하면(시간 초과 · 연결 오류) 대기줄 entries-added로 실제로 들어간 앞부분을 세고 나머지만 다시 보낸다 —
   * 넣는 동안 이 대기줄에 쓰는 쪽은 넣기 하나다(설비 가동 꺼짐 · 실행은 한 번에 하나). 들어간 수가 앞뒤가 맞지 않거나
   * (다른 쓰는 쪽) 상한(PUBLISH_RETRY_LIMIT_MS)을 넘으면 예전처럼 멈춘다 — 비교 행이 빠지거나 겹치면 대조가 성립하지 않는다.
   */
  private async publish(
    state: RunState,
    bp: BackpressureGate,
    payloads: Buffer[],
    points: number[],
    counters: PublishCounters,
  ): Promise<number> {
    let rest = payloads.map((p, i) => ({ p, n: points[i] ?? 0 }));
    let sent = 0;
    let failedSince: number | null = null;
    for (;;) {
      await this.waitBackpressure(state, bp, counters);
      this.checkStop(state);
      let res: { results: (string | Error)[]; backlog: GroupBacklog | null; entriesAdded: number | null };
      try {
        res = await this.deps.stores.xaddBatch(rest.map((x) => x.p));
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        res = { results: rest.map(() => err), backlog: null, entriesAdded: null };
      }
      const failed = res.results.filter((x) => x instanceof Error).length;
      if (failed === 0) {
        sent += rest.reduce((a, x) => a + x.n, 0);
        counters.added = res.entriesAdded ?? (counters.added === null ? null : counters.added + rest.length);
        bp.observe(res.backlog);
        backpressureStage.set({ publisher: 'compare' }, bp.stage);
        return sent;
      }
      bp.xaddFailed();
      backpressureStage.set({ publisher: 'compare' }, bp.stage);
      failedSince ??= this.clock.monoMs();
      const landed = await this.landed(state, counters.added, rest.length, failedSince);
      if (landed === null)
        throw new Error(
          `Redis 발행 실패 ${failed}건 — 실제로 들어간 수를 셀 수 없어(${PUBLISH_RETRY_LIMIT_MS / 1000}s 안에 대기줄 정보를 못 읽음 · 또는 다른 쓰는 쪽) 멈춘다`,
        );
      sent += rest.slice(0, landed).reduce((a, x) => a + x.n, 0);
      counters.added = (counters.added as number) + landed;
      counters.retries += 1;
      rest = rest.slice(landed);
      if (rest.length === 0) return sent;
      if (this.clock.monoMs() - failedSince >= PUBLISH_RETRY_LIMIT_MS)
        throw new Error(
          `Redis 발행이 ${PUBLISH_RETRY_LIMIT_MS / 1000}s 넘게 실패해 멈춘다 — 남은 ${rest.length}건 · 비교 행이 빠지면 대조가 성립하지 않는다`,
        );
    }
  }

  /** 위험 단계(적체 · 발행 실패)면 적체가 주의 임계 아래로 올 때까지 기다린다 */
  private async waitBackpressure(
    state: RunState,
    bp: BackpressureGate,
    counters: PublishCounters,
  ): Promise<void> {
    if (!bp.halted) return;
    const stop = state.stopSignal();
    counters.pauses += 1;
    while (bp.halted && !state.stopRequested) {
      await this.clock.sleep(100, stop);
      bp.observe(await this.deps.stores.backlog().catch(() => null));
      backpressureStage.set({ publisher: 'compare' }, bp.stage);
    }
  }

  /**
   * 실패한 묶음 중 서버에 실제로 들어간 앞부분 수 — 지금 entries-added − 묶음 전 entries-added(파이프라인은 순서대로 처리된다).
   * 읽기도 실패하면 상한 안에서 다시 읽는다 · 기준이 없거나 0 ~ count 밖이면 null(셀 수 없음).
   */
  private async landed(
    state: RunState,
    base: number | null,
    count: number,
    failedSince: number,
  ): Promise<number | null> {
    if (base === null) return null;
    const stop = state.stopSignal();
    for (let wait = 250; ; wait = Math.min(wait * 2, 4000)) {
      const now = await this.deps.stores.entriesAdded().catch(() => null);
      if (now !== null) {
        const n = now - base;
        return n >= 0 && n <= count ? n : null;
      }
      if (this.clock.monoMs() - failedSince >= PUBLISH_RETRY_LIMIT_MS) return null;
      this.checkStop(state);
      await this.clock.sleep(wait, stop);
    }
  }

  /**
   * 넣기 시작 전 — 대기줄 적체(lag + pending)가 0이 될 때까지 기다린다 · 기다린 ms(r5 M2).
   * 중단한 넣기 · flow 실행이 남긴 엔트리가 구간을 비운 뒤에 같은 (설비 · 태그 · 시각)으로 들어오면 ClickHouse는 두 번 저장하고
   * PostgreSQL은 기본 키 충돌로 배치를 통째로 롤백한다. 상한(30초)을 넘으면 비우기 전에 실패로 끝낸다. lag를 모르면(null) 0이 아니라고 본다.
   */
  private async waitBacklogEmpty(state: RunState): Promise<number> {
    const stop = state.stopSignal();
    const t0 = this.clock.monoMs();
    let last: number | null = null;
    for (;;) {
      this.checkStop(state);
      last = await this.backlogNow();
      if (last === 0) return Math.round(this.clock.monoMs() - t0);
      if (this.clock.monoMs() - t0 >= COMPARE_START_BACKLOG_LIMIT_MS) break;
      await this.clock.sleep(COMPARE_POLL_MS, stop);
    }
    const sec = COMPARE_START_BACKLOG_LIMIT_MS / 1000;
    throw new Error(
      last === null
        ? `대기줄 적체를 ${sec}s 동안 확인하지 못해 넣기를 시작하지 않았어요 — 잠시 뒤 다시 넣어 주세요`
        : `대기줄에 앞서 보낸 센서 데이터 ${last}건이 ${sec}s 넘게 남아 넣기를 시작하지 않았어요 — 잠시 뒤 다시 넣어 주세요`,
    );
  }

  /**
   * 적체가 시작 수준으로 돌아오고(lag + pending) 조건이 맞을 때까지 · 상한을 넘으면 timedOut.
   * doneAt은 조건이 맞은 순간(단조 시계) — 넣기의 걸린 시간은 여기까지다(뒤의 COPY 마무리 대기는 재지 않는다).
   */
  private async drain(
    state: RunState,
    startBacklog: number,
    done: () => Promise<boolean> = async () => true,
  ): Promise<{ drainMs: number; timedOut: boolean; doneAt: number }> {
    const stop = state.stopSignal();
    const t0 = this.clock.monoMs();
    let timedOut = true;
    while (!state.stopRequested) {
      const b = await this.backlogNow();
      if (b !== null && b <= startBacklog && (await done())) {
        timedOut = false;
        break;
      }
      if (this.clock.monoMs() - t0 >= COMPARE_DRAIN_LIMIT_MS) break;
      await this.clock.sleep(COMPARE_POLL_MS, stop);
    }
    this.checkStop(state);
    const doneAt = this.clock.monoMs();
    // 마지막 배치 — ClickHouse 삽입 뒤 같은 배치의 COPY가 타임아웃 안에 끝난다(그 뒤 XACK) · 그만큼 더 기다린다
    await this.clock.sleep(this.deps.copyTimeoutMs + 500, stop);
    this.checkStop(state);
    return { drainMs: Math.round(doneAt - t0), timedOut, doneAt };
  }

  // ── ① 넣기

  private async ingest(state: RunState, gate: GateHolder): Promise<void> {
    const target = Number(state.params.rows);
    // 비우기는 넣기 창 전체(UTC D−52 ~ D−1 — 통째인 날 51개)를 — 앞서 넣은 더 큰 넣기가 남아 "쌓인 비교 데이터"가 이번 넣기보다
    // 크게 보이지 않게 · 파티션 DROP · 칸 drop_chunks라 죽은 행 자리가 남지 않는다(r5 H1) · 새로 넣는 칸은 압축 전 상태로 다시 생긴다
    const wide = ingestWideRange(this.clock.nowMs());
    let range: TimeRange = { start: wide.start, end: wide.start };
    let devices: GenDevice[] = [];
    let pps = 0;
    let startBacklog = 0;
    await state.runStep('prepare', async () => {
      devices = await this.deps.stores.loadCardDevices();
      if (devices.length === 0)
        throw new Error('카드 라인 설비 · 태그가 없다 — 시드(card-line) 뒤 다시 시작');
      pps = pointsPerSimSecond(devices);
      range = ingestRange(this.clock.nowMs(), target, pps);
      if (range.end > wide.end)
        throw new Error(
          `${compareSizeName(target)} 행은 넣을 수 있는 기간(${Math.round((wide.end - wide.start) / DAY_MS)}일 · 초당 ${pps}행)을 넘어요 — 설비 · 태그 시드를 확인해 주세요`,
        );
      const backlogWaitMs = await this.waitBacklogEmpty(state);
      startBacklog = (await this.backlogNow()) ?? 0;
      return {
        backlogWaitMs,
        rangeStart: iso(range.start),
        rangeEnd: iso(range.end),
        devices: devices.length,
        tags: devices.reduce((a, d) => a + d.tags.length, 0),
        pointsPerSimSecond: pps,
        expectedRows: target,
        inflightCompress: range.end - range.start > INFLIGHT_COMPRESS_MIN_MS,
      };
    });
    await state.runStep('clear', async () => {
      await this.deps.stores.clearRange(wide);
      // 게이트는 비운 뒤에 켠다 — 비우는 동안 가동 데이터 배치가 PostgreSQL에 실려도 구간 밖이라 섞이지 않는다
      await gate.on();
      return { gate: 'on' };
    });

    const inflightCompress = range.end - range.start > INFLIGHT_COMPRESS_MIN_MS;
    const compressor = new DayCompressor(this.deps.stores, range.start);
    const m0 = await this.deps.meter();
    // 발행 실패 뒤 다시 보내기의 기준 — 발행 전 대기줄 entries-added(읽지 못하면 null — 그때는 실패하면 예전처럼 멈춘다)
    const counters: PublishCounters = {
      pauses: 0,
      retries: 0,
      added: await this.deps.stores.entriesAdded().catch(() => null),
    };
    let published = 0;
    const timeline: TimelinePoint[] = [];
    const t0 = this.clock.monoMs();
    let doneAt = t0;
    // 넣는 중 결과 — 표본(1초)마다 실행 객체 result를 중간값으로 바꾼다(화면이 실시간으로 그린다 · 보관은 completed의 최종값만).
    // 크기는 LIVE_BYTES_EVERY_MS마다 따로 읽어 다음 표본에 싣는다 — 읽기가 늦거나 실패해도 표본을 막지 않는다.
    let bytes: StorePair<number | null> = { clickhouse: null, postgres: null };
    let bytesAt = Number.NEGATIVE_INFINITY;
    const sampler = new TimelineSampler(this.deps.meter, m0, t0, this.clock, timeline, (m) => {
      const now = this.clock.monoMs();
      if (now - bytesAt >= LIVE_BYTES_EVERY_MS) {
        bytesAt = now;
        void this.deps.stores.liveBytes(range).then(
          (b) => {
            bytes = b;
          },
          () => undefined,
        );
      }
      state.result = liveIngestResult({
        target,
        range,
        inflightCompress,
        published,
        base: m0,
        m,
        elapsedMs: now - t0,
        bytes,
        timeline,
      });
    });
    sampler.start();
    try {
      await state.runStep('publish', async () => {
        const bp = new BackpressureGate(this.deps.stores.thresholds());
        // 정확히 target행 — 꽉 찬 초는 10초씩 묶어 보내고, 남는 행은 마지막 초의 앞부분(시각 · 설비 · 태그 순)만
        const fullEnd = range.start + Math.floor(target / pps) * 1000;
        const rest = target - Math.floor(target / pps) * pps;
        let lastPatch = 0;
        const sent = async (chunk: { payloads: Buffer[]; points: number[] }, upTo: number) => {
          published += await this.publish(state, bp, chunk.payloads, chunk.points, counters);
          if (inflightCompress) compressor.offer(upTo);
          await this.pace(published, t0, state);
          const now = this.clock.monoMs();
          if (now - lastPatch >= 1000) {
            lastPatch = now;
            const live = sampler.last();
            state.patchDetail('publish', {
              published,
              rowsCh: live?.rows ?? null,
              rowsPg: live?.copyRows ?? null,
              backpressurePauses: counters.pauses,
              publishRetries: counters.retries,
              progress: Math.min(1, published / target),
              ...(inflightCompress ? { compressedDays: compressor.days } : {}),
            });
          }
          await this.yieldLoop();
        };
        for (let s = range.start; s < fullEnd; s += INGEST_CHUNK_SEC * 1000) {
          this.checkStop(state);
          const to = Math.min(fullEnd, s + INGEST_CHUNK_SEC * 1000);
          await sent(genChunk(devices, s, to, range.start), to);
        }
        if (rest > 0) {
          this.checkStop(state);
          await sent(genSecondCut(devices, fullEnd, range.start, rest), range.end);
        }
        return {
          published,
          backpressurePauses: counters.pauses,
          publishRetries: counters.retries,
          progress: 1,
        };
      });
      await state.runStep('drain', async () => {
        const d = await this.drain(
          state,
          startBacklog,
          async () => (await this.deps.stores.clickhouseRangeRows(range)) >= published,
        );
        doneAt = d.doneAt;
        return {
          drainMs: d.drainMs,
          timedOut: d.timedOut,
          ...(d.timedOut ? { warning: DRAIN_TIMEOUT_WARNING } : {}),
        };
      });
    } finally {
      sampler.stop();
      // 넣는 도중 압축이 아직 돌면 끝날 때까지 — 중단 · 실패여도 다음 실행이 같은 칸을 비우기 전에 끝나 있게
      await compressor.settled();
    }
    const elapsedMs = Math.round(doneAt - t0);
    const m1 = await this.deps.meter();
    await gate.off();

    await state.runStep('verify', async () => {
      const { rows, bytes, optimized, compressed } = await this.deps.stores.rangeStats(range);
      const ins = histDiff(m0.insert, m1.insert);
      const cp = histDiff(m0.copy, m1.copy);
      state.result = {
        part: 'ingest',
        target,
        rangeStart: iso(range.start),
        rangeEnd: iso(range.end),
        inflightCompress,
        rows: { published, clickhouse: rows.clickhouse, postgres: rows.postgres },
        elapsedMs,
        rowsPerSec: elapsedMs > 0 ? Math.round((published / elapsedMs) * 1000) : 0,
        batches: {
          count: ins.count,
          clickhouseMs: { p50: toMs(histQuantile(ins, 0.5)), p95: toMs(histQuantile(ins, 0.95)) },
          postgresMs: { p50: toMs(histQuantile(cp, 0.5)), p95: toMs(histQuantile(cp, 0.95)) },
          postgresFailures: m1.copyFailures - m0.copyFailures,
        },
        bytes: { clickhouse: bytes.clickhouse, postgres: bytes.postgres },
        timeline,
      };
      const warnings = [
        optimized ? null : OPTIMIZE_WARNING,
        compressed ? null : COMPRESS_WARNING,
        compressor.failures > 0 ? INFLIGHT_COMPRESS_WARNING : null,
      ].filter(Boolean);
      return {
        rowsMatch: rows.clickhouse === rows.postgres && rows.clickhouse === published && published === target,
        clickhouse: rows.clickhouse,
        postgres: rows.postgres,
        published,
        copyBatches: cp.count,
        optimized,
        compressed,
        ...(inflightCompress
          ? { compressedDays: compressor.days, compressFailures: compressor.failures }
          : {}),
        ...(warnings.length ? { warning: warnings.join(' · ') } : {}),
      };
    });
  }

  /** 발행 속도 상한(COMPARE_INGEST_MAX_PPS) — 상한이 없으면 그대로 */
  private async pace(published: number, t0: number, state: RunState): Promise<void> {
    if (COMPARE_INGEST_MAX_PPS === null) return;
    const due = t0 + (published / COMPARE_INGEST_MAX_PPS) * 1000;
    const wait = due - this.clock.monoMs();
    if (wait > 0) await this.clock.sleep(wait, state.stopSignal());
  }

  // ── ② 조회 대결

  /**
   * 원천 행 수 단계마다 — 준비(측정 밖)에서 ClickHouse 초별 행 수로 N번째 행이 든 초를 찾고 그 초의 행을 같은 순서로 읽어 자른 자리를 정한다.
   * 두 저장소는 같은 자른 자리로 같은 모양의 집계를 한다 — 집계 결과의 행 수 합이 N인지(원천 확보) · 칸마다 같은지(정합성)를 결과에 남긴다.
   * 넣은 데이터가 N행보다 적은 단계는 재지 않고 건너뛴다(단계 skipped · 결과 cut null).
   */
  private async query(state: RunState): Promise<void> {
    let range: TimeRange | null = null;
    let rows = 0;
    const cuts = new Map<number, CutRow | null>();
    await state.runStep('prepare', async () => {
      range = await this.comparableRange();
      // 넣은 원천 행 수(자를 수 있는 최대) · 단계마다 N번째 행이 든 초(ClickHouse 안에서 누적해 단계당 한 줄만 받는다)
      rows = await this.deps.stores.clickhouseRangeRows(range);
      const plan = await this.deps.stores.secondCuts(range, COMPARE_QUERY_SIZES);
      for (const n of COMPARE_QUERY_SIZES) {
        this.checkStop(state);
        const at = plan.get(n) ?? null;
        if (!at) {
          cuts.set(n, null);
          continue;
        }
        const cut = (await this.deps.stores.secondRows(at.sec))[at.rank - 1];
        if (!cut)
          throw new Error(
            `원천 ${compareSizeName(n)}번째 행을 찾지 못했어요 — 초별 행 수를 센 뒤 데이터가 바뀌었어요 · 다시 재 주세요`,
          );
        cuts.set(n, cut);
      }
      return {
        rangeStart: iso(range.start),
        rangeEnd: iso(range.end),
        clickhouse: rows,
        sizes: COMPARE_QUERY_SIZES.filter((n) => cuts.get(n)).length,
      };
    });
    const r = range as unknown as TimeRange;
    const sizes: Extract<CompareRunResultBody, { part: 'query' }>['sizes'] = [];
    const sync = () => {
      state.result = {
        part: 'query',
        rows,
        rangeStart: iso(r.start),
        rangeEnd: iso(r.end),
        sizes: [...sizes],
      };
    };
    const blank = { values: [], median: null, sourceRows: null, groups: null, checksum: null };
    for (const n of COMPARE_QUERY_SIZES) {
      const key = compareQueryStepKey(n);
      const cut = cuts.get(n) ?? null;
      this.checkStop(state);
      if (!cut) {
        state.skipStep(key, { reason: 'not_enough_rows', available: rows });
        sizes.push({
          target: n,
          cut: null,
          clickhouse: blank,
          postgres: blank,
          winner: null,
          ratio: null,
          match: null,
          mismatchGroups: null,
        });
        sync();
        continue;
      }
      await state.runStep(key, async () => {
        const slice = { start: r.start, cut };
        const opts = {
          stopped: () => state.stopRequested,
          onStop: () => new RunStopped(),
          clock: { monoMs: () => this.clock.monoMs() },
        };
        // 마지막 회의 결과로 두 저장소를 맞춘다(회마다 같은 원천 · 같은 답이어야 한다)
        let chRows: AggRow[] = [];
        let pgRows: AggRow[] = [];
        const ch = await measureReps(async () => {
          chRows = await this.deps.stores.sizeAgg('clickhouse', slice);
          return chRows.length;
        }, opts);
        const pg = await measureReps(async () => {
          pgRows = await this.deps.stores.sizeAgg('postgres', slice);
          return pgRows.length;
        }, opts);
        const cmp = compareAgg(chRows, pgRows);
        const chMed = medianOf(ch.values);
        const pgMed = medianOf(pg.values);
        const rep = (
          m: Awaited<ReturnType<typeof measureReps>>,
          med: number | null,
          s: 'clickhouse' | 'postgres',
        ) => ({
          values: m.values,
          median: med,
          sourceRows: cmp.stores[s].rows,
          groups: cmp.stores[s].groups,
          checksum: cmp.stores[s].checksum.toString(),
        });
        const entry = {
          target: n,
          cut: { ts: iso(cut.ts), deviceId: cut.deviceId, tagId: cut.tagId },
          clickhouse: rep(ch, chMed, 'clickhouse'),
          postgres: rep(pg, pgMed, 'postgres'),
          winner: unanimousWinner(
            { key: 'clickhouse' as const, values: ch.values },
            { key: 'postgres' as const, values: pg.values },
          ),
          ratio: speedRatio(chMed, pgMed),
          match: cmp.match,
          mismatchGroups: cmp.mismatchGroups,
        };
        sizes.push(entry);
        sync();
        return {
          sourceRows: { clickhouse: cmp.stores.clickhouse.rows, postgres: cmp.stores.postgres.rows },
          exact: cmp.stores.clickhouse.rows === n && cmp.stores.postgres.rows === n,
          match: cmp.match,
          winner: entry.winner,
          ratio: entry.ratio,
        };
      });
    }
    sync();
  }

  // ── ③ 데이터 정합성

  /**
   * 마지막 넣기 구간을 두 저장소에서 한 번씩 훑는다(각자 걸린 시간을 잰다) → 네 기준으로 맞춘다 · 읽기만 한다.
   * 재는 동안 결과를 저장소마다 채운다(ClickHouse 먼저) — 화면이 다 잰 쪽 칸부터 그린다. 판정은 두 저장소를 다 잰 뒤에만.
   */
  private async consistency(state: RunState): Promise<void> {
    let range: TimeRange | null = null;
    await state.runStep('prepare', async () => {
      range = await this.comparableRange('consistency');
      return { rangeStart: iso(range.start), rangeEnd: iso(range.end) };
    });
    const r = range as unknown as TimeRange;
    let result = consistencyStart(r);
    state.result = result;
    const groups: Record<'clickhouse' | 'postgres', GroupSum[]> = { clickhouse: [], postgres: [] };
    for (const store of ['clickhouse', 'postgres'] as const) {
      await state.runStep(store, async () => {
        const t0 = this.clock.monoMs();
        groups[store] = await this.deps.stores.consistencyGroups(store, r);
        const summary = storeSummary(groups[store], this.clock.monoMs() - t0);
        result = { ...result, [store]: summary };
        state.result = result;
        return { rows: summary.rows, groups: summary.groups, scanMs: summary.scanMs };
      });
      this.checkStop(state);
    }
    await state.runStep('compare', async () => {
      const diff = diffGroups(groups.clickhouse, groups.postgres);
      // 이름은 다른 곳이 있을 때만 읽는다(카드 라인 태그 129행)
      const labels =
        diff.any > 0 ? tagLabels(await this.deps.stores.cardTagRows()) : new Map<string, string>();
      result = consistencyVerdict(result, diff, labels);
      state.result = result;
      return { match: result.match, mismatchGroups: diff.aggregate, diffGroups: diff.any };
    });
  }
}

function medianOf(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/**
 * 넣는 도중 날 칸 압축 — 보낸 위치가 어떤 날 칸의 끝보다 하루 넘게 앞서면 그 칸은 다 들어갔다(대기줄 상한 20만 엔트리 ≈ 150만 행 ≪ 하루 약 2천만 행).
 * 한 번에 하나만 돈다(앞 압축이 끝나야 다음 범위를 건다) · 실패는 세고 넘어간다(남은 칸은 verify가 한꺼번에 압축한다).
 */
export class DayCompressor {
  /** 압축을 건 범위의 끝(UTC 자정 · 앞은 넣기 시작) */
  private until: number;
  private running: Promise<void> | null = null;
  /** 압축한 칸 수 · 실패 횟수 */
  days = 0;
  failures = 0;

  constructor(
    private readonly stores: Pick<CompareStores, 'compressDays'>,
    start: number,
  ) {
    this.until = start;
  }

  /** 보낸 위치(epoch ms) — 그 날 자정보다 하루 앞(그제까지)의 칸을 압축할 수 있다 */
  offer(sentUpTo: number): void {
    if (this.running) return;
    const ready = utcMidnight(sentUpTo) - DAY_MS;
    if (ready <= this.until) return;
    const r = { start: this.until, end: ready };
    this.until = ready;
    this.running = this.stores.compressDays(r).then(
      (n) => {
        this.days += n;
        this.running = null;
      },
      () => {
        this.failures += 1;
        this.running = null;
      },
    );
  }

  /** 도는 압축이 끝날 때까지 */
  async settled(): Promise<void> {
    while (this.running) await this.running;
  }
}

/** 게이트 켜 두기 — 켜면 GATE_REFRESH_MS마다 다시 쓴다(TTL 10초) · 켜고 끈 뒤 GATE_SETTLE_MS 기다린다(flusher 캐시) */
export class GateHolder {
  private timer: NodeJS.Timeout | null = null;
  private isOn = false;

  constructor(
    private readonly stores: Pick<CompareStores, 'setGate' | 'delGate'>,
    private readonly runId: string,
    private readonly clock: CompareClock,
  ) {}

  get active(): boolean {
    return this.isOn;
  }

  async on(): Promise<void> {
    if (!(await this.stores.setGate(this.runId)))
      throw new Error('게이트(cache:dual:active)를 켜지 못했다 — Redis 확인 뒤 다시');
    this.isOn = true;
    this.timer ??= setInterval(() => {
      void this.stores.setGate(this.runId).catch(() => false);
    }, GATE_REFRESH_MS);
    this.timer.unref?.();
    await this.clock.sleep(GATE_SETTLE_MS);
  }

  async off(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const was = this.isOn;
    this.isOn = false;
    await this.stores.delGate();
    if (was) await this.clock.sleep(GATE_SETTLE_MS);
  }
}

/** 넣는 중 크기를 다시 읽는 간격 — 파티션 크기 표만 읽어 가볍지만 표본(1초)보다 드물게 */
export const LIVE_BYTES_EVERY_MS = 2000;

export type TimelinePoint = Extract<CompareRunResultBody, { part: 'ingest' }>['timeline'][number];

/**
 * 넣는 중 결과(순수) — 계측 차분으로 지금까지의 행 수 · 배치 시간 · 속도를 낸다. 계약은 최종 결과와 같다.
 * 행 수는 Ingest가 각 DB에 넣은 수(ClickHouse 삽입 행 · PostgreSQL COPY 행)이고, 속도는 두 DB 중 적은 쪽 ÷ 경과라
 * 끝(다 들어간 순간)에는 최종 rowsPerSec(보낸 행 ÷ 다 들어가기까지)과 같아진다. 크기는 병합(OPTIMIZE) 전 값이다.
 */
export function liveIngestResult(a: {
  target: number;
  range: TimeRange;
  inflightCompress: boolean;
  published: number;
  base: CompareMeterSnapshot;
  m: CompareMeterSnapshot;
  elapsedMs: number;
  bytes: StorePair<number | null>;
  timeline: readonly TimelinePoint[];
}): Extract<CompareRunResultBody, { part: 'ingest' }> {
  const ins = histDiff(a.base.insert, a.m.insert);
  const cp = histDiff(a.base.copy, a.m.copy);
  const ch = a.m.rowsInserted - a.base.rowsInserted;
  const pg = a.m.copyRows - a.base.copyRows;
  const elapsedMs = Math.max(0, Math.round(a.elapsedMs));
  return {
    part: 'ingest',
    target: a.target,
    rangeStart: iso(a.range.start),
    rangeEnd: iso(a.range.end),
    inflightCompress: a.inflightCompress,
    rows: { published: a.published, clickhouse: ch, postgres: pg },
    elapsedMs,
    rowsPerSec: elapsedMs > 0 ? Math.round((Math.min(ch, pg) / elapsedMs) * 1000) : 0,
    batches: {
      count: ins.count,
      clickhouseMs: { p50: toMs(histQuantile(ins, 0.5)), p95: toMs(histQuantile(ins, 0.95)) },
      postgresMs: { p50: toMs(histQuantile(cp, 0.5)), p95: toMs(histQuantile(cp, 0.95)) },
      postgresFailures: a.m.copyFailures - a.base.copyFailures,
    },
    bytes: { clickhouse: a.bytes.clickhouse, postgres: a.bytes.postgres },
    timeline: a.timeline.map((p) => ({ ...p })),
  };
}

/** 초 단위 진행 — 1초마다 계측을 읽어 그 초에 끝난 배치의 평균 시간 · 누적 행을 남긴다(sum · count 차) */
export class TimelineSampler {
  private timer: NodeJS.Timeout | null = null;
  /** stop 뒤에 끝난 표본은 버린다 — 늦게 온 표본이 verify의 최종 결과를 덮지 않게 */
  private stopped = false;
  private prev: CompareMeterSnapshot;
  private latest: { rows: number; copyRows: number } | null = null;
  private busy = false;

  constructor(
    private readonly meter: () => Promise<CompareMeterSnapshot>,
    private readonly base: CompareMeterSnapshot,
    private readonly t0: number,
    private readonly clock: CompareClock,
    private readonly out: TimelinePoint[],
    /** 표본을 남길 때마다(넣는 중 결과 갱신) */
    private readonly onSample?: (m: CompareMeterSnapshot) => void,
  ) {
    this.prev = base;
  }

  start(): void {
    this.timer = setInterval(() => void this.sample(), 1000);
    this.timer.unref?.();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  last(): { rows: number; copyRows: number } | null {
    return this.latest;
  }

  async sample(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const m = await this.meter();
      if (this.stopped) return;
      const avg = (a: { sum: number; count: number }, b: { sum: number; count: number }) =>
        b.count > a.count ? Math.round(((b.sum - a.sum) / (b.count - a.count)) * 100_000) / 100 : null;
      const rows = m.rowsInserted - this.base.rowsInserted;
      this.out.push({
        tSec: Math.round((this.clock.monoMs() - this.t0) / 100) / 10,
        clickhouseMs: avg(this.prev.insert, m.insert),
        postgresMs: avg(this.prev.copy, m.copy),
        rows,
      });
      this.latest = { rows, copyRows: m.copyRows - this.base.copyRows };
      this.prev = m;
      this.onSample?.(m);
    } catch {
      // 계측 읽기 실패는 그 초를 건너뛴다
    } finally {
      this.busy = false;
    }
  }
}
