// 알람 화면 순수 로직 — 정본 docs/08_screen/05_alarm_console.md · docs/07_api/07_alarms.md · docs/07_api/11_websocket.md
// 응답 파싱 · 탭 → 조회 조건(목록 범위 기본값) · 확인 버튼 판정 · 확인 결과 표시 · 실시간 겹침 정리 · 규칙 폼 검증 · 분석 차트 열.
// 화면 컴포넌트는 이것을 부르기만 한다. 응답 모양은 packages/shared 알람 스키마 하나로 읽는다(모르는 모양은 던진다 · 모르는 필드는 버린다).
import { ApiError } from './api';
import type { WriteRequest } from './commands';
import {
  ALARM_SEVERITIES,
  AlarmEvalResponse,
  type AlarmEventBody,
  AlarmEventObject,
  AlarmEventPage,
  type AlarmFrameBody,
  AlarmFrame as AlarmFrameSchema,
  type AlarmRuleBody,
  AlarmRuleList,
  AlarmRuleObject,
  CONDITION_TYPES,
  type ConditionType,
  type EvalInterval,
  type EvalPointRow,
} from './shared';
import { toKstOffsetIso } from './time';

const DAY = 24 * 3_600_000;

/** 목록 캐시 cache:alarmevents 첫 채움 기준 만료 30초 · 지터 없음(05_redis_keyspace 현행 참고) — staleTime도 같다(09_tech_stack/01) */
export const ALARM_EVENTS_TTL_MS = 30_000;
/** 알람 규칙 staleTime 240초 = cache:alarmrules 300초 × 0.8(09_tech_stack/01 — 관계식의 파생) */
export const ALARM_RULES_STALE_MS = 240_000;

// ── 쿼리 키 — 신호 무효화(lib/cache-signal: cache:alarmrules → alarm · rules)와 같은 접두 ──
export const alarmKeys = {
  all: ['alarm'] as const,
  events: () => ['alarm', 'events'] as const,
  eventList: (q: EventListQuery) => ['alarm', 'events', q] as const,
  rules: () => ['alarm', 'rules'] as const,
  evaluations: (ruleId: number, fromMs: number, toMs: number) =>
    ['alarm', 'evaluations', ruleId, fromMs, toMs] as const,
};

// ── 심각도 · 조건 ──
/** 심각도 3값 — 정의는 packages/shared(11_glossary/03) */
export const SEVERITIES = ALARM_SEVERITIES;
export const severityLabel = (s: number): string => SEVERITIES.find((x) => x.value === s)?.label ?? `S${s}`;

/** 저장 enum 4값(11_glossary/03) — 정의는 packages/shared */
export { CONDITION_TYPES, type ConditionType };

/** 조건 한 줄 — GT 80 · OUT 1~9 · ROC 0.5/s */
export function conditionText(c: string, threshold: number, thresholdLow: number | null): string {
  if (c === 'OUT_OF_RANGE') return `OUT ${thresholdLow ?? '?'}~${threshold}`;
  if (c === 'RATE_OF_CHANGE') return `ROC ${threshold}/s`;
  return `${c} ${threshold}`;
}

// ── 응답 파싱 — packages/shared 스키마(07_api/07 · 07_api/11) ──
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

/** #1 이벤트 객체(07_api/07 §응답 — 필드 행 7) · #2 응답도 같은 모양 */
export type AlarmEvent = AlarmEventBody;
export const parseAlarmEvent = (x: unknown): AlarmEvent => AlarmEventObject.parse(x);

export interface EventPage {
  items: AlarmEvent[];
  nextCursor: string | null;
}

export function parseEventPage(x: unknown): EventPage {
  const page = AlarmEventPage.parse(x);
  return { items: page.items, nextCursor: page.meta.nextCursor };
}

/** 규칙 객체 8필드(07_api/07 #3~#5) — 태그 표시 필드는 규칙 객체에 없다(태그는 마스터 단건 조회로 붙인다) */
export type AlarmRule = AlarmRuleBody;
export const parseAlarmRule = (x: unknown): AlarmRule => AlarmRuleObject.parse(x);
export const parseRuleList = (x: unknown): AlarmRule[] => AlarmRuleList.parse(x).items;

/** WebSocket alarm 프레임에서 type을 뗀 필드 6(07_api/11 §메시지 봉투) — 소켓이 shared WsServerMessage로 거른 뒤 넘긴다 */
export type AlarmFrame = Omit<AlarmFrameBody, 'type'>;

/** 원시 JSON 문자열 → alarm 프레임 · 다른 type · 모양 위반(계약 밖 필드 포함)이면 null — 시험 · 보조 경로 */
export function parseAlarmFrame(raw: string): AlarmFrame | null {
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = AlarmFrameSchema.safeParse(x);
  if (!r.success) return null;
  const { type: _t, ...frame } = r.data;
  return frame;
}

// ── ALM-CONSOLE 탭 · 조회 조건 ──
export const TABS = [
  { id: 'active', label: '활성' },
  { id: 'unacked', label: '미확인' },
  { id: 'history', label: '이력' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

/** 이력 범위 프리셋 — 기본 7일(07_api/07 §알람 목록 범위 기본값 판정 · 2계층 현행 참고) */
export const HISTORY_RANGES = [
  { id: '1d', label: '최근 24시간', ms: DAY },
  { id: '7d', label: '최근 7일', ms: 7 * DAY },
  { id: '30d', label: '최근 30일', ms: 30 * DAY },
  { id: '90d', label: '최근 90일', ms: 90 * DAY },
] as const;
export type HistoryRangeId = (typeof HISTORY_RANGES)[number]['id'];
export const DEFAULT_HISTORY_RANGE: HistoryRangeId = '7d';

export interface ConsoleParams {
  tab: TabId;
  range: HistoryRangeId;
  severity: number | null;
}

/** 쿼리 문자열(탭 · 발생 시각 범위 · 심각도 딥링크) → 조건 — 모르는 값은 기본값 */
export function decodeConsoleParams(q: URLSearchParams): ConsoleParams {
  const tab = TABS.find((t) => t.id === q.get('tab'))?.id ?? 'active';
  const range = HISTORY_RANGES.find((r) => r.id === q.get('range'))?.id ?? DEFAULT_HISTORY_RANGE;
  const sv = Number(q.get('severity'));
  return { tab, range, severity: SEVERITIES.some((s) => s.value === sv) ? sv : null };
}

export function encodeConsoleParams(p: ConsoleParams): URLSearchParams {
  const q = new URLSearchParams({ tab: p.tab });
  if (p.tab === 'history') q.set('range', p.range);
  if (p.severity !== null) q.set('severity', String(p.severity));
  return q;
}

/** #1 요청 파라미터(커서 제외) — 쿼리 키에도 쓴다 */
export interface EventListQuery {
  state?: 'ACTIVE';
  acked?: 'false';
  from?: string;
  to?: string;
  severity?: string;
}

/**
 * 탭 → 조회 조건. 탭 셋은 조회 조건 하나씩이다(REQ-ALM-13).
 * 활성 · 미확인은 from을 싣지 않는다 — 서버 기본(보존 창 시작 ~ 현재)을 쓴다. 화면이 최근 24시간 같은 범위를 실으면
 * 열흘 전 비활성 태그의 열린 알람이 목록에서 빠져 누구도 확인하지 않는다(07_api/07 §알람 목록 범위 기본값 판정).
 * 이력만 범위를 싣는다 — 조회 순간 끝 = 현재. nowMs는 분 단위로 내려 쿼리 키가 렌더마다 바뀌지 않게 한다.
 */
export function eventListQuery(p: ConsoleParams, nowMs: number): EventListQuery {
  const q: EventListQuery = {};
  if (p.tab === 'active') q.state = 'ACTIVE';
  else if (p.tab === 'unacked') q.acked = 'false';
  else {
    const to = Math.floor(nowMs / 60_000) * 60_000;
    const ms = HISTORY_RANGES.find((r) => r.id === p.range)?.ms ?? 7 * DAY;
    q.from = toKstOffsetIso(to - ms);
    q.to = toKstOffsetIso(to);
  }
  if (p.severity !== null) q.severity = String(p.severity);
  return q;
}

export function eventListSearch(q: EventListQuery, cursor: string | null): string {
  const s = new URLSearchParams(q as Record<string, string>);
  if (cursor) s.set('cursor', cursor);
  return s.toString();
}

// ── 확인 허용 판정 · 확인 결과 ──
export type AckButton =
  | { kind: 'enabled' }
  | { kind: 'cleared' } // 비활성 · "해제된 알람"
  | { kind: 'acked'; ackedBy: number | null; ackedAt: string }; // 비활성 · 확인자 · 확인 시각

/**
 * 버튼 활성 조건 = 서버 허용 조건(REQ-ALM-14)을 화면에 옮긴 것 — 화면은 서버 판정을 대신하지 않는다.
 * 인증 전(S7 ①)에는 역할로 숨기지 않는다 — 로그인 응답 user.roles가 없어 화면이 역할을 모른다.
 * CLEARING 중인 알람도 alarm_event에서 ACTIVE라 켜진다(화면은 Redis 상태를 모른다).
 */
export function ackButton(e: Pick<AlarmEvent, 'state' | 'ackedAt' | 'ackedBy'>): AckButton {
  if (e.ackedAt) return { kind: 'acked', ackedBy: e.ackedBy, ackedAt: e.ackedAt };
  if (e.state === 'CLEARED') return { kind: 'cleared' };
  return { kind: 'enabled' };
}

export interface AckOutcome {
  /** 표시 문구 — 200은 null(행이 확인자 · 시각으로 채워진다) */
  message: string | null;
  tone: 'danger' | 'warning' | 'info';
  /** 목록 재조회 여부 — 401 · 403은 제자리 */
  refetch: boolean;
}

/**
 * 확인 응답 → 표시(08_screen/05 §확인 허용 판정 트리 · 08_screen/01 §에러 코드별 사용자 표시).
 * 409는 경합의 정상 결과다 — 같은 요청을 재시도하지 않고 목록을 다시 읽는다.
 * 401을 로그인 화면 이동으로 처리하지 않는다 — 인증 전에는 로그인 화면이 없어 이동 뒤 막힌다.
 */
export function ackOutcome(error: unknown): AckOutcome {
  if (error === null || error === undefined) return { message: null, tone: 'info', refetch: true };
  const code = error instanceof ApiError ? error.code : null;
  const status = error instanceof ApiError ? error.status : -1;
  const tail = code ? ` (${code}/${status})` : '';
  switch (code) {
    case 'alarms.ack_not_allowed':
      return { message: `이미 확인됐거나 해제된 알람${tail}`, tone: 'warning', refetch: true };
    case 'common.not_found':
      return { message: `대상이 없다${tail}`, tone: 'warning', refetch: true };
    case 'auth.unauthenticated':
      return { message: `확인 행위자 계정이 설정되지 않았다${tail}`, tone: 'danger', refetch: false };
    case 'auth.forbidden':
      return {
        message: `이 작업은 운영자(OPERATOR)만 한다 — 확인 행위자에 역할이 없다${tail}`,
        tone: 'danger',
        refetch: false,
      };
    case 'common.postgres_unavailable':
      return { message: `업무 저장소 응답 불가${tail}`, tone: 'danger', refetch: false };
    case 'common.rate_limited':
      return { message: `요청 한도 초과${tail}`, tone: 'warning', refetch: false };
    default:
      if (status === 0) return { message: 'api에 닿지 못했다 (네트워크)', tone: 'danger', refetch: false };
      return {
        message: code ? `확인 실패${tail}` : `확인 실패 (HTTP ${status})`,
        tone: 'danger',
        refetch: false,
      };
  }
}

// ── 쓰기 요청(업무 쓰기 명령 경로 — 보내기 · 키 · 202 처리는 lib/commands의 useBizWrite) ──
/** #2 확인 — 본문 없음 · 응답은 이벤트 객체(#1 모양) */
export const ackRequest = (eventId: number): WriteRequest => ({
  method: 'POST',
  url: `/bff/alarms/events/${eventId}/ack`,
});
/** #4 규칙 등록 */
export const createRuleRequest = (body: RuleBody): WriteRequest => ({
  method: 'POST',
  url: '/bff/alarms/rules',
  body,
});
/** #5 규칙 수정 — 바뀐 가변 필드만 */
export const patchRuleRequest = (ruleId: number, body: Partial<RuleBody>): WriteRequest => ({
  method: 'PATCH',
  url: `/bff/alarms/rules/${ruleId}`,
  body,
});

// ── 실시간 겹침(08_screen/05 §실시간 겹침 — 사건 4) ──
export interface OverlayItem {
  eventId: number;
  ruleId: number;
  tagId: number;
  severity: number;
  /** 열림 판정 행 ts — 닫힘만 받았으면 null */
  openedTs: number | null;
  /** 닫힘 판정 행 ts — 닫힘을 받았을 때만 */
  clearedTs: number | null;
  /** 화면이 받은 시각(브라우저 epoch ms) — 목록 캐시 TTL 경과 판정의 기준 */
  receivedAt: number;
}

/** 프레임 하나를 겹침 층에 합친다 — 같은 eventId의 열림 · 닫힘은 한 행 */
export function applyAlarmFrame(
  overlay: Readonly<Record<number, OverlayItem>>,
  f: AlarmFrame,
  nowMs: number,
): Record<number, OverlayItem> {
  const prev = overlay[f.eventId];
  const item: OverlayItem = {
    eventId: f.eventId,
    ruleId: f.ruleId,
    tagId: f.tagId,
    severity: f.severity,
    openedTs: f.transition === 'OPENED' ? f.ts : (prev?.openedTs ?? null),
    clearedTs: f.transition === 'CLEARED' ? f.ts : (prev?.clearedTs ?? null),
    receivedAt: nowMs,
  };
  return { ...overlay, [f.eventId]: item };
}

/**
 * 겹침 행이 사라지는 때 — ① 목록 재조회 결과에 같은 이벤트가 나타남(닫힘 통지는 CLEARED로 나타남)
 * ② 목록 캐시 TTL이 지난 뒤의 재조회(목록이 진실이다 — 그 뒤에도 없으면 이 탭 조건 밖이다).
 * listUpdatedAt = 목록 응답을 받은 시각(0이면 아직 없음).
 */
export function isOverlaySettled(
  item: OverlayItem,
  listed: ReadonlyMap<number, Pick<AlarmEvent, 'state'>>,
  listUpdatedAt: number,
  ttlMs = ALARM_EVENTS_TTL_MS,
): boolean {
  const row = listed.get(item.eventId);
  if (row && (item.clearedTs === null || row.state === 'CLEARED')) return true;
  return listUpdatedAt >= item.receivedAt + ttlMs;
}

// ── ALM-RULES 폼 검증(08_screen/05 §규칙 폼 검증 — 필드 7) ──
export interface RuleForm {
  tagId: number | null;
  conditionType: ConditionType;
  /** 입력 칸 문자열 그대로 — 수치 판정은 검증이 한다 */
  threshold: string;
  thresholdLow: string;
  debounceMs: string;
  severity: number;
  enabled: boolean;
}

export const EMPTY_RULE_FORM: RuleForm = {
  tagId: null,
  conditionType: 'GT',
  threshold: '',
  thresholdLow: '',
  debounceMs: '5000',
  severity: 2,
  enabled: true,
};

export const ruleFormOf = (r: AlarmRule): RuleForm => ({
  tagId: r.tagId,
  conditionType: r.conditionType,
  threshold: String(r.threshold),
  thresholdLow: r.thresholdLow === null ? '' : String(r.thresholdLow),
  debounceMs: String(r.debounceMs),
  severity: r.severity,
  enabled: r.enabled,
});

export type RuleFormErrors = Partial<Record<keyof RuleForm, string>>;

export interface RuleBody {
  tagId: number;
  conditionType: ConditionType;
  threshold: number;
  thresholdLow: number | null;
  debounceMs: number;
  severity: number;
  enabled: boolean;
}

const parseNum = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * 화면 검증 — 입력 편의이고 서버 400이 최종이다. 통과하면 본문(생성 모양)을 돌려준다.
 * tagActive: 선택한 태그의 활성 여부(모르면 null — 서버가 판정한다).
 */
export function validateRuleForm(
  f: RuleForm,
  tagActive: boolean | null,
): { ok: true; body: RuleBody } | { ok: false; errors: RuleFormErrors } {
  const errors: RuleFormErrors = {};
  if (f.tagId === null) errors.tagId = '태그를 고른다';
  else if (tagActive === false) errors.tagId = '비활성 태그에는 규칙을 만들 수 없다';
  if (!(CONDITION_TYPES as readonly string[]).includes(f.conditionType))
    errors.conditionType = '조건 4종 중 하나';
  const threshold = parseNum(f.threshold);
  if (threshold === null) errors.threshold = '필수 · 수치';
  let thresholdLow: number | null = null;
  if (f.conditionType === 'OUT_OF_RANGE') {
    thresholdLow = parseNum(f.thresholdLow);
    if (thresholdLow === null) errors.thresholdLow = 'OUT_OF_RANGE는 하한이 필수 · 수치';
    else if (threshold !== null && !(thresholdLow < threshold)) errors.thresholdLow = '하한 < 임계';
  }
  const debounce = parseNum(f.debounceMs);
  if (debounce === null || !Number.isInteger(debounce) || debounce < 0) errors.debounceMs = '0 이상 정수(ms)';
  if (!SEVERITIES.some((s) => s.value === f.severity)) errors.severity = '1 LOW · 2 MEDIUM · 3 HIGH';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      tagId: f.tagId as number,
      conditionType: f.conditionType,
      threshold: threshold as number,
      thresholdLow, // OUT_OF_RANGE 밖은 null(서버 검증 — 그 밖 thresholdLow null)
      debounceMs: debounce as number,
      severity: f.severity,
      enabled: f.enabled,
    },
  };
}

/** 편집 PATCH 본문 — 바뀐 가변 필드만(tagId · conditionType은 불변이라 싣지 않는다) */
export function rulePatchBody(before: AlarmRule, after: RuleBody): Partial<RuleBody> {
  const out: Partial<RuleBody> = {};
  if (after.threshold !== before.threshold) out.threshold = after.threshold;
  if (after.thresholdLow !== before.thresholdLow) out.thresholdLow = after.thresholdLow;
  if (after.debounceMs !== before.debounceMs) out.debounceMs = after.debounceMs;
  if (after.severity !== before.severity) out.severity = after.severity;
  if (after.enabled !== before.enabled) out.enabled = after.enabled;
  return out;
}

/** 서버 400 details.fields(path · reason) → 필드 옆 문구 */
export function serverFieldErrors(error: unknown): RuleFormErrors {
  if (!(error instanceof ApiError) || error.code !== 'common.validation_failed') return {};
  const fields = error.details?.fields;
  if (!Array.isArray(fields)) return {};
  const out: RuleFormErrors = {};
  const known: readonly string[] = [
    'tagId',
    'conditionType',
    'threshold',
    'thresholdLow',
    'debounceMs',
    'severity',
    'enabled',
  ];
  for (const f of fields) {
    if (!isObj(f) || typeof f.path !== 'string') continue;
    const key = f.path.replace(/^body\./, '');
    if (!known.includes(key)) continue;
    const reason = typeof f.reason === 'string' ? f.reason : '';
    out[key as keyof RuleForm] =
      reason === 'reference'
        ? '없는 태그이거나 비활성 태그다'
        : reason === 'immutable'
          ? '편집에서 바꿀 수 없는 필드다'
          : `서버 거절 (${reason || '형식'})`;
  }
  return out;
}

/** 저장 확인 문구 — 판정 반영 시점을 말한다(08_screen/05 §규칙 폼 검증) */
export const RULE_SAVED_NOTE =
  '다음 판정 배치부터 새 임계값이 쓰인다 · 이미 대기(PENDING) 중인 위반은 새 임계값으로 이어 판정한다';

// ── ALM-RULES 판정 분석(#6) ──
export const EVAL_RANGES = [
  { id: '1h', label: '최근 1시간', ms: 3_600_000 },
  { id: '24h', label: '최근 24시간', ms: DAY },
  { id: '7d', label: '최근 7일', ms: 7 * DAY },
  { id: '30d', label: '최근 30일', ms: 30 * DAY },
] as const;
export type EvalRangeId = (typeof EVAL_RANGES)[number]['id'];
export const DEFAULT_EVAL_RANGE: EvalRangeId = '7d';

/** 버킷 폭 — raw는 버킷이 아니라 합성하지 않는다 · 1,000 ms는 음영 폭 기본값(api RAW_PERIOD_MS와 같은 값)일 뿐이다 */
export const EVAL_BUCKET_MS: Record<EvalInterval, number> = { raw: 1000, '1m': 60_000, '1h': 3_600_000 };

export interface EvalResult {
  interval: EvalInterval;
  fromMs: number;
  toMs: number;
  rule: AlarmRule | null;
  /** [ts, min, max, breachCount, evalCount] — ts 오름차순 · 누락 버킷은 evalCount 0 행으로 합성된다 */
  points: EvalPointRow[];
}

export function parseEvaluations(x: unknown): EvalResult {
  const r = AlarmEvalResponse.parse(x);
  const points = r.series.flatMap((s) => s.points).sort((a, b) => a[0] - b[0]);
  const fromMs = Date.parse(r.meta.from);
  const toMs = Date.parse(r.meta.to);
  return {
    interval: r.meta.interval,
    fromMs,
    toMs,
    rule: r.meta.rule,
    // raw는 합성하지 않는다 — 점이 판정 한 건이라 버킷이 아니고 scan_rate 가정(1초)이 태그마다 틀릴 수 있다(리드 판정)
    points:
      r.meta.interval === 'raw'
        ? points
        : fillEmptyBuckets(points, EVAL_BUCKET_MS[r.meta.interval], fromMs, toMs),
  };
}

/**
 * 누락 버킷 합성 — api는 판정이 없는 버킷의 행을 내지 않는다(05_timeseries 관례 · WITH FILL 없음).
 * [from, to)를 epoch 정렬 버킷(api 집계와 같은 intDiv 경계)으로 나눠, 행이 하나도 없는 버킷마다 [시작, null, null, 0, 0]을 끼운다.
 * 그래야 빈 버킷 주의 표지(evalCount 0)가 실제로 켜진다 — 합성하지 않으면 빈 구간이 앞뒤 버킷 사이 간격으로만 남아
 * "판정 없음 또는 기록 실패"가 차트에 드러나지 않는다(08_screen/05 · AC-36).
 * 1m · 1h 버킷에만 쓴다 — raw는 parseEvaluations가 건너뛴다.
 * points는 ts 오름차순이어야 한다.
 */
export function fillEmptyBuckets(
  points: readonly EvalPointRow[],
  stepMs: number,
  fromMs: number,
  toMs: number,
): EvalPointRow[] {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || !(stepMs > 0) || fromMs >= toMs)
    return [...points];
  const out: EvalPointRow[] = [];
  let i = 0;
  const last = Math.floor((toMs - 1) / stepMs) * stepMs;
  for (let b = Math.floor(fromMs / stepMs) * stepMs; b <= last; b += stepMs) {
    // 이 버킷 앞의 행(범위 밖 · 정렬 어긋남)은 그대로 싣는다
    while (i < points.length && (points[i] as EvalPointRow)[0] < b) out.push(points[i++] as EvalPointRow);
    if (i < points.length && (points[i] as EvalPointRow)[0] < b + stepMs) {
      while (i < points.length && (points[i] as EvalPointRow)[0] < b + stepMs)
        out.push(points[i++] as EvalPointRow);
    } else {
      out.push([b, null, null, 0, 0]);
    }
  }
  while (i < points.length) out.push(points[i++] as EvalPointRow);
  return out;
}

export interface EvalColumns {
  x: number[];
  min: (number | null)[];
  max: (number | null)[];
  /** 위반 비율(breachCount ÷ evalCount) — evalCount 0이면 null */
  ratio: (number | null)[];
  /** evalCount 0 버킷 — "판정 없음 또는 기록 실패"(위반 0과 다른 표지) */
  empty: boolean[];
  /** 위반이 1건 이상인 버킷 */
  breached: boolean[];
  /** 버킷 폭(ms) — 마지막 버킷 음영의 끝 */
  stepMs: number;
  totalEval: number;
  totalBreach: number;
}

/**
 * points → 차트 열. 빈 버킷(evalCount 0)을 "위반 0"으로 그리지 않는다 — 비율 null · 극값 null(끊김) · empty 표지.
 * 같게 그리면 기록 실패 구간을 "오탐 없음"으로 읽어 임계값을 느슨하게 고친다(08_screen/05 §요소).
 */
export function evalColumns(points: EvalResult['points'], stepMs = EVAL_BUCKET_MS['1m']): EvalColumns {
  const c: EvalColumns = {
    x: [],
    min: [],
    max: [],
    ratio: [],
    empty: [],
    breached: [],
    stepMs,
    totalEval: 0,
    totalBreach: 0,
  };
  for (const [ts, min, max, breach, count] of points) {
    const empty = count === 0;
    c.x.push(ts);
    c.min.push(empty ? null : min);
    c.max.push(empty ? null : max);
    c.ratio.push(empty ? null : breach / count);
    c.empty.push(empty);
    c.breached.push(!empty && breach > 0);
    c.totalEval += count;
    c.totalBreach += breach;
  }
  return c;
}

/** 임계선 — OUT_OF_RANGE는 두 선 · 그 밖은 한 선 · RATE_OF_CHANGE는 값 축이 아니라 변화율이라 긋지 않는다 */
export function thresholdLines(
  rule: Pick<AlarmRule, 'conditionType' | 'threshold' | 'thresholdLow'>,
): number[] {
  if (rule.conditionType === 'RATE_OF_CHANGE') return [];
  if (rule.conditionType === 'OUT_OF_RANGE' && rule.thresholdLow !== null)
    return [rule.thresholdLow, rule.threshold];
  return [rule.threshold];
}

/** 분석 요청 쿼리 — 범위는 분 단위로 내려 쿼리 키를 고정한다 */
export function evaluationsSearch(
  ruleId: number,
  range: EvalRangeId,
  nowMs: number,
): {
  search: string;
  fromMs: number;
  toMs: number;
} {
  const toMs = Math.floor(nowMs / 60_000) * 60_000;
  const fromMs = toMs - (EVAL_RANGES.find((r) => r.id === range)?.ms ?? 7 * DAY);
  const s = new URLSearchParams({
    ruleId: String(ruleId),
    from: toKstOffsetIso(fromMs),
    to: toKstOffsetIso(toMs),
  });
  return { search: s.toString(), fromMs, toMs };
}

/** 원 시계열 보기 — ANL-TREND 딥링크(같은 태그 · 범위 · 08_screen/04 쿼리 문자열) */
export function trendDeepLink(tagId: number, fromMs: number, toMs: number): string {
  const q = new URLSearchParams({
    tags: String(tagId),
    from: toKstOffsetIso(fromMs),
    to: toKstOffsetIso(toMs),
  });
  return `/trend?${q.toString()}`;
}

/** 알람 표면 에러 표시 — lib/error-display에 없는 alarms 네임스페이스 문구를 먼저 본다(08_screen/01 §에러 코드별 사용자 표시) */
const ALARM_TEXT: Record<string, string> = {
  'alarms.ack_not_allowed': '이미 확인됐거나 해제된 알람',
  'alarms.eval_store_unavailable': '판정 기록 저장소 응답 불가',
  'auth.forbidden': '이 작업은 권한이 있는 역할만 한다',
};
export function alarmErrorText(error: unknown, fallback: (e: unknown) => string): string {
  if (error instanceof ApiError && error.code && ALARM_TEXT[error.code])
    return `${ALARM_TEXT[error.code]} (${error.code}/${error.status})`;
  return fallback(error);
}
