// 용량 티어 — 정본 docs/04_architecture/07_capacity_planning.md §용량 티어
// 생성기는 티어를 정의하지 않는다(REQ-GEN-04). 이 표가 정본과 어긋나면 test/tiers.test.ts가 실패한다.

export const CAPACITY_TIERS = {
  S: { devices: 5, tagsPerDevice: 50, hz: 1, pointsPerSecond: 250 },
  M: { devices: 50, tagsPerDevice: 200, hz: 1, pointsPerSecond: 10_000 },
  'M+': { devices: 50, tagsPerDevice: 200, hz: 10, pointsPerSecond: 100_000 },
  L: { devices: 100, tagsPerDevice: 500, hz: 10, pointsPerSecond: 500_000 },
} as const;
export type CapacityTier = keyof typeof CAPACITY_TIERS;
export const CAPACITY_TIER_NAMES = Object.keys(CAPACITY_TIERS) as CapacityTier[];
