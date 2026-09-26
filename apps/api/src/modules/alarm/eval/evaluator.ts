// F-06 알람 판정 한 배치 ①~⑧ — 기전 정본 docs/06_pipeline/08_alarm.md §판정 한 배치 · §인계와 직렬 판정기 · §부분 실패
// ① 인계(flusher ⑥ · XACK 뒤 · 인계 깊이 1) ② 규칙(A1) ③ 상태 파이프라인 HGETALL 1회(A2) ④ 평가(A3)
// ⑤ 확정 INSERT · UPDATE(A4 · PostgreSQL 커밋) ⑥ 상태 파이프라인 쓰기 1회(⑤ 뒤) ⑦ ch:alarm 발행(A6 · ⑤ 커밋분만) ⑧ alarm_eval(A5 · 독립)
// 판정기는 프로세스 안 하나 · 배치를 인계 순서대로 하나씩 판정한다(직렬 — 같은 규칙의 상태 읽기-쓰기 경합이 없다).
// ⑧은 판정 밖 깊이 1 큐(쓰는 중 1 + 대기 1)가 쓴다 — 판정은 ⑧ 완료를 기다리지 않아 alarm_eval 재시도가 인계 · flusher를 멈추지 않는다.
// 판정 실패는 flusher로 던지지 않는다 — 적재 XACK를 되돌리지 않는다(REQ-ING-13).
import { QUALITY } from '@db-study/shared';
import type { AlarmFrame } from '../../../common/ports/realtime-fanout.port';
import { RETRY_BACKOFF_MS } from '../../ingest/flusher';
import type { TagRawRow } from '../../ingest/window-buffer';
import { type AlarmStateName, alarmMetrics as m } from './alarm-eval.metrics';
import { type AlarmEvalRow, type BatchHalt, type ConfirmPort, type JudgeRow, judgeRule } from './judge';
import type { AlarmRule } from './rules';
import { type AlarmStateStorePort, parseState, serializeState } from './state';

export const ALARM_HANDOFF_PORT = Symbol('AlarmHandoffPort');

/** 인계 단위 — flusher가 확정한 배치(원 배치 토큰 · tag_raw 행). 토큰은 SW-08 off면 null */
export interface AlarmBatch {
  token: string | null;
  rows: readonly TagRawRow[];
}

/** flusher → 판정기(직접 호출 — Stream 경계의 유일한 예외 · 04_architecture/02 §경계 예외) */
export interface AlarmHandoffPort {
  /** 인계 깊이 1 — 슬롯이 차 있으면 비워질 때까지 기다린다(flusher 정지 → 적체는 Stream lag로) · 던지지 않는다 */
  handoff(batch: AlarmBatch): Promise<void>;
  /**
   * 종료 드레인 — IngestService가 마지막 인계 뒤에 한 번 부른다(훅 순서에 기대지 않는다). 이 뒤로 alarm_eval 재시도를 멈추고
   * 슬롯 · 판정 중 배치 · ⑧ 큐를 끝낸다(⑧ 큐는 상한 EVAL_DRAIN_MS — 넘으면 남은 전수를 무효 구간으로)
   */
  drain(): Promise<void>;
}

export interface AlarmEvaluatorDeps {
  rules: { load(): Promise<{ rules: AlarmRule[] | null }> };
  state: AlarmStateStorePort;
  confirm: ConfirmPort;
  /** alarm_eval INSERT — 원 배치 토큰(테이블별 중복 제거 윈도우라 tag_raw와 간섭하지 않는다) */
  evalSink: { insert(rows: AlarmEvalRow[], token: string | null): Promise<void> };
  fanout: { publishAlarm(frame: AlarmFrame): Promise<void> };
  /** RATE_OF_CHANGE 결측 한도의 배수 — STALE 배수와 같은 값(소유 06_pipeline/05) */
  staleMultiplier: number;
  sleep(ms: number): Promise<void>;
  stopping(): boolean;
  log: { warn(msg: string): void; error(msg: string): void };
}

/** 종료 때 ⑧ 큐를 기다리는 상한(ms · 현행 참고 — 수집 종료 드레인 상한과 같은 값) */
export const EVAL_DRAIN_MS = 5000;

/** 무효 구간 사유 — alarm_eval_gap 로그 reason 필드 */
export type EvalGapReason = 'retry_exhausted' | 'queue_full' | 'shutdown';

interface EvalJob {
  rows: AlarmEvalRow[];
  token: string | null;
  rules: number;
  /** 삽입 · 무효 구간 중 하나로 끝났다 — 드레인 상한이 먼저 끝낸 작업의 늦은 결말은 세지 않는다 */
  settled: boolean;
  finish(at: number): void;
}

/** 판정에서 빼는 품질 — 저장되는 BAD 계열 2 · 4(REQ-ALM-06 · SIMULATED 9는 판정한다) */
const EXCLUDED_QUALITY: ReadonlySet<number> = new Set([QUALITY.BAD_COMM, QUALITY.BAD_RANGE]);

export class AlarmEvaluator implements AlarmHandoffPort {
  /** 인계 슬롯(깊이 1) — 판정 중 배치는 loop가 쥔다 */
  private slot: AlarmBatch | null = null;
  private slotFreed: (() => void) | null = null;
  private running: Promise<void> | null = null;
  /** ⑧ 큐(깊이 1) — 대기 1 · 쓰는 중 1 */
  private evalSlot: EvalJob | null = null;
  private evalCurrent: EvalJob | null = null;
  private evalRunning: Promise<void> | null = null;

  constructor(
    private readonly d: AlarmEvaluatorDeps,
    private readonly evalDrainMs = EVAL_DRAIN_MS,
  ) {}

  async handoff(batch: AlarmBatch): Promise<void> {
    const start = performance.now();
    while (this.slot !== null) {
      await new Promise<void>((r) => {
        this.slotFreed = r;
      });
    }
    m.handoffWait.observe((performance.now() - start) / 1000);
    this.slot = batch;
    // loop는 첫 await 전까지 동기로 슬롯을 가져가므로 여기서 끝난 프라미스가 대입되지 않는다
    this.running ??= this.loop();
  }

  async drain(): Promise<void> {
    while (this.running) await this.running;
    await this.drainEval();
  }

  /**
   * 슬롯이 빌 때까지 판정한다. 탈출 판정(slot === null)과 running 해제를 같은 동기 구간에 둔다 —
   * 바깥 .finally로 풀면 그 사이 마이크로태스크에 들어온 인계가 "루프가 돈다"고 보고 슬롯에 남아 영구히 판정되지 않는다(H1).
   */
  private async loop(): Promise<void> {
    try {
      while (this.slot !== null) {
        const b = this.slot;
        this.slot = null;
        const wake = this.slotFreed;
        this.slotFreed = null;
        wake?.();
        try {
          await this.judgeBatch(b);
        } catch (e) {
          this.d.log.error(`판정 예외 — ${(e as Error).message} · 이 배치 판정을 버린다(적재는 확정됐다)`);
        }
      }
    } finally {
      this.running = null;
    }
  }

  /** ②~⑧ 한 배치 */
  async judgeBatch(batch: AlarmBatch): Promise<void> {
    const t0 = performance.now();
    const phase = (name: string, ms: number) => m.duration.observe({ phase: name }, ms / 1000);

    // ② A1 규칙 — PostgreSQL도 불가면 판정하지 않는다
    const { rules } = await this.d.rules.load();
    const t1 = performance.now();
    phase('A1', t1 - t0);
    if (!rules || rules.length === 0) return;

    // 규칙 없는 태그의 행은 버린다 · 품질 2 · 4 제외 · 규칙마다 ts 오름차순(REQ-GLB-07 — 배치 안 순서는 보장되지 않는다)
    const byTag = new Map<number, AlarmRule[]>();
    for (const r of rules) {
      const list = byTag.get(r.tagId) ?? [];
      list.push(r);
      byTag.set(r.tagId, list);
    }
    const byRule = new Map<number, { rule: AlarmRule; rows: JudgeRow[] }>();
    for (const row of batch.rows) {
      const [ts, , tagId, value, quality] = row;
      if (EXCLUDED_QUALITY.has(quality)) continue;
      const rs = byTag.get(tagId);
      if (!rs) continue;
      for (const rule of rs) {
        let e = byRule.get(rule.ruleId);
        if (!e) {
          e = { rule, rows: [] };
          byRule.set(rule.ruleId, e);
        }
        e.rows.push({ ts, value, quality });
      }
    }
    if (byRule.size === 0) return;
    for (const e of byRule.values()) e.rows.sort((a, b) => a.ts - b.ts);

    // ③ A2 상태 — 걸린 rule_id만 파이프라인 1회 · 실패는 판정 중단(봉인 계열)
    const ruleIds = [...byRule.keys()];
    let raw: Map<number, Record<string, string>>;
    try {
      raw = await this.d.state.read(ruleIds);
    } catch (e) {
      this.d.log.error(`alarm:state 읽기 실패 — ${(e as Error).message} · 이 배치는 판정하지 않는다`);
      return;
    }
    const t2 = performance.now();
    phase('A2', t2 - t1);

    // ④ A3 평가 · ⑤ 확정(규칙 안에서 전이 순서대로 PostgreSQL 커밋)
    const evalRows: AlarmEvalRow[] = [];
    const writes = new Map<number, Record<string, string>>();
    const frames: AlarmFrame[] = [];
    let confirmMs = 0;
    const transitions: [AlarmStateName, AlarmStateName][] = [];
    // 배치 단위 멈춤 — 첫 PostgreSQL 실패 뒤 나머지 규칙은 확정 쓰기 · acked 조회를 건너뛰고 확정 지점에서 상태를 동결한다
    const halt: BatchHalt = { halted: false };
    for (const { rule, rows } of byRule.values()) {
      const res = await judgeRule(
        rule,
        parseState(raw.get(rule.ruleId)),
        rows,
        this.d.confirm,
        this.d.staleMultiplier,
        halt,
      );
      for (const x of res.evalRows) evalRows.push(x);
      if (res.violations) m.evaluations.inc({ result: 'violation' }, res.violations);
      if (res.normals) m.evaluations.inc({ result: 'normal' }, res.normals);
      for (const op of res.pgFailures) m.pgWriteFailures.inc({ op });
      transitions.push(...res.transitions);
      confirmMs += res.confirmMs;
      if (res.touched) writes.set(rule.ruleId, serializeState(res.state));
      for (const ev of res.events) {
        if (!ev.fresh) continue;
        const severity = String(rule.severity);
        if (ev.kind === 'open') {
          m.opened.inc();
          m.active.inc({ severity });
        } else {
          m.closed.inc();
          m.active.dec({ severity });
        }
        frames.push({
          type: 'alarm',
          eventId: ev.eventId,
          ruleId: rule.ruleId,
          tagId: rule.tagId,
          transition: ev.kind === 'open' ? 'OPENED' : 'CLEARED',
          ts: ev.ts,
          severity: rule.severity,
        });
      }
    }
    const t3 = performance.now();
    phase('A3', t3 - t2 - confirmMs);

    // ⑧ A5 전수 — ⑤~⑦과 독립(ClickHouse가 멈춰도 알람은 열리고 닫힌다) · 큐에 넣고 기다리지 않는다
    const evalDone = this.enqueueEval(evalRows, batch.token, ruleIds.length);
    if (evalRows.length > 0) void evalDone.then((at) => phase('A5', at - t3));

    // ⑥ 상태 쓰기 — 파이프라인 1회 · 확정 전이는 ⑤ 커밋분만 담겼다
    const t4 = performance.now();
    if (writes.size > 0) {
      // 커밋 뒤 실패는 같은 파이프라인을 1회 더 보낸다 — 커밋된 전이가 Redis에 없으면 고아(PG ACTIVE · Redis NORMAL)나
      // 닫힌 event_id로의 재진입이 남는다(06_pipeline/08 §부분 실패). 1회 재시도 뒤에도 실패한 잔여는 한계로 둔다.
      for (let attempt = 0; ; attempt++) {
        try {
          await this.d.state.write(writes);
          for (const [from, to] of transitions) m.transitions.inc({ from, to });
          break;
        } catch (e) {
          const msg = (e as Error).message;
          if (attempt === 0) {
            this.d.log.warn(`alarm:state 쓰기 실패(커밋 뒤) — ${msg} · 같은 파이프라인 1회 재시도`);
            continue;
          }
          // 다음 배치가 옛 상태로 재판정한다 — 열린 행이 있으면 INSERT하지 않고 그 event_id를 다시 쓴다(confirm.open)
          m.stateWriteFailures.inc();
          this.d.log.error(`alarm:state 쓰기 실패(커밋 뒤 · 재시도 뒤) — ${msg} · 다음 배치에서 재판정`);
          break;
        }
      }
    }
    const t5 = performance.now();
    phase('A4', confirmMs + (t5 - t4));

    // ⑦ A6 발행 — PostgreSQL 커밋분만(REQ-ALM-10) · 실패는 계수 · 삼킴(발행 구현)
    for (const f of frames) {
      try {
        await this.d.fanout.publishAlarm(f);
      } catch (e) {
        this.d.log.warn(`ch:alarm 발행 실패 — ${(e as Error).message}`);
      }
    }
    const t6 = performance.now();
    if (frames.length > 0) phase('A6', t6 - t5);

    // total = A4 · A5 · A6 중 마지막 완료(04_architecture/05) — A5는 기다리지 않고 끝날 때 잰다
    void evalDone.then((at) => phase('total', Math.max(t6, at) - t0));
  }

  /**
   * ⑧ 큐 넣기 — 대기 칸이 차 있으면(앞 배치가 쓰는 중이고 그다음 배치도 기다린다 — 재시도 중) 새 배치의 전수는
   * 삽입을 시도하지 않고 즉시 무효 구간으로 남긴다. 돌려주는 값은 그 전수가 끝난 시각(performance.now)
   */
  private enqueueEval(rows: AlarmEvalRow[], token: string | null, rules: number): Promise<number> {
    if (rows.length === 0) return Promise.resolve(performance.now());
    if (this.evalSlot !== null) {
      this.recordGap(rows, token, rules, 'queue_full', '앞 배치 alarm_eval 쓰기 중 · 대기 칸 참');
      return Promise.resolve(performance.now());
    }
    let finish: (at: number) => void = () => {};
    const done = new Promise<number>((r) => {
      finish = r;
    });
    this.evalSlot = { rows, token, rules, settled: false, finish };
    this.evalRunning ??= this.evalLoop();
    return done;
  }

  /** 대기 칸이 빌 때까지 쓴다 — 탈출 판정과 evalRunning 해제는 같은 동기 구간(loop와 같은 이유) */
  private async evalLoop(): Promise<void> {
    try {
      while (this.evalSlot !== null) {
        const job = this.evalSlot;
        this.evalSlot = null;
        this.evalCurrent = job;
        try {
          await this.writeEval(job);
        } catch (e) {
          this.settle(job, 'retry_exhausted', (e as Error).message);
        }
        this.evalCurrent = null;
      }
    } finally {
      this.evalCurrent = null;
      this.evalRunning = null;
    }
  }

  /** 종료 — ⑧ 큐를 상한까지 기다리고, 넘으면 쓰는 중 · 대기 전수를 무효 구간(shutdown)으로 끝낸다 */
  private async drainEval(): Promise<void> {
    const running = this.evalRunning;
    if (!running) return;
    let timer: NodeJS.Timeout | undefined;
    const capped = await Promise.race([
      running.then(() => false),
      new Promise<boolean>((r) => {
        timer = setTimeout(() => r(true), this.evalDrainMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
    if (!capped) return;
    const reason = `종료 드레인 상한 ${this.evalDrainMs} ms`;
    for (const job of [this.evalCurrent, this.evalSlot]) if (job) this.settle(job, 'shutdown', reason);
    this.evalSlot = null;
  }

  /** ⑧ 같은 토큰 · 같은 백오프 · 같은 횟수 재시도 → 소진이면 격리 없이 무효 구간(계수 + 구조화 로그 alarm_eval_gap) */
  private async writeEval(job: EvalJob): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      if (job.settled) return;
      try {
        await this.d.evalSink.insert(job.rows, job.token);
        this.settle(job, null);
        return;
      } catch (e) {
        const msg = (e as Error).message;
        if (attempt >= RETRY_BACKOFF_MS.length || this.d.stopping()) {
          this.settle(job, 'retry_exhausted', msg);
          return;
        }
        const wait = RETRY_BACKOFF_MS[attempt] as number;
        this.d.log.warn(
          `alarm_eval INSERT 실패(시도 ${attempt + 1}) — ${msg} · ${wait} ms 뒤 같은 토큰 재시도`,
        );
        await this.d.sleep(wait);
      }
    }
  }

  /** 작업 결말 1회 — reason null이면 삽입 성공 */
  private settle(job: EvalJob, reason: EvalGapReason | null, error = ''): void {
    if (job.settled) return;
    job.settled = true;
    if (reason === null) m.evalRowsInserted.inc(job.rows.length);
    else this.recordGap(job.rows, job.token, job.rules, reason, error);
    job.finish(performance.now());
  }

  private recordGap(
    rows: AlarmEvalRow[],
    token: string | null,
    rules: number,
    reason: EvalGapReason,
    error: string,
  ): void {
    let tsMin = Number.POSITIVE_INFINITY;
    let tsMax = Number.NEGATIVE_INFINITY;
    for (const r of rows) {
      if (r[0] < tsMin) tsMin = r[0];
      if (r[0] > tsMax) tsMax = r[0];
    }
    m.gapBatches.inc();
    m.gapRows.inc(rows.length);
    this.d.log.error(
      JSON.stringify({
        event: 'alarm_eval_gap',
        reason,
        ts_min: tsMin,
        ts_max: tsMax,
        rows: rows.length,
        rules,
        token,
        error,
      }),
    );
  }
}
