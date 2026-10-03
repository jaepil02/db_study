// 라이브 실행 제어 계약(EXP-PERF · EXP-FLOW) — 정본 docs/07_api/09_datagen.md §라이브 실행 제어 · §실행 객체 · §매개변수 · §결과
// 기전 정본 docs/06_pipeline/10_datagen_inject.md §라이브 실행 · 화면 docs/08_screen/08_evidence_screens.md §실행 패널
// 라이브 실행은 측정 기록이 아니다 — 앱 경유 시연값(표지 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님").
import { z } from 'zod';

export const RUN_TYPES = ['perf', 'flow'] as const;
export type RunType = (typeof RUN_TYPES)[number];

/** 실행 status 5 — 종결 3(completed · stopped · failed) · 전송 enum #21 */
export const RUN_STATUSES = ['running', 'stopping', 'completed', 'stopped', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const RUN_TERMINAL: ReadonlySet<RunStatus> = new Set(['completed', 'stopped', 'failed']);

/** 단계 status 6 · 전송 enum #22 */
export const RUN_STEP_STATUSES = ['pending', 'running', 'done', 'skipped', 'stopped', 'failed'] as const;
export type RunStepStatus = (typeof RUN_STEP_STATUSES)[number];

/** 매개변수 — 닫힌 값 집합(화이트리스트) · 생략하면 기본값 */
export const PERF_MAX_EXPONENTS = [5, 6, 7, 8] as const;
export const FLOW_PPS = [1000, 5000, 10000, 20000, 50000] as const;
export const FLOW_DURATION_SEC = [30, 60, 120, 300] as const;
export const FLOW_BIZ_PER_SEC = [0, 0.5, 1, 2] as const;
/** 조회 섞기 빈도(초당 조회 수) — 센서 시계열 · 센서 지금 값 · 업무 설비 목록 3종(06_pipeline/10 §흐름 시연 실행) */
export const FLOW_READS_PER_SEC = [0, 5, 20, 50] as const;
export const RUN_DEFAULTS = {
  perf: { maxExponent: 7 },
  flow: { pps: 10000, durationSec: 60, bizPerSec: 1, readsPerSec: 20 },
} as const;

const oneOf = <T extends readonly number[]>(xs: T) =>
  z.number().refine((v) => (xs as readonly number[]).includes(v), { message: `허용값 ${xs.join(' · ')}` });

export const PerfRunParams = z.strictObject({
  maxExponent: oneOf(PERF_MAX_EXPONENTS).default(RUN_DEFAULTS.perf.maxExponent),
});
export const FlowRunParams = z.strictObject({
  pps: oneOf(FLOW_PPS).default(RUN_DEFAULTS.flow.pps),
  durationSec: oneOf(FLOW_DURATION_SEC).default(RUN_DEFAULTS.flow.durationSec),
  bizPerSec: oneOf(FLOW_BIZ_PER_SEC).default(RUN_DEFAULTS.flow.bizPerSec),
  readsPerSec: oneOf(FLOW_READS_PER_SEC).default(RUN_DEFAULTS.flow.readsPerSec),
});

/** #2 POST /api/v1/runs 본문 */
export const RunStartRequest = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('perf'), params: PerfRunParams.default({ maxExponent: 7 }) }),
  z.strictObject({
    type: z.literal('flow'),
    params: FlowRunParams.default({ ...RUN_DEFAULTS.flow }),
  }),
]);
export type RunStartRequestBody = z.infer<typeof RunStartRequest>;

/** 단계 — key: perf prepare · fill-ch@{k} · fill-pg@{k} · query@{k} · cleanup / flow prepare · publish · drain */
export const RunStep = z.strictObject({
  key: z.string(),
  label: z.string(),
  status: z.enum(RUN_STEP_STATUSES),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  elapsedMs: z.number().int().nonnegative().nullable(),
  detail: z.record(z.string(), z.unknown()),
});
export type RunStepBody = z.infer<typeof RunStep>;

const repStat = z.strictObject({
  values: z.array(z.number()),
  median: z.number().nullable(),
  rows: z.number().int().nullable(),
});
export const PerfScaleResult = z.strictObject({
  exponent: z.number().int(),
  rows: z.number().int(),
  fillMs: z.strictObject({ ch: z.number().nullable(), pg: z.number().nullable() }),
  storageBytes: z.strictObject({ ch: z.number().nullable(), pg: z.number().nullable() }),
  queries: z.array(
    z.strictObject({
      q: z.enum(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']),
      ch: repStat,
      pg: repStat,
      winner: z.enum(['ch', 'pg']).nullable(),
      ratio: z.number().nullable(),
      resultMatch: z.boolean().nullable(),
    }),
  ),
});
export type PerfScaleResultBody = z.infer<typeof PerfScaleResult>;
export const PerfRunResult = z.strictObject({ scales: z.array(PerfScaleResult) });
export const FlowRunResult = z.strictObject({
  pointsSent: z.number().int(),
  entriesSent: z.number().int(),
  commandsSent: z.number().int(),
  commandsOk: z.number().int(),
  commandsPending: z.number().int(),
  commandsFailed: z.number().int(),
  backpressurePauses: z.number().int(),
  drainMs: z.number().nullable(),
  /** 보낸 조회 수(3종 합 · 실패 포함) */
  readsSent: z.number().int(),
});

/** 실행 객체 — 필드 10 · 시각은 UTC ISO Z(화면이 KST로 한 번 변환) · elapsedMs는 서버 계산 */
export const RunObject = z.strictObject({
  runId: z.uuid(),
  type: z.enum(RUN_TYPES),
  status: z.enum(RUN_STATUSES),
  params: z.record(z.string(), z.number()),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  elapsedMs: z.number().int().nonnegative(),
  steps: z.array(RunStep),
  result: z.union([PerfRunResult, FlowRunResult]).nullable(),
  error: z.strictObject({ code: z.string().nullable(), message: z.string() }).nullable(),
});
export type RunObjectBody = z.infer<typeof RunObject>;

/** #3 GET /api/v1/runs/current */
export const RunCurrentBody = z.strictObject({ run: RunObject.nullable() });

/** 시연 전용 행(흐름 시연 업무 명령의 유일한 대상 · 비활성) — 정본 06_pipeline/10 §흐름 시연 실행 */
export const DEMO_FLOW = {
  siteCode: 'DEMO-FLOW',
  lineCode: 'DEMO-FLOW-L',
  deviceCode: 'DEMO-FLOW-DEV',
} as const;
