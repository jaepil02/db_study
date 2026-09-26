// 분위수 · 분포 요약 · 구조 판정 집계 — 실행기 한 반복의 원시 요약(3회 중앙값 · 편차는 오케스트레이터 collect의 몫)

/** 선형 보간 분위수(numpy 기본 · R-7) — 정렬된 배열 */
export function quantileSorted(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (q <= 0) return sorted[0] as number;
  if (q >= 1) return sorted[sorted.length - 1] as number;
  const h = (sorted.length - 1) * q;
  const lo = Math.floor(h);
  const a = sorted[lo] as number;
  const b = sorted[Math.min(lo + 1, sorted.length - 1)] as number;
  return a + (b - a) * (h - lo);
}

export interface Dist {
  count: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  mean: number | null;
  max: number | null;
}

const round3 = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);

export function dist(values: readonly number[]): Dist {
  const s = [...values].sort((a, b) => a - b);
  const sum = s.reduce((acc, x) => acc + x, 0);
  return {
    count: s.length,
    p50: round3(quantileSorted(s, 0.5)),
    p95: round3(quantileSorted(s, 0.95)),
    p99: round3(quantileSorted(s, 0.99)),
    mean: round3(s.length ? sum / s.length : null),
    max: round3(s.length ? (s[s.length - 1] as number) : null),
  };
}

/** 가시성 — 폴링 상한 안에 본 것의 분포 + 상한 안 미관측 건수(null) */
export function visibility(values: readonly (number | null)[]): Dist & { unobserved: number } {
  const seen = values.filter((v): v is number => v !== null);
  return { ...dist(seen), unobserved: values.length - seen.length };
}

/** EXP-42 — 부분 반영(상태만 바뀌고 실적 0행) · 경합 위반(한 주문에 실적 2행 이상) */
export function atomicCounts(orders: readonly { completed: boolean; logs: number }[]): {
  partialApply: number;
  raceViolation: number;
  completedWithLog: number;
} {
  let partialApply = 0;
  let raceViolation = 0;
  let completedWithLog = 0;
  for (const o of orders) {
    if (o.completed && o.logs === 0) partialApply++;
    if (o.logs >= 2) raceViolation++;
    if (o.completed && o.logs >= 1) completedWithLog++;
  }
  return { partialApply, raceViolation, completedWithLog };
}

/** EXP-43 — 시도별 성패를 경우마다 수용 건수로 */
export function acceptedCounts(
  attempts: readonly { case: string; ok: boolean }[],
): Record<string, { attempts: number; accepted: number }> {
  const out: Record<string, { attempts: number; accepted: number }> = {};
  for (const a of attempts) {
    const c = out[a.case] ?? { attempts: 0, accepted: 0 };
    c.attempts++;
    if (a.ok) c.accepted++;
    out[a.case] = c;
  }
  return out;
}
