// EXP-07 S5 재측정(티어 M · 모드 B) — 최신값 시나리오 고정 도착률. 대상 http://api:3000(Host 대조 허용 이름).
// S2 시나리오(scripts/lab/s2/k6-latest.js)와 같은 요청 모양 · DEVICE 고정이 기본(S2와 같은 조건) · ROTATE=N이면 설비 1..N 순환.
// 판정 지표 — k6 정확 분위수(절대값) · 서버 히스토그램은 비 · 방향(06_experiment_catalog EXP-07).
import { check } from 'k6';
import http from 'k6/http';

const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '60s';
const DEVICE = Number(__ENV.DEVICE || 1);
const ROTATE = Number(__ENV.ROTATE || 0);

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['min', 'med', 'avg', 'p(95)', 'p(99)', 'max', 'count'],
  scenarios: {
    latest: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 200,
    },
  },
};

let n = 0;
export default function () {
  n += 1;
  const d = ROTATE > 0 ? ((__VU * 7919 + n) % ROTATE) + 1 : DEVICE;
  const r = http.get(`http://api:3000/api/v1/realtime/devices/${d}/tags`, { tags: { name: 'latest' } });
  check(r, { 200: (x) => x.status === 200 });
}
