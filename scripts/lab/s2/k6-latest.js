// EXP-07 최신값 시나리오 — 고정 도착률(constant-arrival-rate) · 설비 하나의 최신값 조회
// 컨테이너 · cpuset 11-12 · 대상 http://api:3000(Host api:3000 — Host 대조 허용 목록) — scripts/lab/s2/exp07.sh가 부른다.
// 도착률 · 창은 2계층 미정이라 환경변수로 받고 기록 조건에 적는다.
import http from 'k6/http';
import { check } from 'k6';

const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '70s';
const DEVICE = __ENV.DEVICE || '1';

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['min', 'med', 'avg', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    latest: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
};

export default function () {
  const r = http.get(`http://api:3000/api/v1/realtime/devices/${DEVICE}/tags`);
  check(r, { 200: (x) => x.status === 200 });
}
