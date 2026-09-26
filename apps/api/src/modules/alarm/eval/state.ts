// A2 · ⑥ alarm:state:{rule_id} — 봉인 계열 Hash · 필드 7(정본 docs/05_data_stores/05_redis_keyspace.md §봉인 계열 키 · 03_enums 상태 머신 2)
// state · first_breach_ts · breach_count · event_id · first_clear_ts · last_value · last_ts — 시각은 epoch ms 정수 · 빈 값은 빈 문자열.
// 쓰기 주체는 판정기 하나다(확인 표면은 쓰지 않는다 · W4). alarm:state 왕복은 배치당 읽기 1(파이프라인 HGETALL) · 쓰기 1(파이프라인 HSET)
// — ADR-11 · REQ-ALM-07(규칙 캐시 GET은 별도 · 커밋 뒤 쓰기 실패면 같은 파이프라인 1회 재시도).
import type { AlarmStateName } from './alarm-eval.metrics';

export interface AlarmState {
  state: AlarmStateName;
  firstBreachTs: number | null;
  breachCount: number;
  eventId: number | null;
  firstClearTs: number | null;
  /** RATE_OF_CHANGE 직전 값 · 늦은 행 판별 기준 — 마지막 GOOD · SIMULATED(비 BAD) 행 */
  lastValue: number | null;
  lastTs: number | null;
}

export const ALARM_STATE_FIELDS = [
  'state',
  'first_breach_ts',
  'breach_count',
  'event_id',
  'first_clear_ts',
  'last_value',
  'last_ts',
] as const;

export function initialState(): AlarmState {
  return {
    state: 'NORMAL',
    firstBreachTs: null,
    breachCount: 0,
    eventId: null,
    firstClearTs: null,
    lastValue: null,
    lastTs: null,
  };
}

const STATES: ReadonlySet<string> = new Set(['NORMAL', 'PENDING', 'ACTIVE', 'CLEARING']);

function num(v: string | undefined): number | null {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** HGETALL 결과 → 상태. 키가 없으면(빈 객체) NORMAL 초기 상태 */
export function parseState(h: Record<string, string> | null | undefined): AlarmState {
  if (!h || Object.keys(h).length === 0) return initialState();
  const state = STATES.has(h.state ?? '') ? (h.state as AlarmStateName) : 'NORMAL';
  return {
    state,
    firstBreachTs: num(h.first_breach_ts),
    breachCount: num(h.breach_count) ?? 0,
    eventId: num(h.event_id),
    firstClearTs: num(h.first_clear_ts),
    lastValue: num(h.last_value),
    lastTs: num(h.last_ts),
  };
}

/** 상태 → HSET 필드 7(전부 쓴다 — 초기화된 필드는 빈 문자열) */
export function serializeState(s: AlarmState): Record<(typeof ALARM_STATE_FIELDS)[number], string> {
  const str = (v: number | null) => (v === null ? '' : String(v));
  return {
    state: s.state,
    first_breach_ts: str(s.firstBreachTs),
    breach_count: String(s.breachCount),
    event_id: str(s.eventId),
    first_clear_ts: str(s.firstClearTs),
    last_value: str(s.lastValue),
    last_ts: str(s.lastTs),
  };
}

/**
 * 상태 저장소 — 읽기 · 쓰기 각 1왕복(파이프라인). 봉인 계열이라 실패를 던진다(판정 중단 · REQ-ALM-07).
 * 원시 Hash 입출력만 한다 — 해석은 parseState · serializeState.
 */
export interface AlarmStateStorePort {
  read(ruleIds: readonly number[]): Promise<Map<number, Record<string, string>>>;
  write(states: ReadonlyMap<number, Record<string, string>>): Promise<void>;
}
