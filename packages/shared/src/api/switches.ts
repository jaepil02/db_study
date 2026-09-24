// 역할 스위치 11 목록 — 채번 · 환경변수 · 기본값 정본 docs/02_features/13_switch_matrix.md
// 포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md §포트 · 구현 이름 확정 표
// api(주입 · 노출)와 웹(실험 콘솔 표)이 같은 목록을 쓴다 — 두 벌이 되면 콘솔이 모르는 구현 이름을 "다름"으로 오판한다.

export type SwitchValueKind = 'onoff' | 'ms' | 'writer';

export interface SwitchSpec {
  id: string;
  env: string;
  kind: SwitchValueKind;
  /** 기본값 — onoff는 on · off, ms는 정수, writer는 ingest · collector */
  defaultValue: string | number;
  port: string;
  /** 04_architecture/02 표의 on 구현 열(SW-11은 기본값 ingest 쪽) */
  onImpl: string;
  /** 04_architecture/02 표의 off 구현 열(SW-07은 0일 때 · SW-11은 collector 쪽) */
  offImpl: string;
}

export const SWITCHES: readonly SwitchSpec[] = [
  {
    id: 'SW-01',
    env: 'REDIS_STREAM_BUFFER',
    kind: 'onoff',
    defaultValue: 'on',
    port: 'PointBufferPort',
    onImpl: 'RedisStreamBuffer',
    offImpl: 'InProcessQueueBuffer',
  },
  {
    id: 'SW-02',
    env: 'REDIS_LATEST_CACHE',
    kind: 'onoff',
    defaultValue: 'on',
    port: 'LatestValueReadPort',
    onImpl: 'RedisLatestValueReader',
    offImpl: 'ClickHouseLatestValueReader',
  },
  {
    id: 'SW-03',
    env: 'REDIS_QUERY_CACHE',
    kind: 'onoff',
    defaultValue: 'on',
    port: 'TimeseriesCachePort',
    onImpl: 'RedisTimeseriesCache',
    offImpl: 'NoopTimeseriesCache',
  },
  {
    id: 'SW-04',
    env: 'CACHE_KEY_TIME_SNAP',
    kind: 'onoff',
    defaultValue: 'on',
    port: 'CacheKeyNormalizerPort',
    onImpl: 'TimeSnapKeyNormalizer',
    offImpl: 'RawTimeKeyNormalizer',
  },
  {
    id: 'SW-05',
    env: 'CACHE_STAMPEDE_LOCK',
    kind: 'onoff',
    defaultValue: 'on',
    port: 'RebuildLockPort',
    onImpl: 'RedisRebuildLock',
    offImpl: 'NoopRebuildLock',
  },
  {
    id: 'SW-06',
    env: 'REDIS_PUBSUB_FANOUT',
    kind: 'onoff',
    defaultValue: 'on',
    port: 'RealtimeFanoutPort',
    onImpl: 'RedisPubSubFanout',
    offImpl: 'DirectGatewayFanout',
  },
  {
    id: 'SW-07',
    env: 'WS_THROTTLE_MS',
    kind: 'ms',
    defaultValue: 100,
    port: 'FrameThrottlePort',
    onImpl: 'WindowMergeThrottle',
    offImpl: 'PassthroughThrottle',
  },
  {
    id: 'SW-08',
    env: 'INGEST_IDEMPOTENCY',
    kind: 'onoff',
    defaultValue: 'on',
    port: 'BatchTokenPort',
    onImpl: 'DeterministicBatchToken',
    offImpl: 'NoBatchToken',
  },
  {
    id: 'SW-09',
    env: 'CONTROL_TABLE_ENABLED',
    kind: 'onoff',
    defaultValue: 'off',
    port: 'ControlTableSinkPort',
    onImpl: 'PostgresControlSink',
    offImpl: 'NoopControlSink',
  },
  {
    id: 'SW-10',
    env: 'COLLECTOR_DEADBAND',
    kind: 'onoff',
    defaultValue: 'off',
    port: 'DeadbandFilterPort',
    onImpl: 'TagDeadbandFilter',
    offImpl: 'PassthroughFilter',
  },
  {
    id: 'SW-11',
    env: 'LATEST_VALUE_WRITER',
    kind: 'writer',
    defaultValue: 'ingest',
    port: 'LatestValueWritePort',
    onImpl: 'IngestLatestValueWriter',
    offImpl: 'CollectorLatestValueWriter',
  },
];

/** 값에서 주입될 구현 이름 — SW-07은 0이면 통과 구현 · SW-11은 ingest가 onImpl 쪽 */
export function implFor(spec: SwitchSpec, value: string | number): string {
  switch (spec.kind) {
    case 'onoff':
      return value === 'on' ? spec.onImpl : spec.offImpl;
    case 'ms':
      return Number(value) > 0 ? spec.onImpl : spec.offImpl;
    case 'writer':
      return value === 'ingest' ? spec.onImpl : spec.offImpl;
  }
}
