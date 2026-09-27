// 역방향 대조 채움 행 벡터 · 대상 주문 집합 — 같은 시드 = 같은 행(두 저장소 · 반복 · 초기화 뒤 다시 채우기)
// 행 i(1-based)의 모든 필드는 (seed, i)의 해시로만 정해진다 — 임의 행을 따로 다시 만들 수 있다(RMT 새 버전 삽입 · 초기화 채우기).
// order_id는 빈 볼륨의 IDENTITY 발급 1..N과 같다(05_data_stores/10 §업무 규모 격자와 채우기) — 실행기는 채운 뒤 두 저장소를 대조한다.

export type WorkStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface WorkOrderRow {
  orderId: number;
  lineId: number;
  orderNo: string;
  productCode: string;
  targetQty: number;
  plannedStartMs: number;
  plannedEndMs: number;
  status: WorkStatus;
}

/** 계획 시작 기준 — 2026-01-01 00:00 KST · 행마다 1분씩 */
export const PLAN_BASE_MS = Date.UTC(2025, 11, 31, 15, 0, 0);
export const PRODUCT_CODES = 20;
/** 대상 창 슬롯 — EXP-40 0 · EXP-42 1 · EXP-43 UPDATE 경로 2 · 예비 3(PostgreSQL을 실험 사이에 되돌리지 않아도 겹치지 않는다) */
export const SLOTS = { exp40: 0, exp42: 1, exp43: 2 } as const;
export const SLOT_COUNT = 4;

/** 32비트 정수 해시(murmur3 finalizer 계열) — 결정적 · 플랫폼 무관 */
export function hash32(seed: number, i: number, field: number): number {
  let h = (seed ^ Math.imul(i, 0x9e3779b1) ^ Math.imul(field + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** [0, 1) 균등 */
export function unit(seed: number, i: number, field: number): number {
  return hash32(seed, i, field) / 2 ** 32;
}

export function statusOf(seed: number, i: number, inProgress: number): WorkStatus {
  const u = unit(seed, i, 0);
  if (u < inProgress) return 'IN_PROGRESS';
  const r = (u - inProgress) / (1 - inProgress);
  if (r < 0.6) return 'PLANNED';
  if (r < 0.9) return 'COMPLETED';
  return 'CANCELLED';
}

export function orderNoOf(seed: number, i: number): string {
  return `WO-${seed}-${String(i).padStart(7, '0')}`;
}

/** 행 i — lineIds는 production_line에 실제로 있는 번호(FK)를 오름차순으로 준다 */
export function workOrderRow(
  seed: number,
  i: number,
  inProgress: number,
  lineIds: readonly number[],
): WorkOrderRow {
  const start = PLAN_BASE_MS + (i - 1) * 60_000;
  return {
    orderId: i,
    lineId: lineIds[(i - 1) % lineIds.length] as number,
    orderNo: orderNoOf(seed, i),
    productCode: `P-${String((hash32(seed, i, 1) % PRODUCT_CODES) + 1).padStart(3, '0')}`,
    targetQty: (hash32(seed, i, 2) % 1000) + 1,
    plannedStartMs: start,
    plannedEndMs: start + ((hash32(seed, i, 3) % 72) + 1) * 3_600_000,
    status: statusOf(seed, i, inProgress),
  };
}

/** 채움 상태의 IN_PROGRESS 주문 번호 오름차순 */
export function inProgressIds(seed: number, scale: number, inProgress: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= scale; i++) if (statusOf(seed, i, inProgress) === 'IN_PROGRESS') out.push(i);
  return out;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** 0..m-1의 결정적 순열 j → (a·j + b) mod m — a는 m과 서로소 · 대상이 파트 · 페이지 한쪽에 몰리지 않게 흩는다 */
export function permute(seed: number, m: number): (j: number) => number {
  if (m <= 1) return () => 0;
  let a = (hash32(seed, m, 7) % (m - 1)) + 1;
  while (gcd(a, m) !== 1) a = (a % (m - 1)) + 1;
  const b = hash32(seed, m, 8) % m;
  return (j) => Number((BigInt(a) * BigInt(j) + BigInt(b)) % BigInt(m));
}

/**
 * 반복 rep의 대상 n개 — IN_PROGRESS를 흩은 순서에서 슬롯 창 [slot·span, (slot+1)·span)을 반복 3개의 고정 폭 조각(floor(span/3))으로
 * 나눈 rep번째 조각의 앞 n개. 조각 폭이 N과 무관해 N이 다른 변형(EXP-40 ch_rmt 50 · 나머지 300)도 반복 r의 대상이 같은 집합의
 * 앞부분이다(공정성 규칙 1 · 기록 040 뒤 리드 판정 2026-09-27 — 옛 창 rep·n은 N마다 시작점이 달랐다).
 * EXP-42 · 43 대상도 이 창을 쓰므로 바뀐다 — 기록 042 · 043은 옛 창으로 측정된 원시라 영향 없다(그 원시 detail.targets가 쓴 집합을 담는다).
 * 종결에서 나가는 전이가 없어 반복마다 겹치지 않는 집합을 쓴다(01_postgresql_schema §허용 전이).
 */
export function targetIds(
  ids: readonly number[],
  seed: number,
  slot: number,
  rep: number,
  n: number,
): number[] {
  const span = Math.floor(ids.length / SLOT_COUNT);
  const repSpan = Math.floor(span / 3);
  if (n > repSpan)
    throw new Error(
      `대상 부족 — IN_PROGRESS ${ids.length}행 · 슬롯 폭 ${span} · 반복 조각 ${repSpan} < N ${n}(N을 줄이거나 규모를 키운다)`,
    );
  const p = permute(seed, ids.length);
  const lo = slot * span + rep * repSpan;
  return Array.from({ length: n }, (_, j) => ids[p(lo + j)] as number);
}

/** PostgreSQL COPY text 한 줄(order_id는 IDENTITY가 발급한다) — 시각은 UTC ISO(timestamptz) */
export function pgCopyLine(r: WorkOrderRow): string {
  return `${r.lineId}\t${r.orderNo}\t${r.productCode}\t${r.targetQty}\t${new Date(r.plannedStartMs).toISOString()}\t${new Date(r.plannedEndMs).toISOString()}\t${r.status}\n`;
}

/** ClickHouse JSONEachRow 한 행 — DateTime64(3)는 epoch ms 정수(input_format_read_datetime_number_as_raw_value 1) */
export function chRow(r: WorkOrderRow): Record<string, unknown> {
  return {
    order_id: r.orderId,
    line_id: r.lineId,
    order_no: r.orderNo,
    product_code: r.productCode,
    target_qty: r.targetQty,
    planned_start: r.plannedStartMs,
    planned_end: r.plannedEndMs,
    status: r.status,
  };
}
