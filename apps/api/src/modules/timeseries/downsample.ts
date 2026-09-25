// 2차 축소(TSQ-06) — 정본 docs/06_pipeline/06_timeseries_read.md §다운샘플 · 메타 부착 · 07_api/05 §서버가 요청을 바꾸는 자리
// 1차 축소는 롤업이 이미 했다. 여전히 태그당 maxPoints를 넘으면 태그마다 줄인다 — 워커에서 돈다(ADR-25 · 이벤트 루프 격리).
// 단순 n번째 추출을 쓰지 않는다 — 스파이크를 잃어 알람 원인 분석에서 이상치가 사라진다(원본 data_flow.md §6.3).
// 점 모양: [ts, ...열] — 열 순서는 meta.columns(첫 열 ts)를 따른다. null 값은 없는 버킷 값이다(집계가 비면 null).

export type Row = (number | null)[];

/**
 * LTTB(Largest-Triangle-Three-Buckets) — 첫 · 끝 점을 두고 가운데를 (threshold − 2)개 구간으로 나눠
 * 구간마다 앞 선택점 · 다음 구간 평균점과 만드는 삼각형 넓이가 가장 큰 점 하나를 고른다. 판정 열은 valueCol(값 · 평균).
 * 고른 점의 행 전체를 그대로 낸다 — 다른 열(min · max · 품질)도 같은 시각의 실제 값이다.
 */
export function lttb(rows: readonly Row[], threshold: number, valueCol = 1): Row[] {
  const n = rows.length;
  if (threshold >= n || threshold < 3)
    return threshold < 3 ? rows.slice(0, Math.max(0, threshold)) : [...rows];
  const y = (r: Row) => (r[valueCol] ?? 0) as number;
  const x = (r: Row) => r[0] as number;
  const out: Row[] = [rows[0] as Row];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgX += x(rows[j] as Row);
      avgY += y(rows[j] as Row);
    }
    const len = Math.max(1, avgEnd - avgStart);
    avgX /= len;
    avgY /= len;
    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd = Math.floor((i + 1) * every) + 1;
    const ax = x(rows[a] as Row);
    const ay = y(rows[a] as Row);
    let maxArea = -1;
    let pick = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      const r = rows[j] as Row;
      const area = Math.abs((ax - avgX) * (y(r) - ay) - (ax - x(r)) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        pick = j;
      }
    }
    out.push(rows[pick] as Row);
    a = pick;
  }
  out.push(rows[n - 1] as Row);
  return out;
}

/**
 * 극값 보존(minmax) — 인접 점을 묶어 묶음마다 극값을 남긴다.
 * raw(열 [ts, value, quality]) — 묶음마다 최소 · 최대 두 점을 시각 순서로(점 수 ≤ 2 × 묶음 수).
 * 롤업 — 묶음마다 한 행: min 열은 최솟값 · max 열은 최댓값 · last는 묶음 끝 · avg는 평균 · p95는 최댓값(보수적) · ts는 묶음 시작.
 */
export function minmax(rows: readonly Row[], maxPoints: number, columns: readonly string[]): Row[] {
  const n = rows.length;
  if (n <= maxPoints) return [...rows];
  if (columns[1] === 'value') {
    const groups = Math.max(1, Math.floor(maxPoints / 2));
    const out: Row[] = [];
    for (let g = 0; g < groups; g++) {
      const s = Math.floor((g * n) / groups);
      const e = Math.floor(((g + 1) * n) / groups);
      let lo = s;
      let hi = s;
      for (let j = s; j < e; j++) {
        if (((rows[j] as Row)[1] ?? 0) < ((rows[lo] as Row)[1] ?? 0)) lo = j;
        if (((rows[j] as Row)[1] ?? 0) > ((rows[hi] as Row)[1] ?? 0)) hi = j;
      }
      if (lo === hi) out.push(rows[lo] as Row);
      else for (const j of lo < hi ? [lo, hi] : [hi, lo]) out.push(rows[j] as Row);
    }
    return out;
  }
  const out: Row[] = [];
  for (let g = 0; g < maxPoints; g++) {
    const s = Math.floor((g * n) / maxPoints);
    const e = Math.floor(((g + 1) * n) / maxPoints);
    const grp = rows.slice(s, e);
    const row: Row = [(grp[0] as Row)[0] ?? null];
    for (let c = 1; c < columns.length; c++) {
      const vals = grp.map((r) => r[c]).filter((v): v is number => v !== null && v !== undefined);
      const col = columns[c];
      if (vals.length === 0) row.push(null);
      else if (col === 'min') row.push(Math.min(...vals));
      else if (col === 'max' || col === 'p95') row.push(Math.max(...vals));
      else if (col === 'last') row.push(vals[vals.length - 1] as number);
      else row.push(vals.reduce((x, v) => x + v, 0) / vals.length);
    }
    out.push(row);
  }
  return out;
}

export interface ReduceTask {
  series: Row[][];
  maxPoints: number;
  mode: 'lttb' | 'minmax';
  columns: string[];
}
export interface ReduceResult {
  series: Row[][];
  downsampled: boolean;
  busyMs: number;
}

/** 워커 작업 — 태그마다 maxPoints를 넘는 것만 줄인다 */
export function reduceSeries(t: ReduceTask): ReduceResult {
  const t0 = performance.now();
  let downsampled = false;
  const series = t.series.map((rows) => {
    if (rows.length <= t.maxPoints) return rows;
    downsampled = true;
    return t.mode === 'minmax' ? minmax(rows, t.maxPoints, t.columns) : lttb(rows, t.maxPoints, 1);
  });
  return { series, downsampled, busyMs: performance.now() - t0 };
}
