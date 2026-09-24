// 요청 블록 계산 — 기전 정본 docs/06_pipeline/02_collect.md §폴링과 레지스터 블록 병합
// S2: 연속 주소 태그만 한 요청으로 묶고 max_regs_per_request(≤ 125)에서 자른다.
// 허용 갭 병합(COL-03 · 현행 참고 20 레지스터)은 S3 — 지금은 갭이 있으면 블록을 가른다.

/** FC03 요청당 상한 — 1계층 프로토콜 제약 */
export const FC03_MAX_REGS = 125;

export interface BlockTag<T> {
  tag: T;
  /** 블록 응답 워드 배열 안 첫 워드의 위치 */
  offset: number;
}

export interface RequestBlock<T> {
  start: number;
  count: number;
  tags: BlockTag<T>[];
}

/**
 * 태그를 주소 오름차순으로 정렬해 블록으로 묶는다. 블록 순서가 곧 한 사이클의 요청 순서다(주소 오름차순 순차 요청).
 * 한 태그가 maxRegs보다 넓으면 읽을 수 없으므로 호출자가 먼저 걸러야 한다 — 여기서는 던진다.
 */
export function planBlocks<T extends { address: number }>(
  tags: readonly T[],
  wordsOf: (t: T) => number,
  maxRegs: number,
): RequestBlock<T>[] {
  const limit = Math.min(maxRegs, FC03_MAX_REGS);
  const sorted = [...tags].sort((a, b) => a.address - b.address);
  const blocks: RequestBlock<T>[] = [];
  let cur: RequestBlock<T> | null = null;
  for (const t of sorted) {
    const words = wordsOf(t);
    if (words > limit)
      throw new Error(`태그 폭 ${words}워드가 요청 상한 ${limit}을 넘는다 — 주소 ${t.address}`);
    const end = t.address + words;
    // 연속(또는 겹침)이고 넓혀도 상한 안이면 같은 블록 — 갭이 있으면 가른다
    if (
      cur &&
      t.address <= cur.start + cur.count &&
      Math.max(end, cur.start + cur.count) - cur.start <= limit
    ) {
      cur.count = Math.max(end, cur.start + cur.count) - cur.start;
      cur.tags.push({ tag: t, offset: t.address - cur.start });
      continue;
    }
    cur = { start: t.address, count: words, tags: [{ tag: t, offset: 0 }] };
    blocks.push(cur);
  }
  return blocks;
}
