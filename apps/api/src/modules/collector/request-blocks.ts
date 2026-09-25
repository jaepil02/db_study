// 요청 블록 계산(COL-03) — 기전 정본 docs/06_pipeline/02_collect.md §폴링과 레지스터 블록 병합
// 같은 function_code 안에서 주소 오름차순으로 묶고, 사이의 안 쓰는 레지스터를 허용 갭까지 함께 읽는다(갭 허용 병합).
// 상한은 요청당 125 레지스터(FC03 · FC04 — 1계층 프로토콜 제약)와 설비별 max_regs_per_request 중 작은 쪽이다.

/** FC03 · FC04 요청당 상한 — 1계층 프로토콜 제약 */
export const FC03_MAX_REGS = 125;

/** 허용 갭 — 2계층 현행 참고 20 레지스터(소유 06_pipeline/02) */
export const MAX_GAP_REGS = 20;

export interface BlockTag<T> {
  tag: T;
  /** 블록 응답 워드 배열 안 첫 워드의 위치 */
  offset: number;
}

export interface RequestBlock<T> {
  /** 3 holding · 4 input — 한 블록은 한 function_code다 */
  fc: number;
  start: number;
  count: number;
  tags: BlockTag<T>[];
}

/**
 * 태그를 function_code별로 나누고 주소 오름차순으로 블록을 만든다. 블록 순서가 곧 한 사이클의 요청 순서다
 * (function_code 오름차순 → 주소 오름차순 순차 요청). 한 태그가 상한보다 넓으면 읽을 수 없으므로 호출자가 먼저 걸러야 한다 — 여기서는 던진다.
 */
export function planBlocks<T extends { address: number; functionCode: number }>(
  tags: readonly T[],
  wordsOf: (t: T) => number,
  maxRegs: number,
  maxGap = MAX_GAP_REGS,
): RequestBlock<T>[] {
  const limit = Math.min(maxRegs, FC03_MAX_REGS);
  const sorted = [...tags].sort((a, b) => a.functionCode - b.functionCode || a.address - b.address);
  const blocks: RequestBlock<T>[] = [];
  let cur: RequestBlock<T> | null = null;
  for (const t of sorted) {
    const words = wordsOf(t);
    if (words > limit)
      throw new Error(`태그 폭 ${words}워드가 요청 상한 ${limit}을 넘는다 — 주소 ${t.address}`);
    const end = t.address + words;
    // 같은 function_code · 갭이 허용 갭 이하 · 넓혀도 상한 안이면 같은 블록
    if (
      cur &&
      cur.fc === t.functionCode &&
      t.address - (cur.start + cur.count) <= maxGap &&
      Math.max(end, cur.start + cur.count) - cur.start <= limit
    ) {
      cur.count = Math.max(end, cur.start + cur.count) - cur.start;
      cur.tags.push({ tag: t, offset: t.address - cur.start });
      continue;
    }
    cur = { fc: t.functionCode, start: t.address, count: words, tags: [{ tag: t, offset: 0 }] };
    blocks.push(cur);
  }
  return blocks;
}
