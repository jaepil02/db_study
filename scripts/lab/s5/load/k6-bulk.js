// EXP-37 S5 — 모드 C 수집 부하(k6가 내는 수집 부하 · 조회를 섞지 않는다 — 05_load_scenarios §부하 단위).
// POST /api/v1/ingest/bulk(07_api/09 #1) · 게이트 DATAGEN_BULK_ENABLED=true로 기동한 api · 무인증(S5).
// 503 datagen.stream_full은 재시도하지 않고 따로 센다(07_api/09 — 거절 수가 곧 HTTP 경유 수집 상한의 신호) · 부분 수용 요청도 재전송하지 않는다.
// 부하: PPS(초당 포인트) · ENTRIES(요청당 엔트리 — 조건 칸) · 엔트리 = 설비 하나의 시점 하나(TPD 태그 · dt 전부 0 · quality 9)
//   요청 도착률 = PPS ÷ (ENTRIES × TPD) — constant-arrival-rate(rate = PPS · timeUnit = ENTRIES × TPD 초)
//   전역 엔트리 번호 g = 반복 번호(테스트 전체) × ENTRIES + j → 설비 = g mod NDEV + 1 · 시점 k = ⌊g ÷ NDEV⌋
//   ts = T0 − SHIFT + k × (1000 ÷ HZ) · HZ = PPS ÷ (NDEV × TPD) — 한 요청이 담는 시점 폭(SHIFT)만큼 격자를 뒤로 물려 미래 ts를 만들지 않는다
//   (묶어 보내는 발행자는 모은 뒤에 보낸다 — 그 지연은 E2E에 그대로 들어간다 · 기록 해석에 적는다)
// 태그 ID = (설비 − 1) × TPD + 1 … 설비 × TPD(티어 시드). scanSeq = k(설비 안 단조 증가).
import { check } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const PPS = Number(__ENV.PPS || 10000);
const ENTRIES = Number(__ENV.ENTRIES || 50);
const NDEV = Number(__ENV.NDEV || 50);
const TPD = Number(__ENV.TPD || 200);
const DURATION = __ENV.DURATION || '60s';
const HZ = PPS / (NDEV * TPD);
const PERIOD_MS = 1000 / HZ;
const SHIFT_MS = Math.ceil(ENTRIES / NDEV / HZ) * 1000;

const accRows = new Counter('bulk_accepted_rows');
const accEntries = new Counter('bulk_accepted_entries');
const sentRows = new Counter('bulk_sent_rows');
const c202 = new Counter('bulk_202');
const c503 = new Counter('bulk_503');
const c503Partial = new Counter('bulk_503_partial_entries');
const c4xx = new Counter('bulk_4xx');
const cOther = new Counter('bulk_other');
const bodyBytes = new Trend('bulk_body_bytes');

export const options = {
  summaryTrendStats: ['min', 'med', 'avg', 'p(95)', 'p(99)', 'max', 'count'],
  scenarios: {
    bulk: {
      executor: 'constant-arrival-rate',
      rate: PPS,
      timeUnit: `${ENTRIES * TPD}s`,
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 400,
    },
  },
};

const TAGS = Array.from({ length: NDEV }, (_, d) => Array.from({ length: TPD }, (_, k) => d * TPD + k + 1));
const ZEROS = Array.from({ length: TPD }, () => 0);
const NINES = Array.from({ length: TPD }, () => 9);

export function setup() {
  if (!Number.isInteger(PERIOD_MS)) throw new Error(`PPS ${PPS} → 주기 ${PERIOD_MS} ms — 정수 ms 격자가 아니다`);
  // 격자 시작을 지난 초로 내린다 — 올림(ceil)이면 첫 엔트리가 벽시계보다 최대 1초 앞서 미래 ts가 된다(검수 #12)
  return { t0: Math.floor(Date.now() / 1000) * 1000 - SHIFT_MS };
}

export default function (data) {
  const i = exec.scenario.iterationInTest;
  const entries = [];
  for (let j = 0; j < ENTRIES; j++) {
    const g = i * ENTRIES + j;
    const d = g % NDEV;
    const k = Math.floor(g / NDEV);
    const t0 = data.t0 + k * PERIOD_MS;
    const values = TAGS[d].map((tag) => Math.round((50 + 40 * Math.sin((t0 / 600_000 + tag / 50) * 2 * Math.PI)) * 100) / 100);
    entries.push({ deviceId: d + 1, scanSeq: k, t0, tagIds: TAGS[d], dt: ZEROS, values, quality: NINES });
  }
  const body = JSON.stringify({ v: 1, entries });
  bodyBytes.add(body.length);
  sentRows.add(ENTRIES * TPD);
  const r = http.post('http://api:3000/api/v1/ingest/bulk', body, {
    headers: { 'content-type': 'application/json' },
    tags: { name: 'bulk' },
    responseType: 'text',
  });
  if (r.status === 202) {
    c202.add(1);
    try {
      const b = JSON.parse(r.body);
      accRows.add(b.acceptedRows);
      accEntries.add(b.acceptedEntries);
    } catch (_) {
      cOther.add(1);
    }
  } else if (r.status === 503) {
    c503.add(1);
    try {
      const p = JSON.parse(r.body).error?.details?.acceptedEntries ?? 0;
      c503Partial.add(p);
      accEntries.add(p);
      accRows.add(p * TPD);
    } catch (_) {
      // 봉투가 아닌 503은 부분 수용 0으로 센다
    }
  } else if (r.status >= 400 && r.status < 500) {
    c4xx.add(1);
  } else {
    cOther.add(1);
  }
  check(r, { '202': (x) => x.status === 202 });
}
