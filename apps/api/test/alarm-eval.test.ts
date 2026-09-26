// S7 ① 알람 판정기 — 전이 8 · 행 평가 규칙 5 · RATE_OF_CHANGE 경계 5 · 부분 실패 · 인계 깊이 1 · 규칙 원천(06_pipeline/08)
import type { Metric } from 'prom-client';
import { describe, expect, it } from 'vitest';
import { appRegistry } from '../src/common/metrics/registry';
import type { AlarmFrame } from '../src/common/ports/realtime-fanout.port';
import { DirectGatewayFanout, directBus, RedisPubSubFanout } from '../src/common/ports/realtime-fanout.port';
import { CacheKeyClient } from '../src/common/redis/cache-key-client';
import type { RedisConnections } from '../src/common/redis/connections';
import { DurableKeyClient } from '../src/common/redis/durable-key-client';
import type { FanoutPublisher } from '../src/common/redis/fanout-publisher';
import type { AppConfig } from '../src/config/app-config';
import { AlarmEvalService } from '../src/modules/alarm/eval/alarm-eval.module';
import {
  type AlarmBatch,
  AlarmEvaluator,
  type AlarmEvaluatorDeps,
} from '../src/modules/alarm/eval/evaluator';
import {
  type AlarmEvalRow,
  type ConfirmPort,
  type JudgeRow,
  judgeRule,
} from '../src/modules/alarm/eval/judge';
import { ALARM_PG_STATEMENT_TIMEOUT_MS, queryBounded } from '../src/modules/alarm/eval/pg-bounded';
import { type AlarmRule, AlarmRuleSource, parseRules } from '../src/modules/alarm/eval/rules';
import { type AlarmState, initialState, parseState, serializeState } from '../src/modules/alarm/eval/state';
import { Flusher, type FlusherDeps } from '../src/modules/ingest/flusher';
import { IngestService } from '../src/modules/ingest/ingest.service';
import type { TagRawRow } from '../src/modules/ingest/window-buffer';

const T = 1_790_000_000_000;

function rule(p: Partial<AlarmRule> = {}): AlarmRule {
  return {
    ruleId: 7,
    tagId: 11,
    conditionType: 'GT',
    threshold: 10,
    thresholdLow: null,
    debounceMs: 1000,
    severity: 2,
    scanRateMs: 1000,
    ...p,
  };
}

const rowsAt = (...pts: [number, number][]): JudgeRow[] =>
  pts.map(([dt, v]) => ({ ts: T + dt, value: v, quality: 9 }));

/** 확정 포트 목 — 호출 기록 · 실패 주입 */
function confirmMock(
  opts: { acked?: boolean; failOpen?: boolean; failClose?: boolean; reuse?: boolean } = {},
) {
  const calls: string[] = [];
  let next = 100;
  const port: ConfirmPort = {
    async open(_r, ts) {
      calls.push(`open@${ts - T}`);
      if (opts.failOpen) throw new Error('pg down');
      return { eventId: next++, inserted: !opts.reuse };
    },
    async close(_r, eventId, ts) {
      calls.push(`close:${eventId}@${ts - T}`);
      if (opts.failClose) throw new Error('pg down');
      return true;
    },
    async acked(eventId) {
      calls.push(`acked:${eventId}`);
      return opts.acked ?? false;
    },
  };
  return { port, calls };
}

const judge = (r: AlarmRule, s: AlarmState, rows: JudgeRow[], c: ConfirmPort) => judgeRule(r, s, rows, c, 3);
const pairs = (t: [string, string][]) => t.map(([a, b]) => `${a}>${b}`);

describe('디바운스 전이 8(06_pipeline/08 §디바운스 전이와 세 쓰기)', () => {
  it('NORMAL→PENDING → PENDING→PENDING → PENDING→ACTIVE(열기) → ACTIVE→CLEARING → CLEARING→ACTIVE → CLEARING→NORMAL(닫기)', async () => {
    const c = confirmMock();
    const res = await judge(
      rule(),
      initialState(),
      rowsAt([0, 11], [500, 12], [1000, 13], [1500, 5], [1800, 11], [2000, 5], [2500, 5], [3000, 5]),
      c.port,
    );
    expect(pairs(res.transitions)).toEqual([
      'NORMAL>PENDING',
      'PENDING>PENDING',
      'PENDING>ACTIVE',
      'ACTIVE>CLEARING',
      'CLEARING>ACTIVE',
      'ACTIVE>CLEARING',
      'CLEARING>NORMAL',
    ]);
    expect(c.calls).toEqual(['open@1000', 'acked:100', 'acked:100', 'close:100@3000']);
    expect(res.events).toEqual([
      { kind: 'open', eventId: 100, ts: T + 1000, fresh: true },
      { kind: 'close', eventId: 100, ts: T + 3000, fresh: true },
    ]);
    expect(res.state).toMatchObject({ state: 'NORMAL', eventId: null, firstBreachTs: null, breachCount: 0 });
    expect(res.evalRows.map((r) => r[4])).toEqual([1, 1, 1, 0, 1, 0, 0, 0]);
  });

  it('PENDING→NORMAL — 디바운스 안 정상 복귀는 행을 남기지 않는다(오탐 억제)', async () => {
    const c = confirmMock();
    const res = await judge(rule(), initialState(), rowsAt([0, 11], [500, 12], [800, 3]), c.port);
    expect(pairs(res.transitions)).toEqual(['NORMAL>PENDING', 'PENDING>PENDING', 'PENDING>NORMAL']);
    expect(c.calls).toEqual([]);
    expect(res.state.state).toBe('NORMAL');
  });

  it('PENDING 경과 = ts − first_breach_ts · breach_count 누적', async () => {
    const c = confirmMock();
    const res = await judge(rule(), initialState(), rowsAt([0, 11], [300, 12], [600, 13]), c.port);
    expect(res.state).toMatchObject({ state: 'PENDING', firstBreachTs: T, breachCount: 3 });
  });

  it('ACTIVE→NORMAL(ACKED 경로) — 확인된 ACTIVE의 해소 첫 감지는 디바운스 없이 닫는다', async () => {
    const c = confirmMock({ acked: true });
    const s: AlarmState = { ...initialState(), state: 'ACTIVE', eventId: 55, lastTs: T - 1, lastValue: 20 };
    const res = await judge(rule(), s, rowsAt([0, 5]), c.port);
    expect(pairs(res.transitions)).toEqual(['ACTIVE>NORMAL']);
    expect(c.calls).toEqual(['acked:55', 'close:55@0']);
    expect(res.events).toEqual([{ kind: 'close', eventId: 55, ts: T, fresh: true }]);
  });

  it('CLEARING 중 확인은 디바운스를 끊지 않는다 — CLEARING에서는 acked를 읽지 않고 재위반 뒤 다음 해소에서 읽는다', async () => {
    const c = confirmMock({ acked: true });
    const s: AlarmState = {
      ...initialState(),
      state: 'CLEARING',
      eventId: 55,
      firstClearTs: T - 200,
      lastTs: T - 1,
    };
    const res = await judge(rule(), s, rowsAt([0, 5], [100, 20], [200, 5]), c.port);
    expect(pairs(res.transitions)).toEqual(['CLEARING>ACTIVE', 'ACTIVE>NORMAL']);
    expect(c.calls).toEqual(['acked:55', 'close:55@200']);
  });

  it('ACTIVE 동안 위반 지속은 전이 없음 · 해소 첫 감지만 PostgreSQL을 1회 읽는다', async () => {
    const c = confirmMock();
    const s: AlarmState = { ...initialState(), state: 'ACTIVE', eventId: 9, lastTs: T - 1 };
    const res = await judge(
      rule({ debounceMs: 10_000 }),
      s,
      rowsAt([0, 20], [100, 5], [200, 5], [300, 5]),
      c.port,
    );
    expect(pairs(res.transitions)).toEqual(['ACTIVE>CLEARING']);
    expect(c.calls).toEqual(['acked:9']);
  });

  it('조건 경계 — GT · LT는 같으면 위반 아님 · OUT_OF_RANGE는 규칙 경계', async () => {
    const c = confirmMock();
    const gt = await judge(rule(), initialState(), rowsAt([0, 10]), c.port);
    expect(gt.evalRows[0]?.[4]).toBe(0);
    const lt = await judge(rule({ conditionType: 'LT' }), initialState(), rowsAt([0, 10], [1, 9.99]), c.port);
    expect(lt.evalRows.map((r) => r[4])).toEqual([0, 1]);
    const oor = await judge(
      rule({ conditionType: 'OUT_OF_RANGE', thresholdLow: 2 }),
      initialState(),
      rowsAt([0, 2], [1, 1.9], [2, 10], [3, 10.1]),
      c.port,
    );
    expect(oor.evalRows.map((r) => r[4])).toEqual([0, 1, 0, 1]);
  });
});

describe('행 평가 순서 — 늦은 행(06_pipeline/08 §행 평가 순서)', () => {
  it('ts < last_ts인 행은 전이를 일으키지 않고 alarm_eval에만 남는다 · last_*를 갱신하지 않는다', async () => {
    const c = confirmMock();
    const s: AlarmState = { ...initialState(), lastTs: T + 5000, lastValue: 1 };
    const res = await judge(rule(), s, rowsAt([0, 50], [100, 60]), c.port);
    expect(res.transitions).toEqual([]);
    expect(res.evalRows.map((r) => r[4])).toEqual([1, 1]);
    expect(res.state.lastTs).toBe(T + 5000);
  });

  it('상태는 봉인 Hash 필드 7로 왕복한다', () => {
    const s: AlarmState = {
      state: 'CLEARING',
      firstBreachTs: T,
      breachCount: 4,
      eventId: 12,
      firstClearTs: T + 9,
      lastValue: 1.5,
      lastTs: T + 10,
    };
    const h = serializeState(s);
    expect(Object.keys(h)).toHaveLength(7);
    expect(parseState(h)).toEqual(s);
    expect(parseState({})).toEqual(initialState());
    expect(serializeState(initialState())).toMatchObject({
      event_id: '',
      first_breach_ts: '',
      breach_count: '0',
    });
  });
});

describe('RATE_OF_CHANGE 경계 5(06_pipeline/08 §RATE_OF_CHANGE 경계)', () => {
  const rate = rule({ conditionType: 'RATE_OF_CHANGE', threshold: 5, scanRateMs: 1000 });

  it('직전 값 없음 → 판정 없음 · last_* 기록만', async () => {
    const res = await judge(rate, initialState(), rowsAt([0, 100]), confirmMock().port);
    expect(res.evalRows).toEqual([]);
    expect(res.state).toMatchObject({ lastValue: 100, lastTs: T });
    expect(res.touched).toBe(true);
  });

  it('Δts = 0 → 판정 없음 · 갱신 없음', async () => {
    const s = { ...initialState(), lastValue: 1, lastTs: T };
    const res = await judge(rate, s, rowsAt([0, 100]), confirmMock().port);
    expect(res.evalRows).toEqual([]);
    expect(res.state).toMatchObject({ lastValue: 1, lastTs: T });
  });

  it('Δts < 0(늦은 행) → 판정 없음 · 갱신 없음', async () => {
    const s = { ...initialState(), lastValue: 1, lastTs: T + 500 };
    const res = await judge(rate, s, rowsAt([0, 100]), confirmMock().port);
    expect(res.evalRows).toEqual([]);
    expect(res.state).toMatchObject({ lastValue: 1, lastTs: T + 500 });
  });

  it('Δts > scan_rate_ms × STALE 배수(결측 뒤) → 판정 없음 · 새 행으로 교체', async () => {
    const s = { ...initialState(), lastValue: 1, lastTs: T - 3001 };
    const res = await judge(rate, s, rowsAt([0, 100]), confirmMock().port);
    expect(res.evalRows).toEqual([]);
    expect(res.state).toMatchObject({ lastValue: 100, lastTs: T });
  });

  it('정상 간격 — abs(Δvalue) ÷ Δts초 > threshold · 한도(= 배수 × 주기)는 판정한다', async () => {
    const s = { ...initialState(), lastValue: 0, lastTs: T - 1000 };
    const res = await judge(rate, s, rowsAt([0, 5], [1000, 11], [4000, 11]), confirmMock().port);
    // 5/1s = 5 → 위반 아님 · 6/1s → 위반 · Δts 3000 = 한도 → 판정(0/3s)
    expect(res.evalRows.map((r) => r[4])).toEqual([0, 1, 0]);
  });

  it('직전 값이 BAD였음 — BAD 행은 판정기에 오지 않아 마지막 GOOD 값과 비교한다(판정기 배치 테스트)', async () => {
    const h = harness({ rules: [rate] });
    h.states.set(7, serializeState({ ...initialState(), lastValue: 0, lastTs: T - 1000 }));
    await h.ev.judgeBatch(batch([T, 11, 1000, 2], [T + 500, 11, 1, 9]));
    // 품질 2 행(1000)은 빠지고 1/1.5s로 판정 — 위반 아님
    expect(h.evalInserts[0]?.rows.map((r) => [r[3], r[4]])).toEqual([[1, 0]]);
  });
});

// ── 판정기(배치 · 세 쓰기 · 부분 실패 · 인계)

function tagRow(ts: number, tagId: number, value: number, quality: number): TagRawRow {
  return [ts, 1, tagId, value, quality, 0];
}
function batch(...rows: [number, number, number, number][]): AlarmBatch {
  return { token: 'tok-1', rows: rows.map(([ts, tag, v, q]) => tagRow(ts, tag, v, q)) };
}

function harness(
  opts: {
    rules?: AlarmRule[] | null;
    confirm?: ReturnType<typeof confirmMock>;
    failEval?: number;
    failStateRead?: boolean;
    failStateWrite?: boolean;
    /** 앞에서부터 이 횟수만 쓰기 실패 */
    stateWriteFails?: number;
    /** alarm_eval 삽입을 붙잡는다 — 풀어 줄 때까지 응답하지 않는다 */
    holdEval?: boolean;
  } = {},
) {
  const states = new Map<number, Record<string, string>>();
  const redisCalls: string[] = [];
  const evalInserts: { rows: AlarmEvalRow[]; token: string | null }[] = [];
  const frames: AlarmFrame[] = [];
  const logs: string[] = [];
  const sleeps: number[] = [];
  let evalFails = opts.failEval ?? 0;
  let writeFails = opts.stateWriteFails ?? 0;
  const evalHolds: (() => void)[] = [];
  const confirm = opts.confirm ?? confirmMock();
  const deps: AlarmEvaluatorDeps = {
    rules: { load: async () => ({ rules: opts.rules === undefined ? [rule()] : opts.rules }) },
    state: {
      async read(ids) {
        redisCalls.push(`read:${ids.join(',')}`);
        if (opts.failStateRead) throw new Error('redis down');
        return new Map(ids.map((id) => [id, states.get(id) ?? {}]));
      },
      async write(w) {
        redisCalls.push(`write:${[...w.keys()].join(',')}`);
        if (opts.failStateWrite) throw new Error('redis down');
        if (writeFails > 0) {
          writeFails--;
          throw new Error('redis blip');
        }
        for (const [k, v] of w) states.set(k, v);
      },
    },
    confirm: confirm.port,
    evalSink: {
      async insert(rows, token) {
        if (opts.holdEval) await new Promise<void>((r) => evalHolds.push(r));
        if (evalFails > 0) {
          evalFails--;
          throw new Error('ch down');
        }
        evalInserts.push({ rows, token });
      },
    },
    fanout: {
      async publishAlarm(f) {
        frames.push(f);
      },
    },
    staleMultiplier: 3,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    stopping: () => false,
    log: { warn: (s) => logs.push(s), error: (s) => logs.push(s) },
  };
  return {
    ev: new AlarmEvaluator(deps, opts.holdEval ? 30 : undefined),
    deps,
    states,
    redisCalls,
    evalInserts,
    evalHolds,
    frames,
    logs,
    sleeps,
    confirm,
  };
}

async function metricValue(name: string, labels: Record<string, string> = {}): Promise<number> {
  const m = appRegistry.getSingleMetric(name) as Metric;
  const vals = (await m.get()).values;
  const hit = vals.find((v) =>
    Object.entries(labels).every(([k, x]) => (v.labels as Record<string, string>)[k] === x),
  );
  return hit?.value ?? 0;
}

describe('판정기 한 배치 — 행 평가 규칙 · 세 쓰기 순서(06_pipeline/08 §판정 한 배치)', () => {
  it('alarm:state 왕복 2(읽기 1 · 쓰기 1 · 규칙 캐시 GET 별도) — 행 수 · 규칙 수와 무관', async () => {
    const h = harness({ rules: [rule(), rule({ ruleId: 8, tagId: 12 }), rule({ ruleId: 9, tagId: 13 })] });
    const rows: [number, number, number, number][] = [];
    for (let i = 0; i < 300; i++) rows.push([T + i * 10, 11 + (i % 3), 20, 9]);
    await h.ev.judgeBatch(batch(...rows));
    expect(h.redisCalls).toEqual(['read:7,8,9', 'write:7,8,9']);
  });

  it('규칙별 ts 정렬 — 배치 안 역순 행도 오름차순으로 평가한다 · 규칙 없는 태그 · BAD(2 · 4)는 버리고 SIMULATED(9)는 판정', async () => {
    const h = harness();
    await h.ev.judgeBatch(
      batch(
        [T + 1000, 11, 13, 9],
        [T + 500, 11, 12, 0],
        [T, 11, 11, 9],
        [T + 700, 11, 99, 4],
        [T + 800, 11, 99, 2],
        [T, 99, 50, 9],
      ),
    );
    expect(h.evalInserts[0]?.rows.map((r) => r[0] - T)).toEqual([0, 500, 1000]);
    expect(h.confirm.calls).toEqual(['open@1000']);
    expect(h.frames).toEqual([
      { type: 'alarm', eventId: 100, ruleId: 7, tagId: 11, transition: 'OPENED', ts: T + 1000, severity: 2 },
    ]);
    expect(parseState(h.states.get(7)).state).toBe('ACTIVE');
    expect(parseState(h.states.get(7)).eventId).toBe(100);
    expect(h.evalInserts[0]?.token).toBe('tok-1');
  });

  it('디바운스 시계는 행 ts — 적체 소진으로 한꺼번에 와도 디바운스 미만 스파이크는 이벤트 0', async () => {
    const h = harness();
    await h.ev.judgeBatch(batch([T, 11, 50, 9], [T + 999, 11, 50, 9], [T + 1200, 11, 1, 9]));
    expect(h.confirm.calls).toEqual([]);
    expect(h.frames).toEqual([]);
    expect(parseState(h.states.get(7)).state).toBe('NORMAL');
  });

  it('규칙이 없거나 PostgreSQL 불가(null)면 판정하지 않는다 — Redis 왕복 0', async () => {
    for (const rules of [[], null]) {
      const h = harness({ rules });
      await h.ev.judgeBatch(batch([T, 11, 50, 9]));
      expect(h.redisCalls).toEqual([]);
      expect(h.evalInserts).toEqual([]);
    }
  });

  it('alarm:state 읽기 실패 → 판정 중단(봉인 계열) — 쓰기 · 발행 · 전수 없음', async () => {
    const h = harness({ failStateRead: true });
    await h.ev.judgeBatch(batch([T, 11, 50, 9]));
    expect(h.redisCalls).toEqual(['read:7']);
    expect(h.evalInserts).toEqual([]);
    expect(h.frames).toEqual([]);
  });
});

describe('부분 실패 — PostgreSQL이 진실(06_pipeline/08 §부분 실패)', () => {
  it('열기 INSERT 실패 → PENDING 유지 · 발행 없음 · alm_pg_write_failures_total{op=open} · alarm_eval은 정상', async () => {
    const before = await metricValue('alm_pg_write_failures_total', { op: 'open' });
    const h = harness({ confirm: confirmMock({ failOpen: true }) });
    await h.ev.judgeBatch(batch([T, 11, 50, 9], [T + 1000, 11, 51, 9], [T + 1500, 11, 52, 9]));
    // 첫 실패 뒤 이 배치의 나머지 확정 시도는 멈춘다 — 다음 배치가 재시도
    expect(h.confirm.calls).toEqual(['open@1000']);
    expect(parseState(h.states.get(7))).toMatchObject({ state: 'PENDING', eventId: null, firstBreachTs: T });
    expect(h.frames).toEqual([]);
    expect(h.evalInserts[0]?.rows).toHaveLength(3);
    expect(await metricValue('alm_pg_write_failures_total', { op: 'open' })).toBe(before + 1);
  });

  it('닫기 UPDATE 실패 → 직전 상태(CLEARING) 유지 · 발행 없음', async () => {
    const h = harness({ confirm: confirmMock({ failClose: true }) });
    h.states.set(
      7,
      serializeState({
        ...initialState(),
        state: 'CLEARING',
        eventId: 5,
        firstClearTs: T - 2000,
        lastTs: T - 1,
      }),
    );
    await h.ev.judgeBatch(batch([T, 11, 1, 9]));
    expect(parseState(h.states.get(7))).toMatchObject({ state: 'CLEARING', eventId: 5 });
    expect(h.frames).toEqual([]);
  });

  it('커밋 뒤 alarm:state 쓰기 실패 → 계수 · 이미 커밋된 열기는 발행 · 다음 배치는 열린 행을 재사용(INSERT 없음 · 재발행 없음)', async () => {
    const before = await metricValue('alm_state_write_failures_total');
    const h = harness({ failStateWrite: true });
    await h.ev.judgeBatch(batch([T, 11, 50, 9], [T + 1000, 11, 51, 9]));
    expect(await metricValue('alm_state_write_failures_total')).toBe(before + 1);
    expect(h.frames).toHaveLength(1);
    // 재판정 — 열기 쿼리가 열린 행을 돌려준다(inserted false)
    const h2 = harness({ confirm: confirmMock({ reuse: true }) });
    await h2.ev.judgeBatch(batch([T, 11, 50, 9], [T + 1000, 11, 51, 9]));
    expect(h2.frames).toEqual([]);
    expect(parseState(h2.states.get(7))).toMatchObject({ state: 'ACTIVE', eventId: 100 });
  });

  it('커밋 뒤 alarm:state 쓰기 실패 1회 → 같은 파이프라인 1회 재시도로 성공 · 실패 계수 없음(M5)', async () => {
    const before = await metricValue('alm_state_write_failures_total');
    const h = harness({ stateWriteFails: 1 });
    await h.ev.judgeBatch(batch([T, 11, 50, 9], [T + 1000, 11, 51, 9]));
    expect(h.redisCalls).toEqual(['read:7', 'write:7', 'write:7']);
    expect(parseState(h.states.get(7))).toMatchObject({ state: 'ACTIVE', eventId: 100 });
    expect(await metricValue('alm_state_write_failures_total')).toBe(before);
  });

  it('재시도도 실패 → 쓰기 2회로 멈추고 계수 1 · 로그(기존 동작)', async () => {
    const before = await metricValue('alm_state_write_failures_total');
    const h = harness({ failStateWrite: true });
    await h.ev.judgeBatch(batch([T, 11, 50, 9], [T + 1000, 11, 51, 9]));
    expect(h.redisCalls).toEqual(['read:7', 'write:7', 'write:7']);
    expect(await metricValue('alm_state_write_failures_total')).toBe(before + 1);
    expect(h.logs.some((l) => l.includes('재시도 뒤'))).toBe(true);
  });

  it('배치 단위 멈춤(M3) — 첫 열기 실패 뒤 다른 규칙은 확정을 시도하지 않고 PENDING으로 동결 · 전수는 모두 낸다', async () => {
    const before = await metricValue('alm_pg_write_failures_total', { op: 'open' });
    const h = harness({
      rules: [rule(), rule({ ruleId: 8, tagId: 12 }), rule({ ruleId: 9, tagId: 13 })],
      confirm: confirmMock({ failOpen: true }),
    });
    const rows: [number, number, number, number][] = [];
    for (const tag of [11, 12, 13])
      rows.push([T, tag, 50, 9], [T + 1000, tag, 51, 9], [T + 2000, tag, 52, 9]);
    await h.ev.judgeBatch(batch(...rows));
    expect(h.confirm.calls).toEqual(['open@1000']);
    for (const id of [7, 8, 9])
      expect(parseState(h.states.get(id))).toMatchObject({ state: 'PENDING', firstBreachTs: T });
    expect(await metricValue('alm_pg_write_failures_total', { op: 'open' })).toBe(before + 1);
    expect(h.evalInserts[0]?.rows).toHaveLength(9);
  });

  it('멈춘 규칙의 상태 동결(L1) — 같은 배치 뒤 정상 행이 와도 PENDING → NORMAL이 되지 않는다(다음 배치가 열기 재시도)', async () => {
    const h = harness({ confirm: confirmMock({ failOpen: true }) });
    await h.ev.judgeBatch(batch([T, 11, 50, 9], [T + 1000, 11, 51, 9], [T + 1500, 11, 1, 9]));
    expect(parseState(h.states.get(7))).toMatchObject({
      state: 'PENDING',
      firstBreachTs: T,
      breachCount: 1,
      lastTs: T + 1500,
    });
    expect(h.evalInserts[0]?.rows.map((r) => r[4])).toEqual([1, 1, 0]);
  });

  it('acked 조회 실패 → 그 규칙은 CLEARING(확인 안 됨) · 배치 멈춤으로 뒤 규칙의 확정 · acked 조회를 건너뛴다', async () => {
    const c = confirmMock();
    c.port.acked = async (id) => {
      c.calls.push(`acked:${id}`);
      throw new Error('pg down');
    };
    const h = harness({ rules: [rule(), rule({ ruleId: 8, tagId: 12 })], confirm: c });
    const active = (eventId: number) =>
      serializeState({ ...initialState(), state: 'ACTIVE', eventId, lastTs: T - 1 });
    h.states.set(7, active(5));
    h.states.set(8, active(6));
    await h.ev.judgeBatch(batch([T, 11, 1, 9], [T, 12, 1, 9]));
    expect(c.calls).toEqual(['acked:5']);
    expect(parseState(h.states.get(7)).state).toBe('CLEARING');
    expect(parseState(h.states.get(8)).state).toBe('ACTIVE');
  });

  it('alarm_eval 실패 — 같은 토큰 · 같은 백오프 재시도 뒤 성공하면 정상', async () => {
    const h = harness({ failEval: 2 });
    await h.ev.judgeBatch(batch([T, 11, 50, 9]));
    await h.ev.drain();
    expect(h.sleeps).toEqual([1000, 2000]);
    expect(h.evalInserts).toHaveLength(1);
    expect(h.evalInserts[0]?.token).toBe('tok-1');
  });

  it('alarm_eval 재시도 소진 → 격리 없이 무효 구간(alm_eval_gap_* · 로그 alarm_eval_gap) · 알람은 정상(열림 · 발행)', async () => {
    const gb = await metricValue('alm_eval_gap_batches_total');
    const gr = await metricValue('alm_eval_gap_rows_total');
    const h = harness({ failEval: 99 });
    await h.ev.judgeBatch(batch([T, 11, 50, 9], [T + 1000, 11, 51, 9]));
    await h.ev.drain();
    expect(h.sleeps).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(await metricValue('alm_eval_gap_batches_total')).toBe(gb + 1);
    expect(await metricValue('alm_eval_gap_rows_total')).toBe(gr + 2);
    const gap = h.logs
      .map((l) => (l.startsWith('{') ? JSON.parse(l) : null))
      .find((x) => x?.event === 'alarm_eval_gap');
    expect(gap).toMatchObject({
      reason: 'retry_exhausted',
      ts_min: T,
      ts_max: T + 1000,
      rows: 2,
      rules: 1,
      token: 'tok-1',
    });
    expect(h.frames).toHaveLength(1);
    expect(parseState(h.states.get(7)).state).toBe('ACTIVE');
  });
});

describe('⑧ alarm_eval 큐 깊이 1(M2) — 판정은 전수 기록을 기다리지 않는다', () => {
  const gapLogs = (logs: string[]) =>
    logs.map((l) => (l.startsWith('{') ? JSON.parse(l) : null)).filter((x) => x?.event === 'alarm_eval_gap');

  it('쓰는 중 1 + 대기 1 — 세 번째 배치의 전수는 삽입 없이 즉시 무효 구간(queue_full) · 판정은 그대로 끝난다', async () => {
    const gb = await metricValue('alm_eval_gap_batches_total');
    const h = harness({ holdEval: true });
    const b = (dt: number) => batch([T + dt, 11, 1, 9]);
    await h.ev.judgeBatch(b(0)); // 쓰는 중(붙잡힘) — judgeBatch는 돌아왔다
    await h.ev.judgeBatch(b(10)); // 대기
    await h.ev.judgeBatch(b(20)); // 대기 칸 참 → 무효 구간
    expect(h.redisCalls.filter((x) => x.startsWith('write'))).toHaveLength(3);
    expect(await metricValue('alm_eval_gap_batches_total')).toBe(gb + 1);
    expect(gapLogs(h.logs)).toMatchObject([{ reason: 'queue_full', ts_min: T + 20, rows: 1 }]);
    h.evalHolds.shift()?.();
    await new Promise((r) => setTimeout(r, 0));
    h.evalHolds.shift()?.();
    await h.ev.drain();
    expect(h.evalInserts.map((x) => x.rows[0]?.[0])).toEqual([T, T + 10]);
  });

  it('종료 드레인 상한 — 응답 없는 쓰기 · 대기 전수를 무효 구간(shutdown)으로 끝내고 돌아온다 · 늦은 결말은 세지 않는다', async () => {
    const gb = await metricValue('alm_eval_gap_batches_total');
    const h = harness({ holdEval: true });
    await h.ev.judgeBatch(batch([T, 11, 1, 9]));
    await h.ev.judgeBatch(batch([T + 10, 11, 1, 9]));
    await h.ev.drain(); // 상한 30 ms(harness)
    expect(gapLogs(h.logs).map((x) => x.reason)).toEqual(['shutdown', 'shutdown']);
    expect(await metricValue('alm_eval_gap_batches_total')).toBe(gb + 2);
    const ins = await metricValue('alm_eval_rows_inserted_total');
    h.evalHolds.shift()?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(await metricValue('alm_eval_rows_inserted_total')).toBe(ins);
  });

  it('종료 중(stopping)이면 실패한 전수를 더 재시도하지 않는다', async () => {
    const h = harness({ failEval: 99 });
    h.deps.stopping = () => true;
    await h.ev.judgeBatch(batch([T, 11, 1, 9]));
    await h.ev.drain();
    expect(h.sleeps).toEqual([]);
    expect(gapLogs(h.logs).map((x) => x.reason)).toEqual(['retry_exhausted']);
  });
});

describe('인계 깊이 1(06_pipeline/08 §인계와 직렬 판정기)', () => {
  it('판정 중 1 + 슬롯 1까지는 즉시 · 세 번째 인계는 첫 판정이 끝날 때까지 기다린다 · 인계 순서대로 직렬', async () => {
    const order: string[] = [];
    const gates: (() => void)[] = [];
    const h = harness();
    // 규칙 원천에서 멈춰 판정 중 상태를 만든다
    (h.ev as unknown as { d: AlarmEvaluatorDeps }).d.rules = {
      load: () =>
        new Promise((r) => {
          order.push(`load${gates.length}`);
          gates.push(() => r({ rules: [] }));
        }),
    };
    const b = (n: number): AlarmBatch => ({ token: `t${n}`, rows: [] });
    await h.ev.handoff(b(1)); // 판정 중
    await h.ev.handoff(b(2)); // 슬롯
    let third = false;
    const p3 = h.ev.handoff(b(3)).then(() => {
      third = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(third).toBe(false);
    expect(order).toEqual(['load0']);
    gates[0]?.(); // 1 끝 → 2가 판정 중 · 3이 슬롯으로
    await p3;
    expect(third).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    gates[1]?.();
    await new Promise((r) => setTimeout(r, 0));
    gates[2]?.();
    await h.ev.drain();
    expect(order).toEqual(['load0', 'load1', 'load2']);
  });

  it('경합 회귀(H1) — 루프가 빈 슬롯을 보고 빠지는 순간 전후 어느 마이크로태스크에 인계가 와도 그 배치를 판정하고 세 번째 인계가 돌아온다', async () => {
    const tick = async (n: number) => {
      for (let i = 0; i < n; i++) await Promise.resolve();
    };
    for (let k = 0; k <= 12; k++) {
      const loads: string[] = [];
      let release: (() => void) | null = null;
      const h = harness();
      (h.ev as unknown as { d: AlarmEvaluatorDeps }).d.rules = {
        load: () => {
          loads.push(`load${loads.length}`);
          // 첫 배치만 붙잡는다 — 나머지는 즉시 끝난다
          if (loads.length > 1) return Promise.resolve({ rules: [] });
          return new Promise((r) => {
            release = () => r({ rules: [] });
          });
        },
      };
      const b = (n: number): AlarmBatch => ({ token: `t${n}`, rows: [] });
      await h.ev.handoff(b(1));
      (release as unknown as () => void)();
      // flusher 재개를 k 마이크로태스크 늦춘다 — 루프 탈출 판정과 running 해제 사이의 틈을 훑는다
      await tick(k);
      await h.ev.handoff(b(2));
      const third = await Promise.race([
        h.ev.handoff(b(3)).then(() => 'returned'),
        new Promise((r) => setTimeout(() => r('stuck'), 50)),
      ]);
      expect(third, `k=${k}`).toBe('returned');
      await h.ev.drain();
      expect(loads, `k=${k}`).toEqual(['load0', 'load1', 'load2']);
    }
  });

  it('판정 예외는 flusher로 던지지 않는다', async () => {
    const h = harness();
    (h.ev as unknown as { d: AlarmEvaluatorDeps }).d.rules = {
      load: async () => {
        throw new Error('boom');
      },
    };
    await h.ev.handoff(batch([T, 11, 50, 9]));
    await h.ev.drain();
    expect(h.logs.some((l) => l.includes('boom'))).toBe(true);
  });

  it('flusher ⑥ — XACK · 최신값 뒤에 인계 · ing_routed_rows_total{layer=alarm}은 받아들인 행 수', async () => {
    const order: string[] = [];
    const handed: AlarmBatch[] = [];
    const before = await metricValue('ing_routed_rows_total', { layer: 'alarm' });
    const deps = {
      insert: async () => {
        order.push('insert');
      },
      tokens: { implName: 'DeterministicBatchToken', tokenFor: () => 'tk', settings: () => ({}) },
      asyncInsert: false,
      control: { implName: 'NoopControlSink', copy: async () => order.push('copy'), close: async () => {} },
      ack: async () => {
        order.push('ack');
      },
      dlq: async () => {},
      latest: {
        implName: 'IngestLatestValueWriter',
        write: async () => {
          order.push('latest');
        },
      },
      alarm: {
        handoff: async (b: AlarmBatch) => {
          order.push('handoff');
          handed.push(b);
        },
        drain: async () => {},
      },
      labFault: { afterInsert: () => {} },
      sleep: async () => {},
      stopping: () => false,
      log: { warn: () => {}, error: () => {} },
    } as unknown as FlusherDeps;
    const piece = {
      entries: [
        {
          id: '1-0',
          idMs: 1,
          decodedAt: 0,
          payload: Buffer.from('x'),
          entry: {
            ok: true,
            d: 1,
            s: 1,
            t0: T,
            tg: [11, 12],
            dt: [0, 0],
            va: [1, 2],
            q: [9, 9],
            negativeDt: 0,
          },
        },
      ],
    };
    await new Flusher(deps).process(piece as never);
    expect(order).toEqual(['insert', 'copy', 'ack', 'latest', 'handoff']);
    expect(handed[0]?.token).toBe('tk');
    expect(handed[0]?.rows).toHaveLength(2);
    expect(await metricValue('ing_routed_rows_total', { layer: 'alarm' })).toBe(before + 2);
  });
});

describe('규칙 원천 A1(06_pipeline/08 §규칙과 상태의 조회)', () => {
  const rules = [rule()];
  function src(cache: { value: string | null; failed: boolean }, db: 'ok' | 'fail') {
    const sets: string[] = [];
    let dbCalls = 0;
    const s = new AlarmRuleSource(
      {
        get: async () => cache,
        set: async (json) => {
          sets.push(json);
        },
      },
      {
        loadActive: async () => {
          dbCalls++;
          if (db === 'fail') throw new Error('pg down');
          return rules;
        },
      },
      { warn: () => {} },
    );
    return { s, sets, dbCalls: () => dbCalls };
  }

  it('히트 — PostgreSQL을 읽지 않는다', async () => {
    const x = src({ value: JSON.stringify(rules), failed: false }, 'ok');
    expect(await x.s.load()).toEqual({ rules, outcome: 'hit' });
    expect(x.dbCalls()).toBe(0);
  });

  it('미스 — PostgreSQL로 채운다(TTL 300초 ±20%는 래퍼)', async () => {
    const x = src({ value: null, failed: false }, 'ok');
    expect(await x.s.load()).toEqual({ rules, outcome: 'miss' });
    expect(x.sets).toEqual([JSON.stringify(rules)]);
  });

  it('Redis 실패 — PostgreSQL 직행 · 채우지 않는다', async () => {
    const x = src({ value: null, failed: true }, 'ok');
    expect((await x.s.load()).outcome).toBe('cache_failed');
    expect(x.sets).toEqual([]);
  });

  it('PostgreSQL도 불가 — null(그 배치 판정 생략)', async () => {
    const x = src({ value: null, failed: false }, 'fail');
    expect(await x.s.load()).toEqual({ rules: null, outcome: 'db_failed' });
  });

  it('깨진 캐시 JSON은 미스로 다룬다', () => {
    expect(parseRules('{')).toBeNull();
    expect(parseRules('[{"ruleId":1}]')).toBeNull();
    expect(parseRules(JSON.stringify(rules))).toEqual(rules);
  });
});

describe('SW-06 publishAlarm(04_architecture/02 · 07_api/11 alarm 프레임)', () => {
  const frame: AlarmFrame = {
    type: 'alarm',
    eventId: 1,
    ruleId: 2,
    tagId: 3,
    transition: 'OPENED',
    ts: T,
    severity: 3,
  };

  it('DirectGatewayFanout은 프로세스 안 버스 alarm으로 같은 프레임을 낸다', async () => {
    const got: AlarmFrame[] = [];
    const on = (f: AlarmFrame) => got.push(f);
    directBus.on('alarm', on);
    await new DirectGatewayFanout().publishAlarm(frame);
    directBus.off('alarm', on);
    expect(got).toEqual([frame]);
  });

  it('RedisPubSubFanout은 FanoutPublisher.publishAlarm(PUBLISH ch:alarm)으로', async () => {
    const got: unknown[] = [];
    const pub = { publishAlarm: async (f: AlarmFrame) => got.push(f) } as unknown as FanoutPublisher;
    await new RedisPubSubFanout(pub).publishAlarm(frame);
    expect(got).toEqual([frame]);
  });
});

describe('DurableKeyClient alarm:state — alarm:state 왕복 2(파이프라인 exec 읽기 1 · 쓰기 1 · 규칙 캐시 GET 별도 · REQ-ALM-07)', () => {
  /** ioredis 모양 가짜 — 파이프라인 exec 수 = 왕복 수 */
  function fakeRedis(fail = false) {
    const hashes = new Map<string, Record<string, string>>();
    const log = { execs: 0, cmds: [] as string[] };
    const redis = {
      defineCommand: () => {},
      pipeline() {
        const ops: (() => [Error | null, unknown])[] = [];
        const b = {
          hgetall(k: string) {
            log.cmds.push(`HGETALL ${k}`);
            ops.push(() => [fail ? new Error('down') : null, { ...(hashes.get(k) ?? {}) }]);
            return b;
          },
          hset(k: string, f: Record<string, string>) {
            log.cmds.push(`HSET ${k}`);
            ops.push(() => {
              hashes.set(k, { ...(hashes.get(k) ?? {}), ...f });
              return [fail ? new Error('down') : null, 1];
            });
            return b;
          },
          async exec() {
            log.execs++;
            return ops.map((o) => o());
          },
        };
        return b;
      },
    };
    return { redis, hashes, log };
  }

  it('읽기 · 쓰기가 각각 파이프라인 1회 · 키 alarm:state:{rule_id} · TTL 명령 없음', async () => {
    const f = fakeRedis();
    const d = new DurableKeyClient({ command: f.redis } as never);
    const h = harness({ rules: [rule(), rule({ ruleId: 8, tagId: 12 })] });
    (h.ev as unknown as { d: AlarmEvaluatorDeps }).d.state = {
      read: (ids) => d.readAlarmStates(ids),
      write: (s) => d.writeAlarmStates(s),
    };
    const rows: [number, number, number, number][] = [];
    for (let i = 0; i < 200; i++) rows.push([T + i * 10, 11 + (i % 2), 50, 9]);
    await h.ev.judgeBatch(batch(...rows));
    expect(f.log.execs).toBe(2);
    expect(f.log.cmds).toEqual([
      'HGETALL alarm:state:7',
      'HGETALL alarm:state:8',
      'HSET alarm:state:7',
      'HSET alarm:state:8',
    ]);
    expect(parseState(f.hashes.get('alarm:state:7')).state).toBe('ACTIVE');
  });

  it('봉인 계열 — 파이프라인 안 오류는 던진다 · durable_wrapper_failures_total{prefix=alarm} 계수', async () => {
    const f = fakeRedis(true);
    const d = new DurableKeyClient({ command: f.redis } as never);
    const before = await metricValue('durable_wrapper_failures_total', { prefix: 'alarm' });
    await expect(d.readAlarmStates([1])).rejects.toThrow('down');
    await expect(d.writeAlarmStates(new Map([[1, { state: 'NORMAL' }]]))).rejects.toThrow('down');
    expect(await metricValue('durable_wrapper_failures_total', { prefix: 'alarm' })).toBe(before + 2);
  });
});

describe('종료 순서(L8) — 마지막 인계 뒤에 판정기를 멈춘다(훅 순서에 기대지 않는다)', () => {
  it('AlarmEvalService는 자체 종료 훅이 없고 drain이 정지(stopping)를 건 뒤 판정기를 비운다', async () => {
    const svc = new AlarmEvalService(
      { switches: { 'SW-08': 'on' } } as unknown as AppConfig,
      { pool: {} } as never,
      { client: {} } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect('beforeApplicationShutdown' in svc).toBe(false);
    const seen: boolean[] = [];
    const inner = svc as unknown as { stopping: boolean; evaluator: { drain(): Promise<void> } };
    expect(inner.stopping).toBe(false);
    inner.evaluator = {
      drain: async () => {
        seen.push(inner.stopping);
      },
    };
    await svc.drain();
    expect(seen).toEqual([true]);
  });

  it('IngestService 종료는 flusher 드레인(마지막 인계 포함)이 끝난 뒤에 판정기 drain을 부른다', async () => {
    const order: string[] = [];
    const svc = new IngestService(
      { ingestBatchPlan: 'A', ingestLabFault: null } as unknown as AppConfig,
      {} as never,
      {} as never,
      { client: {} } as never,
      {} as never,
      { implName: 'NoBatchToken', tokenFor: () => null, settings: () => ({}) } as never,
      {
        implName: 'NoopControlSink',
        copy: async () => {},
        close: async () => order.push('control.close'),
      } as never,
      { implName: 'x', write: async () => {} } as never,
      {
        handoff: async () => {},
        drain: async () => {
          order.push('alarm.drain');
        },
      },
    );
    const inner = svc as unknown as {
      step(): Promise<number>;
      flusher: { process(p: unknown): Promise<void> };
      queue: unknown[];
      flushLoop: Promise<void> | null;
      flush(): Promise<void>;
    };
    inner.step = async () => 0;
    inner.flusher = {
      process: async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push('handoff');
      },
    };
    inner.queue.push({ entries: [{ id: '1-0', decodedAt: 0 }] });
    inner.flushLoop = inner.flush();
    await svc.beforeApplicationShutdown();
    expect(order).toEqual(['handoff', 'alarm.drain', 'control.close']);
  });
});

describe('규칙 캐시 · 판정 경로 PostgreSQL 상한(L3 · M3)', () => {
  const cacheWith = (getBuffer: () => Promise<Buffer | null>) =>
    new CacheKeyClient({
      command: { defineCommand: () => {}, getBuffer },
    } as unknown as RedisConnections);

  it('getAlarmRules — 히트 · 미스 · degrade를 가른다(failed면 판정기가 PostgreSQL 직행 · 채우지 않는다)', async () => {
    expect(await cacheWith(async () => Buffer.from('[]')).getAlarmRules()).toEqual({
      value: '[]',
      failed: false,
    });
    expect(await cacheWith(async () => null).getAlarmRules()).toEqual({ value: null, failed: false });
    expect(
      await cacheWith(async () => {
        throw new Error('redis down');
      }).getAlarmRules(),
    ).toEqual({ value: null, failed: true });
  });

  it('queryBounded — 트랜잭션 안 SET LOCAL statement_timeout 1초 · 실패면 ROLLBACK · 연결 반환', async () => {
    const calls: string[] = [];
    let released = 0;
    const pool = (fail: boolean) => ({
      connect: async () => ({
        query: async (sql: string) => {
          calls.push(sql);
          if (fail && sql === 'SELECT 1') throw new Error('canceling statement due to statement timeout');
          return { rows: [{ ok: true }] };
        },
        release: () => {
          released++;
        },
      }),
    });
    const r = await queryBounded(pool(false) as never, 'SELECT 1');
    expect(r.rows).toEqual([{ ok: true }]);
    expect(ALARM_PG_STATEMENT_TIMEOUT_MS).toBe(1000);
    expect(calls).toEqual(['BEGIN; SET LOCAL statement_timeout = 1000', 'SELECT 1', 'COMMIT']);
    calls.length = 0;
    await expect(queryBounded(pool(true) as never, 'SELECT 1')).rejects.toThrow(/statement timeout/);
    expect(calls).toEqual(['BEGIN; SET LOCAL statement_timeout = 1000', 'SELECT 1', 'ROLLBACK']);
    expect(released).toBe(2);
  });
});
