// S5 OBS-02 저장소 메트릭 — 수집 결과 → 게이지 매핑 · 계열별 실패 격리 · 트리밍 결함 검출 분기 · 설계 거절 계수 · 메모리 상한
// 정본: docs/10_observability/01_metrics_catalog.md §저장소 · §E2E · 관측 자체 · 02_instrumentation.md §수집 방식 · §트리밍 결함 검출
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Metric } from 'prom-client';
import { beforeEach, describe, expect, it } from 'vitest';
import { countDesignedRejection } from '../src/common/http/http-metrics';
import { appRegistry } from '../src/common/metrics/registry';
import { ingestMetrics } from '../src/modules/ingest/ingest.metrics';
import { installRunMemoryLimit, readMemoryLimitBytes } from '../src/modules/metrics/obs.metrics';
import { chMetrics, clearMetric, pgMetrics, redisMetrics } from '../src/modules/metrics/store.metrics';
import {
  applyChDisk,
  applyChPartLog,
  applyChParts,
  applyChQueryP95,
  applyChServerCounters,
  applyPgConnections,
  applyPgDatabase,
  applyPgTables,
  applyPgTopStatements,
  applyRedisInfo,
  applyStreamStats,
  lastDeliveredOf,
  parsePendingRange,
  parsePendingSummary,
  parseRedisInfo,
  parseXinfoStream,
  runStoreCollection,
  series,
  TrimDetector,
} from '../src/modules/metrics/store-stats.map';
import { initAlertCounters, STORE_STATS_ROLES } from '../src/modules/metrics/store-stats.service';

type Sample = { labels: Record<string, string | number>; value: number };

async function values(m: Metric): Promise<Sample[]> {
  return (await m.get()).values as Sample[];
}

async function sampleOf(m: Metric, labels: Record<string, string> = {}): Promise<number | undefined> {
  const vs = await values(m);
  return vs.find((v) => Object.entries(labels).every(([k, x]) => String(v.labels[k]) === x))?.value;
}

async function exposed(name: string): Promise<string[]> {
  const text = await appRegistry.metrics();
  return text.split('\n').filter((l) => l.startsWith(`${name} `) || l.startsWith(`${name}{`));
}

const INFO = [
  '# Memory',
  'used_memory:1048576',
  'maxmemory:268435456',
  'mem_fragmentation_ratio:1.25',
  'mem_clients_normal:40960',
  '',
  '# Stats',
  'instantaneous_ops_per_sec:1234',
  'evicted_keys:7',
  'keyspace_hits:100',
  'keyspace_misses:25',
  '# Clients',
  'connected_clients:5',
].join('\r\n');

describe('수집 결과 → 게이지 매핑 — Redis', () => {
  it('INFO memory · stats · clients → 8이름', async () => {
    applyRedisInfo(parseRedisInfo(INFO));
    expect(await sampleOf(redisMetrics.usedMemory)).toBe(1_048_576);
    expect(await sampleOf(redisMetrics.maxMemory)).toBe(268_435_456);
    expect(await sampleOf(redisMetrics.fragmentation)).toBe(1.25);
    expect(await sampleOf(redisMetrics.evicted)).toBe(7);
    expect(await sampleOf(redisMetrics.hits)).toBe(100);
    expect(await sampleOf(redisMetrics.misses)).toBe(25);
    expect(await sampleOf(redisMetrics.opsPerSec)).toBe(1234);
    expect(await sampleOf(redisMetrics.clientOutputBuffer)).toBe(40_960);
  });

  it('서버 누적값은 counter에 그대로 옮긴다 — 두 번 수집해도 더해지지 않는다', async () => {
    applyRedisInfo(parseRedisInfo(INFO));
    applyRedisInfo(parseRedisInfo(INFO.replace('evicted_keys:7', 'evicted_keys:9')));
    expect(await sampleOf(redisMetrics.evicted)).toBe(9);
  });

  it('필수 필드가 없으면 던진다 — 수집 격리가 그 계열을 비운다', () => {
    expect(() => applyRedisInfo(parseRedisInfo('# Memory\r\nused_memory:1'))).toThrow(/maxmemory/);
  });

  it('XINFO STREAM → 길이 · 누적 XADD · 첫 ID · 최대 삭제 ID', async () => {
    const reply = [
      'length',
      3,
      'radix-tree-keys',
      1,
      'last-generated-id',
      '1700000000300-0',
      'max-deleted-entry-id',
      '1700000000099-0',
      'entries-added',
      103,
      'recorded-first-entry-id',
      '1700000000100-0',
      'groups',
      1,
      'first-entry',
      ['1700000000100-0', ['p', 'x']],
      'last-entry',
      ['1700000000300-0', ['p', 'y']],
    ];
    const s = parseXinfoStream(reply);
    expect(s).toEqual({
      length: 3,
      entriesAdded: 103,
      firstId: '1700000000100-0',
      maxDeletedId: '1700000000099-0',
    });
    expect(
      parseXinfoStream(['length', 0, 'max-deleted-entry-id', '0-0', 'first-entry', null]).maxDeletedId,
    ).toBe(null);
    applyStreamStats([
      { stream: 'raw', length: 3, entriesAdded: 103 },
      { stream: 'dlq', length: 0, entriesAdded: null },
      { stream: 'biz', length: 7, entriesAdded: 9 },
    ]);
    expect(await sampleOf(redisMetrics.streamLength, { stream: 'raw' })).toBe(3);
    expect(await sampleOf(redisMetrics.streamLength, { stream: 'dlq' })).toBe(0);
    expect(await sampleOf(redisMetrics.streamLength, { stream: 'biz' })).toBe(7);
    expect(await sampleOf(redisMetrics.entriesAdded, { stream: 'raw' })).toBe(103);
    expect(await sampleOf(redisMetrics.entriesAdded, { stream: 'dlq' })).toBeUndefined();
  });
});

describe('수집 결과 → 게이지 매핑 — PostgreSQL', () => {
  it('pg_stat_database → 커밋 · 버퍼 적중률 · 읽은 블록 0이면 비율을 비운다', async () => {
    applyPgDatabase({ xact_commit: '4591', blks_hit: '300', blks_read: '100' });
    expect(await sampleOf(pgMetrics.xactCommit)).toBe(4591);
    expect(await sampleOf(pgMetrics.bufferHitRatio)).toBe(0.75);
    applyPgDatabase({ xact_commit: 1, blks_hit: 0, blks_read: 0 });
    expect(await exposed('pg_buffer_hit_ratio')).toEqual([]);
  });

  it('연결 상태 — 닫힌 집합 · 권한 밖 NULL은 unknown · 없는 상태는 0', async () => {
    applyPgConnections([
      { state: 'active', n: 2 },
      { state: 'idle', n: '5' },
      { state: null, n: 3 },
    ]);
    expect(await sampleOf(pgMetrics.connections, { state: 'active' })).toBe(2);
    expect(await sampleOf(pgMetrics.connections, { state: 'idle' })).toBe(5);
    expect(await sampleOf(pgMetrics.connections, { state: 'unknown' })).toBe(3);
    expect(await sampleOf(pgMetrics.connections, { state: 'idle in transaction' })).toBe(0);
  });

  it('상위 문형 — rank · queryid만 · ms → 초 · 10개로 자른다', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ queryid: String(-1000 - i), mean_ms: 100 - i }));
    applyPgTopStatements(rows);
    const vs = await values(pgMetrics.statementTopMean);
    expect(vs).toHaveLength(10);
    expect(await sampleOf(pgMetrics.statementTopMean, { rank: '1', queryid: '-1000' })).toBe(0.1);
    for (const v of vs) expect(Object.keys(v.labels).sort()).toEqual(['queryid', 'rank']);
  });

  it('테이블 — 고정 기준 16 밖(pgmigrations 등)은 싣지 않는다 · heap · index 두 kind', async () => {
    applyPgTables([
      { table: 'plc_tag_raw_control', live: '5000', dead: '10', autovac: '2', heap: '8192', idx: '4096' },
      { table: 'pgmigrations', live: 1, dead: 1, autovac: 1, heap: 1, idx: 1 },
    ]);
    expect(await sampleOf(pgMetrics.liveTuples, { table: 'plc_tag_raw_control' })).toBe(5000);
    expect(await sampleOf(pgMetrics.deadTuples, { table: 'plc_tag_raw_control' })).toBe(10);
    expect(await sampleOf(pgMetrics.autovacuum, { table: 'plc_tag_raw_control' })).toBe(2);
    expect(await sampleOf(pgMetrics.relationSize, { table: 'plc_tag_raw_control', kind: 'heap' })).toBe(8192);
    expect(await sampleOf(pgMetrics.relationSize, { table: 'plc_tag_raw_control', kind: 'index' })).toBe(
      4096,
    );
    expect(await sampleOf(pgMetrics.deadTuples, { table: 'pgmigrations' })).toBeUndefined();
    expect(await sampleOf(pgMetrics.liveTuples, { table: 'pgmigrations' })).toBeUndefined();
  });
});

describe('수집 결과 → 게이지 매핑 — ClickHouse', () => {
  it('system.metrics · events · parts · part_log · disks', async () => {
    applyChServerCounters(
      [
        { metric: 'Merge', value: '2' },
        { metric: 'MemoryTracking', value: '446593004' },
      ],
      [{ event: 'InsertedRows', value: '23390228' }],
    );
    expect(await sampleOf(chMetrics.mergesRunning)).toBe(2);
    expect(await sampleOf(chMetrics.memoryTracking)).toBe(446_593_004);
    expect(await sampleOf(chMetrics.insertedRows)).toBe(23_390_228);

    applyChParts([
      { table: 'tag_raw', parts: '3', bytes_on_disk: '1000', uncompressed: '4000', rows: '120000' },
      { table: '.inner_id.x', parts: 1, bytes_on_disk: 1, uncompressed: 1, rows: 1 },
    ]);
    expect(await sampleOf(chMetrics.activeParts, { table: 'tag_raw' })).toBe(3);
    expect(await sampleOf(chMetrics.partsBytesOnDisk, { table: 'tag_raw' })).toBe(1000);
    expect(await sampleOf(chMetrics.partsUncompressed, { table: 'tag_raw' })).toBe(4000);
    expect(await sampleOf(chMetrics.partsRows, { table: 'tag_raw' })).toBe(120_000);
    expect(await sampleOf(chMetrics.partsRows, { table: '.inner_id.x' })).toBeUndefined();
    expect(await values(chMetrics.activeParts)).toHaveLength(1);

    applyChPartLog([{ table: 'tag_1m', new_parts: '12', merge_bytes: '49517208' }]);
    expect(await sampleOf(chMetrics.newParts, { table: 'tag_1m' })).toBe(12);
    expect(await sampleOf(chMetrics.mergeWrittenBytes, { table: 'tag_1m' })).toBe(49_517_208);

    applyChDisk({ free_space: '430661660672', total_space: '485473984512' });
    expect(await sampleOf(chMetrics.diskFree)).toBe(430_661_660_672);
    expect(await sampleOf(chMetrics.diskTotal)).toBe(485_473_984_512);
  });

  it('쿼리 p95 — ms → 초 · 창 안 쿼리 0이면(nan) 0으로 채우지 않고 비운다', async () => {
    applyChQueryP95({ p95_ms: 250, n: '40' });
    expect(await sampleOf(chMetrics.queryP95)).toBe(0.25);
    applyChQueryP95({ p95_ms: Number.NaN, n: '0' });
    expect(await exposed('ch_query_duration_p95_seconds')).toEqual([]);
  });
});

describe('계열별 실패 격리', () => {
  it('실패한 계열만 비우고 obs_collect_errors_total{store} +1 · 마지막 성공 시각은 갱신하지 않는다', async () => {
    const errors = appRegistry.getSingleMetric('obs_collect_errors_total') as Metric;
    const last = appRegistry.getSingleMetric('obs_collect_last_success_timestamp_seconds') as Metric;
    const before = (await sampleOf(errors, { store: 'clickhouse' })) ?? 0;
    const lastBefore = await sampleOf(last, { store: 'clickhouse' });

    applyChDisk({ free_space: 1, total_space: 2 });
    let cleared = false;
    const r = await runStoreCollection(
      'clickhouse',
      [
        series({
          name: 'server',
          fetch: async () =>
            [
              { metric: 'Merge', value: 1 },
              { metric: 'MemoryTracking', value: 5 },
            ] as const,
          apply: (m) => applyChServerCounters(m, []),
          clear: () => {},
        }),
        series({
          name: 'disks',
          fetch: async () => {
            throw new Error('Code: 241. MEMORY_LIMIT_EXCEEDED');
          },
          apply: () => {},
          clear: () => {
            cleared = true;
            clearMetric(chMetrics.diskFree, chMetrics.diskTotal);
          },
        }),
      ],
      () => 1_700_000_000_000,
    );
    expect(r.ok).toEqual(['server']);
    expect(r.failed.map((f) => f.name)).toEqual(['disks']);
    expect(cleared).toBe(true);
    expect(await exposed('ch_disk_free_bytes')).toEqual([]);
    expect(await sampleOf(chMetrics.memoryTracking)).toBe(5);
    expect(await sampleOf(errors, { store: 'clickhouse' })).toBe(before + 1);
    expect(await sampleOf(last, { store: 'clickhouse' })).toBe(lastBefore);
    // 다른 저장소의 오류 계수는 움직이지 않는다
    expect(await sampleOf(errors, { store: 'redis' })).toBeUndefined();
  });

  it('전 계열 성공이면 마지막 성공 시각(epoch 초) · 수집 시간 히스토그램', async () => {
    const r = await runStoreCollection(
      'postgres',
      [series({ name: 'db', fetch: async () => 1, apply: () => {}, clear: () => {} })],
      () => 1_700_000_123_000,
    );
    expect(r.failed).toEqual([]);
    const last = appRegistry.getSingleMetric('obs_collect_last_success_timestamp_seconds') as Metric;
    expect(await sampleOf(last, { store: 'postgres' })).toBe(1_700_000_123);
    const dur = appRegistry.getSingleMetric('obs_collect_duration_seconds') as Metric;
    expect(await sampleOf(dur, { store: 'postgres', le: '+Inf' })).toBeGreaterThanOrEqual(1);
  });

  it('비운 계열은 0이 아니라 사라진다 — 레이블 없는 계열 포함', async () => {
    applyRedisInfo(parseRedisInfo(INFO));
    clearMetric(redisMetrics.usedMemory, redisMetrics.evicted);
    expect(await exposed('redis_used_memory_bytes')).toEqual([]);
    expect(await exposed('redis_evicted_keys_total')).toEqual([]);
  });

  it('수집 역할은 all · api뿐이다(ADR-22)', () => {
    expect([...STORE_STATS_ROLES].sort()).toEqual(['all', 'api']);
  });
});

describe('트리밍 결함 검출 — 02_instrumentation §트리밍 결함 검출', () => {
  let d: TrimDetector;
  beforeEach(() => {
    d = new TrimDetector();
  });

  it('정상 — 확인된 엔트리만 잘렸다(P ≥ F · D ≥ F)', () => {
    const o = { firstId: '100-0', pendingMinId: '150-0', lastDeliveredId: '200-0', maxDeletedId: '99-0' };
    expect(d.pelRange(o)).toBeNull();
    expect(d.step(o)).toEqual({ pel: 0, undelivered: 0 });
  });

  it('P < F — PEL 쪽 개수 정확 · [P, F) 범위 조회 · 다음 주기에 같은 ID를 다시 세지 않는다', async () => {
    const before = (await sampleOf(redisMetrics.trimmedUnacked)) ?? 0;
    const o = { firstId: '100-0', pendingMinId: '90-0', lastDeliveredId: '200-0', maxDeletedId: '99-0' };
    expect(d.pelRange(o)).toEqual({ start: '90-0', end: '(100-0', count: 1000 });
    expect(d.step(o, ['90-0', '95-1'])).toEqual({ pel: 2, undelivered: 0 });
    // 잘린 PEL 항목은 XACK · 회수 전까지 남는다 — 이미 센 상한 다음부터만
    expect(d.pelRange(o)).toEqual({ start: '(95-1', end: '(100-0', count: 1000 });
    expect(d.step(o, ['90-0', '95-1'])).toEqual({ pel: 0, undelivered: 0 });
    // 더 잘려 F가 뒤로 가면 새 구간만 센다
    const o2 = { ...o, firstId: '120-0' };
    expect(d.step(o2, ['95-1', '110-0'])).toEqual({ pel: 1, undelivered: 0 });
    expect(await sampleOf(redisMetrics.trimmedUnacked)).toBe(before + 3);
  });

  it('D < F 이고 D 다음 엔트리가 존재했다(M > D) — 미배달 사건 1 · 이어지는 동안 다시 세지 않는다', () => {
    const o = { firstId: '100-0', pendingMinId: null, lastDeliveredId: '50-0', maxDeletedId: '99-0' };
    expect(d.pelRange(o)).toBeNull();
    expect(d.step(o)).toEqual({ pel: 0, undelivered: 1 });
    expect(d.step({ ...o, firstId: '130-0', maxDeletedId: '129-0' })).toEqual({ pel: 0, undelivered: 0 });
    // 컨슈머가 따라잡아 조건이 풀린 뒤 다시 참이면 새 사건
    expect(d.step({ ...o, lastDeliveredId: '140-0', firstId: '130-0' })).toEqual({ pel: 0, undelivered: 0 });
    expect(d.step({ ...o, lastDeliveredId: '140-0', firstId: '200-0', maxDeletedId: '199-0' })).toEqual({
      pel: 0,
      undelivered: 1,
    });
  });

  it('D < F 이지만 D 다음 엔트리가 잘리지 않았다(M ≤ D) — 정상(F가 곧 D 다음 미배달 엔트리)', () => {
    const o = { firstId: '100-0', pendingMinId: null, lastDeliveredId: '50-0', maxDeletedId: '40-0' };
    expect(d.step(o)).toEqual({ pel: 0, undelivered: 0 });
  });

  it('스트림이 비었으면(F 없음) 판정하지 않는다', () => {
    const o = { firstId: null, pendingMinId: '10-0', lastDeliveredId: '5-0', maxDeletedId: '20-0' };
    expect(d.pelRange(o)).toBeNull();
    expect(d.step(o, ['10-0'])).toEqual({ pel: 0, undelivered: 0 });
  });

  it('XPENDING · XINFO GROUPS 응답 해석', () => {
    expect(parsePendingSummary([0, null, null, null])).toBeNull();
    expect(parsePendingSummary([3, '90-0', '120-0', [['c1', '3']]])).toBe('90-0');
    expect(
      parsePendingRange([
        ['90-0', 'c1', 1000, 1],
        ['95-1', 'c1', 900, 2],
      ]),
    ).toEqual(['90-0', '95-1']);
    const groups = [
      ['name', 'grp:dlq', 'last-delivered-id', '0-0'],
      [
        'name',
        'grp:ingest',
        'consumers',
        3,
        'pending',
        2,
        'last-delivered-id',
        '200-0',
        'entries-read',
        10,
        'lag',
        0,
      ],
    ];
    expect(lastDeliveredOf(groups, 'grp:ingest')).toBe('200-0');
    expect(lastDeliveredOf(groups, 'grp:none')).toBeNull();
  });
});

describe('HTTP 설계 거절 · 관측 자체', () => {
  it('http_designed_rejections_total — datagen.stream_full · common.rate_limited만 센다', async () => {
    const m = appRegistry.getSingleMetric('http_designed_rejections_total') as Metric;
    expect(countDesignedRejection('/api/v1/ingest/bulk', 'datagen.stream_full')).toBe(true);
    expect(countDesignedRejection(undefined, 'common.rate_limited')).toBe(true);
    expect(countDesignedRejection('/api/v1/tags', 'common.validation_failed')).toBe(false);
    expect(await sampleOf(m, { route: '/api/v1/ingest/bulk', error_code: 'datagen.stream_full' })).toBe(1);
    expect(await sampleOf(m, { route: 'unmatched', error_code: 'common.rate_limited' })).toBe(1);
    expect(await sampleOf(m, { error_code: 'common.validation_failed' })).toBeUndefined();
  });

  it('obs_run_memory_limit_bytes — cgroup memory.max 바이트 · max(상한 없음)이면 비운다', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-'));
    const f = join(dir, 'memory.max');
    writeFileSync(f, '4294967296\n');
    expect(readMemoryLimitBytes(f)).toBe(4_294_967_296);
    const g = installRunMemoryLimit(readMemoryLimitBytes(f));
    expect(await sampleOf(g)).toBe(4_294_967_296);
    writeFileSync(f, 'max\n');
    expect(readMemoryLimitBytes(f)).toBeNull();
    installRunMemoryLimit(readMemoryLimitBytes(f));
    expect(await exposed('obs_run_memory_limit_bytes')).toEqual([]);
    expect(readMemoryLimitBytes(join(dir, 'none'))).toBeNull();
  });

  it('첫 수집 전 저장소 계열은 비어 있다 — 수집하지 않는 역할이 0을 내지 않는다', async () => {
    const text = await appRegistry.metrics();
    // 이 파일의 앞선 테스트가 채운 계열 밖의 이름 — 임포트 직후 상태 그대로
    expect(text).toMatch(/# TYPE pg_wal_bytes_total counter\n(?!pg_wal_bytes_total )/);
    expect(text).toMatch(/# TYPE pg_lock_waits gauge\n(?!pg_lock_waits )/);
  });
});

describe('알림 계수 0 초기화 — increase()가 첫 사건을 놓치지 않게', () => {
  it('dlq_count{reason} · ing_mv_errors_total{result}는 등록 때 닫힌 값마다 0', async () => {
    expect(await sampleOf(ingestMetrics.dlqCount, { reason: 'retry_exhausted' })).toBe(0);
    expect(await sampleOf(ingestMetrics.dlqCount, { reason: 'undecodable' })).toBe(0);
    expect(await sampleOf(ingestMetrics.mvErrors, { result: 'error' })).toBe(0);
    expect(await sampleOf(ingestMetrics.mvErrors, { result: 'retry_ok' })).toBe(0);
  });

  it('수집 역할 기동 — obs_collect_errors_total{store} 3값 · stream_trimmed_unacked가 0으로 나타난다(기존 값은 보존)', async () => {
    const errors = appRegistry.getSingleMetric('obs_collect_errors_total') as Metric;
    const chBefore = (await sampleOf(errors, { store: 'clickhouse' })) ?? 0;
    initAlertCounters();
    expect(await sampleOf(errors, { store: 'redis' })).toBe(0);
    expect(await sampleOf(errors, { store: 'postgres' })).toBe(0);
    expect(await sampleOf(errors, { store: 'clickhouse' })).toBe(chBefore);
    expect(await exposed('stream_trimmed_unacked')).toHaveLength(1);
  });
});
