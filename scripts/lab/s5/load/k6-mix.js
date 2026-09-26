// S5 조회 혼합 — EXP-22 Baseline · EXP-25 Soak · EXP-27 고정 조회 · EXP-38 관측 간섭. 대상 http://api:3000(Host 대조 허용 이름).
// 조회 부하는 주입 모드가 아니다(05_load_scenarios §부하 단위) — 모드 B 수집과 함께 건다. 도착률은 이 파일이 정하고 기록 조건에 적는다(2계층).
// 시나리오 셋(고정 도착률 · 서로 독립):
//   latest — GET /api/v1/realtime/devices/{d}/tags · d = 1..NDEV 순환(RATE_LATEST · 기본 20/s)
//   ts     — POST /api/v1/timeseries/query · now 기준 최근 TS_RANGE_MIN분 · 설비 d의 앞 TS_TAGS 태그(RATE_TS · 기본 5/s)
//   master — GET /api/v1/devices?siteId=1(RATE_MASTER · 기본 1/s · siteId는 필수 필터 — 07_api/04 #2)
// 태그 ID = (설비 − 1) × TPD + k(티어 시드 · 빈 기반 스냅샷에 한 번 시드 — seed.ts). 0인 도착률은 그 시나리오를 뺀다.
import { check } from 'k6';
import http from 'k6/http';

const DURATION = __ENV.DURATION || '60s';
const RATES = {
  latest: Number(__ENV.RATE_LATEST ?? 20),
  ts: Number(__ENV.RATE_TS ?? 5),
  master: Number(__ENV.RATE_MASTER ?? 1),
};
const NDEV = Number(__ENV.NDEV || 50);
const TPD = Number(__ENV.TPD || 200);
const TS_TAGS = Number(__ENV.TS_TAGS || 4);
const TS_RANGE_MIN = Number(__ENV.TS_RANGE_MIN || 15);

const scenarios = {};
const thresholds = {};
for (const [name, rate] of Object.entries(RATES)) {
  if (!(rate > 0)) continue;
  scenarios[name] = {
    executor: 'constant-arrival-rate',
    exec: name,
    rate,
    timeUnit: '1s',
    duration: DURATION,
    preAllocatedVUs: Math.max(5, Math.ceil(rate / 2)),
    maxVUs: Math.max(50, rate * 5),
  };
  // 시나리오별 하위 지표를 요약에 싣기 위한 항상 참인 임계(판정이 아니다)
  thresholds[`http_req_duration{scenario:${name}}`] = ['max>=0'];
  thresholds[`checks{scenario:${name}}`] = ['rate>=0'];
}

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['min', 'med', 'avg', 'p(95)', 'p(99)', 'max', 'count'],
  scenarios,
  thresholds,
};

// VU마다 다른 출발점에서 설비를 순환한다 — 한 설비 키에 몰리지 않게
let n = 0;
const dev = () => {
  n += 1;
  return ((__VU * 7919 + n) % NDEV) + 1;
};
const iso = (ms) => new Date(ms + 9 * 3_600_000).toISOString().replace('Z', '+09:00');

export function latest() {
  const r = http.get(`http://api:3000/api/v1/realtime/devices/${dev()}/tags`, { tags: { name: 'latest' } });
  check(r, { 200: (x) => x.status === 200 });
}

export function ts() {
  const d = dev();
  const tagIds = Array.from({ length: TS_TAGS }, (_, k) => (d - 1) * TPD + k + 1);
  const now = Date.now();
  const r = http.post(
    'http://api:3000/api/v1/timeseries/query',
    JSON.stringify({ tagIds, from: iso(now - TS_RANGE_MIN * 60_000), to: iso(now), aggregations: ['avg', 'max'] }),
    { headers: { 'content-type': 'application/json' }, tags: { name: 'ts' } },
  );
  check(r, { 200: (x) => x.status === 200 });
}

export function master() {
  const r = http.get('http://api:3000/api/v1/devices?siteId=1', { tags: { name: 'master' } });
  check(r, { 200: (x) => x.status === 200 });
}
