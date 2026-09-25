// S4 조회 시나리오 — 고정 도착률 · 대상 http://api:3000(Host 허용 이름) · scripts/lab/s4/exp0{8,9}-rep.sh가 부른다.
// MODE: repeat — 이력 안 고정 범위 10개를 돌려 가며(반복 조회 · 히트 경로)
//       fresh  — 요청마다 다른 분 경계의 1일 범위(신규 범위 · 미스 경로)
//       relative — now 기준 상대 범위(from = now − 24시간 · to = now − 10분)를 반복(SW-04 키 파편화)
//       burst  — 같은 범위(FROM_MS · TO_MS)를 VU N개가 한 번씩 동시에(EXP-10 스탬피드 · per-vu-iterations)
// 이력 앵커(ANCHOR_START · ANCHOR_END epoch 초)는 s4-hist-m seed.txt 값 · 태그는 시드 부분 집합의 4개.
import http from 'k6/http';
import { check } from 'k6';

const RATE = Number(__ENV.RATE || 20);
const DURATION = __ENV.DURATION || '60s';
const MODE = __ENV.MODE || 'repeat';
const A0 = Number(__ENV.ANCHOR_START) * 1000;
const A1 = Number(__ENV.ANCHOR_END) * 1000;
const TAGS = [1, 2, 201, 202];
const DAY = 86_400_000;

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['min', 'med', 'avg', 'p(95)', 'p(99)', 'max'],
  scenarios:
    MODE === 'burst'
      ? { q: { executor: 'per-vu-iterations', vus: Number(__ENV.N || 50), iterations: 1, maxDuration: '30s' } }
      : { q: { executor: 'constant-arrival-rate', rate: RATE, timeUnit: '1s', duration: DURATION, preAllocatedVUs: 20, maxVUs: 200 } },
};

const iso = (ms) => new Date(ms + 9 * 3_600_000).toISOString().replace('Z', '+09:00');

export default function () {
  let from;
  let to;
  if (MODE === 'repeat') {
    const i = __ITER % 10;
    from = A0 + DAY / 2 + i * (DAY / 4);
    to = from + DAY;
  } else if (MODE === 'fresh') {
    // VU · 반복마다 다른 분 — 한 실행 안에서 겹치지 않게 분 오프셋을 흩는다
    const k = (__VU * 7919 + __ITER * 104729) % (4 * 1440);
    from = A0 + DAY / 2 + k * 60_000;
    to = from + DAY;
  } else if (MODE === 'burst') {
    from = Number(__ENV.FROM_MS);
    to = Number(__ENV.TO_MS);
  } else {
    const now = Date.now();
    from = now - DAY;
    to = now - 10 * 60_000;
  }
  const r = http.post(
    'http://api:3000/api/v1/timeseries/query',
    JSON.stringify({ tagIds: TAGS, from: iso(from), to: iso(to), aggregations: ['avg', 'max'] }),
    { headers: { 'content-type': 'application/json' } },
  );
  check(r, { 200: (x) => x.status === 200 });
}
