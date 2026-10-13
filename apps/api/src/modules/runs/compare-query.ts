// ② 조회 대결 자르기 · 대조(순수 함수) — 원천 행 수 단계(넣기 건수와 같은 10만 ~ 10억 · 사용자 결정 2026-10-12)
// 원천 N행 = 넣기 구간 시작부터 (시각 · 설비 · 태그) 순으로 N번째 행까지. 같은 시각에 여러 행이 몰려 있어 시각만으로는 N에 맞출 수 없다
// (카드 라인 1초 = 0 ms 129행 · 200 ms마다 18행 · 100 ms마다 6행 — 모두 3의 배수라 10만 같은 수는 시각 경계로 만들 수 없다).
// 그래서 ① 초별 행 수로 N번째 행이 든 초와 그 초 안 순번을 찾고 ② 그 초의 행을 같은 순서로 읽어 자른 자리(시각 · 설비 · 태그)를 고른다.
// ①은 실제로는 ClickHouse 안에서 계산한다(compare-sql CH_SECOND_CUTS — 10억 넣기면 초가 약 433만 개) · cutSeconds는 같은 규칙의 기준 구현이다(가짜 저장소 · 시험).
// 집계 결과는 칸(설비 · 태그 · 1시간)마다 행 수 · 값 체크섬을 맞춘다(compareAgg) — 행 수 합이 곧 집계에 쓰인 원천 행 수다.
import type { StorePair } from './compare-stores';

/** 초 하나의 원천 행 수 — 초 시작(epoch ms) */
export interface SecondCount {
  sec: number;
  n: number;
}

/** 자른 자리 — 원천을 (시각 · 설비 · 태그) 순으로 줄 세운 N번째 행 */
export interface CutRow {
  ts: number;
  deviceId: number;
  tagId: number;
}

/** 집계 결과 칸 하나 — 설비 · 태그 · 1시간 칸 시작(epoch ms) · 행 수 · 평균 · 값 체크섬(floor(value × 1000)의 정수 합) */
export interface AggRow {
  deviceId: number;
  tagId: number;
  hour: number;
  n: number;
  v: number;
  s: bigint;
}

/** N번째 행이 든 초와 그 초 안 순번(1부터) — 원천이 N행보다 적으면 null */
export interface CutSecond {
  sec: number;
  rank: number;
}

/**
 * 목표 행 수마다 N번째 행이 든 초 — counts는 초 오름차순이어야 한다(앞 초까지 누적 < N ≤ 그 초까지 누적).
 * 목표가 0 이하이거나 원천 합보다 크면 null.
 */
export function cutSeconds(
  counts: readonly SecondCount[],
  targets: readonly number[],
): Map<number, CutSecond | null> {
  const out = new Map<number, CutSecond | null>();
  const want = [...new Set(targets)].sort((a, b) => a - b);
  let i = 0;
  let before = 0;
  for (const t of want) {
    if (t <= 0) {
      out.set(t, null);
      continue;
    }
    while (i < counts.length && before + (counts[i] as SecondCount).n < t) {
      before += (counts[i] as SecondCount).n;
      i += 1;
    }
    const c = counts[i];
    out.set(t, c ? { sec: c.sec, rank: t - before } : null);
  }
  return out;
}

export interface AggCompare {
  /** 저장소별 원천 행 수(칸 행 수 합) · 값 체크섬 합 · 칸 수 */
  stores: StorePair<{ rows: number; checksum: bigint; groups: number }>;
  /** 서로 다른 칸 수 — 한쪽에만 있는 칸 · 행 수가 다른 칸 · 체크섬이 다른 칸 */
  mismatchGroups: number;
  match: boolean;
}

const groupKey = (r: AggRow) => `${r.deviceId}:${r.tagId}:${r.hour}`;

function summary(rows: readonly AggRow[]) {
  let n = 0;
  let s = 0n;
  for (const r of rows) {
    n += r.n;
    s += r.s;
  }
  return { rows: n, checksum: s, groups: rows.length };
}

/** 두 저장소의 집계 결과를 칸마다 맞춘다 — 평균(부동소수)은 더하는 순서로 끝자리가 갈리므로 행 수 · 정수 체크섬만 본다 */
export function compareAgg(clickhouse: readonly AggRow[], postgres: readonly AggRow[]): AggCompare {
  const pg = new Map(postgres.map((r) => [groupKey(r), r]));
  let mismatch = 0;
  for (const c of clickhouse) {
    const k = groupKey(c);
    const p = pg.get(k);
    if (!p || p.n !== c.n || p.s !== c.s) mismatch += 1;
    pg.delete(k);
  }
  mismatch += pg.size;
  return {
    stores: { clickhouse: summary(clickhouse), postgres: summary(postgres) },
    mismatchGroups: mismatch,
    match: mismatch === 0,
  };
}
