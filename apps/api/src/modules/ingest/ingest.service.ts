// F-02 적재 — 기전 정본 docs/06_pipeline/03_ingest_batch.md(ADR-09: 읽기와 삽입을 가른다)
// ① 기동: XGROUP CREATE MKSTREAM · rt:latest 기동 복원 ② 소비: XREADGROUP ③ 디코딩: piscina 워커 ④ fan-in: 창 버퍼
// ⑤ 배치 확정: 창이 닫히면 ID 순 ⑥ 삽입: INSERT plc.tag_raw ⑦ 실패: 같은 배치 재시도 ⑧ 성공 후속: XACK → 최신값 조건부 쓰기 · ch:rt
// S2 범위(ING-01 · 02 · 03 · 08): 컨슈머 1 · 시간 트리거 · 멱등 토큰 없음(S3 SW-08) · DLQ 없음(S3) · XAUTOCLAIM 없음(S3).
import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { RedisConnections } from '../../common/redis/connections';
import { DurableKeyClient, type LatestTuple } from '../../common/redis/durable-key-client';
import { FanoutPublisher } from '../../common/redis/fanout-publisher';
import type { DecodeResult } from '../../common/workers/tasks';
import { WorkerPool } from '../../common/workers/worker-pool';
import { ingestMetrics as m } from './ingest.metrics';
import {
  type BatchEntry,
  type ClosedWindow,
  idMsOf,
  rowsOf,
  TAG_RAW_COLUMNS,
  WindowBuffer,
} from './window-buffer';

export const STREAM_RAW = 'stream:plc:raw';
export const GROUP_INGEST = 'grp:ingest';
/** S2 컨슈머 1의 고정 이름 — 다중 컨슈머 · XAUTOCLAIM은 S3 */
export const INGEST_CONSUMER = 'ingest-1';
/** 종료 드레인 상한 — 컨테이너 정지 유예(compose stop -t)보다 작게 */
const SHUTDOWN_DRAIN_MS = 5000;
/** XREADGROUP COUNT 현행 참고 100(06_pipeline/03 §소진 모드 표의 정상 열) */
const READ_COUNT = 100;
/** BLOCK — 저부하 창 닫힘(ⓑ)이 늦지 않게 창 폭보다 짧게 둔다(S2 판정 · 조정값 아님) */
const READ_BLOCK_MS = 200;
/** flusher 보유 상한 — 창 버퍼(닫혀 대기) 1 + 삽입 중 1(06_pipeline/03 §행 수 상한과 flusher 메모리 · 판정 인계 2칸은 S7) */
const FLUSHER_MAX_BATCHES = 2;
/** 삽입 실패 재시도 간격 — S2 판정: 고정 간격 · 무한(지수 백오프 · 소진 · DLQ는 S3 ING-05) */
const INSERT_RETRY_MS = 1000;
/** 기동 복원 창 — 빈 키 복원과 같은 값 · 현행 참고 10분(소유 06_pipeline/05 §기동 복원과 복원 창) */
export const RESTORE_WINDOW_MINUTES = 10;
/** consumer_lag 갱신 주기 — S2 판정 1초(스크레이프 때 저장소를 조회하지 않는다 · 07_api/10 #2) */
const LAG_POLL_MS = 1000;

@Injectable()
export class IngestService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly log = new Logger('IngestService');
  /**
   * 컨슈머 이름 고정 — S2는 컨슈머 1이고 XAUTOCLAIM(다중 컨슈머 · S3)이 없다. 컨테이너를 다시 만들 때마다 이름이 바뀌면
   * 이전 이름의 PEL을 영구히 회수하지 못해 consumer_lag(lag + pending)가 0으로 돌아오지 않는다.
   */
  private readonly consumer = INGEST_CONSUMER;
  /** 기동 시 자기 PEL부터 다시 읽는다 — 비정상 종료가 남긴 미확인 엔트리 회수(null이면 새 엔트리만) */
  private pendingCursor: string | null = '0';
  private readonly buffer = new WindowBuffer();
  private readonly queue: ClosedWindow[] = [];
  private blocking: Redis | null = null;
  private running = false;
  /** 종료 중 남은 창을 큐에 다 넣었다 — flusher는 큐가 빌 때까지 돌고 끝난다 */
  private drained = false;
  private consumeLoop: Promise<void> | null = null;
  private flushLoop: Promise<void> | null = null;
  private flushing = 0;
  private wakeFlusher: (() => void) | null = null;
  private lagTimer: NodeJS.Timeout | null = null;
  private lastLag = 0;

  constructor(
    private readonly conns: RedisConnections,
    private readonly durable: DurableKeyClient,
    private readonly fanout: FanoutPublisher,
    private readonly ch: ClickHouse,
    private readonly workers: WorkerPool,
  ) {}

  async onApplicationBootstrap() {
    await this.conns.ready();
    await this.durable.ensureGroup(STREAM_RAW, GROUP_INGEST);
    await this.restoreLatest();
    this.blocking = this.conns.blockingConnection(`ingest-consumer-1`);
    this.running = true;
    this.consumeLoop = this.consume();
    this.flushLoop = this.flush();
    this.lagTimer = setInterval(() => void this.pollLag(), LAG_POLL_MS);
    this.log.log(`컨슈머 ${this.consumer} 기동 — ${STREAM_RAW} · ${GROUP_INGEST}`);
  }

  /**
   * 종료: 읽기를 멈추고 남은 창을 전부 닫아 삽입 · XACK까지 끝낸다 — 받은 엔트리를 PEL에 남기지 않는다.
   * Nest 종료 순서는 onModuleDestroy → beforeApplicationShutdown → onApplicationShutdown이다 — 드레인은 가운데서 하고
   * 저장소 연결 · 워커 풀은 마지막(onApplicationShutdown)에 닫힌다. 수집(Collector)은 onModuleDestroy에서 먼저 멈춘다.
   */
  async beforeApplicationShutdown() {
    this.running = false;
    if (this.lagTimer) clearInterval(this.lagTimer);
    await this.consumeLoop;
    // 마지막 읽기 뒤에 XADD된 엔트리까지 받는다 — 수집은 이미 멈췄으므로 빈 응답이 나올 때까지 읽으면 lag가 0이 된다
    // (상한 SHUTDOWN_DRAIN_MS — 다른 프로세스가 계속 발행하는 구성에서 종료가 끝나지 않는 것을 막는다)
    const until = Date.now() + SHUTDOWN_DRAIN_MS;
    while (Date.now() < until) {
      const n = await this.step(1);
      if (n === 0) break;
    }
    this.queue.push(...this.buffer.drainAll());
    this.drained = true;
    this.wakeFlusher?.();
    await this.flushLoop;
  }

  /** ② ③ ④ — 읽기 · 디코딩 · 인계. 삽입을 모른다 */
  private async consume(): Promise<void> {
    while (this.running) {
      if (this.queue.length + this.flushing >= FLUSHER_MAX_BATCHES) {
        // flusher가 차면 읽기를 멈춘다 — 적체를 프로세스 메모리가 아니라 Stream(lag)에 둔다
        const t0 = performance.now();
        await sleep(20);
        m.consumerPaused.inc((performance.now() - t0) / 1000);
        continue;
      }
      await this.step(READ_BLOCK_MS);
    }
  }

  /** 읽기 한 번 — 받은 엔트리 수(PEL 끝 · 읽기 실패는 -1) */
  private async step(blockMs: number): Promise<number> {
    let records: { id: string; payload: Buffer }[] = [];
    const readStartAt = Date.now();
    const late = this.buffer.lateEntries;
    const fromPel = this.pendingCursor !== null;
    try {
      records = await this.durable.readGroup(
        this.blocking as Redis,
        STREAM_RAW,
        GROUP_INGEST,
        this.consumer,
        READ_COUNT,
        blockMs,
        this.pendingCursor ?? '>',
      );
    } catch (e) {
      this.log.warn(`XREADGROUP 실패 — ${(e as Error).message} · 재시도`);
      await sleep(500);
      return -1;
    }
    if (fromPel) {
      if (records.length === 0) {
        this.pendingCursor = null;
        return -1;
      }
      this.pendingCursor = records[records.length - 1]?.id ?? null;
      this.log.warn(`PEL 회수 — 이전 종료가 남긴 미확인 엔트리 ${records.length}건을 다시 처리한다`);
    }
    const receivedAt = Date.now();
    if (records.length > 0) {
      const decoded = await this.workers.run<DecodeResult>(
        { payloads: records.map((r) => r.payload) },
        'decode',
      );
      const decodedAt = Date.now();
      m.decode.observe((decodedAt - receivedAt) / 1000);
      const undecodable: string[] = [];
      records.forEach((r, i) => {
        const idMs = idMsOf(r.id);
        m.residence.observe(Math.max(0, receivedAt - idMs) / 1000);
        const d = decoded.entries[i];
        if (d?.ok) {
          if (d.negativeDt > 0) m.negativeDt.inc(d.negativeDt);
          this.buffer.add({ id: r.id, idMs, decodedAt, entry: d } satisfies BatchEntry);
        } else {
          this.buffer.advance(idMs);
          undecodable.push(r.id);
          this.log.error(
            `해독 불가 엔트리 ${r.id} — ${d && !d.ok ? d.reason : 'unknown'} · S2는 DLQ가 없어 XACK만 한다`,
          );
        }
      });
      // S2 한계: 해독 불가 엔트리는 격리할 DLQ가 없다(S3 ING-05) — PEL에 영구 잔류해 랙이 0으로 돌아오지 않는 것을 막으려 XACK한다
      if (undecodable.length) await this.durable.ack(STREAM_RAW, GROUP_INGEST, undecodable);
    }
    const closed = this.buffer.takeClosable(readStartAt, !fromPel && records.length < READ_COUNT);
    if (this.buffer.lateEntries > late)
      this.log.warn(`닫힌 창 뒤 도착 엔트리 누계 ${this.buffer.lateEntries} — 다음 창으로 넘겼다`);
    if (closed.length) {
      this.queue.push(...closed);
      this.wakeFlusher?.();
    }
    return records.length;
  }

  /** ⑤~⑧ — 단일 flusher: 창 순서대로 삽입 · XACK · 최신값 */
  private async flush(): Promise<void> {
    while (!this.drained || this.queue.length > 0) {
      const w = this.queue.shift();
      if (!w) {
        await new Promise<void>((r) => {
          this.wakeFlusher = r;
          setTimeout(r, 200);
        });
        continue;
      }
      this.flushing = 1;
      try {
        await this.flushWindow(w);
      } finally {
        this.flushing = 0;
      }
    }
  }

  private async flushWindow(w: ClosedWindow): Promise<void> {
    const startAt = Date.now();
    for (const e of w.entries) m.fanin.observe(Math.max(0, startAt - e.decodedAt) / 1000);
    const rows = rowsOf(w);
    if (rows.length > 0) {
      for (let attempt = 1; ; attempt++) {
        const endTimer = m.insertDuration.startTimer();
        try {
          await this.ch.client.insert({
            table: 'tag_raw',
            values: rows,
            format: 'JSONCompactEachRow',
            columns: [...TAG_RAW_COLUMNS] as [string, ...string[]],
          });
          endTimer();
          break;
        } catch (e) {
          endTimer();
          this.log.warn(
            `INSERT 실패(시도 ${attempt}) — ${(e as Error).message} · ${INSERT_RETRY_MS} ms 뒤 같은 배치 재시도`,
          );
          m.insertRetries.inc();
          await sleep(INSERT_RETRY_MS);
        }
      }
      m.rowsInserted.inc(rows.length);
      m.batchSize.observe(rows.length);
    }
    // XACK는 삽입 성공 뒤에만(REQ-GLB-05) — 실패하면 PEL에 남아 재기동 뒤 회수 대상이 된다(회수는 S3)
    try {
      await this.durable.ack(
        STREAM_RAW,
        GROUP_INGEST,
        w.entries.map((e) => e.id),
      );
    } catch (e) {
      this.log.error(`XACK 실패 — ${(e as Error).message} · 엔트리는 PEL에 남는다`);
      return; // 확인되지 않은 값으로 최신값을 세우지 않는다(REQ-ING-07)
    }
    await this.writeLatest(w);
  }

  /** ING-08 — XACK 뒤 설비별 조건부 쓰기 → 받아들인 필드만 ch:rt 발행 */
  private async writeLatest(w: ClosedWindow): Promise<void> {
    const byDevice = new Map<number, Map<number, LatestTuple>>();
    for (const { entry: e } of w.entries) {
      let tags = byDevice.get(e.d);
      if (!tags) {
        tags = new Map();
        byDevice.set(e.d, tags);
      }
      for (let i = 0; i < e.tg.length; i++) {
        const tag = e.tg[i] as number;
        const ts = e.t0 + (e.dt[i] ?? 0);
        const prev = tags.get(tag);
        if (!prev || ts >= prev[1]) tags.set(tag, [tag, ts, e.va[i] ?? 0, e.q[i] ?? 0]);
      }
    }
    for (const [deviceId, tags] of byDevice) {
      try {
        const accepted = await this.durable.writeLatestIfNewer(deviceId, [...tags.values()]);
        m.latestUpdates.inc({ writer: 'ingest' }, accepted.length);
        await this.fanout.publishRt(deviceId, accepted);
      } catch (e) {
        // 최신값만 멈춘다 — 적재는 이미 확정됐다(06_pipeline/02 §발행 · 적체 조회 표의 rt:latest 행과 같은 결)
        this.log.warn(`rt:latest 쓰기 실패 — 설비 ${deviceId} · ${(e as Error).message}`);
      }
    }
  }

  /** 기동 복원 — 최근 창 argMax 1회 · 조건부 쓰기라 보존된 새 값을 덮지 않는다(06_pipeline/05 §기동 복원과 복원 창) */
  private async restoreLatest(): Promise<void> {
    try {
      const rs = await this.ch.client.query({
        query: `SELECT device_id, tag_id, toUnixTimestamp64Milli(max(ts)) AS ts_ms,
                       argMax(value, ts) AS last_value, argMax(quality, ts) AS last_quality
                  FROM plc.tag_raw
                 WHERE ts >= now64(3) - INTERVAL {minutes:UInt32} MINUTE
                 GROUP BY device_id, tag_id`,
        query_params: { minutes: RESTORE_WINDOW_MINUTES },
        format: 'JSONEachRow',
      });
      const rows = await rs.json<{
        device_id: number;
        tag_id: number;
        ts_ms: string;
        last_value: number;
        last_quality: number;
      }>();
      const byDevice = new Map<number, LatestTuple[]>();
      for (const r of rows) {
        const list = byDevice.get(Number(r.device_id)) ?? [];
        list.push([Number(r.tag_id), Number(r.ts_ms), Number(r.last_value), Number(r.last_quality)]);
        byDevice.set(Number(r.device_id), list);
      }
      for (const [d, tuples] of byDevice) await this.durable.writeLatestIfNewer(d, tuples);
      this.log.log(
        `기동 복원 — 설비 ${byDevice.size} · 태그 ${rows.length}(최근 ${RESTORE_WINDOW_MINUTES}분)`,
      );
    } catch (e) {
      // 복원 실패는 기동을 막지 않는다 — 다음 적재가 최신값을 채운다
      this.log.warn(`기동 복원 실패 — ${(e as Error).message}`);
    }
  }

  /** consumer_lag = lag + pending(01_metrics §컨슈머 랙 판정) · lag가 비면 직전 값 유지 + unknown 1 */
  private async pollLag(): Promise<void> {
    try {
      const b = await this.durable.groupBacklog(STREAM_RAW, GROUP_INGEST);
      if (!b) return;
      m.groupPending.set(b.pending);
      if (b.lag === null) {
        m.lagUnknown.set(1);
        m.consumerLag.set(this.lastLag);
        return;
      }
      m.lagUnknown.set(0);
      m.groupLag.set(b.lag);
      this.lastLag = b.lag + b.pending;
      m.consumerLag.set(this.lastLag);
    } catch {
      // Redis 불가 — 게이지는 마지막 값을 유지한다
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
