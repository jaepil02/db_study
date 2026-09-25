// 모드 B 발행 루프(GEN-06) — 벽시계 1초 격자마다 설비 × 시점 엔트리를 만들어 stream:plc:raw에 직접 XADD한다.
// 발행 한 번 = 묶음 XADD MAXLEN ~ + XINFO GROUPS · 결과 적체로 다음 묶음의 단계를 정한다(06_pipeline/10 §모드 B 적체 검사).
// 위험이면 묶음을 발행하지 않고 XINFO GROUPS만 보내 재개를 기다린다 — 스풀이 없다(생성 데이터는 다시 만들 수 있다).
// 생성 시계는 멈추지 않는다 — 중단 동안의 시점은 발행되지 않은 채 지나가고 재개 뒤 ts는 현재 격자다.
import type { SignalProfile } from '@db-study/shared';
import { Counter, Gauge } from 'prom-client';
import { appRegistry } from '../../../common/metrics/registry';
import type { GroupBacklog } from '../../../common/redis/durable-key-client';
import { INGEST_GROUP, RAW_STREAM } from '../../collector/redis-stream-buffer';
import { genPointsDropout, genPointsGenerated } from '../datagen.service';
import { PROFILE_NAMES } from '../mode-a/register-writer';
import { BackpressureGate, type Stage } from './backpressure-gate';
import { type ModeBGenerator, UNDECODABLE_PAYLOAD, UndecodableMixer } from './mode-b-generator';

/** 한 프로세스 레지스트리에 같은 이름을 두 번 등록하지 않는다 — 발행 경로 셋이 같은 계열을 나눠 쓴다 */
function counter(name: string, help: string): Counter<'mode'> {
  return (
    (appRegistry.getSingleMetric(name) as Counter<'mode'> | undefined) ??
    new Counter({ name, help, labelNames: ['mode'], registers: [appRegistry] })
  );
}

export const genPublishHaltedEntries = counter(
  'gen_publish_halted_entries_total',
  '위험 단계로 발행하지 않은 엔트리',
);
export const genPublishHaltedPoints = counter(
  'gen_publish_halted_points_total',
  '위험 단계로 발행하지 않은 포인트',
);
export const backpressureStage =
  (appRegistry.getSingleMetric('backpressure_stage') as Gauge<'publisher'> | undefined) ??
  new Gauge({
    name: 'backpressure_stage',
    help: '발행 경로별 백프레셔 단계(0 정상 · 1 주의 · 2 경고 · 3 위험 · 4 복구)',
    labelNames: ['publisher'],
    registers: [appRegistry],
  });
/** gen_worker_utilization — datagen.service가 등록한다(같은 이름을 다시 만들지 않는다) */
function workerUtilization(): Gauge<'mode'> | undefined {
  return appRegistry.getSingleMetric('gen_worker_utilization') as Gauge<'mode'> | undefined;
}

/** DurableKeyClient 중 모드 B가 쓰는 부분 */
export interface StreamPublisher {
  xaddBatchWithBacklog(
    stream: string,
    payloads: readonly Buffer[],
    maxlen: number,
    group: string,
  ): Promise<{ results: (string | Error)[]; backlog: GroupBacklog | null }>;
  groupBacklog(stream: string, group: string): Promise<GroupBacklog | null>;
}

export interface ModeBRunOptions {
  /** 초당 시점 수 — 1,000의 약수(격자 ts가 정수 ms) */
  stepsPerSecond: number;
  durationSeconds: number;
  maxlen: number;
  /** N 엔트리마다 해독 불가 하나(0 = 없음) */
  undecodableEvery: number;
}

export interface ModeBSummary {
  generatedPoints: number;
  generatedEntries: number;
  dropoutPoints: number;
  publishedEntries: number;
  publishedPoints: number;
  haltedEntries: number;
  haltedPoints: number;
  undecodableInjected: number;
  xaddFailures: number;
  ticks: number;
  /** 격자 시각보다 한 주기 이상 늦게 시작한 틱 — 생성기 포화 신호(REQ-GEN-13 · 포화 구간 폐기) */
  lateTicks: number;
  maxBacklog: number | null;
  finalStage: Stage;
  workerUtilization: number;
}

export interface RunnerClock {
  nowMs(): number;
  monoMs(): number;
  sleepUntil(wallMs: number): Promise<void>;
}

export const systemRunnerClock: RunnerClock = {
  nowMs: () => Date.now(),
  monoMs: () => performance.now(),
  sleepUntil: (t) => new Promise((r) => setTimeout(r, Math.max(0, t - Date.now()))),
};

export class ModeBRunner {
  readonly gate: BackpressureGate;
  private readonly mixer: UndecodableMixer;
  private readonly periodMs: number;
  private busyMs = 0;
  private readonly s: Omit<ModeBSummary, 'undecodableInjected' | 'finalStage' | 'workerUtilization'> = {
    generatedPoints: 0,
    generatedEntries: 0,
    dropoutPoints: 0,
    publishedEntries: 0,
    publishedPoints: 0,
    haltedEntries: 0,
    haltedPoints: 0,
    xaddFailures: 0,
    ticks: 0,
    lateTicks: 0,
    maxBacklog: null,
  };
  private undecodablePublished = 0;

  constructor(
    private readonly gen: ModeBGenerator,
    private readonly publisher: StreamPublisher,
    private readonly opts: ModeBRunOptions,
    gate: BackpressureGate,
    private readonly clock: RunnerClock = systemRunnerClock,
  ) {
    if (!Number.isInteger(opts.stepsPerSecond) || opts.stepsPerSecond < 1 || 1000 % opts.stepsPerSecond !== 0)
      throw new Error(`초당 시점 ${opts.stepsPerSecond} — 1,000의 약수인 정수`);
    this.periodMs = 1000 / opts.stepsPerSecond;
    this.gate = gate;
    this.mixer = new UndecodableMixer(opts.undecodableEvery);
    backpressureStage.set({ publisher: 'gen_b' }, gate.stage);
  }

  /** durationSeconds틱 — 첫 틱은 다음 초 경계 */
  async run(): Promise<ModeBSummary> {
    const first = Math.ceil(this.clock.nowMs() / 1000) * 1000;
    const started = this.clock.monoMs();
    for (let i = 0; i < this.opts.durationSeconds; i++) {
      const at = first + i * 1000;
      await this.clock.sleepUntil(at);
      if (this.clock.nowMs() - at >= 1000) this.s.lateTicks += 1;
      await this.tick(at);
    }
    return this.summary(this.clock.monoMs() - started);
  }

  /** 격자 초 tickMs 하나 — 그 초에서 끝나는 시점 stepsPerSecond개(가장 새 시점 ts = tickMs · 미래 ts를 만들지 않는다) */
  async tick(tickMs: number): Promise<void> {
    this.s.ticks += 1;
    const t0 = this.clock.monoMs();
    const payloads: Buffer[] = [];
    const points: number[] = [];
    for (let j = this.opts.stepsPerSecond - 1; j >= 0; j--) {
      const ts = tickMs - j * this.periodMs;
      const r = this.gen.step(Math.floor(ts / this.periodMs), ts);
      this.s.generatedPoints += r.points;
      this.s.generatedEntries += r.entries.length;
      this.s.dropoutPoints += r.dropped;
      r.byProfile.forEach((n, code) => {
        if (n > 0) genPointsGenerated.inc({ mode: 'B', profile: PROFILE_NAMES[code] as SignalProfile }, n);
      });
      if (r.dropped > 0) genPointsDropout.inc({ mode: 'B' }, r.dropped);
      for (const e of r.entries) {
        payloads.push(e.payload);
        points.push(e.points);
      }
    }
    this.busyMs += this.clock.monoMs() - t0;
    if (this.gate.halted) {
      this.halt(
        payloads.length,
        points.reduce((a, b) => a + b, 0),
      );
      // 적체 확인만 보낸다 — 주의 임계 아래면 다음 묶음부터 재개
      const backlog = await this.publisher.groupBacklog(RAW_STREAM, INGEST_GROUP).catch(() => null);
      this.observe(backlog);
      return;
    }
    await this.publish(payloads, points);
  }

  private async publish(payloads: Buffer[], points: number[]): Promise<void> {
    const pointsOf = new Map(payloads.map((p, i) => [p, points[i] ?? 0]));
    const wire = this.mixer.mix(payloads);
    let failed = false;
    let last: GroupBacklog | null = null;
    let results: (string | Error)[];
    try {
      const r = await this.publisher.xaddBatchWithBacklog(RAW_STREAM, wire, this.opts.maxlen, INGEST_GROUP);
      results = r.results;
      last = r.backlog;
    } catch (e) {
      // 파이프라인 자체 실패(연결 끊김) — 묶음 전부 실패로 센다
      results = wire.map(() => (e instanceof Error ? e : new Error(String(e))));
    }
    results.forEach((r, i) => {
      const p = wire[i] as Buffer;
      const junk = p === UNDECODABLE_PAYLOAD;
      if (r instanceof Error) {
        failed = true;
        this.s.xaddFailures += 1;
        if (!junk) this.halt(1, pointsOf.get(p) ?? 0); // 실패 엔트리는 발행 중단 수에 더한다
        return;
      }
      if (junk) {
        this.undecodablePublished += 1;
        return;
      }
      this.s.publishedEntries += 1;
      this.s.publishedPoints += pointsOf.get(p) ?? 0;
    });
    if (failed) {
      backpressureStage.set({ publisher: 'gen_b' }, this.gate.xaddFailed());
      return;
    }
    this.observe(last);
  }

  private halt(entries: number, pts: number): void {
    this.s.haltedEntries += entries;
    this.s.haltedPoints += pts;
    genPublishHaltedEntries.inc({ mode: 'B' }, entries);
    genPublishHaltedPoints.inc({ mode: 'B' }, pts);
  }

  private observe(b: GroupBacklog | null): void {
    if (b && b.lag !== null) this.s.maxBacklog = Math.max(this.s.maxBacklog ?? 0, b.lag + b.pending);
    backpressureStage.set({ publisher: 'gen_b' }, this.gate.observe(b));
  }

  /** 생성기 사용률 = 생성 · 인코딩 시간 ÷ 경과 — 모드 B는 생성을 발행 스레드 하나에서 한다(워커 1개로 센다) */
  summary(elapsedMs: number): ModeBSummary {
    const utilization = elapsedMs > 0 ? this.busyMs / elapsedMs : 0;
    workerUtilization()?.set({ mode: 'B' }, utilization);
    return {
      ...this.s,
      undecodableInjected: this.undecodablePublished,
      finalStage: this.gate.stage,
      workerUtilization: utilization,
    };
  }
}
