// 알람 표면 스키마 — 정본 docs/07_api/07_alarms.md(표면 6 · 이벤트 객체 · 규칙 객체 8 필드 · 목록 파라미터 5행 · #6 응답)
// alarm 프레임 정본 docs/07_api/11_websocket.md §메시지 봉투 — WsServerMessage의 alarm 갈래가 이 정의를 쓴다(한 정의).
// 저장 모양 정본 05_data_stores/01 §ALM · 결합 CHECK 정본 02_postgresql_constraints.md · enum 정본 11_glossary/03.
// 쓰기 요청은 모르는 필드를 거절한다(strictObject). 불변 필드(ruleId · tagId · conditionType)는 스키마가 받고 서비스가 400 immutable로 가른다.
// 결합 규칙(OUT_OF_RANGE만 thresholdLow · thresholdLow < threshold)은 "현재 값"과 합쳐야 판정되는 PATCH가 있어 서비스(ruleShapeIssues)가 한다.
// 응답 스키마는 모르는 필드를 무시한다(z.object — 07_api/01 §응답 필드 변경 규칙: 필드 추가는 v1 유지).
import { z } from 'zod';

/** condition_type 4값(11_glossary/03 — 저장 enum) */
export const CONDITION_TYPES = ['GT', 'LT', 'OUT_OF_RANGE', 'RATE_OF_CHANGE'] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];
export const EVENT_STATES = ['ACTIVE', 'CLEARED'] as const;
export type AlarmEventState = (typeof EVENT_STATES)[number];

/** severity 3값 — 1 LOW · 2 MEDIUM · 3 HIGH · 클수록 심각(11_glossary/03) */
export const ALARM_SEVERITIES = [
  { value: 1, label: 'LOW' },
  { value: 2, label: 'MEDIUM' },
  { value: 3, label: 'HIGH' },
] as const;
export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number]['value'];

/** 페이지 — limit 기본 50 · 상한 200(2계층 · 소유 07_api/01 §페이지네이션) */
export const ALARM_EVENTS_LIMIT_DEFAULT = 50;
export const ALARM_EVENTS_LIMIT_MAX = 200;

const int4 = z.coerce.number().int().min(1).max(2_147_483_647);
const offsetIso = z.iso.datetime({ offset: true });
const finite = z.number().refine(Number.isFinite, 'finite');
const bool = z.enum(['true', 'false']);
const severity = z.number().int().min(1).max(3);

/** 이벤트 경로 식별자 — event_id는 bigint(IDENTITY가 2^53에 닿지 않는다 · 07_api/01 §수치 직렬화) */
export const EventIdParam = z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const RuleIdParam = int4;

/** #1 목록 파라미터 5행 — state · acked · from/to · ruleId/tagId/severity · limit/cursor */
export const AlarmEventListQuery = z
  .strictObject({
    state: z.enum(EVENT_STATES).optional(),
    acked: bool.optional(),
    from: offsetIso.optional(),
    to: offsetIso.optional(),
    ruleId: int4.optional(),
    tagId: int4.optional(),
    severity: z.coerce.number().int().min(1).max(3).optional(),
    limit: z.coerce.number().int().min(1).max(ALARM_EVENTS_LIMIT_MAX).default(ALARM_EVENTS_LIMIT_DEFAULT),
    cursor: z.string().min(1).max(200).optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || Date.parse(q.from) < Date.parse(q.to), {
    message: 'from < to',
    path: ['from'],
  });
export type AlarmEventListParams = z.infer<typeof AlarmEventListQuery>;

/** 이벤트 객체 — #1 응답 필드 행 7(식별자 · 태그 4 · 규칙 속성 · 시각 · 값 · 상태 · 확인) · #2 응답도 같은 모양 */
export const AlarmEventObject = z.object({
  eventId: z.number().int(),
  ruleId: z.number().int(),
  tagId: z.number().int(),
  tagCode: z.string(),
  tagName: z.string(),
  /** false = 판정이 멈춘 열린 알람(비활성 태그) */
  tagIsActive: z.boolean(),
  conditionType: z.enum(CONDITION_TYPES),
  severity: z.number().int(),
  /** UTC ISO — 확정 판정 행의 ts(벽시계가 아니다) */
  occurredAt: z.string(),
  clearedAt: z.string().nullable(),
  triggerValue: z.number(),
  state: z.enum(EVENT_STATES),
  ackedBy: z.number().int().nullable(),
  ackedAt: z.string().nullable(),
});
export type AlarmEventBody = z.infer<typeof AlarmEventObject>;

/** #1 응답 — items + meta(nextCursor · limit) */
export const AlarmEventPage = z.object({
  items: z.array(AlarmEventObject),
  meta: z.object({ nextCursor: z.string().nullable(), limit: z.number().int() }),
});
export type AlarmEventPageBody = z.infer<typeof AlarmEventPage>;

/** 규칙 객체 8 필드(07_api/07 §#3 · #4 · #5 검산) */
export const AlarmRuleObject = z.object({
  ruleId: z.number().int(),
  tagId: z.number().int(),
  conditionType: z.enum(CONDITION_TYPES),
  threshold: z.number(),
  thresholdLow: z.number().nullable(),
  debounceMs: z.number().int(),
  severity: z.number().int(),
  enabled: z.boolean(),
});
export type AlarmRuleBody = z.infer<typeof AlarmRuleObject>;

/** #3 응답 — items(페이지 없음) + meta.count */
export const AlarmRuleList = z.object({
  items: z.array(AlarmRuleObject),
  meta: z.object({ count: z.number().int() }),
});
export type AlarmRuleListBody = z.infer<typeof AlarmRuleList>;

/** #3 규칙 조회 — tagId · enabled 선택 필터 */
export const AlarmRuleListQuery = z.strictObject({
  tagId: int4.optional(),
  enabled: bool.optional(),
});

const ruleFields = {
  threshold: finite,
  thresholdLow: finite.nullable(),
  debounceMs: z.number().int().min(0).max(2_147_483_647),
  severity,
  enabled: z.boolean(),
};

/** #4 규칙 등록 — enabled 기본 true · thresholdLow 생략 = null */
export const AlarmRuleCreateRequest = z.strictObject({
  tagId: z.number().int().min(1).max(2_147_483_647),
  conditionType: z.enum(CONDITION_TYPES),
  threshold: ruleFields.threshold,
  thresholdLow: ruleFields.thresholdLow.default(null),
  debounceMs: ruleFields.debounceMs,
  severity: ruleFields.severity,
  enabled: ruleFields.enabled.default(true),
});
export type AlarmRuleCreate = z.infer<typeof AlarmRuleCreateRequest>;

/** 불변 3(07_api/07 §#5 불변 행) — 수정 본문에 오면 400 immutable(07_api/01 §요청 검증과 성공 본문) */
export const RULE_IMMUTABLE_FIELDS = ['ruleId', 'tagId', 'conditionType'] as const;
export const RULE_EDITABLE_FIELDS = [
  'threshold',
  'thresholdLow',
  'debounceMs',
  'severity',
  'enabled',
] as const;

/** #5 규칙 수정 — 수정 가능 5 중 일부 · 불변 3은 받되 서비스가 거절한다 */
export const AlarmRulePatchRequest = z.strictObject({
  threshold: ruleFields.threshold.optional(),
  thresholdLow: ruleFields.thresholdLow.optional(),
  debounceMs: ruleFields.debounceMs.optional(),
  severity: ruleFields.severity.optional(),
  enabled: ruleFields.enabled.optional(),
  ruleId: z.unknown().optional(),
  tagId: z.unknown().optional(),
  conditionType: z.unknown().optional(),
});
export type AlarmRulePatch = z.infer<typeof AlarmRulePatchRequest>;

/** 결합 규칙 — OUT_OF_RANGE만 thresholdLow 필수 · 그 밖 null · thresholdLow < threshold(04_alarm.sql CHECK 둘과 같은 뜻) */
export function ruleShapeIssues(r: {
  conditionType: ConditionType;
  threshold: number;
  thresholdLow: number | null;
}): { path: string; reason: 'required' | 'range' }[] {
  if (r.conditionType === 'OUT_OF_RANGE') {
    if (r.thresholdLow === null) return [{ path: 'thresholdLow', reason: 'required' }];
    if (!(r.thresholdLow < r.threshold)) return [{ path: 'thresholdLow', reason: 'range' }];
    return [];
  }
  return r.thresholdLow === null ? [] : [{ path: 'thresholdLow', reason: 'range' }];
}

/** 판정 이력 해상도 — 1시간 이하 원시 · 7일까지 1분 · 그 초과 1시간(07_api/07 §#6 버킷) */
export const EVAL_INTERVALS = ['raw', '1m', '1h'] as const;
export type EvalInterval = (typeof EVAL_INTERVALS)[number];
/** maxPoints 기본 2000 · 상한 10,000 — 05_timeseries와 같은 값(07_api/07 §#6 요청) */
export const EVAL_MAX_POINTS_DEFAULT = 2000;
export const EVAL_MAX_POINTS_LIMIT = 10_000;

/** #6 요청 — ruleId 또는 tagId 정확히 하나 · from · to 필수 */
export const AlarmEvalQuery = z
  .strictObject({
    ruleId: int4.optional(),
    tagId: int4.optional(),
    from: offsetIso,
    to: offsetIso,
    maxPoints: z.coerce.number().int().min(1).max(EVAL_MAX_POINTS_LIMIT).default(EVAL_MAX_POINTS_DEFAULT),
  })
  .refine((q) => (q.ruleId === undefined) !== (q.tagId === undefined), {
    message: 'ruleId 또는 tagId 정확히 하나',
    path: ['ruleId'],
  })
  .refine((q) => Date.parse(q.from) < Date.parse(q.to), { message: 'from < to', path: ['from'] });
export type AlarmEvalParams = z.infer<typeof AlarmEvalQuery>;

/** #6 points 열 5 — [ts, min, max, breachCount, evalCount] */
export const EVAL_COLUMNS = ['ts', 'min', 'max', 'breachCount', 'evalCount'] as const;

/**
 * #6 points 한 행 — ts는 버킷 시작 epoch ms · min · max는 판정한 값의 극값(JSON에 NaN이 없어 비수치 값은 null로 온다).
 * 판정이 없는 버킷은 행이 없다 — 누락 버킷을 채우지 않는다(05_timeseries 관례 · 합성은 화면 몫).
 */
export const EvalPoint = z.tuple([
  z.number().int(),
  z.number().nullable(),
  z.number().nullable(),
  z.number().int(),
  z.number().int(),
]);
export type EvalPointRow = z.infer<typeof EvalPoint>;

/** #6 응답 — meta(interval · from · to · columns · pointCount · rule) + series[](ruleId · tagId · points) */
export const AlarmEvalResponse = z.object({
  meta: z.object({
    interval: z.enum(EVAL_INTERVALS),
    from: offsetIso,
    to: offsetIso,
    columns: z.array(z.string()).readonly(),
    pointCount: z.number().int(),
    /** 현재 규칙 — tagId 요청에 규칙이 여럿이거나 PostgreSQL 불가면 null */
    rule: AlarmRuleObject.nullable(),
  }),
  series: z.array(
    z.object({ ruleId: z.number().int(), tagId: z.number().int(), points: z.array(EvalPoint) }),
  ),
});
export type AlarmEvalResponseBody = z.infer<typeof AlarmEvalResponse>;

/** WebSocket alarm 프레임(07_api/11 §메시지 봉투 — 필드 6 + type) · 열림 · 닫힘만(확인은 싣지 않는다) */
export const ALARM_TRANSITIONS = ['OPENED', 'CLEARED'] as const;
export const AlarmFrame = z.strictObject({
  type: z.literal('alarm'),
  eventId: z.number().int(),
  ruleId: z.number().int(),
  tagId: z.number().int(),
  transition: z.enum(ALARM_TRANSITIONS),
  /** 전이를 일으킨 판정 행의 측정 시각(epoch ms) — 벽시계가 아니다 */
  ts: z.number().int(),
  severity: z.number().int(),
});
export type AlarmFrameBody = z.infer<typeof AlarmFrame>;
