// 적재 계측 — 이름 정본 docs/10_observability/01_metrics_catalog.md §적재 — ING · §실시간(rlt_latest_updates_total)
// 구간: 6a Stream 체류 · 6b 디코딩 · 6c fan-in 대기 · #7 INSERT(04_architecture/05 §구간 분해)
import { Counter, Gauge, Histogram } from 'prom-client';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../../common/metrics/registry';

const reg = [appRegistry];

export const ingestMetrics = {
  consumerLag: new Gauge({ name: 'consumer_lag', help: '그룹 lag + pending', registers: reg }),
  groupLag: new Gauge({
    name: 'ing_group_lag',
    help: 'consumer_lag의 성분 — 아직 배달하지 않은 엔트리',
    registers: reg,
  }),
  groupPending: new Gauge({
    name: 'ing_group_pending',
    help: 'consumer_lag의 성분 — 배달했으나 XACK하지 않은 엔트리',
    registers: reg,
  }),
  lagUnknown: new Gauge({
    name: 'ing_consumer_lag_unknown',
    help: 'lag 산출 불가 — 직전 값 유지 중',
    registers: reg,
  }),
  rowsInserted: new Counter({ name: 'rows_inserted', help: 'tag_raw에 쓰인 행', registers: reg }),
  insertRetries: new Counter({
    name: 'ing_insert_retries_total',
    help: '같은 배치 재시도 — S2는 토큰 없이 같은 행 재전송(S3부터 같은 토큰)',
    registers: reg,
  }),
  insertDuration: new Histogram({
    name: 'insert_duration',
    help: 'INSERT 송신 → 응답(구간 #7)',
    buckets: LATENCY_BUCKETS_SECONDS,
    registers: reg,
  }),
  batchSize: new Histogram({
    name: 'batch_size',
    help: '배치당 행 수',
    buckets: [1, 8, 16, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    registers: reg,
  }),
  residence: new Histogram({
    name: 'ing_stream_residence_seconds',
    help: 'XREADGROUP 수신 − 엔트리 ID 시각(6a)',
    buckets: LATENCY_BUCKETS_SECONDS,
    registers: reg,
  }),
  decode: new Histogram({
    name: 'ing_decode_seconds',
    help: '수신 → 행 배열 완료(6b)',
    buckets: LATENCY_BUCKETS_SECONDS,
    registers: reg,
  }),
  fanin: new Histogram({
    name: 'ing_fanin_wait_seconds',
    help: '행 배열 완료 → 플러시 시작(6c)',
    buckets: LATENCY_BUCKETS_SECONDS,
    registers: reg,
  }),
  consumerPaused: new Counter({
    name: 'ing_consumer_paused_seconds_total',
    help: 'flusher 보유 상한으로 컨슈머가 읽기를 멈춘 시간',
    registers: reg,
  }),
  negativeDt: new Counter({
    name: 'ing_negative_dt_total',
    help: '음수 dt 행 — 거절하지 않고 센다',
    registers: reg,
  }),
  latestUpdates: new Counter({
    name: 'rlt_latest_updates_total',
    help: 'rt:latest 갱신 — 갱신 공백 판정',
    labelNames: ['writer'],
    registers: reg,
  }),
};
