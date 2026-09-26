// A3 규칙 하나의 판정 — 기전 정본 docs/06_pipeline/08_alarm.md §행 평가 순서 · §조건 평가와 RATE_OF_CHANGE 경계 · §디바운스 전이와 세 쓰기
// · §ACK와 alarm:state · §부분 실패. 상태 머신 모양 정본 docs/11_glossary/03_enums_state_machines.md 상태 머신 2.
// 행은 호출자가 규칙별 ts 오름차순 · 품질 2 · 4 제외로 넘긴다. 디바운스 시계는 행 ts다(벽시계가 아니다 · REQ-ALM-08).
// 확정 전이(열기 1 · 닫기 2)는 PostgreSQL 쓰기가 성공해야 상태를 바꾼다 — 실패하면 직전 상태를 둔다(다음 배치가 재시도 · REQ-ALM-10).
// 멈춤은 배치 단위다(BatchHalt) — 첫 PostgreSQL 실패 뒤 그 배치의 모든 규칙이 확정 쓰기 · acked 조회를 건너뛴다(장애 때
// 규칙 수 × 타임아웃을 막는다). 확정 지점에서 멈춘 규칙은 그 배치 끝까지 상태를 동결한다(PENDING이 뒤 정상 행으로 NORMAL이 되지 않는다).
// 판정 전수(alarm_eval 행)는 확정과 독립이라 계속 낸다.
import type { AlarmStateName } from './alarm-eval.metrics';
import type { AlarmRule } from './rules';
import type { AlarmState } from './state';

export interface JudgeRow {
  ts: number;
  value: number;
  quality: number;
}

/** alarm_eval 한 행 — 열 순서 ts · rule_id · tag_id · value · breached · severity(05_data_stores/03 §alarm_eval) */
export type AlarmEvalRow = [number, number, number, number, 0 | 1, number];
export const ALARM_EVAL_COLUMNS = ['ts', 'rule_id', 'tag_id', 'value', 'breached', 'severity'] as const;

/** 확정 쓰기 — 판정기가 PostgreSQL 구현을 넣는다. 실패는 던진다 */
export interface ConfirmPort {
  /** 열기 — 같은 rule_id의 열린 행이 있으면 INSERT하지 않고 그 event_id(inserted false · §부분 실패 중복 열기 방지) */
  open(rule: AlarmRule, ts: number, value: number): Promise<{ eventId: number; inserted: boolean }>;
  /** 닫기 — 이번에 닫았으면 true · 이미 닫혀 있었으면 false(커밋 뒤 상태 쓰기 실패의 재시도) */
  close(rule: AlarmRule, eventId: number | null, ts: number): Promise<boolean>;
  /** 해소 첫 감지 때 1회 — 확인됐는가. 실패는 던진다(판정이 확인 안 된 것으로 보고 → CLEARING · 배치를 멈춘다) */
  acked(eventId: number): Promise<boolean>;
}

/** 배치 하나의 확정 멈춤 — 판정기가 배치마다 새로 만들어 규칙 판정에 함께 넘긴다 */
export interface BatchHalt {
  halted: boolean;
}

export interface ConfirmedEvent {
  kind: 'open' | 'close';
  eventId: number;
  ts: number;
  /** 이번에 PostgreSQL 행을 새로 열거나 닫았다 — 계수 · 발행은 이것만(재시도로 다시 확인한 행은 이미 통지됐다) */
  fresh: boolean;
}

export interface RuleJudgeResult {
  state: AlarmState;
  evalRows: AlarmEvalRow[];
  violations: number;
  normals: number;
  transitions: [AlarmStateName, AlarmStateName][];
  events: ConfirmedEvent[];
  pgFailures: ('open' | 'close')[];
  /** 상태가 바뀌었거나 last_* 가 갱신됐다 — ⑥에 싣는다 */
  touched: boolean;
  /** 확정 쓰기(PostgreSQL) 소요 ms 합 — A4에 넣고 A3에서 뺀다 */
  confirmMs: number;
}

/** 조건 평가 — GT · LT · OUT_OF_RANGE(경계는 규칙 값 · 같으면 위반 아님) */
export function breachOf(rule: AlarmRule, value: number): boolean {
  switch (rule.conditionType) {
    case 'GT':
      return value > rule.threshold;
    case 'LT':
      return value < rule.threshold;
    case 'OUT_OF_RANGE':
      return value < (rule.thresholdLow ?? Number.NEGATIVE_INFINITY) || value > rule.threshold;
    case 'RATE_OF_CHANGE':
      throw new Error('RATE_OF_CHANGE는 직전 값이 필요하다 — rateStep을 쓴다');
  }
}

/**
 * RATE_OF_CHANGE 경계 5(§RATE_OF_CHANGE 경계) — 판정하면 위반 여부 · 판정하지 않으면 null. 상태의 last_*를 갱신한다.
 * 직전 값 없음 → 기록만 · Δts = 0 → 갱신 없음 · Δts < 0(늦은 행) → 갱신 없음 · Δts > 결측 한도 → 교체만 · BAD는 호출 전에 빠진다.
 */
export function rateStep(
  rule: AlarmRule,
  s: AlarmState,
  row: JudgeRow,
  staleMultiplier: number,
): boolean | null {
  if (s.lastTs === null || s.lastValue === null) {
    s.lastValue = row.value;
    s.lastTs = row.ts;
    return null;
  }
  const dt = row.ts - s.lastTs;
  if (dt <= 0) return null;
  const prev = s.lastValue;
  s.lastValue = row.value;
  s.lastTs = row.ts;
  if (dt > rule.scanRateMs * staleMultiplier) return null;
  return Math.abs(row.value - prev) / (dt / 1000) > rule.threshold;
}

function reset(s: AlarmState): void {
  s.state = 'NORMAL';
  s.firstBreachTs = null;
  s.breachCount = 0;
  s.eventId = null;
  s.firstClearTs = null;
}

export async function judgeRule(
  rule: AlarmRule,
  initial: AlarmState,
  rows: readonly JudgeRow[],
  confirm: ConfirmPort,
  staleMultiplier: number,
  halt: BatchHalt = { halted: false },
): Promise<RuleJudgeResult> {
  const s: AlarmState = { ...initial };
  const r: RuleJudgeResult = {
    state: s,
    evalRows: [],
    violations: 0,
    normals: 0,
    transitions: [],
    events: [],
    pgFailures: [],
    touched: false,
    confirmMs: 0,
  };
  /** 이 규칙이 확정 지점에서 멈췄다 — 배치 끝까지 전이 없음(직전 상태 유지 · 다음 배치가 재시도) · last_*와 전수는 계속 */
  let frozen = false;
  const stop = () => {
    halt.halted = true;
    frozen = true;
  };
  const move = (to: AlarmStateName) => {
    r.transitions.push([s.state, to]);
    s.state = to;
  };
  const timed = async <T>(fn: () => Promise<T>): Promise<T> => {
    const t = performance.now();
    try {
      return await fn();
    } finally {
      r.confirmMs += performance.now() - t;
    }
  };

  for (const row of rows) {
    let breached: boolean;
    let late = false;
    if (rule.conditionType === 'RATE_OF_CHANGE') {
      const before = s.lastTs;
      const b = rateStep(rule, s, row, staleMultiplier);
      if (s.lastTs !== before) r.touched = true;
      if (b === null) continue; // 판정하지 않는다 — alarm_eval 행 없음
      breached = b;
    } else {
      breached = breachOf(rule, row.value);
      // 늦은 행 — 판정 결과는 alarm_eval에 남기되 전이 · last_* 갱신은 없다(상태 머신은 뒤로 가지 않는다)
      late = s.lastTs !== null && row.ts < s.lastTs;
      if (!late) {
        s.lastValue = row.value;
        s.lastTs = row.ts;
        r.touched = true;
      }
    }
    r.evalRows.push([row.ts, rule.ruleId, rule.tagId, row.value, breached ? 1 : 0, rule.severity]);
    if (breached) r.violations++;
    else r.normals++;
    if (late || frozen) continue;

    switch (s.state) {
      case 'NORMAL':
        if (breached) {
          move('PENDING');
          s.firstBreachTs = row.ts;
          s.breachCount = 1;
        }
        break;
      case 'PENDING':
        if (!breached) {
          move('NORMAL');
          reset(s);
        } else if (row.ts - (s.firstBreachTs ?? row.ts) >= rule.debounceMs) {
          if (halt.halted) {
            frozen = true;
            break;
          }
          try {
            const ev = await timed(() => confirm.open(rule, row.ts, row.value));
            move('ACTIVE');
            s.eventId = ev.eventId;
            r.events.push({ kind: 'open', eventId: ev.eventId, ts: row.ts, fresh: ev.inserted });
          } catch {
            stop();
            r.pgFailures.push('open');
          }
        } else {
          move('PENDING');
          s.breachCount += 1;
        }
        break;
      case 'ACTIVE':
        if (breached) break;
        if (halt.halted) {
          frozen = true;
          break;
        }
        {
          // 해소 첫 감지 — 확인 여부를 PostgreSQL에서 1회 읽는다(ACKED 경로) · 읽지 못하면 확인 안 된 것으로 보고 배치를 멈춘다
          const eventId = s.eventId;
          let acked = false;
          if (eventId !== null) {
            try {
              acked = await timed(() => confirm.acked(eventId));
            } catch {
              halt.halted = true;
            }
          }
          if (!acked) {
            move('CLEARING');
            s.firstClearTs = row.ts;
            break;
          }
          try {
            const fresh = await timed(() => confirm.close(rule, eventId, row.ts));
            if (eventId !== null) r.events.push({ kind: 'close', eventId, ts: row.ts, fresh });
            move('NORMAL');
            reset(s);
          } catch {
            stop();
            r.pgFailures.push('close');
          }
        }
        break;
      case 'CLEARING':
        if (breached) {
          move('ACTIVE');
          s.firstClearTs = null;
        } else if (row.ts - (s.firstClearTs ?? row.ts) >= rule.debounceMs) {
          if (halt.halted) {
            frozen = true;
            break;
          }
          // CLEARING 중 확인은 디바운스를 끊지 않는다 — 여기서 acked를 읽지 않는다(§ACK와 alarm:state)
          const eventId = s.eventId;
          try {
            const fresh = await timed(() => confirm.close(rule, eventId, row.ts));
            if (eventId !== null) r.events.push({ kind: 'close', eventId, ts: row.ts, fresh });
            move('NORMAL');
            reset(s);
          } catch {
            stop();
            r.pgFailures.push('close');
          }
        }
        break;
    }
    if (r.transitions.length > 0) r.touched = true;
  }
  return r;
}
