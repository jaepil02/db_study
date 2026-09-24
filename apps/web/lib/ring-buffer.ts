// 태그별 고정 길이 버퍼 — 계약 docs/08_screen/01_standards.md §차트 표준(실시간 링 버퍼 · 이어 그리기 기준)
// 시각 · 값 두 열의 Float64Array. 프레임마다 배열을 새로 만들지 않는다 — 초당 10프레임에서 GC가 트렌드를 끊는다.
// uPlot은 순서대로 이어진 배열을 받으므로 원형 인덱스 대신 "용량 2배 저장소 + 가득 차면 뒤쪽 용량만큼 앞으로 당기기"를 쓴다.
// 당기기는 용량만큼 push마다 한 번(분할 상환 O(1))이고, 차트에는 subarray 뷰(데이터 복사 없음)를 넘긴다.

export class TagRingBuffer {
  readonly capacity: number;
  private readonly tsStore: Float64Array;
  private readonly valStore: Float64Array;
  private start = 0;
  private end = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.tsStore = new Float64Array(capacity * 2);
    this.valStore = new Float64Array(capacity * 2);
  }

  get length(): number {
    return this.end - this.start;
  }

  /** 마지막 ts — 비었으면 -Infinity */
  get lastTs(): number {
    return this.length === 0 ? Number.NEGATIVE_INFINITY : (this.tsStore[this.end - 1] as number);
  }

  get firstTs(): number {
    return this.length === 0 ? Number.POSITIVE_INFINITY : (this.tsStore[this.start] as number);
  }

  /** ts 오름차순으로만 붙인다 — 마지막 ts 이하인 값은 버리고 false */
  push(ts: number, value: number): boolean {
    if (ts <= this.lastTs) return false;
    if (this.end === this.tsStore.length) this.compact();
    this.tsStore[this.end] = ts;
    this.valStore[this.end] = value;
    this.end += 1;
    if (this.length > this.capacity) this.start += 1;
    return true;
  }

  /**
   * 과거 채움 — 이미 가진 첫 ts보다 앞선 점만 앞에 붙인다(진입 1회).
   * 프레임이 채움보다 먼저 와도 선이 뒤로 꺾이지 않는다. 용량을 넘으면 가장 오래된 점부터 버린다.
   */
  prepend(ts: ArrayLike<number>, values: ArrayLike<number>): number {
    const first = this.firstTs;
    let n = 0;
    let prev = Number.NEGATIVE_INFINITY;
    const keepTs: number[] = [];
    const keepVal: number[] = [];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i] as number;
      if (t >= first || t <= prev) continue;
      keepTs.push(t);
      keepVal.push(values[i] as number);
      prev = t;
      n++;
    }
    if (n === 0) return 0;
    const existingTs = this.tsStore.slice(this.start, this.end);
    const existingVal = this.valStore.slice(this.start, this.end);
    const total = Math.min(this.capacity, n + existingTs.length);
    const fromHistory = total - existingTs.length;
    const skip = n - Math.max(0, fromHistory);
    this.start = 0;
    this.end = 0;
    for (let i = skip; i < n; i++) {
      this.tsStore[this.end] = keepTs[i] as number;
      this.valStore[this.end] = keepVal[i] as number;
      this.end++;
    }
    const existingSkip = existingTs.length - (total - (this.end - this.start));
    for (let i = existingSkip; i < existingTs.length; i++) {
      this.tsStore[this.end] = existingTs[i] as number;
      this.valStore[this.end] = existingVal[i] as number;
      this.end++;
    }
    return n - skip;
  }

  /** uPlot에 넘길 두 열의 뷰 — 저장소를 복사하지 않는다 */
  views(): [Float64Array, Float64Array] {
    return [this.tsStore.subarray(this.start, this.end), this.valStore.subarray(this.start, this.end)];
  }

  clear(): void {
    this.start = 0;
    this.end = 0;
  }

  private compact(): void {
    const len = this.length;
    this.tsStore.copyWithin(0, this.start, this.end);
    this.valStore.copyWithin(0, this.start, this.end);
    this.start = 0;
    this.end = len;
  }
}
