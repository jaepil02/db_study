// EXP-CONSOLE 요약 카드 파서(S5 확장) — 이름 · 레이블 정본 10_observability/01_metrics_catalog.md
import { describe, expect, it } from 'vitest';
import {
  backpressureStageName,
  cacheHitRatio,
  parsePrometheusText,
  sumModes,
  summarizeConsole,
} from '../lib/metrics-parser';

const TEXT = `# TYPE consumer_lag gauge
consumer_lag 12
ing_group_lag 2
ing_group_pending 10
ing_consumer_lag_unknown 0
stream_trimmed_unacked 0
backpressure_stage{publisher="gen_b"} 1
backpressure_stage{publisher="collector"} 0
spool_active 0
spool_bytes 0
dlq_count{reason="retry_exhausted"} 3
dlq_count{reason="undecodable"} 1
tsq_cache_requests_total{result="hit"} 90
tsq_cache_requests_total{result="miss"} 10
tsq_cache_requests_total{result="error"} 1
redis_keyspace_hits_total 99999
gen_points_generated_total{mode="A",profile="SINE"} 100
gen_points_generated_total{mode="B",profile="SINE"} 1000
gen_points_generated_total{mode="B",profile="RAMP"} 500
gen_points_generated_total{mode="standalone",profile="SINE"} 7
http_designed_rejections_total{route="/api/v1/ingest/bulk",error_code="datagen.stream_full"} 4
http_designed_rejections_total{route="/api/v1/timeseries",error_code="common.rate_limited"} 9
pg_connections{state="active"} 3
pg_connections{state="idle"} 7
pg_statement_top_mean_seconds{rank="2",queryid="222"} 0.01
pg_statement_top_mean_seconds{rank="1",queryid="111"} 0.25
pg_lock_waits 0
pg_buffer_hit_ratio 0.99
ch_active_parts{table="tag_raw"} 12
ch_active_parts{table="tag_1m"} 4
ch_merges_running 1
ch_query_duration_p95_seconds 0.042
ch_disk_free_bytes 1000
ch_disk_total_bytes 4000
redis_used_memory_bytes 1048576
redis_maxmemory_bytes 4194304
redis_stream_length{stream="raw"} 5000
obs_collect_last_success_timestamp_seconds{store="postgres"} 1758675600
obs_collect_errors_total{store="clickhouse"} 2
`;

describe('summarizeConsole', () => {
  const s = summarizeConsole(parsePrometheusText(TEXT));

  it('앱 · 파이프라인 계열', () => {
    expect(s.consumerLag).toBe(12);
    expect(s.unacked).toEqual({ groupLag: 2, pending: 10, lagUnknown: false });
    expect(s.trimmedUnacked).toBe(0);
    expect(s.backpressure).toEqual([
      { publisher: 'collector', stage: 0 },
      { publisher: 'gen_b', stage: 1 },
    ]);
    expect(s.spool).toEqual({ active: false, bytes: 0, drainRate: null });
    expect(s.dlq).toEqual({ total: 4, byReason: { retry_exhausted: 3, undecodable: 1 } });
  });

  it('캐시 히트율은 tsq_cache_requests_total만 — keyspace 계열을 섞지 않는다', () => {
    expect(s.cacheRequests).toEqual({ hit: 90, miss: 10, error: 1 });
  });

  it('생성기는 모드 A~D별 합 · standalone 제외 · 모드 C 거절은 datagen.stream_full만', () => {
    expect(s.genPointsByMode).toEqual({ A: 100, B: 1500 });
    expect(sumModes(s.genPointsByMode)).toBe(1600);
    expect(s.modeCRejections).toBe(4);
  });

  it('저장소 요약 — 연결 합 · 느린 쿼리 1위 · 파트 합 · 수집 시각 · 수집 실패', () => {
    expect(s.stores.postgres).toEqual({
      connections: { total: 10, byState: { active: 3, idle: 7 } },
      slowestMeanSec: 0.25,
      lockWaits: 0,
      bufferHitRatio: 0.99,
      xactCommitTotal: null,
    });
    expect(s.stores.clickhouse?.activeParts).toEqual({ total: 16, byTable: { tag_raw: 12, tag_1m: 4 } });
    expect(s.stores.clickhouse?.queryP95Sec).toBe(0.042);
    expect(s.stores.redis?.streamLength).toEqual({ raw: 5000 });
    expect(s.collect.postgres).toEqual({ lastSuccessSec: 1758675600, errorsTotal: null });
    expect(s.collect.clickhouse.errorsTotal).toBe(2);
  });

  it('없는 계열은 null — 카드가 "이 단계에서 아직 계측하지 않는다"로 그린다(키 계열별 메모리 OBS-03 포함)', () => {
    const e = summarizeConsole([]);
    expect(e).toMatchObject({
      consumerLag: null,
      unacked: null,
      trimmedUnacked: null,
      backpressure: null,
      spool: null,
      dlq: null,
      cacheRequests: null,
      genPointsByMode: null,
      modeCRejections: null,
      stores: { postgres: null, clickhouse: null, redis: null },
      keyMemory: null,
    });
    expect(s.keyMemory).toBeNull();
  });

  it('키 계열별 메모리가 들어오면 접두별로 모은다', () => {
    const k = summarizeConsole(
      parsePrometheusText(
        'redis_prefix_memory_bytes{prefix="stream"} 100\nredis_prefix_memory_bytes{prefix="cache"} 40',
      ),
    );
    expect(k.keyMemory).toEqual({ stream: 100, cache: 40 });
  });
});

describe('backpressureStageName', () => {
  it('0 정상 · 1 주의 · 2 경고 · 3 위험 · 4 복구', () => {
    expect([0, 1, 2, 3, 4].map(backpressureStageName)).toEqual(['정상', '주의', '경고', '위험', '복구']);
    expect(backpressureStageName(7)).toBe('알 수 없는 값 7');
  });
});

describe('cacheHitRatio', () => {
  it('두 폴링 사이 hit 증가 ÷ (hit + miss 증가)', () => {
    expect(cacheHitRatio({ hit: 90, miss: 10 }, { hit: 170, miss: 30 })).toBe(0.8);
  });
  it('첫 표본 · 재기동(감소) · 창 안 조회 0건이면 계산하지 않는다', () => {
    expect(cacheHitRatio(null, { hit: 1, miss: 1 })).toBeNull();
    expect(cacheHitRatio({ hit: 90, miss: 10 }, { hit: 5, miss: 10 })).toBeNull();
    expect(cacheHitRatio({ hit: 90, miss: 10 }, { hit: 90, miss: 10 })).toBeNull();
  });
});
