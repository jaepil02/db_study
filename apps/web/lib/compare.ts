// EXP-COMPARE 순수 로직 — 정본 docs/08_screen/07_experiment_console.md §EXP-COMPARE · 편차 규칙 10_observability/04 §반복과 폐기
// 측정 창 = 창 시작 캡처와 끝 캡처(health + metrics 누적값)의 차. 창 분위수는 히스토그램 버킷 차의 선형 보간이다.
// 히스토그램 계열의 판정 분위수는 p50 — p95는 참고로 보이고 편차 판정에 쓰지 않는다(10_observability/04 S2 판정).
import type { MetricSample } from './metrics-parser';
import { type HealthBody, SWITCHES } from './shared';
import { comboWarnings } from './switches';

export interface Capture {
  atMs: number;
  health: HealthBody;
  samples: MetricSample[];
}
export interface MeasureWindow {
  id: string;
  start: Capture;
  end: Capture;
}

/** 편차 폐기 기준 — 2계층 현행 참고 20%(소유 10_observability/04) */
export const DEVIATION_LIMIT = 0.2;

type Filter = Record<string, string>;
const match = (s: MetricSample, name: string, f: Filter) =>
  s.name === name && Object.entries(f).every(([k, v]) => s.labels[k] === v);

/** 창 안 누적 차 — 레이블 조합별로 빼서 더한다 */
export function counterDelta(w: MeasureWindow, name: string, f: Filter = {}): number | null {
  const sum = (xs: MetricSample[]) => {
    const hit = xs.filter((s) => match(s, name, f));
    return hit.length === 0 ? null : hit.reduce((a, s) => a + s.value, 0);
  };
  const a = sum(w.start.samples);
  const b = sum(w.end.samples);
  if (b === null) return null;
  return b - (a ?? 0);
}

export function gaugeEnd(w: MeasureWindow, name: string, f: Filter = {}): number | null {
  const hit = w.end.samples.filter((s) => match(s, name, f));
  return hit.length === 0 ? null : hit.reduce((a, s) => a + s.value, 0);
}

/** 버킷 차의 분위수(초) — 레이블 조합을 le별로 합친 뒤 Prometheus 방식 선형 보간. 표본 0이면 null */
export function histQuantile(w: MeasureWindow, name: string, q: number, f: Filter = {}): number | null {
  const byLe = (xs: MetricSample[]) => {
    const m = new Map<number, number>();
    for (const s of xs) {
      if (!match(s, `${name}_bucket`, f) || s.labels.le === undefined) continue;
      const le = s.labels.le === '+Inf' ? Number.POSITIVE_INFINITY : Number(s.labels.le);
      m.set(le, (m.get(le) ?? 0) + s.value);
    }
    return m;
  };
  const a = byLe(w.start.samples);
  const b = byLe(w.end.samples);
  const les = [...b.keys()].sort((x, y) => x - y);
  const cum = les.map((le) => (b.get(le) ?? 0) - (a.get(le) ?? 0));
  const total = cum[cum.length - 1] ?? 0;
  if (total <= 0) return null;
  const rank = q * total;
  for (let i = 0; i < les.length; i++) {
    if ((cum[i] ?? 0) >= rank) {
      const hi = les[i] as number;
      const lo = i === 0 ? 0 : (les[i - 1] as number);
      if (!Number.isFinite(hi)) return lo; // +Inf 칸 — 마지막 유한 경계
      const below = i === 0 ? 0 : (cum[i - 1] ?? 0);
      const inBucket = (cum[i] ?? 0) - below;
      return inBucket <= 0 ? hi : lo + (hi - lo) * ((rank - below) / inBucket);
    }
  }
  return null;
}

/** 재기동 감지 — 누적 계열(_total · _bucket · _count · _sum)이 하나라도 줄었다 */
export function restartDetected(w: MeasureWindow): boolean {
  const key = (s: MetricSample) =>
    `${s.name}{${Object.entries(s.labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(',')}}`;
  const start = new Map(w.start.samples.map((s) => [key(s), s.value]));
  for (const s of w.end.samples) {
    if (!/_(total|bucket|count|sum)$/.test(s.name)) continue;
    const prev = start.get(key(s));
    if (prev !== undefined && s.value < prev) return true;
  }
  return false;
}

export interface CompareMetric {
  label: string;
  /** 편차 판정에 쓰는가 — 히스토그램 p95 등 참고 지표는 false */
  judged: boolean;
  value(w: MeasureWindow): number | null;
}

const perSec = (w: MeasureWindow, v: number | null) =>
  v === null ? null : v / Math.max(0.001, (w.end.atMs - w.start.atMs) / 1000);
const ms = (v: number | null) => (v === null ? null : v * 1000);

/** 스위치별 비교 표 지표 — §스위치별 비교 대상의 "화면 비교 표의 지표" 열 */
export const COMPARE_METRICS: Record<string, CompareMetric[]> = {
  'SW-01': [{ label: '적체(consumer_lag 끝값)', judged: true, value: (w) => gaugeEnd(w, 'consumer_lag') }],
  'SW-02': [
    {
      label: '최신값 API p50(ms)',
      judged: true,
      value: (w) =>
        ms(
          histQuantile(w, 'http_request_duration_seconds', 0.5, {
            route: '/api/v1/realtime/devices/:id/tags',
          }),
        ),
    },
    {
      label: '최신값 API p95(ms · 참고)',
      judged: false,
      value: (w) =>
        ms(
          histQuantile(w, 'http_request_duration_seconds', 0.95, {
            route: '/api/v1/realtime/devices/:id/tags',
          }),
        ),
    },
  ],
  'SW-03': [
    {
      label: '시계열 조회 p50(ms)',
      judged: true,
      value: (w) =>
        ms(histQuantile(w, 'http_request_duration_seconds', 0.5, { route: '/api/v1/timeseries/query' })),
    },
    {
      label: '시계열 조회 p95(ms · 참고)',
      judged: false,
      value: (w) =>
        ms(histQuantile(w, 'http_request_duration_seconds', 0.95, { route: '/api/v1/timeseries/query' })),
    },
    {
      label: 'ClickHouse 쿼리 실행 수',
      judged: true,
      value: (w) => counterDelta(w, 'tsq_source_queries_total'),
    },
  ],
  'SW-04': [
    {
      label: '캐시 히트율',
      judged: true,
      value: (w) => {
        const hit = counterDelta(w, 'tsq_cache_requests_total', { result: 'hit' }) ?? 0;
        const all = counterDelta(w, 'tsq_cache_requests_total');
        return all ? hit / all : null;
      },
    },
  ],
  'SW-05': [
    {
      label: 'ClickHouse 쿼리 실행 수',
      judged: true,
      value: (w) => counterDelta(w, 'tsq_source_queries_total'),
    },
    {
      label: '락 대기 소진 수',
      judged: false,
      value: (w) => counterDelta(w, 'tsq_rebuild_lock_wait_exhausted_total'),
    },
  ],
  'SW-06': [
    {
      label: '발행 → 도착 p50(ms)',
      judged: true,
      value: (w) => ms(histQuantile(w, 'rlt_fanout_delivery_seconds', 0.5)),
    },
    {
      label: '발행 → 도착 p95(ms · 참고)',
      judged: false,
      value: (w) => ms(histQuantile(w, 'rlt_fanout_delivery_seconds', 0.95)),
    },
  ],
  'SW-07': [
    {
      label: '연결당 초당 rt 프레임',
      judged: true,
      value: (w) => {
        const conns = gaugeEnd(w, 'ws_connections');
        const f = perSec(w, counterDelta(w, 'ws_frames_sent_total', { channel: 'rt' }));
        return conns && f !== null ? f / conns : null;
      },
    },
    {
      label: '이벤트 루프 p95(ms · 끝값)',
      judged: false,
      value: (w) => ms(gaugeEnd(w, 'nodejs_eventloop_lag_p95_seconds')),
    },
  ],
  'SW-08': [
    { label: '삽입 재시도 수', judged: true, value: (w) => counterDelta(w, 'ing_insert_retries_total') },
  ],
  'SW-09': [
    {
      label: '대조군 적재 행/초',
      judged: true,
      value: (w) => perSec(w, counterDelta(w, 'ing_control_copy_rows_total')),
    },
  ],
  'SW-10': [
    { label: '데드밴드 생략 수', judged: true, value: (w) => counterDelta(w, 'col_deadband_skipped_total') },
  ],
  'SW-11': [
    { label: '최신값 갱신 수', judged: true, value: (w) => counterDelta(w, 'rlt_latest_updates_total') },
  ],
};

/** 조건 = 주입 구현 11개(SW-07은 창 값까지) — 이 문자열이 같으면 같은 조건이다 */
export function conditionKey(h: HealthBody): string {
  return SWITCHES.map((s) => {
    const cur = h.switches[s.id];
    const impl = cur?.impl ?? '도입 전';
    return `${s.id}=${impl}${s.id === 'SW-07' ? `:${String(cur?.value ?? '')}` : ''}`;
  }).join('|');
}

export function groupByCondition(ws: readonly MeasureWindow[]): Map<string, MeasureWindow[]> {
  const m = new Map<string, MeasureWindow[]>();
  for (const w of ws) {
    const k = conditionKey(w.start.health);
    m.set(k, [...(m.get(k) ?? []), w]);
  }
  return m;
}

/** 두 조건이 다른 스위치 id 목록 */
export function differingSwitches(a: HealthBody, b: HealthBody): string[] {
  const ka = conditionKey(a).split('|');
  const kb = conditionKey(b).split('|');
  return SWITCHES.filter((_, i) => ka[i] !== kb[i]).map((s) => s.id);
}

/** 대상 스위치의 조합 제약 — 그 제약에 걸리면 차이가 0으로 나온다(02_features/13 §조합 제약) */
const TARGET_COMBOS: Record<string, number[]> = { 'SW-04': [1], 'SW-05': [1], 'SW-11': [7] };

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** 편차 = (최대 − 최소) ÷ 중앙값 */
export function deviation(xs: readonly number[]): number | null {
  const med = median(xs);
  if (med === null || med === 0 || xs.length < 2) return med === 0 && xs.every((x) => x === 0) ? 0 : null;
  return (Math.max(...xs) - Math.min(...xs)) / Math.abs(med);
}

export interface Comparability {
  ok: boolean;
  target: string | null;
  reasons: string[];
}

/** §비교 성립 조건 6 — 전부 통과해야 비교 표를 그린다 */
export function judgeComparability(
  a: readonly MeasureWindow[],
  b: readonly MeasureWindow[],
  need = 3,
): Comparability {
  const reasons: string[] = [];
  const ha = a[0]?.start.health;
  const hb = b[0]?.start.health;
  if (!ha || !hb) return { ok: false, target: null, reasons: ['비교할 두 번째 조건이 없다'] };
  const diff = differingSwitches(ha, hb);
  const target = diff.length === 1 ? (diff[0] as string) : null;
  if (diff.length !== 1)
    reasons.push(`다른 스위치가 ${diff.length}개(${diff.join(' · ') || '없음'}) — 정확히 하나여야 한다`);
  const all = [...a, ...b];
  if (all.some(restartDetected)) reasons.push('창 안에 재기동이 있다(누적값 감소)');
  if (a.length < need || b.length < need)
    reasons.push(`조건당 창 ${need}개 — A ${a.length}/${need} · B ${b.length}/${need}`);
  if (target) {
    for (const m of COMPARE_METRICS[target] ?? []) {
      if (!m.judged) continue;
      for (const [name, set] of [
        ['A', a],
        ['B', b],
      ] as const) {
        const vals = set.map((w) => m.value(w)).filter((v): v is number => v !== null);
        const d = deviation(vals);
        if (d !== null && d > DEVIATION_LIMIT)
          reasons.push(`편차 초과 — ${name} ${m.label} ${(d * 100).toFixed(0)}% > ${DEVIATION_LIMIT * 100}%`);
      }
    }
    const combos = TARGET_COMBOS[target] ?? [];
    for (const h of [ha, hb]) {
      const hit = comboWarnings(h.switches).filter((c) => combos.includes(c.no));
      for (const c of hit) reasons.push(`조합 제약 #${c.no} — ${c.text}`);
    }
  }
  const runKey = (h: HealthBody) => `${h.run.commitHash}|${h.run.memoryProfile}|${h.run.capacityTier}`;
  if (new Set(all.map((w) => runKey(w.start.health))).size > 1)
    reasons.push('커밋 해시 · 메모리 프로파일 · 용량 티어가 창마다 다르다');
  if (
    all.some(
      (w) =>
        runKey(w.start.health) !== runKey(w.end.health) ||
        conditionKey(w.start.health) !== conditionKey(w.end.health),
    )
  )
    reasons.push('창 안에서 조건(4요소 · 스위치)이 바뀌었다');
  return { ok: reasons.length === 0, target, reasons: [...new Set(reasons)] };
}

/** 쌍 현황 — 이 브라우저에 기본 구현 창과 대안 구현 창이 모두 있는 스위치 수 */
export function pairedSwitches(ws: readonly MeasureWindow[]): string[] {
  const seen = new Map<string, Set<string>>();
  for (const w of ws) {
    for (const s of SWITCHES) {
      const impl = w.start.health.switches[s.id]?.impl;
      if (!impl) continue;
      const set = seen.get(s.id) ?? new Set();
      set.add(impl);
      seen.set(s.id, set);
    }
  }
  return SWITCHES.filter((s) => (seen.get(s.id)?.size ?? 0) >= 2).map((s) => s.id);
}

/** BFF가 창 계산용으로 내리는 계열 — 누적 버킷까지(요약 아님 · 07_api/10 웹 내부 계약) */
export const WINDOW_METRIC_NAMES = new Set([
  'consumer_lag',
  'http_request_duration_seconds_bucket',
  'tsq_source_queries_total',
  'tsq_cache_requests_total',
  'tsq_rebuild_lock_wait_exhausted_total',
  'rlt_fanout_delivery_seconds_bucket',
  'ws_frames_sent_total',
  'ws_connections',
  'nodejs_eventloop_lag_p95_seconds',
  'ing_insert_retries_total',
  'ing_control_copy_rows_total',
  'col_deadband_skipped_total',
  'rlt_latest_updates_total',
]);
