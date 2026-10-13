// 생성 계측 — 이름 정본 docs/10_observability/01_metrics_catalog.md §생성 — GEN
// 모드 A(가상 PLC 레지스터 쓰기) · 라이브 실행(run)이 나눠 쓴다. 생성기 단독 처리량 · 모드 B 계측은 측정 도구와 함께 지웠다(D-16).
import { Counter } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';

const reg = [appRegistry];

export const genPointsGenerated = new Counter({
  name: 'gen_points_generated_total',
  help: '생성 카운트 — 무손실 판정의 분모',
  labelNames: ['mode', 'profile'],
  registers: reg,
});
export const genPointsDropout = new Counter({
  name: 'gen_points_dropout_total',
  help: 'DROPOUT이 생략한 행',
  labelNames: ['mode'],
  registers: reg,
});
/** 백프레셔 위험 단계로 발행하지 않은 엔트리 · 포인트 — 라이브 실행의 발행 게이트(runs/backpressure-gate)가 센다 */
export const genPublishHaltedEntries = new Counter({
  name: 'gen_publish_halted_entries_total',
  help: '위험 단계로 발행하지 않은 엔트리',
  labelNames: ['mode'],
  registers: reg,
});
export const genPublishHaltedPoints = new Counter({
  name: 'gen_publish_halted_points_total',
  help: '위험 단계로 발행하지 않은 포인트',
  labelNames: ['mode'],
  registers: reg,
});
