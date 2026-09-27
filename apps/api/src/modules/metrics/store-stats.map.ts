// 저장소 수집 결과 → 게이지 매핑 · 계열별 실패 격리 · 트리밍 결함 검출(순수 로직 — 저장소 호출은 store-stats.service.ts)
// 정본: docs/10_observability/01_metrics_catalog.md §저장소 · 02_instrumentation.md §수집 방식 · §트리밍 결함 검출
import { cmpId } from '../ingest/window-buffer';
import {
  chMetrics,
  clearMetric,
  mirrorCounter,
  obsCollectMetrics,
  pgMetrics,
  redisMetrics,
  replaceGauge,
  type StoreName,
} from './store.metrics';

// ─────────────────────────── 계열별 실패 격리 ───────────────────────────

/** 수집 계열 하나 — 조회(fetch) → 반영(apply) · 실패하면 그 계열만 비운다(clear) */
export interface SeriesGroup<T = unknown> {
  name: string;
  fetch: () => Promise<T>;
  apply: (v: T) => void;
  clear: () => void;
}

/** 계열의 값 타입을 지운다 — 한 저장소의 계열들은 값 타입이 서로 다르다 */
export function series<T>(g: SeriesGroup<T>): SeriesGroup {
  return g as unknown as SeriesGroup;
}

export interface StoreRunResult {
  store: StoreName;
  ok: string[];
  failed: { name: string; error: string }[];
}

/**
 * 한 저장소의 계열들을 병렬로 모은다. 실패한 계열만 비우고 obs_collect_errors_total{store}를 계열마다 1 올린다(REQ-OBS-03).
 * obs_collect_last_success_timestamp_seconds는 그 저장소의 모든 계열이 성공한 수집에서만 갱신한다 — 표시값의 나이가 거짓이 되지 않게.
 */
export async function runStoreCollection(
  store: StoreName,
  groups: ReadonlyArray<SeriesGroup>,
  now: () => number = Date.now,
): Promise<StoreRunResult> {
  const t0 = performance.now();
  const result: StoreRunResult = { store, ok: [], failed: [] };
  await Promise.all(
    groups.map(async (g) => {
      try {
        g.apply(await g.fetch());
        result.ok.push(g.name);
      } catch (e) {
        g.clear();
        obsCollectMetrics.errors.inc({ store });
        // 원문 메시지는 로그에만 — 메트릭 레이블에 싣지 않는다(닫힌 집합)
        result.failed.push({ name: g.name, error: e instanceof Error ? e.message : String(e) });
      }
    }),
  );
  obsCollectMetrics.duration.observe({ store }, (performance.now() - t0) / 1000);
  if (result.failed.length === 0) obsCollectMetrics.lastSuccess.set({ store }, now() / 1000);
  return result;
}

// ─────────────────────────── Redis ───────────────────────────

/** INFO 텍스트 → 키/값 — 섹션 머리(#)와 빈 줄은 건너뛴다 */
export function parseRedisInfo(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

function num(v: string | undefined): number {
  return v === undefined || v === '' ? Number.NaN : Number(v);
}

/** INFO memory · stats · clients → Redis 서버 계열 8이름 */
export function applyRedisInfo(info: Record<string, string>): void {
  const need = ['used_memory', 'maxmemory', 'evicted_keys', 'keyspace_hits', 'keyspace_misses'];
  for (const k of need) {
    if (!Number.isFinite(num(info[k]))) throw new Error(`INFO에 ${k}가 없다`);
  }
  redisMetrics.usedMemory.set(num(info.used_memory));
  redisMetrics.maxMemory.set(num(info.maxmemory));
  const frag = num(info.mem_fragmentation_ratio);
  if (Number.isFinite(frag)) redisMetrics.fragmentation.set(frag);
  else clearMetric(redisMetrics.fragmentation);
  mirrorCounter(redisMetrics.evicted, [[{}, num(info.evicted_keys)]]);
  mirrorCounter(redisMetrics.hits, [[{}, num(info.keyspace_hits)]]);
  mirrorCounter(redisMetrics.misses, [[{}, num(info.keyspace_misses)]]);
  const ops = num(info.instantaneous_ops_per_sec);
  if (Number.isFinite(ops)) redisMetrics.opsPerSec.set(ops);
  else clearMetric(redisMetrics.opsPerSec);
  // 일반 클라이언트(Pub/Sub 구독 연결 포함) 버퍼 합 — INFO memory mem_clients_normal(질의 버퍼 · 클라이언트 구조체 포함 근사)
  const cob = num(info.mem_clients_normal);
  if (Number.isFinite(cob)) redisMetrics.clientOutputBuffer.set(cob);
  else clearMetric(redisMetrics.clientOutputBuffer);
}

export function clearRedisInfo(): void {
  for (const m of [
    redisMetrics.usedMemory,
    redisMetrics.maxMemory,
    redisMetrics.fragmentation,
    redisMetrics.evicted,
    redisMetrics.hits,
    redisMetrics.misses,
    redisMetrics.opsPerSec,
    redisMetrics.clientOutputBuffer,
  ]) {
    clearMetric(m);
  }
}

/** XINFO STREAM · XINFO GROUPS의 평탄 배열 응답 → Map */
export function flatToMap(reply: unknown): Map<string, unknown> {
  const m = new Map<string, unknown>();
  if (!Array.isArray(reply)) return m;
  for (let i = 0; i + 1 < reply.length; i += 2) m.set(String(reply[i]), reply[i + 1]);
  return m;
}

/** stream 레이블 값 — 05_data_stores/05의 stream 키 2(raw · dlq) */
export type StreamLabel = 'raw' | 'dlq' | 'biz';

export interface StreamStat {
  stream: StreamLabel;
  /** 키가 없으면 null — XLEN 0 · entries-added 없음 */
  length: number;
  entriesAdded: number | null;
}

/** XINFO STREAM 응답 → 길이 · 누적 XADD · 첫 엔트리 ID · 최대 삭제 ID */
export function parseXinfoStream(reply: unknown): {
  length: number;
  entriesAdded: number | null;
  firstId: string | null;
  maxDeletedId: string | null;
} {
  const m = flatToMap(reply);
  const first = m.get('first-entry');
  const firstId = Array.isArray(first) && first.length > 0 ? String(first[0]) : null;
  const recorded = m.get('recorded-first-entry-id');
  const ea = m.get('entries-added');
  const md = m.get('max-deleted-entry-id');
  return {
    length: Number(m.get('length') ?? 0),
    entriesAdded: ea === undefined || ea === null ? null : Number(ea),
    firstId: firstId ?? (recorded && String(recorded) !== '0-0' ? String(recorded) : null),
    maxDeletedId: md === undefined || md === null || String(md) === '0-0' ? null : String(md),
  };
}

export function applyStreamStats(stats: readonly StreamStat[]): void {
  replaceGauge(
    redisMetrics.streamLength,
    stats.map((s) => [{ stream: s.stream }, s.length] as const),
  );
  mirrorCounter(
    redisMetrics.entriesAdded,
    stats
      .filter((s) => s.entriesAdded !== null)
      .map((s) => [{ stream: s.stream }, s.entriesAdded ?? 0] as const),
  );
}

export function clearStreamStats(): void {
  clearMetric(redisMetrics.streamLength);
  clearMetric(redisMetrics.entriesAdded);
}

// ─────────────────────────── 트리밍 결함 검출 ───────────────────────────

/**
 * 한 수집 주기의 관측 — 02_instrumentation §트리밍 결함 검출
 * F = 스트림 첫 엔트리 ID · P = PEL 최소 ID(XPENDING 요약) · D = 그룹 마지막 배달 ID · M = 스트림 최대 삭제 ID(max-deleted-entry-id)
 */
export interface TrimObservation {
  firstId: string | null;
  pendingMinId: string | null;
  lastDeliveredId: string | null;
  maxDeletedId: string | null;
}

/** XPENDING 범위 조회 인자 — start는 '(' 접두면 배타 */
export interface PelRange {
  start: string;
  end: string;
  count: number;
}

export const PEL_SCAN_LIMIT = 1000;

/**
 * 트리밍 결함 검출기 — 상태: 이미 센 PEL ID 상한 · 직전 주기의 미배달 사건 여부.
 * ① P < F: PEL에 있는 엔트리가 잘렸다 — XPENDING [P, F) 개수만큼 증가(정확). 잘린 PEL 항목은 XACK · 회수 전까지 PEL에 남으므로
 *    이미 센 ID 다음부터만 센다(중복 계수 방지).
 * ② D < F 이고 D 다음 엔트리가 존재했다(M > D): 미배달 엔트리가 잘렸다 — 사건 1 증가(개수는 잘린 뒤라 셀 수 없다).
 *    조건이 이어지는 동안은 한 사건이다 — 조건이 거짓이 됐다가 다시 참이 될 때 새 사건으로 센다.
 * ③ 그 밖은 정상 — 확인된 엔트리만 잘렸다.
 */
export class TrimDetector {
  private countedUpTo: string | null = null;
  private undeliveredOpen = false;

  /** ①의 조회 범위 — 필요 없으면 null */
  pelRange(o: TrimObservation): PelRange | null {
    if (!o.firstId || !o.pendingMinId) return null;
    if (cmpId(o.pendingMinId, o.firstId) >= 0) return null;
    const from =
      this.countedUpTo && cmpId(this.countedUpTo, o.pendingMinId) >= 0
        ? `(${this.countedUpTo}`
        : o.pendingMinId;
    if (this.countedUpTo && cmpId(this.countedUpTo, o.firstId) >= 0) return null;
    return { start: from, end: `(${o.firstId}`, count: PEL_SCAN_LIMIT };
  }

  /** 관측 + ①의 조회 결과(범위 안 PEL ID) → 이번 주기 증가분 */
  step(o: TrimObservation, pelIdsBelowFirst: readonly string[] = []): { pel: number; undelivered: number } {
    let pel = 0;
    if (o.firstId) {
      for (const id of pelIdsBelowFirst) {
        if (cmpId(id, o.firstId) >= 0) continue;
        if (this.countedUpTo && cmpId(id, this.countedUpTo) <= 0) continue;
        pel += 1;
        if (!this.countedUpTo || cmpId(id, this.countedUpTo) > 0) this.countedUpTo = id;
      }
    }
    const cond =
      !!o.firstId &&
      !!o.lastDeliveredId &&
      !!o.maxDeletedId &&
      cmpId(o.lastDeliveredId, o.firstId) < 0 &&
      cmpId(o.maxDeletedId, o.lastDeliveredId) > 0;
    const undelivered = cond && !this.undeliveredOpen ? 1 : 0;
    this.undeliveredOpen = cond;
    // 0이어도 inc — 검출이 한 번이라도 돈 역할에서만 계열이 나타난다(수집하지 않는 역할의 0은 거짓이다)
    redisMetrics.trimmedUnacked.inc(pel + undelivered);
    return { pel, undelivered };
  }
}

/** XPENDING 요약 응답 [count, min, max, consumers] → 최소 미확인 ID */
export function parsePendingSummary(reply: unknown): string | null {
  if (!Array.isArray(reply)) return null;
  const [count, min] = reply as [unknown, unknown];
  if (!count || Number(count) === 0 || min === null || min === undefined) return null;
  return String(min);
}

/** XPENDING 범위 응답 [[id, consumer, idle, deliveries], …] → ID 목록 */
export function parsePendingRange(reply: unknown): string[] {
  if (!Array.isArray(reply)) return [];
  return (reply as unknown[]).map((r) => (Array.isArray(r) ? String(r[0]) : '')).filter(Boolean);
}

/** XINFO GROUPS 응답 → 그 그룹의 last-delivered-id */
export function lastDeliveredOf(reply: unknown, group: string): string | null {
  if (!Array.isArray(reply)) return null;
  for (const g of reply as unknown[]) {
    const m = flatToMap(g);
    if (m.get('name') === group) {
      const d = m.get('last-delivered-id');
      return d === undefined || d === null ? null : String(d);
    }
  }
  return null;
}

// ─────────────────────────── PostgreSQL ───────────────────────────

/** 고정 기준 PostgreSQL 테이블 16(루트 README · biz_command_log — D-04 부분 개정) — table 레이블의 닫힌 집합 · 파티션은 부모 이름으로 합산 */
export const PG_TABLES = [
  'site',
  'production_line',
  'device',
  'modbus_config',
  'tag_master',
  'tag_master_history',
  'alarm_rule',
  'alarm_event',
  'user_account',
  'role',
  'user_role',
  'work_order',
  'production_log',
  'audit_log',
  'plc_tag_raw_control',
  'biz_command_log',
] as const;

export interface PgDatabaseRow {
  xact_commit: string | number;
  blks_hit: string | number;
  blks_read: string | number;
}

export function applyPgDatabase(r: PgDatabaseRow | undefined): void {
  if (!r) throw new Error('pg_stat_database에 현재 DB 행이 없다');
  mirrorCounter(pgMetrics.xactCommit, [[{}, Number(r.xact_commit)]]);
  const hit = Number(r.blks_hit);
  const read = Number(r.blks_read);
  // 읽은 블록이 0이면 비율이 정의되지 않는다 — 0이나 1로 채우지 않고 비운다
  if (hit + read > 0) pgMetrics.bufferHitRatio.set(hit / (hit + read));
  else clearMetric(pgMetrics.bufferHitRatio);
}

export function clearPgDatabase(): void {
  clearMetric(pgMetrics.xactCommit);
  clearMetric(pgMetrics.bufferHitRatio);
}

/** pg_stat_activity.state 닫힌 집합 — 권한 밖 세션은 state가 NULL이라 unknown으로 센다 */
export const PG_CONN_STATES = [
  'active',
  'idle',
  'idle in transaction',
  'idle in transaction (aborted)',
  'fastpath function call',
  'disabled',
  'unknown',
] as const;

export function applyPgConnections(rows: readonly { state: string | null; n: string | number }[]): void {
  const by = new Map<string, number>(PG_CONN_STATES.map((s) => [s, 0]));
  for (const r of rows) {
    const s = r.state && by.has(r.state) ? r.state : 'unknown';
    by.set(s, (by.get(s) ?? 0) + Number(r.n));
  }
  replaceGauge(
    pgMetrics.connections,
    [...by].map(([state, n]) => [{ state }, n] as const),
  );
}

export function applyPgLockWaits(r: { n: string | number } | undefined): void {
  pgMetrics.lockWaits.set(Number(r?.n ?? 0));
}

export const PG_TOP_STATEMENTS = 10;

/** 상위 10 문형 — rank(1~10) · queryid만 싣고 문형 텍스트는 싣지 않는다(REQ-OBS-10) · mean_exec_time은 ms */
export function applyPgTopStatements(rows: readonly { queryid: string; mean_ms: string | number }[]): void {
  replaceGauge(
    pgMetrics.statementTopMean,
    rows
      .slice(0, PG_TOP_STATEMENTS)
      .map(
        (r, i) => [{ rank: String(i + 1), queryid: String(r.queryid) }, Number(r.mean_ms) / 1000] as const,
      ),
  );
}

export interface PgTableRow {
  table: string;
  live: string | number;
  dead: string | number;
  autovac: string | number;
  heap: string | number;
  idx: string | number;
}

export function applyPgTables(rows: readonly PgTableRow[]): void {
  const known = rows.filter((r) => (PG_TABLES as readonly string[]).includes(r.table));
  replaceGauge(
    pgMetrics.liveTuples,
    known.map((r) => [{ table: r.table }, Number(r.live)] as const),
  );
  replaceGauge(
    pgMetrics.deadTuples,
    known.map((r) => [{ table: r.table }, Number(r.dead)] as const),
  );
  mirrorCounter(
    pgMetrics.autovacuum,
    known.map((r) => [{ table: r.table }, Number(r.autovac)] as const),
  );
  replaceGauge(
    pgMetrics.relationSize,
    known.flatMap((r) => [
      [{ table: r.table, kind: 'heap' }, Number(r.heap)] as const,
      [{ table: r.table, kind: 'index' }, Number(r.idx)] as const,
    ]),
  );
}

export function clearPgTables(): void {
  clearMetric(pgMetrics.liveTuples);
  clearMetric(pgMetrics.deadTuples);
  clearMetric(pgMetrics.autovacuum);
  clearMetric(pgMetrics.relationSize);
}

export function applyPgWal(r: { wal_bytes: string | number } | undefined): void {
  if (!r) throw new Error('pg_stat_wal 행이 없다');
  mirrorCounter(pgMetrics.walBytes, [[{}, Number(r.wal_bytes)]]);
}

// ─────────────────────────── ClickHouse ───────────────────────────

/** 고정 기준 ClickHouse 테이블 5 — table 레이블의 닫힌 집합(MV · Dictionary는 파트가 없다) */
export const CH_TABLES = ['tag_raw', 'alarm_eval', 'tag_1m', 'tag_1h', 'tag_1d'] as const;

function knownCh<T extends { table: string }>(rows: readonly T[]): T[] {
  return rows.filter((r) => (CH_TABLES as readonly string[]).includes(r.table));
}

export function applyChServerCounters(
  metrics: readonly { metric: string; value: string | number }[],
  events: readonly { event: string; value: string | number }[],
): void {
  const m = new Map(metrics.map((r) => [r.metric, Number(r.value)]));
  const merge = m.get('Merge');
  const mem = m.get('MemoryTracking');
  if (merge === undefined || mem === undefined)
    throw new Error('system.metrics에 Merge · MemoryTracking이 없다');
  chMetrics.mergesRunning.set(merge);
  chMetrics.memoryTracking.set(mem);
  // InsertedRows는 삽입이 한 번도 없으면 system.events에 행이 없다 — 0이다
  const inserted = events.find((r) => r.event === 'InsertedRows');
  mirrorCounter(chMetrics.insertedRows, [[{}, Number(inserted?.value ?? 0)]]);
}

export function clearChServerCounters(): void {
  clearMetric(chMetrics.mergesRunning);
  clearMetric(chMetrics.memoryTracking);
  clearMetric(chMetrics.insertedRows);
}

export interface ChPartsRow {
  table: string;
  parts: string | number;
  bytes_on_disk: string | number;
  uncompressed: string | number;
  rows: string | number;
}

export function applyChParts(rows: readonly ChPartsRow[]): void {
  const k = knownCh(rows);
  replaceGauge(
    chMetrics.activeParts,
    k.map((r) => [{ table: r.table }, Number(r.parts)] as const),
  );
  replaceGauge(
    chMetrics.partsBytesOnDisk,
    k.map((r) => [{ table: r.table }, Number(r.bytes_on_disk)] as const),
  );
  replaceGauge(
    chMetrics.partsRows,
    k.map((r) => [{ table: r.table }, Number(r.rows)] as const),
  );
  replaceGauge(
    chMetrics.partsUncompressed,
    k.map((r) => [{ table: r.table }, Number(r.uncompressed)] as const),
  );
}

export function clearChParts(): void {
  clearMetric(chMetrics.activeParts);
  clearMetric(chMetrics.partsBytesOnDisk);
  clearMetric(chMetrics.partsUncompressed);
  clearMetric(chMetrics.partsRows);
}

export function applyChPartLog(
  rows: readonly { table: string; new_parts: string | number; merge_bytes: string | number }[],
): void {
  const k = knownCh(rows);
  mirrorCounter(
    chMetrics.newParts,
    k.map((r) => [{ table: r.table }, Number(r.new_parts)] as const),
  );
  mirrorCounter(
    chMetrics.mergeWrittenBytes,
    k.map((r) => [{ table: r.table }, Number(r.merge_bytes)] as const),
  );
}

export function clearChPartLog(): void {
  clearMetric(chMetrics.newParts);
  clearMetric(chMetrics.mergeWrittenBytes);
}

/** 창 안 쿼리가 없으면 p95가 정의되지 않는다(nan) — 0으로 채우지 않고 비운다 */
export function applyChQueryP95(r: { p95_ms: number | string | null; n: string | number } | undefined): void {
  const n = Number(r?.n ?? 0);
  const p = Number(r?.p95_ms);
  if (n > 0 && Number.isFinite(p)) chMetrics.queryP95.set(p / 1000);
  else clearMetric(chMetrics.queryP95);
}

export function applyChDisk(
  r: { free_space: string | number; total_space: string | number } | undefined,
): void {
  if (!r) throw new Error('system.disks에 default 디스크가 없다');
  chMetrics.diskFree.set(Number(r.free_space));
  chMetrics.diskTotal.set(Number(r.total_space));
}

export function clearChDisk(): void {
  clearMetric(chMetrics.diskFree);
  clearMetric(chMetrics.diskTotal);
}
