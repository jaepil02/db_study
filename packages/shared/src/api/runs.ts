// 라이브 실행 제어 계약(EXP-FLOW · 직접 비교 compare) — 정본 docs/07_api/09_datagen.md §라이브 실행 제어 · §실행 객체 · §매개변수 · §결과
// compare(D-16 결정 2) — 같은 센서 데이터를 Redis Stream으로 ClickHouse · PostgreSQL(TimescaleDB)에 똑같이 싣고(SW-09 gated) 넣기 · 조회 · 데이터 정합성을 잰다
// (업무 방해는 실측이 흔들려 판정 불가 — 사용자 결정으로 삭제 2026-10-11 · 무결성 규칙 시험은 두 저장소 데이터 대조로 교체 — 사용자 결정 2026-10-12).
// perf(옛 직접 재 보기 — Redis를 거치지 않는 실행)는 D-16에서 삭제 · 측정 규칙(워밍업 1 + 3회 · 승패)은 api modules/runs/measure.ts에 남는다.
// 기전 정본 docs/06_pipeline/10_datagen_inject.md §라이브 실행
// 라이브 실행은 측정 기록이 아니다 — 앱 경유 시연값(표지 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님").
import { z } from 'zod';

export const RUN_TYPES = ['flow', 'compare'] as const;
export type RunType = (typeof RUN_TYPES)[number];

/** 실행 status 5 — 종결 3(completed · stopped · failed) · 전송 enum #21 */
export const RUN_STATUSES = ['running', 'stopping', 'completed', 'stopped', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const RUN_TERMINAL: ReadonlySet<RunStatus> = new Set(['completed', 'stopped', 'failed']);

/** 단계 status 6 · 전송 enum #22 */
export const RUN_STEP_STATUSES = ['pending', 'running', 'done', 'skipped', 'stopped', 'failed'] as const;
export type RunStepStatus = (typeof RUN_STEP_STATUSES)[number];

/** 매개변수 — 닫힌 값 집합(화이트리스트) · 생략하면 기본값 */
export const FLOW_PPS = [1000, 5000, 10000, 20000, 50000] as const;
export const FLOW_DURATION_SEC = [30, 60, 120, 300] as const;
export const FLOW_BIZ_PER_SEC = [0, 0.5, 1, 2] as const;
/** 조회 섞기 빈도(초당 조회 수) — 센서 시계열 · 센서 지금 값 · 업무 설비 목록 3종(06_pipeline/10 §흐름 시연 실행) */
export const FLOW_READS_PER_SEC = [0, 5, 20, 50] as const;
/** 직접 비교 — 실행 하나가 부분 하나(패널 ▶ 하나) */
export const COMPARE_PARTS = ['ingest', 'query', 'consistency'] as const;
export type ComparePart = (typeof COMPARE_PARTS)[number];
/**
 * 넣기 건수 — 카드 라인 30대의 과거 데이터를 정확히 이만큼(사용자 결정 2026-10-12 — 시간 구간 대신 건수 · 10억까지 · 날짜를 더 과거로).
 * 초당 231행이라 10억은 약 50일치다 — 센서 원본 보존이 60일이다(tag_raw TTL · TimescaleDB 보존 정책). ingest만 쓴다.
 */
export const COMPARE_INGEST_ROWS = [
  100_000, 1_000_000, 5_000_000, 10_000_000, 30_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000,
] as const;
export const RUN_DEFAULTS = {
  flow: { pps: 10000, durationSec: 60, bizPerSec: 1, readsPerSec: 20 },
  compare: { part: 'ingest' as ComparePart, rows: 1_000_000 },
} as const;

const oneOf = <T extends readonly number[]>(xs: T) =>
  z.number().refine((v) => (xs as readonly number[]).includes(v), { message: `허용값 ${xs.join(' · ')}` });

export const FlowRunParams = z.strictObject({
  pps: oneOf(FLOW_PPS).default(RUN_DEFAULTS.flow.pps),
  durationSec: oneOf(FLOW_DURATION_SEC).default(RUN_DEFAULTS.flow.durationSec),
  bizPerSec: oneOf(FLOW_BIZ_PER_SEC).default(RUN_DEFAULTS.flow.bizPerSec),
  readsPerSec: oneOf(FLOW_READS_PER_SEC).default(RUN_DEFAULTS.flow.readsPerSec),
});

export const CompareRunParams = z.strictObject({
  part: z.enum(COMPARE_PARTS),
  rows: oneOf(COMPARE_INGEST_ROWS).default(RUN_DEFAULTS.compare.rows),
});
export type CompareRunParamsBody = z.infer<typeof CompareRunParams>;

/** #2 POST /api/v1/runs 본문 */
export const RunStartRequest = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('flow'),
    params: FlowRunParams.default({ ...RUN_DEFAULTS.flow }),
  }),
  z.strictObject({
    type: z.literal('compare'),
    params: CompareRunParams,
  }),
]);
export type RunStartRequestBody = z.infer<typeof RunStartRequest>;

/** 단계 — key: flow prepare · publish · drain */
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

/** ① 넣기 — 과거 구간을 Redis Stream으로 발행 → flusher가 같은 배치를 CH 삽입 + PG COPY */
export const CompareIngestResult = z.strictObject({
  part: z.literal('ingest'),
  /** 넣을 건수(COMPARE_INGEST_ROWS) — 보낸 행(rows.published)이 이 수와 같다 */
  target: z.number().int(),
  rangeStart: z.iso.datetime(),
  rangeEnd: z.iso.datetime(),
  /**
   * 넣는 도중 PostgreSQL 지난 날 칸을 압축했는가 — 7일치를 넘는 넣기(5억 · 10억)는 압축 전 크기가 디스크 여유를 넘어
   * 다 들어간 날 칸부터 압축하며 넣는다. 그 압축 부하가 묶음 시간에 섞인다.
   */
  inflightCompress: z.boolean(),
  rows: z.strictObject({
    published: z.number().int(),
    clickhouse: z.number().int(),
    postgres: z.number().int(),
  }),
  elapsedMs: z.number().nonnegative(),
  rowsPerSec: z.number().nonnegative(),
  batches: z.strictObject({
    count: z.number().int(),
    /** 배치 하나 삽입 시간 — CH insert_duration · PG ing_control_copy_seconds(ms) */
    clickhouseMs: z.strictObject({ p50: z.number().nullable(), p95: z.number().nullable() }),
    postgresMs: z.strictObject({ p50: z.number().nullable(), p95: z.number().nullable() }),
    postgresFailures: z.number().int(),
  }),
  bytes: z.strictObject({ clickhouse: z.number().int().nullable(), postgres: z.number().int().nullable() }),
  /** 초 단위 진행(그림용) — 그 초에 끝난 배치의 평균 시간 · 누적 행 */
  timeline: z.array(
    z.strictObject({
      tSec: z.number(),
      clickhouseMs: z.number().nullable(),
      postgresMs: z.number().nullable(),
      rows: z.number().int(),
    }),
  ),
});

/**
 * ② 조회 대결 — 원천 행 수 단계는 넣기 건수와 같은 스케일(10만 ~ 10억 9단계 · 사용자 결정 2026-10-12 — 드롭다운과 같은 단계).
 * 단계마다 마지막 넣기 구간의 앞에서부터 **정확히 그 수**의 원천 행을 설비 · 태그 · 1시간 칸으로 집계한다(행 수 · 평균 · 값 체크섬).
 * 원천은 (시각 · 설비 · 태그) 순으로 줄 세워 N번째 행에서 자른다 — 같은 시각에 여러 행이 몰려 있어(카드 라인 초당 231행)
 * 시각만으로는 N에 맞출 수 없다. 넣은 데이터가 N보다 적으면 그 단계는 재지 않는다(10억을 넣어야 9단계를 다 잰다).
 */
export const COMPARE_QUERY_SIZES = COMPARE_INGEST_ROWS;
/** 조회 대결 단계 key — "rows-10000" */
export const compareQueryStepKey = (rows: number): string => `rows-${rows}`;
/** 건수 쉬운 이름(단위 없이) — 1만 · 5,000만 · 1억 · 10억(억 · 만 단위로 나누어떨어지지 않으면 그대로) */
export function compareSizeName(rows: number): string {
  if (rows >= 100_000_000 && rows % 100_000_000 === 0)
    return `${(rows / 100_000_000).toLocaleString('ko-KR')}억`;
  return rows >= 10_000 && rows % 10_000 === 0
    ? `${(rows / 10_000).toLocaleString('ko-KR')}만`
    : rows.toLocaleString('ko-KR');
}

/** 한 단계 한 저장소 — 3회 측정(워밍업 1회는 버린다 · apps/api modules/runs/measure.ts) + 마지막 회 집계 결과의 요약 */
const sizeRep = z.strictObject({
  values: z.array(z.number()),
  median: z.number().nullable(),
  /** 집계에 쓰인 원천 행 수(결과 칸들의 행 수 합) — 목표 행 수와 같아야 한다 */
  sourceRows: z.number().int().nullable(),
  /** 결과 칸 수(설비 · 태그 · 1시간) */
  groups: z.number().int().nullable(),
  /** 값 체크섬 — floor(value × 1000)의 정수 합(10진 문자열 — 큰 단계는 2^53을 넘을 수 있다) */
  checksum: z.string().nullable(),
});

export const CompareQueryResult = z.strictObject({
  part: z.literal('query'),
  /** 넣기 구간 안 원천 행 수(ClickHouse) — 이보다 큰 단계는 재지 않는다 */
  rows: z.number().int(),
  rangeStart: z.iso.datetime(),
  rangeEnd: z.iso.datetime(),
  /** 끝난 단계만(작은 것부터) — 진행 중에는 0 → 10 */
  sizes: z.array(
    z.strictObject({
      /** 목표 원천 행 수(COMPARE_QUERY_SIZES) */
      target: z.number().int(),
      /** 자른 자리 — (시각 · 설비 · 태그) 순 target번째 행 · 넣은 데이터가 모자라 재지 않았으면 null */
      cut: z
        .strictObject({ ts: z.iso.datetime(), deviceId: z.number().int(), tagId: z.number().int() })
        .nullable(),
      clickhouse: sizeRep,
      postgres: sizeRep,
      /** 3회 모두 같은 쪽이 빨랐을 때만 — 아니면 null */
      winner: z.enum(['clickhouse', 'postgres']).nullable(),
      /** 느린 쪽 중간값 ÷ 빠른 쪽 중간값 */
      ratio: z.number().nullable(),
      /** 두 저장소 집계 결과가 칸(설비 · 태그 · 1시간)마다 같은가 — 행 수 · 값 체크섬 · 재지 않았으면 null */
      match: z.boolean().nullable(),
      /** 서로 다른 칸 수(한쪽에만 있는 칸 포함) — 재지 않았으면 null */
      mismatchGroups: z.number().int().nullable(),
    }),
  ),
});

/**
 * ③ 데이터 정합성 — 마지막 넣기 구간에 두 저장소가 받은 결과가 같은지 네 기준으로 맞춰 본다(사용자 결정 2026-10-13 — 기준 1 · 6 · 9 · 11).
 * 저장소마다 구간을 한 번 훑어 묶음(설비 · 태그 · 1시간)마다 행 수 · 값 합계 · 최소 · 최대 · 행 지문 합을 내고, 네 기준이 그 결과에서 나온다.
 *   ① 행 수        묶음 행 수의 합(= 구간 count)
 *   ② 값 합계      round(value × 1000)의 정수 합 — 부동소수를 그대로 더하면 같은 데이터라도 두 DB의 끝자리가 갈린다
 *   ③ 묶음 집계    묶음마다 행 수 · 값 합계 · 최소 · 최대가 모두 같은가(한쪽에만 있는 묶음도 다른 묶음)
 *   ④ 행 지문      행마다 6열(설비 · 태그 · 시각 · 값 · 품질 · 순번)의 MD5 앞 64비트를 더한 값
 * 재는 동안에는 다 잰 저장소만 채운다(ClickHouse 먼저) — 판정(checks · match)은 두 저장소를 다 잰 뒤에만.
 */
export const CONSISTENCY_MISMATCH_LIMIT = 5;
const consistencyStore = z.strictObject({
  /** ① 행 수 */
  rows: z.number().int(),
  /** ② 값 합계 — round(value × 1000)의 정수 합(10진 문자열 — 2^53을 넘는다) · 화면은 ÷ 1000(소수 셋째 자리) */
  sum: z.string(),
  /** ③ 묶음(설비 · 태그 · 1시간) 수 */
  groups: z.number().int(),
  /** ④ 행 지문 합(10진 문자열 — 부호 있는 64비트 값들의 합) */
  fingerprint: z.string(),
  /** 구간을 다 훑는 데 걸린 시간(ms) */
  scanMs: z.number().nonnegative(),
});
export type ConsistencyStoreBody = z.infer<typeof consistencyStore>;

export const CompareConsistencyResult = z.strictObject({
  part: z.literal('consistency'),
  rangeStart: z.iso.datetime(),
  rangeEnd: z.iso.datetime(),
  /** 저장소별 실측 — 아직 재지 않았으면 null */
  clickhouse: consistencyStore.nullable(),
  postgres: consistencyStore.nullable(),
  /** 기준별 판정(같으면 true) — 두 저장소를 다 잰 뒤 · 재는 중이면 null */
  checks: z
    .strictObject({ rows: z.boolean(), sum: z.boolean(), groups: z.boolean(), fingerprint: z.boolean() })
    .nullable(),
  /** ③ 묶음 집계가 다른 묶음 수(행 수 · 합계 · 최소 · 최대 — 한쪽에만 있는 묶음 포함) — 재는 중이면 null */
  mismatchGroups: z.number().int().nullable(),
  /** 어느 값이든(지문 포함) 다른 묶음 수 — mismatchGroups 이상 · 재는 중이면 null */
  diffGroups: z.number().int().nullable(),
  /**
   * 어느 값이든 다른 묶음(다른 곳) — 시각 · 설비 · 태그 순으로 앞에서부터 CONSISTENCY_MISMATCH_LIMIT개.
   * 행 수가 null이면 그쪽에 묶음이 없다 · 두 행 수가 같으면 내용만 다르다
   */
  mismatches: z.array(
    z.strictObject({
      deviceId: z.number().int(),
      tagId: z.number().int(),
      /** "L1-PRT 인쇄 · 잉크 온도" — 카드 라인 태그가 아니면 null */
      label: z.string().nullable(),
      hour: z.iso.datetime(),
      clickhouse: z.number().int().nullable(),
      postgres: z.number().int().nullable(),
    }),
  ),
  /** 네 기준이 모두 같다 — 재는 중이면 null */
  match: z.boolean().nullable(),
});

export const CompareRunResult = z.discriminatedUnion('part', [
  CompareIngestResult,
  CompareQueryResult,
  CompareConsistencyResult,
]);
export type CompareRunResultBody = z.infer<typeof CompareRunResult>;

/** 실행 객체 — 필드 10 · 시각은 UTC ISO Z(화면이 KST로 한 번 변환) · elapsedMs는 서버 계산 */
export const RunObject = z.strictObject({
  runId: z.uuid(),
  type: z.enum(RUN_TYPES),
  status: z.enum(RUN_STATUSES),
  params: z.record(z.string(), z.union([z.number(), z.string()])),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  elapsedMs: z.number().int().nonnegative(),
  steps: z.array(RunStep),
  result: z.union([FlowRunResult, CompareRunResult]).nullable(),
  error: z.strictObject({ code: z.string().nullable(), message: z.string() }).nullable(),
});
export type RunObjectBody = z.infer<typeof RunObject>;

/** #3 GET /api/v1/runs/current */
export const RunCurrentBody = z.strictObject({ run: RunObject.nullable() });

/** 보관된 직접 비교 결과 하나(PG run_result) */
export const CompareLatestEntry = z.strictObject({
  runId: z.uuid(),
  status: z.enum(['completed', 'stopped', 'failed']),
  params: CompareRunParams,
  result: CompareRunResult.nullable(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  commitHash: z.string().nullable(),
  /** 실행 때 스위치 값(health switches와 같은 모양) */
  switches: z.record(z.string(), z.union([z.string(), z.number()])),
  /** 실행 때 설비 가동이 켜져 있었는가 — 켜져 있었으면 그 부하가 함께 섞인 값 */
  plantOn: z.boolean(),
});
export type CompareLatestEntryBody = z.infer<typeof CompareLatestEntry>;

/** #GET /api/v1/runs/latest?type=compare — 부분별 가장 최근 종결 실행(없으면 null) */
/** 부분별 마지막 시도(완료 · 중단 · 실패 무엇이든) — 최근 완료 결과보다 뒤에 끝난 시도가 있으면 화면이 "마지막 시도는 중단됐어요"를 보인다 */
export const CompareAttempt = z.strictObject({
  runId: z.uuid(),
  status: z.enum(['completed', 'stopped', 'failed']),
  endedAt: z.iso.datetime(),
});
export type CompareAttemptBody = z.infer<typeof CompareAttempt>;

/** 부분별 **최근 완료(completed)** 결과 1건(없으면 null) + 부분별 마지막 시도 */
export const CompareLatestBody = z.strictObject({
  ingest: CompareLatestEntry.nullable(),
  query: CompareLatestEntry.nullable(),
  consistency: CompareLatestEntry.nullable(),
  attempts: z.strictObject({
    ingest: CompareAttempt.nullable(),
    query: CompareAttempt.nullable(),
    consistency: CompareAttempt.nullable(),
  }),
});
export type CompareLatestBodyType = z.infer<typeof CompareLatestBody>;

/** 시연 전용 행(흐름 시연 업무 명령의 유일한 대상 · 비활성) — 정본 06_pipeline/10 §흐름 시연 실행 */
export const DEMO_FLOW = {
  siteCode: 'DEMO-FLOW',
  lineCode: 'DEMO-FLOW-L',
  deviceCode: 'DEMO-FLOW-DEV',
} as const;
