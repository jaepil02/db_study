// 직접 비교의 저장소 접근 — 실행기(compare-runner)는 이 포트만 본다(시험은 가짜를 넣는다)
// ClickHouse: 조회는 공용 클라이언트 · 구간 비우기(동기 변이) · 병합 · 지우기는 긴 제한 시간의 관리 클라이언트(공용은 10초)
// PostgreSQL: 풀 app_rw — 비교 사본(TimescaleDB hypertable · ADR-32)의 구간 압축 · 구간 비우기 · 전체 비우기는 007 · 009의 SECURITY DEFINER 함수로만
// (칸은 넣을 때 스스로 생긴다 — 미리 만들 것이 없다)
// Redis: 래퍼 둘만(ADR-13) — 게이트 · 조회 사본은 CacheKeyClient, Stream · rt:latest는 DurableKeyClient
import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { STREAM_DLQ } from '@db-study/shared';
import type { Pool } from 'pg';
import { type CacheKeyClient, DUAL_GATE_TTL_SECONDS } from '../../common/redis/cache-key-client';
import type { DurableKeyClient, GroupBacklog } from '../../common/redis/durable-key-client';
import { type AppConfig, requireStoreUrls, requireStreamMaxlen } from '../../config/app-config';
import { INGEST_GROUP, RAW_STREAM } from '../collector/redis-stream-buffer';
import { type Thresholds, thresholdsFor } from './backpressure-gate';
import { type GenDevice, genDevicesOf, type SeedTagRow } from './compare-gen';
import type { AggRow, CutRow, CutSecond } from './compare-query';
import { type TimeRange, utcDayIds, wholeUtcDaysIn } from './compare-range';
import {
  CH_CONSISTENCY_GROUPS,
  CH_HAS_ROWS,
  CH_PARTITION_BYTES,
  CH_PARTITION_ROWS,
  CH_PURGE_TABLES,
  CH_RANGE_ROWS,
  CH_SECOND_CUTS,
  CH_SECOND_ROWS,
  CH_TOTAL_BYTES,
  CH_TOTAL_ROWS,
  chClearRawStatements,
  chClearRollupStatements,
  chOptimizeStatement,
  PG_CARD_TAGS,
  PG_CHUNK_BYTES,
  PG_CLEAR_RANGE,
  PG_COMPRESS_DAYS,
  PG_COMPRESS_RANGE,
  PG_CONSISTENCY_GROUPS,
  PG_ESTIMATE_ROWS,
  PG_HAS_ROWS,
  PG_PARTITION_ROWS,
  PG_PURGE,
  PG_TOTAL_BYTES,
  PG_TOTAL_ROWS,
  SIZE_AGG_SQL,
} from './compare-sql';
import type { LastIngest } from './run-result';

/** ③ 묶음 하나(설비 · 태그 · 1시간) — 행 수 · 값 합계(round(value × 1000)의 정수 합) · 최소 · 최대(64비트 hex) · 행 지문 합 */
export interface GroupSum {
  deviceId: number;
  tagId: number;
  /** 묶음 시작(epoch ms · 1시간 배수 · UTC) */
  hour: number;
  n: number;
  s: bigint;
  lo: string;
  hi: string;
  f: bigint;
}

/** 저장소별 행 수 · 크기 */
export interface StorePair<T> {
  clickhouse: T;
  postgres: T;
}

/** 조회 대결 한 단계의 원천 — 구간 시작부터 자른 자리(N번째 행)까지 */
export interface SizeSlice {
  start: number;
  cut: CutRow;
}

export interface CompareStores {
  loadCardDevices(): Promise<GenDevice[]>;
  clearRange(r: TimeRange): Promise<void>;
  /** 구간 행 수(두 저장소 전체를 센다 — PostgreSQL은 큰 구간에서 수 초) */
  rangeRows(r: TimeRange): Promise<StorePair<number>>;
  /** ClickHouse 구간 행 수만(적체 소진 확인 — 자주 부른다) */
  clickhouseRangeRows(r: TimeRange): Promise<number>;
  /**
   * 구간 행 수 + 크기(구간이 걸친 파티션 · 칸 크기 × 구간 몫) — 둘 다 자리 잡은 모양에서 잰다:
   * ClickHouse는 파티션 병합(FINAL) 뒤 · PostgreSQL(TimescaleDB)은 구간 칸 열 압축 뒤
   */
  rangeStats(r: TimeRange): Promise<{
    rows: StorePair<number>;
    bytes: StorePair<number | null>;
    optimized: boolean;
    compressed: boolean;
  }>;
  /**
   * 넣는 중 크기 — 구간이 걸친 UTC 일 파티션 · 칸의 디스크 크기 합(행을 세지 않아 가볍다 · 병합 · 압축 전 그대로).
   * 넣기는 시작 때 사흘 창을 통째로 비우므로 그 파티션 크기가 곧 이번 넣기 데이터 크기다.
   */
  liveBytes(r: TimeRange): Promise<StorePair<number | null>>;
  /**
   * 넣는 도중 PostgreSQL 압축 — 구간에 걸친 칸 중 아직 압축하지 않은 것(다 들어간 지난 날 칸만 넘긴다) · 압축한 칸 수.
   * 7일치를 넘는 넣기는 압축 전 크기(약 117 B/행)가 디스크 여유를 넘어 넣으면서 압축한다.
   */
  compressDays(r: TimeRange): Promise<number>;
  hasRows(r: TimeRange): Promise<StorePair<boolean>>;
  /** ③ 데이터 정합성 — 구간을 한 번 훑어 묶음(설비 · 태그 · 1시간)마다 잰다(저장소 하나씩 — 실행기가 각자 걸린 시간을 잰다) */
  consistencyGroups(store: 'clickhouse' | 'postgres', r: TimeRange): Promise<GroupSum[]>;
  /** ③ 다른 묶음에 붙일 이름 — 카드 라인 활성 설비 · 태그(시드) */
  cardTagRows(): Promise<SeedTagRow[]>;
  /** ② 조회 대결 준비 — 단계마다 N번째 행이 든 초와 그 초 안 순번(1부터 · ClickHouse 원본) · 원천이 N보다 적으면 null */
  secondCuts(r: TimeRange, targets: readonly number[]): Promise<Map<number, CutSecond | null>>;
  /** ② 조회 대결 준비 — 초 하나(초 시작 epoch ms)의 원천 행 · (시각 · 설비 · 태그) 순 */
  secondRows(sec: number): Promise<CutRow[]>;
  /** ② 조회 대결 — 원천 N행을 한 저장소에서 한 번 집계(설비 · 태그 · 1시간 칸) */
  sizeAgg(store: 'clickhouse' | 'postgres', a: SizeSlice): Promise<AggRow[]>;
  backlog(): Promise<GroupBacklog | null>;
  xaddBatch(payloads: readonly Buffer[]): Promise<{
    results: (string | Error)[];
    backlog: GroupBacklog | null;
    /** 발행 뒤 대기줄 entries-added(읽지 못하면 null) */
    entriesAdded: number | null;
  }>;
  /** 대기줄 entries-added — 시간 초과로 끝난 발행이 실제로 몇 개 들어갔는지 센다 */
  entriesAdded(): Promise<number | null>;
  thresholds(): Thresholds;
  setGate(runId: string): Promise<boolean>;
  delGate(): Promise<boolean>;
  deleteLatest(deviceIds: readonly number[]): Promise<number>;
}

/** 관리 문(구간 동기 변이 · 병합) 제한 시간 — 하루치 파티션 변이 · 병합이 공용 10초를 넘는다 */
export const CH_ADMIN_TIMEOUT_MS = 300_000;

export function adminClickHouse(cfg: AppConfig): ClickHouseClient {
  const url = new URL(requireStoreUrls(cfg).clickhouseUrl);
  return createClient({
    url: `${url.protocol}//${url.host}`,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'plc',
    request_timeout: CH_ADMIN_TIMEOUT_MS,
  });
}

const num = (v: unknown) => Number(v ?? 0);

export class LiveCompareStores implements CompareStores {
  constructor(
    private readonly cfg: AppConfig,
    private readonly pg: Pool,
    private readonly ch: ClickHouseClient,
    private readonly admin: ClickHouseClient,
    private readonly durable: DurableKeyClient,
    private readonly cache: CacheKeyClient,
  ) {}

  private async chRows<R>(query: string, query_params: Record<string, unknown> = {}): Promise<R[]> {
    const rs = await this.ch.query({ query, query_params, format: 'JSONEachRow' });
    return rs.json<R>();
  }

  /**
   * 구간 전체를 훑는 읽기(집계 · 세기 · 1분 칸 대조 · 자를 자리) — 관리 클라이언트(제한 300초). 넣기가 10억 행(약 50일치)이면
   * ClickHouse도 이런 읽기가 공용 클라이언트 제한(10초)에 닿는다(5천만 행 집계 0.44초 · 1억 행 1분 칸 대조 0.78초 실측 → 20배).
   */
  private async chScan<R>(query: string, query_params: Record<string, unknown> = {}): Promise<R[]> {
    const rs = await this.admin.query({ query, query_params, format: 'JSONEachRow' });
    return rs.json<R>();
  }

  async loadCardDevices(): Promise<GenDevice[]> {
    return genDevicesOf((await this.pg.query<SeedTagRow>(PG_CARD_TAGS)).rows);
  }

  async clearRange(r: TimeRange): Promise<void> {
    const touched = utcDayIds(r);
    for (const q of [...chClearRawStatements(r, wholeUtcDaysIn(r), touched), ...chClearRollupStatements(r)]) {
      await this.admin.command({ query: q });
    }
    await this.pg.query(PG_CLEAR_RANGE, [new Date(r.start), new Date(r.end)]);
  }

  async rangeRows(r: TimeRange): Promise<StorePair<number>> {
    const ch = await this.partitionRows(r);
    const pg = await this.pgPartitionRows(r);
    return {
      clickhouse: [...ch.values()].reduce((a, x) => a + x.inRange, 0),
      postgres: [...pg.values()].reduce((a, x) => a + x.inRange, 0),
    };
  }

  private async partitionRows(r: TimeRange): Promise<Map<string, { inRange: number; total: number }>> {
    const rows = await this.chScan<{ p: string; in_range: string; total: string }>(CH_PARTITION_ROWS, {
      ids: utcDayIds(r),
      s: r.start,
      e: r.end,
    });
    return new Map(rows.map((x) => [x.p, { inRange: num(x.in_range), total: num(x.total) }]));
  }

  private async pgPartitionRows(r: TimeRange): Promise<Map<string, { inRange: number; total: number }>> {
    const ids = utcDayIds(r);
    const dayStart = Date.UTC(
      Number(ids[0]?.slice(0, 4)),
      Number(ids[0]?.slice(4, 6)) - 1,
      Number(ids[0]?.slice(6, 8)),
    );
    const dayEnd = dayStart + ids.length * 86_400_000;
    const rs = await this.pg.query<{ p: string; in_range: string; total: string }>(PG_PARTITION_ROWS, [
      new Date(r.start),
      new Date(r.end),
      new Date(dayStart),
      new Date(dayEnd),
    ]);
    return new Map(rs.rows.map((x) => [x.p, { inRange: num(x.in_range), total: num(x.total) }]));
  }

  async clickhouseRangeRows(r: TimeRange): Promise<number> {
    const rows = await this.chScan<{ n: string }>(CH_RANGE_ROWS, { s: r.start, e: r.end });
    return num(rows[0]?.n);
  }

  async rangeStats(r: TimeRange) {
    const ids = utcDayIds(r);
    let optimized = true;
    for (const id of ids) {
      try {
        await this.admin.command({ query: chOptimizeStatement(id) });
      } catch {
        optimized = false; // 병합이 제한 시간을 넘으면 그 상태 그대로 잰다(detail에 optimized false)
      }
    }
    let compressed = true;
    try {
      await this.pg.query(PG_COMPRESS_RANGE, [new Date(r.start), new Date(r.end)]);
    } catch {
      compressed = false; // 압축이 실패하면 압축 전 크기로 잰다(detail에 compressed false)
    }
    const chRows = await this.partitionRows(r);
    const chBytes = await this.chRows<{ p: string; bytes: string }>(CH_PARTITION_BYTES, { ids });
    const pgRows = await this.pgPartitionRows(r);
    const pgBytes = await this.pg.query<{ p: string; bytes: string }>(PG_CHUNK_BYTES, [ids]);
    const sumIn = (m: Map<string, { inRange: number }>) => [...m.values()].reduce((a, x) => a + x.inRange, 0);
    return {
      rows: { clickhouse: sumIn(chRows), postgres: sumIn(pgRows) },
      bytes: {
        clickhouse: shareOf(chRows, new Map(chBytes.map((x) => [x.p, num(x.bytes)]))),
        postgres: shareOf(pgRows, new Map(pgBytes.rows.map((x) => [x.p, num(x.bytes)]))),
      },
      optimized,
      compressed,
    };
  }

  async liveBytes(r: TimeRange): Promise<StorePair<number | null>> {
    const ids = utcDayIds(r);
    const [ch, pg] = await Promise.all([
      this.chRows<{ p: string; bytes: string }>(CH_PARTITION_BYTES, { ids }).catch(() => null),
      this.pg
        .query<{ p: string; bytes: string }>(PG_CHUNK_BYTES, [ids])
        .then((x) => x.rows)
        .catch(() => null),
    ]);
    const sum = (rows: { bytes: string }[] | null) =>
      rows === null ? null : rows.reduce((a, x) => a + num(x.bytes), 0);
    return { clickhouse: sum(ch), postgres: sum(pg) };
  }

  async compressDays(r: TimeRange): Promise<number> {
    const rs = await this.pg.query<{ compressed: number }>(PG_COMPRESS_DAYS, [
      new Date(r.start),
      new Date(r.end),
    ]);
    return num(rs.rows[0]?.compressed);
  }

  async hasRows(r: TimeRange): Promise<StorePair<boolean>> {
    const ch = await this.chRows<{ n: string }>(CH_HAS_ROWS, { s: r.start, e: r.end });
    const pg = await this.pg.query<{ has: boolean }>(PG_HAS_ROWS, [new Date(r.start), new Date(r.end)]);
    return { clickhouse: num(ch[0]?.n) > 0, postgres: Boolean(pg.rows[0]?.has) };
  }

  async consistencyGroups(store: 'clickhouse' | 'postgres', r: TimeRange): Promise<GroupSum[]> {
    type Raw = {
      d: number | string;
      g: number | string;
      hr: number | string;
      n: string;
      s: string;
      lo: string;
      hi: string;
      f: string;
    };
    const rows =
      store === 'clickhouse'
        ? await this.chScan<Raw>(CH_CONSISTENCY_GROUPS, { s: r.start, e: r.end })
        : (await this.pg.query<Raw>(PG_CONSISTENCY_GROUPS, [new Date(r.start), new Date(r.end)])).rows;
    return rows.map((x) => ({
      deviceId: num(x.d),
      tagId: num(x.g),
      hour: num(x.hr) * 1000,
      n: num(x.n),
      s: BigInt(x.s),
      lo: x.lo,
      hi: x.hi,
      f: BigInt(x.f),
    }));
  }

  async cardTagRows(): Promise<SeedTagRow[]> {
    return (await this.pg.query<SeedTagRow>(PG_CARD_TAGS)).rows;
  }

  async secondCuts(r: TimeRange, targets: readonly number[]): Promise<Map<number, CutSecond | null>> {
    const rows = await this.chScan<{ target: string; sec: string; before: string }>(CH_SECOND_CUTS, {
      s: r.start,
      e: r.end,
      targets: [...targets],
    });
    const at = new Map(
      rows.map((x) => [num(x.target), { sec: num(x.sec), rank: num(x.target) - num(x.before) }]),
    );
    return new Map(targets.map((t) => [t, at.get(t) ?? null]));
  }

  async secondRows(sec: number): Promise<CutRow[]> {
    const rows = await this.chRows<{ t: string; d: number; g: number }>(CH_SECOND_ROWS, {
      s: sec,
      e: sec + 1000,
    });
    return rows.map((x) => ({ ts: num(x.t), deviceId: num(x.d), tagId: num(x.g) }));
  }

  async sizeAgg(store: 'clickhouse' | 'postgres', a: SizeSlice): Promise<AggRow[]> {
    const { cut } = a;
    if (store === 'clickhouse') {
      const rows = await this.chScan<{
        device_id: number;
        tag_id: number;
        h: number;
        n: string;
        v: number;
        s: string;
      }>(SIZE_AGG_SQL.clickhouse, { s: a.start, t: cut.ts, d: cut.deviceId, g: cut.tagId });
      return rows.map((x) => ({
        deviceId: num(x.device_id),
        tagId: num(x.tag_id),
        hour: num(x.h) * 1000,
        n: num(x.n),
        v: num(x.v),
        s: BigInt(x.s),
      }));
    }
    const rs = await this.pg.query<{
      device_id: number;
      tag_id: number;
      h: Date;
      n: string;
      v: number;
      s: string;
    }>(SIZE_AGG_SQL.postgres, [new Date(a.start), new Date(cut.ts), cut.deviceId, cut.tagId]);
    return rs.rows.map((x) => ({
      deviceId: num(x.device_id),
      tagId: num(x.tag_id),
      hour: new Date(x.h).getTime(),
      n: num(x.n),
      v: num(x.v),
      s: BigInt(x.s),
    }));
  }

  backlog(): Promise<GroupBacklog | null> {
    return this.durable.groupBacklog(RAW_STREAM, INGEST_GROUP);
  }

  xaddBatch(payloads: readonly Buffer[]) {
    return this.durable.xaddBatchWithBacklog(
      RAW_STREAM,
      payloads,
      requireStreamMaxlen(this.cfg),
      INGEST_GROUP,
    );
  }

  entriesAdded(): Promise<number | null> {
    return this.durable.streamEntriesAdded(RAW_STREAM);
  }

  thresholds(): Thresholds {
    return thresholdsFor(requireStreamMaxlen(this.cfg));
  }

  setGate(runId: string): Promise<boolean> {
    return this.cache.setDualGate(runId, DUAL_GATE_TTL_SECONDS);
  }

  delGate(): Promise<boolean> {
    return this.cache.delDualGate();
  }

  deleteLatest(deviceIds: readonly number[]): Promise<number> {
    return this.durable.deleteLatest(deviceIds);
  }
}

/** 파티션 크기 × (구간 행 ÷ 파티션 행)의 합 — 파티션에 구간 밖 행(가동 데이터 등)이 섞여도 구간 몫만 센다 · 행이 없으면 null */
export function shareOf(
  rows: Map<string, { inRange: number; total: number }>,
  bytes: Map<string, number>,
): number | null {
  let out = 0;
  let any = false;
  for (const [p, r] of rows) {
    const b = bytes.get(p);
    if (b === undefined || r.total <= 0 || r.inRange <= 0) continue;
    any = true;
    out += (b * r.inRange) / r.total;
  }
  return any ? Math.round(out) : null;
}

// ── 센서 데이터 현황 · 지우기(D-16 결정 5)

export interface SensorStores {
  totals(
    exact: boolean,
  ): Promise<{ ch: { rows: number; bytes: number }; pg: { rows: number; bytes: number } }>;
  redisCounts(): Promise<{ streamLength: number; latestKeys: number }>;
  purgeClickHouse(): Promise<void>;
  purgePostgres(): Promise<void>;
  purgeRedis(): Promise<{ streamEntries: number; keys: number }>;
  /** 마지막 넣기(상태 무관 · run_result) */
  lastIngest(): Promise<LastIngest | null>;
  hasRows(r: TimeRange): Promise<StorePair<boolean>>;
  /** 구간 행 수(두 저장소를 센다 — 넣기 결과에 행 수가 없을 때만) */
  rangeRows(r: TimeRange): Promise<StorePair<number>>;
}

/** 현황 조회의 PostgreSQL 행 수 제한 시간 — 넘으면 통계 추정치(approximate_row_count)로 낸다(⑤ 머리가 주기적으로 부른다) */
export const PG_STATS_COUNT_TIMEOUT_MS = 3000;

export class LiveSensorStores implements SensorStores {
  constructor(
    private readonly pg: Pool,
    private readonly admin: ClickHouseClient,
    private readonly durable: DurableKeyClient,
    private readonly cache: CacheKeyClient,
    private readonly compare: Pick<CompareStores, 'hasRows' | 'rangeRows'>,
    private readonly last: () => Promise<LastIngest | null>,
  ) {}

  async totals(exact: boolean) {
    const chN = await (await this.admin.query({ query: CH_TOTAL_ROWS, format: 'JSONEachRow' })).json<{
      n: string;
    }>();
    const chB = await (await this.admin.query({ query: CH_TOTAL_BYTES, format: 'JSONEachRow' })).json<{
      bytes: string | null;
    }>();
    const pgB = await this.pg.query<{ bytes: string }>(PG_TOTAL_BYTES);
    return {
      ch: { rows: num(chN[0]?.n), bytes: num(chB[0]?.bytes) },
      pg: { rows: await this.pgRows(exact), bytes: num(pgB.rows[0]?.bytes) },
    };
  }

  /** 정확히 세거나(지우기 직전) · 제한 시간 안에 세고 넘으면 추정치(현황) */
  private async pgRows(exact: boolean): Promise<number> {
    if (exact) return num((await this.pg.query<{ n: string }>(PG_TOTAL_ROWS)).rows[0]?.n);
    const c = await this.pg.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SET LOCAL statement_timeout = ${PG_STATS_COUNT_TIMEOUT_MS}`);
      const n = num((await c.query<{ n: string }>(PG_TOTAL_ROWS)).rows[0]?.n);
      await c.query('COMMIT');
      return n;
    } catch {
      await c.query('ROLLBACK').catch(() => undefined);
      const est = await c.query<{ n: string }>(PG_ESTIMATE_ROWS);
      return num(est.rows[0]?.n);
    } finally {
      c.release();
    }
  }

  async redisCounts() {
    return {
      streamLength: await this.durable.streamLength(RAW_STREAM),
      latestKeys: await this.durable.countLatestKeys(),
    };
  }

  async purgeClickHouse(): Promise<void> {
    for (const t of CH_PURGE_TABLES) await this.admin.command({ query: `TRUNCATE TABLE plc.${t}` });
  }

  async purgePostgres(): Promise<void> {
    await this.pg.query(PG_PURGE);
  }

  async purgeRedis(): Promise<{ streamEntries: number; keys: number }> {
    const streamEntries =
      (await this.durable.trimStreamAll(RAW_STREAM)) + (await this.durable.trimStreamAll(STREAM_DLQ));
    const latest = await this.durable.deleteAllLatest();
    const copies = (await this.cache.deleteQueryCopies()) ?? 0;
    return { streamEntries, keys: latest + copies };
  }

  lastIngest(): Promise<LastIngest | null> {
    return this.last();
  }

  hasRows(r: TimeRange): Promise<StorePair<boolean>> {
    return this.compare.hasRows(r);
  }

  rangeRows(r: TimeRange): Promise<StorePair<number>> {
    return this.compare.rangeRows(r);
  }
}
