// 열거 집합 — 정본 docs/11_glossary/03_enums_state_machines.md(품질 코드 7 · 신호 프로파일 8)

/** 품질 코드 7 — 출처 축(9)과 건강 축(0~5)이 한 칸에 겹친다 */
export const QUALITY = {
  GOOD: 0,
  UNCERTAIN: 1,
  BAD_COMM: 2,
  BAD_TIMEOUT: 3,
  BAD_RANGE: 4,
  STALE: 5,
  SIMULATED: 9,
} as const;
export type QualityCode = (typeof QUALITY)[keyof typeof QUALITY];

/** Stream 엔트리에 실릴 수 있는 품질 — 3(BAD_TIMEOUT)은 행이 없고 5(STALE)는 조회 시점 판정이다(06_pipeline/12) */
export const STREAM_QUALITY_CODES: readonly number[] = [
  QUALITY.GOOD,
  QUALITY.UNCERTAIN,
  QUALITY.BAD_COMM,
  QUALITY.BAD_RANGE,
  QUALITY.SIMULATED,
];

/** 신호 프로파일 8 — 아날로그 3 · 이산 3 · 이상 2 */
export const SIGNAL_PROFILES = [
  'SINE',
  'RANDOM_WALK',
  'RAMP',
  'STEP',
  'BINARY',
  'COUNTER',
  'SPIKE',
  'DROPOUT',
] as const;
export type SignalProfile = (typeof SIGNAL_PROFILES)[number];
