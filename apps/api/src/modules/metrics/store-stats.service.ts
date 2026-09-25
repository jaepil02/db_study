// OBS-02 저장소 메트릭 수집(S5) — 정본 docs/10_observability/02_instrumentation.md §수집 방식 · 01_metrics_catalog.md §저장소 · §조정값
// ① 수집 주기 15초(COLLECT_INTERVAL_MS · 기동 시 고정) — 스크레이프는 저장소를 조회하지 않고 마지막 값만 낸다(REQ-OBS-03 · 07_api/10 #2).
// ② 계열별 실패 격리 — 실패한 계열만 비우고 obs_collect_errors_total{store}를 올린다 · /metrics 자체는 200.
// ③ api 역할 한 곳(all · api)만 수집한다(ADR-22) — worker · collector가 다시 모으면 저장소 쿼리 로그에 관측 쿼리가 배로 섞인다.
// ④ 앱의 기존 저장소 클라이언트를 쓴다 — PostgreSQL 앱 풀 · ClickHouse 앱 HTTP 클라이언트 · Redis 명령 연결(읽기 전용 통계 명령만).
// ClickHouse 관측 쿼리는 log_comment 'obs'를 달아 ch_query_duration_p95_seconds의 모집단에서 뺀다.
// OBS-03 키 계열 메모리 표본(redis_prefix_*)은 S6이라 여기에 없다.
import { STREAM_DLQ } from '@db-study/shared';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { Postgres } from '../../common/postgres/postgres.module';
import { RedisConnections } from '../../common/redis/connections';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
// 스트림 · 그룹 이름은 Collector 발행 경로의 상수를 쓴다 — ingest.service를 들이면 적재 모듈 의존이 관측으로 번진다
import { INGEST_GROUP as GROUP_INGEST, RAW_STREAM as STREAM_RAW } from '../collector/redis-stream-buffer';
import { COLLECT_INTERVAL_MS } from './e2e-gauge.service';
import { chMetrics, clearMetric, obsCollectMetrics, pgMetrics, redisMetrics } from './store.metrics';
import {
  applyChDisk,
  applyChPartLog,
  applyChParts,
  applyChQueryP95,
  applyChServerCounters,
  applyPgConnections,
  applyPgDatabase,
  applyPgLockWaits,
  applyPgTables,
  applyPgTopStatements,
  applyPgWal,
  applyRedisInfo,
  applyStreamStats,
  CH_TABLES,
  type ChPartsRow,
  clearChDisk,
  clearChPartLog,
  clearChParts,
  clearChServerCounters,
  clearPgDatabase,
  clearPgTables,
  clearRedisInfo,
  clearStreamStats,
  lastDeliveredOf,
  PG_TABLES,
  PG_TOP_STATEMENTS,
  type PgDatabaseRow,
  type PgTableRow,
  parsePendingRange,
  parsePendingSummary,
  parseRedisInfo,
  parseXinfoStream,
  runStoreCollection,
  type SeriesGroup,
  type StreamLabel,
  type StreamStat,
  series,
  TrimDetector,
} from './store-stats.map';

/** 저장소 통계를 모으는 역할(ADR-22) */
export const STORE_STATS_ROLES: ReadonlySet<AppConfig['appRole']> = new Set(['all', 'api']);

const STREAMS: ReadonlyArray<readonly [StreamLabel, string]> = [
  ['raw', STREAM_RAW],
  ['dlq', STREAM_DLQ],
];

const OBS_LOG_COMMENT = 'obs';
/** 저장소 수집 쿼리 상한(ms · PostgreSQL statement_timeout · ClickHouse max_execution_time) — 수집 주기(15초)보다 짧게 · 락 대기가 수집 전체를 붙잡지 않게 한다(검수 #8 · 2계층 현행 참고) */
const PG_COLLECT_TIMEOUT_MS = 5000;

function isNoSuchKey(e: unknown): boolean {
  return e instanceof Error && /no such key/i.test(e.message);
}

/**
 * 알림 규칙이 increase()로 보는 계수를 수집 역할에서만 0으로 시작한다 — 첫 사건이 시계열을 처음 만들면 increase()가 0을 내
 * 그 사건을 놓친다(수집 실패 알림 · 트리밍 결함 알림). 수집하지 않는 역할은 계열 자체를 내지 않는다.
 */
export function initAlertCounters(): void {
  for (const store of ['redis', 'postgres', 'clickhouse'] as const)
    obsCollectMetrics.errors.inc({ store }, 0);
  redisMetrics.trimmedUnacked.inc(0);
}

@Injectable()
export class StoreStatsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('StoreStatsService');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly trim = new TrimDetector();
  /** ch_new_parts_total · ch_merge_written_bytes_total의 0점 — api 기동 시각(초) */
  private readonly partLogSince = Math.floor(Date.now() / 1000);

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly pg: Postgres,
    private readonly ch: ClickHouse,
    private readonly redis: RedisConnections,
  ) {}

  onApplicationBootstrap() {
    if (!STORE_STATS_ROLES.has(this.cfg.appRole)) return;
    initAlertCounters();
    this.log.log(`저장소 통계 수집 — 주기 ${COLLECT_INTERVAL_MS} ms(기동 시 고정)`);
    this.timer = setInterval(() => void this.collect(), COLLECT_INTERVAL_MS);
    void this.collect();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** 수집 한 번 — 앞 수집이 아직 돌면 건너뛴다(겹치면 저장소 부하가 주기와 무관해진다) */
  async collect(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const results = await Promise.all([
        runStoreCollection('redis', this.redisGroups()),
        runStoreCollection('postgres', this.pgGroups()),
        runStoreCollection('clickhouse', this.chGroups()),
      ]);
      for (const r of results) {
        for (const f of r.failed) this.log.warn(`수집 실패 ${r.store}.${f.name} — ${f.error}`);
      }
    } finally {
      this.running = false;
    }
  }

  // ─────────── Redis ───────────

  redisGroups(): SeriesGroup[] {
    const r = this.redis.command;
    return [
      series({
        name: 'info',
        fetch: async () => {
          const [mem, stats, clients] = await Promise.all([
            r.info('memory'),
            r.info('stats'),
            r.info('clients'),
          ]);
          return parseRedisInfo(`${mem}\n${stats}\n${clients}`);
        },
        apply: applyRedisInfo,
        clear: clearRedisInfo,
      }),
      series({
        name: 'streams',
        fetch: () => this.fetchStreams(),
        apply: applyStreamStats,
        clear: clearStreamStats,
      }),
      // 트리밍 검출은 앱이 세는 계수라 실패해도 비우지 않는다 — 이번 주기만 건너뛴다
      series({ name: 'trim', fetch: () => this.detectTrim(), apply: () => {}, clear: () => {} }),
    ];
  }

  private async fetchStreams(): Promise<StreamStat[]> {
    const r = this.redis.command;
    return Promise.all(
      STREAMS.map(async ([label, key]) => {
        try {
          const s = parseXinfoStream(await r.xinfo('STREAM', key));
          return { stream: label, length: s.length, entriesAdded: s.entriesAdded };
        } catch (e) {
          // 키가 아직 없으면(첫 XADD 전) 길이 0 · 누적 없음 — 수집 실패가 아니다
          if (isNoSuchKey(e)) return { stream: label, length: 0, entriesAdded: null };
          throw e;
        }
      }),
    );
  }

  private async detectTrim(): Promise<void> {
    const r = this.redis.command;
    let stream: ReturnType<typeof parseXinfoStream>;
    let groups: unknown;
    let pending: unknown;
    try {
      [stream, groups, pending] = await Promise.all([
        r.xinfo('STREAM', STREAM_RAW).then(parseXinfoStream),
        r.xinfo('GROUPS', STREAM_RAW),
        r.xpending(STREAM_RAW, GROUP_INGEST),
      ]);
    } catch (e) {
      // 스트림 · 그룹이 아직 없으면 잘릴 미확인 엔트리도 없다
      if (isNoSuchKey(e) || (e instanceof Error && /NOGROUP/i.test(e.message))) return;
      throw e;
    }
    const obs = {
      firstId: stream.firstId,
      pendingMinId: parsePendingSummary(pending),
      lastDeliveredId: lastDeliveredOf(groups, GROUP_INGEST),
      maxDeletedId: stream.maxDeletedId,
    };
    const range = this.trim.pelRange(obs);
    const ids = range
      ? parsePendingRange(await r.xpending(STREAM_RAW, GROUP_INGEST, range.start, range.end, range.count))
      : [];
    const d = this.trim.step(obs, ids);
    if (d.pel + d.undelivered > 0) {
      this.log.warn(`트리밍 결함 검출 — PEL ${d.pel} · 미배달 사건 ${d.undelivered}(stream_trimmed_unacked)`);
    }
  }

  // ─────────── PostgreSQL ───────────

  pgGroups(): SeriesGroup[] {
    // 수집 쿼리 상한 — 크기 함수가 TRUNCATE · DROP(모드 D ⑧ · 대조군 정리)의 AccessExclusiveLock 뒤에서 기다리면
    // 수집 한 번이 끝나지 않아 세 저장소 계열이 함께 멈춘다(검수 #8). 트랜잭션 안 SET LOCAL로 그 쿼리만 끊고 그 계열만 비운다.
    const q = async <R>(sql: string, params: unknown[] = []): Promise<R[]> => {
      const client = await this.pg.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL statement_timeout = ${PG_COLLECT_TIMEOUT_MS}`);
        const res = await client.query(sql, params);
        await client.query('COMMIT');
        return res.rows as R[];
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    };
    return [
      series({
        name: 'database',
        fetch: () =>
          q<PgDatabaseRow>(
            `SELECT xact_commit, blks_hit, blks_read FROM pg_stat_database WHERE datname = current_database()`,
          ),
        apply: (rows) => applyPgDatabase(rows[0]),
        clear: clearPgDatabase,
      }),
      series({
        name: 'connections',
        fetch: () =>
          q<{ state: string | null; n: number }>(
            `SELECT state, count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND backend_type = 'client backend' GROUP BY state`,
          ),
        apply: applyPgConnections,
        clear: () => clearMetric(pgMetrics.connections),
      }),
      series({
        name: 'locks',
        fetch: () => q<{ n: number }>(`SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted`),
        apply: (rows) => applyPgLockWaits(rows[0]),
        clear: () => clearMetric(pgMetrics.lockWaits),
      }),
      series({
        // queryid만 싣는다 — 문형 텍스트(query 열)는 SELECT하지도 않는다(REQ-OBS-10)
        name: 'statements',
        fetch: () =>
          q<{ queryid: string; mean_ms: number }>(
            `SELECT s.queryid::text AS queryid, s.mean_exec_time AS mean_ms
               FROM pg_stat_statements s JOIN pg_database d ON d.oid = s.dbid
              WHERE d.datname = current_database() AND s.queryid IS NOT NULL
              ORDER BY s.mean_exec_time DESC LIMIT $1`,
            [PG_TOP_STATEMENTS],
          ),
        apply: applyPgTopStatements,
        clear: () => clearMetric(pgMetrics.statementTopMean),
      }),
      series({
        // 파티션(대조군 일 · alarm_event 월)은 파티션 트리 최상위 부모 이름으로 합산 — table 레이블은 고정 기준 15
        name: 'tables',
        fetch: () =>
          q<PgTableRow>(
            `SELECT r.relname AS "table",
                    sum(s.n_dead_tup)::bigint AS dead,
                    sum(s.autovacuum_count)::bigint AS autovac,
                    coalesce(sum(pg_table_size(s.relid)), 0)::bigint AS heap,
                    coalesce(sum(pg_indexes_size(s.relid)), 0)::bigint AS idx
               FROM pg_stat_user_tables s
               JOIN pg_class r ON r.oid = coalesce(pg_partition_root(s.relid), s.relid)
              WHERE s.schemaname = 'public' AND r.relname = ANY($1::text[])
              GROUP BY r.relname`,
            [[...PG_TABLES]],
          ),
        apply: applyPgTables,
        clear: clearPgTables,
      }),
      series({
        name: 'wal',
        fetch: () => q<{ wal_bytes: string }>(`SELECT wal_bytes::text AS wal_bytes FROM pg_stat_wal`),
        apply: (rows) => applyPgWal(rows[0]),
        clear: () => clearMetric(pgMetrics.walBytes),
      }),
    ];
  }

  // ─────────── ClickHouse ───────────

  private async chRows<R>(query: string, query_params: Record<string, unknown> = {}): Promise<R[]> {
    const rs = await this.ch.client.query({
      query,
      query_params,
      format: 'JSONEachRow',
      // 서버 쪽 실행 상한 — PostgreSQL과 같은 이유(수집 한 번이 다른 저장소 계열까지 붙잡지 않게 · 검수 #8)
      clickhouse_settings: { log_comment: OBS_LOG_COMMENT, max_execution_time: PG_COLLECT_TIMEOUT_MS / 1000 },
    });
    return rs.json<R>();
  }

  chGroups(): SeriesGroup[] {
    const tables = [...CH_TABLES];
    const windowSec = Math.round(COLLECT_INTERVAL_MS / 1000);
    return [
      series({
        name: 'server',
        fetch: () =>
          Promise.all([
            this.chRows<{ metric: string; value: string }>(
              `SELECT metric, value FROM system.metrics WHERE metric IN ('Merge', 'MemoryTracking')`,
            ),
            this.chRows<{ event: string; value: string }>(
              `SELECT event, value FROM system.events WHERE event = 'InsertedRows'`,
            ),
          ]),
        apply: ([m, e]) => applyChServerCounters(m, e),
        clear: clearChServerCounters,
      }),
      series({
        name: 'parts',
        fetch: () =>
          this.chRows<ChPartsRow>(
            `SELECT table, count() AS parts, sum(bytes_on_disk) AS bytes_on_disk,
                    sum(data_uncompressed_bytes) AS uncompressed
               FROM system.parts
              WHERE active AND database = currentDatabase() AND table IN {tables:Array(String)}
              GROUP BY table`,
            { tables },
          ),
        apply: applyChParts,
        clear: clearChParts,
      }),
      series({
        // 0점 = api 기동 시각 — part_log 전 기간 count는 보존 TTL에 따라 줄어 counter가 거꾸로 간다
        name: 'part_log',
        fetch: () =>
          this.chRows<{ table: string; new_parts: string; merge_bytes: string }>(
            `SELECT table,
                    countIf(event_type = 'NewPart') AS new_parts,
                    sumIf(size_in_bytes, event_type = 'MergeParts') AS merge_bytes
               FROM system.part_log
              WHERE event_time >= toDateTime({since:UInt32}) AND database = currentDatabase()
                AND table IN {tables:Array(String)}
              GROUP BY table`,
            { since: this.partLogSince, tables },
          ),
        apply: applyChPartLog,
        clear: clearChPartLog,
      }),
      series({
        // 직전 수집 창(주기와 같은 폭) · 관측 쿼리(log_comment obs) 제외
        name: 'query_log',
        fetch: () =>
          this.chRows<{ p95_ms: number | null; n: string }>(
            `SELECT quantile(0.95)(query_duration_ms) AS p95_ms, count() AS n
               FROM system.query_log
              WHERE type = 'QueryFinish' AND event_time > now() - toIntervalSecond({w:UInt32})
                AND log_comment != {c:String}`,
            { w: windowSec, c: OBS_LOG_COMMENT },
          ),
        apply: (rows) => applyChQueryP95(rows[0]),
        clear: () => clearMetric(chMetrics.queryP95),
      }),
      series({
        name: 'disks',
        fetch: () =>
          this.chRows<{ free_space: string; total_space: string }>(
            `SELECT free_space, total_space FROM system.disks WHERE name = 'default'`,
          ),
        apply: (rows) => applyChDisk(rows[0]),
        clear: clearChDisk,
      }),
    ];
  }
}
