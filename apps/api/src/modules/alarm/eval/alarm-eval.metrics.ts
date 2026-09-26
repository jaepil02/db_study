// 알람 판정기 계측 — 이름 정본 docs/10_observability/01_metrics_catalog.md §알람 — ALM(판정기 계열 · alm_acks_total은 API 소유)
// 구간 A1~A6 · total — 04_architecture/05 §알람 판정 구간. 구간 자체(ts 범위 · 토큰)는 메트릭이 아니라 구조화 로그 alarm_eval_gap이다.
import { Counter, Gauge, Histogram } from 'prom-client';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../../../common/metrics/registry';

const reg = [appRegistry];

/** 저장 state 값 4(ACKED는 alarm_event.acked_at 파생 — 03_enums 상태 머신 2) */
export type AlarmStateName = 'NORMAL' | 'PENDING' | 'ACTIVE' | 'CLEARING';

/** 전이 8(06_pipeline/08 §디바운스 전이와 세 쓰기) — ACKED 경로는 ACTIVE → NORMAL로 센다 */
export const TRANSITIONS: readonly [AlarmStateName, AlarmStateName][] = [
  ['NORMAL', 'PENDING'],
  ['PENDING', 'PENDING'],
  ['PENDING', 'NORMAL'],
  ['PENDING', 'ACTIVE'],
  ['ACTIVE', 'CLEARING'],
  ['ACTIVE', 'NORMAL'],
  ['CLEARING', 'ACTIVE'],
  ['CLEARING', 'NORMAL'],
];

export const alarmMetrics = {
  evaluations: new Counter({
    name: 'alm_evaluations_total',
    help: '판정 수 — 분기 대조 ②의 첫 값',
    labelNames: ['result'] as const,
    registers: reg,
  }),
  duration: new Histogram({
    name: 'alm_eval_duration_seconds',
    help: '판정 구간(total)과 하위 구간 A1~A6',
    labelNames: ['phase'] as const,
    buckets: LATENCY_BUCKETS_SECONDS,
    registers: reg,
  }),
  handoffWait: new Histogram({
    name: 'alm_handoff_wait_seconds',
    help: 'flusher가 인계 슬롯을 기다린 시간',
    buckets: LATENCY_BUCKETS_SECONDS,
    registers: reg,
  }),
  transitions: new Counter({
    name: 'alm_transitions_total',
    help: '디바운스 상태 전이 수',
    labelNames: ['from', 'to'] as const,
    registers: reg,
  }),
  opened: new Counter({ name: 'alm_events_opened_total', help: 'alarm_event 확정 열기', registers: reg }),
  closed: new Counter({ name: 'alm_events_closed_total', help: 'alarm_event 확정 닫기', registers: reg }),
  active: new Gauge({
    name: 'alm_active_alarms',
    help: '열린 알람 수(심각도별)',
    labelNames: ['severity'] as const,
    registers: reg,
  }),
  evalRowsInserted: new Counter({
    name: 'alm_eval_rows_inserted_total',
    help: 'alarm_eval에 쓰인 판정 행',
    registers: reg,
  }),
  gapBatches: new Counter({
    name: 'alm_eval_gap_batches_total',
    help: '재시도 소진으로 판정 전수가 빈 배치(무효 구간)',
    registers: reg,
  }),
  gapRows: new Counter({
    name: 'alm_eval_gap_rows_total',
    help: '재시도 소진으로 판정 전수가 빈 행(무효 구간)',
    registers: reg,
  }),
  stateWriteFailures: new Counter({
    name: 'alm_state_write_failures_total',
    help: '커밋 뒤 alarm:state 쓰기 실패',
    registers: reg,
  }),
  pgWriteFailures: new Counter({
    name: 'alm_pg_write_failures_total',
    help: '확정 INSERT · UPDATE 실패',
    labelNames: ['op'] as const,
    registers: reg,
  }),
};

// 닫힌 레이블 값마다 0으로 시작한다(S5 관례) — 첫 사건이 시계열을 처음 만들면 increase()가 0을 내 알림(alarm_eval_gap)이 그 사건을 놓친다
alarmMetrics.gapBatches.inc(0);
alarmMetrics.gapRows.inc(0);
alarmMetrics.stateWriteFailures.inc(0);
alarmMetrics.evalRowsInserted.inc(0);
alarmMetrics.opened.inc(0);
alarmMetrics.closed.inc(0);
for (const result of ['normal', 'violation']) alarmMetrics.evaluations.inc({ result }, 0);
for (const op of ['open', 'close']) alarmMetrics.pgWriteFailures.inc({ op }, 0);
for (const [from, to] of TRANSITIONS) alarmMetrics.transitions.inc({ from, to }, 0);
for (const severity of ['1', '2', '3']) alarmMetrics.active.set({ severity }, 0);
