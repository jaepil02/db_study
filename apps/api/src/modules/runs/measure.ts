// 측정 규칙(순수 함수) — 워밍업 1회 버림 + 3회 · 중간값 · 승패는 3회 모두 같을 때만
// 규칙 정본 docs/10_observability/04_experiment_protocol.md(3회 중앙값) · 옛 perf 실행(D-16에서 삭제)의 측정 규칙만 옮겨 왔다.
// 웨이브 2 비교 실행(compare query)이 다시 쓴다 — 정본 docs/07_api/09_datagen.md §조회 대결 문항.

/** 워밍업 1회 버림 + 3회 */
export const MEASURE_WARMUP = 1;
export const MEASURE_REPS = 3;

export const round2 = (x: number): number => Math.round(x * 100) / 100;

/** 중간값 — 빈 배열이면 null */
export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export interface MeasureClock {
  monoMs(): number;
}
export const systemMeasureClock: MeasureClock = { monoMs: () => performance.now() };

export interface Measured {
  /** 측정 3회의 걸린 시간(ms · 0.01 반올림) — 워밍업 제외 */
  values: number[];
  /** 마지막 회가 돌려준 값(결과 행 수 등) */
  rows: number | null;
}

/**
 * 워밍업 1회 버림 + 3회 — fn은 결과 행 수를 돌려준다. 회 사이마다 stopped()를 보고 true면 onStop()을 던진다
 * (실행 틀의 중단 — RunStopped를 넘기면 된다).
 */
export async function measureReps(
  fn: () => Promise<number>,
  opts: { clock?: MeasureClock; stopped?: () => boolean; onStop?: () => Error } = {},
): Promise<Measured> {
  const clock = opts.clock ?? systemMeasureClock;
  let rows: number | null = null;
  const values: number[] = [];
  for (let i = 0; i < MEASURE_WARMUP + MEASURE_REPS; i++) {
    if (opts.stopped?.()) throw opts.onStop ? opts.onStop() : new Error('측정 중단');
    const t0 = clock.monoMs();
    rows = await fn();
    const ms = clock.monoMs() - t0;
    if (i >= MEASURE_WARMUP) values.push(round2(ms));
  }
  return { values, rows };
}

/**
 * 승자 — 같은 회차끼리 짝지어 3회 모두 같은 쪽이 빨랐을 때만 그 쪽 · 한 번이라도 뒤집히거나 같으면 null(승패 없음).
 * 회차 수가 다르거나 비었으면 null.
 */
export function unanimousWinner<A extends string, B extends string>(
  a: { key: A; values: readonly number[] },
  b: { key: B; values: readonly number[] },
): A | B | null {
  if (a.values.length === 0 || a.values.length !== b.values.length) return null;
  let aWins = 0;
  let bWins = 0;
  for (let i = 0; i < a.values.length; i++) {
    const x = a.values[i] as number;
    const y = b.values[i] as number;
    if (x < y) aWins++;
    else if (y < x) bWins++;
  }
  if (aWins === a.values.length) return a.key;
  if (bWins === b.values.length) return b.key;
  return null;
}

/** 배수 — 느린 쪽 중간값 ÷ 빠른 쪽 중간값(0.01 반올림) · 어느 쪽이든 없거나 0이면 null */
export function speedRatio(aMedian: number | null, bMedian: number | null): number | null {
  if (aMedian === null || bMedian === null || aMedian <= 0 || bMedian <= 0) return null;
  return round2(Math.max(aMedian, bMedian) / Math.min(aMedian, bMedian));
}
