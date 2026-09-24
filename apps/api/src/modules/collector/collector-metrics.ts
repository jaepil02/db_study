// COL 계측 — 이름 정본 docs/10_observability/01_metrics_catalog.md §수집 — COL · SIM · GEN
// points_emitted · poll_duration은 원본 이름 보존(접두 · 단위 접미 규칙의 예외).
import { Counter, Gauge, Histogram } from 'prom-client';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../../common/metrics/registry';

/** 발행을 시도한 포인트 — XADD 실패로 버린 엔트리도 센다(S2는 스풀이 없다 · tag_raw와의 차가 버린 양이다) */
export const pointsEmitted = new Counter({
  name: 'points_emitted',
  help: 'Collector가 발행한 포인트',
  labelNames: ['device'],
  registers: [appRegistry],
});

/** 한 사이클(첫 요청 송신 직전 ~ 발행 끝) — scan_rate 초과가 F-01 병목 #1의 신호 */
export const pollDuration = new Histogram({
  name: 'poll_duration',
  help: '폴링 한 사이클 소요(초)',
  labelNames: ['device'],
  buckets: LATENCY_BUCKETS_SECONDS,
  registers: [appRegistry],
});

export const colPolls = new Counter({
  name: 'col_polls_total',
  help: '폴링 사이클 수 — 타임아웃율의 분모',
  labelNames: ['device'],
  registers: [appRegistry],
});

export const colPollTimeouts = new Counter({
  name: 'col_poll_timeouts_total',
  help: '타임아웃으로 건너뛴 사이클 수 — 행 없음(BAD_TIMEOUT 계수)',
  labelNames: ['device'],
  registers: [appRegistry],
});

export const colPointsByQuality = new Counter({
  name: 'col_points_by_quality_total',
  help: '품질 코드별 판정 수',
  labelNames: ['quality'],
  registers: [appRegistry],
});

/** 요청 송신 직전 ~ 응답 수신 직후(지연 예산 구간 #2) · 타임아웃은 +Inf 칸 */
export const colModbusRtt = new Histogram({
  name: 'col_modbus_rtt_seconds',
  help: 'Modbus 요청 왕복(초)',
  buckets: LATENCY_BUCKETS_SECONDS,
  registers: [appRegistry],
});

export const colReady = new Gauge({
  name: 'col_ready',
  help: '기동 로드(설비 · 활성 태그) 완료 — 0이면 기동 미준비',
  registers: [appRegistry],
});
colReady.set(0);
