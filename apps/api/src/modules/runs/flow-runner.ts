// flow 라이브 실행(GEN-12) — 기전 정본 docs/06_pipeline/10_datagen_inject.md §흐름 시연 실행 — flow · §시연 전용 행 · §취소 · 정리
// 단계: prepare(시드 태그 로드 · 시연 전용 행 확인 · 시작 적체 기록) → publish(발행 + 업무 명령) → drain(적체 복귀 · 상한 30초).
// 흐름 요약은 내지 않는다 — 실행은 발행 원천일 뿐이고 요약은 워커가 낸다(흐름 계약 불변).
// 업무 명령은 BizWritePort(프로세스 안 호출)로 시연 전용 설비 DEMO-FLOW-DEV에만 · actor null · 되돌림 없음.
import { DEMO_FLOW } from '@db-study/shared';
import type { GroupBacklog } from '../../common/redis/durable-key-client';
import type { BizWriteOutcome, BizWritePort, BizWriteRequest } from '../biz/biz-contracts';
import { genPointsGenerated } from '../datagen/datagen.service';
import { BackpressureGate, type Thresholds } from '../datagen/mode-b/backpressure-gate';
import { genPublishHaltedEntries, genPublishHaltedPoints } from '../datagen/mode-b/mode-b-runner';
import {
  FLOW_MAX_REPS_PER_TAG,
  type FlowSecondResult,
  type FlowSecondTask,
  type FlowTag,
  flowTagsSuffice,
} from './flow-gen';
import {
  type RunEnding,
  type RunError,
  type RunExecutor,
  type RunState,
  type RunStepDef,
  RunStopped,
  runErrorOf,
} from './run-registry';

/** drain 상한(2계층 · 현행 참고 30초 · 소유 06_pipeline/10) */
export const FLOW_DRAIN_LIMIT_MS = 30_000;
export const FLOW_DRAIN_POLL_MS = 250;

export const FLOW_STEPS: RunStepDef[] = [
  { key: 'prepare', label: '시드 설비 · 태그 로드 · 시연 전용 행 확인' },
  { key: 'publish', label: '발행' },
  { key: 'drain', label: '적체 소진' },
];

/** 시연 전용 행 조회 결과 — 코드로 찾는다 */
export interface DemoRows {
  siteId: number | null;
  lineId: number | null;
  deviceId: number | null;
  deviceActive: boolean | null;
}

export interface FlowDeps {
  loadTags(): Promise<FlowTag[]>;
  /** siteId가 주어지면 그 사이트 안 라인을 찾는다 */
  findDemo(siteId?: number | null): Promise<DemoRows>;
  port: BizWritePort;
  /** grp:ingest 적체(lag + pending의 원자료) · 조회 실패는 null */
  backlog(): Promise<GroupBacklog | null>;
  xaddBatch(
    payloads: readonly Buffer[],
  ): Promise<{ results: (string | Error)[]; backlog: GroupBacklog | null }>;
  /** 모드 B와 같은 임계(MAXLEN 비율) — MEMORY_PROFILE이 없으면 던진다(실행 failed) */
  thresholds(): Thresholds;
  /** 한 초 생성 · 인코딩 — worker_threads 작업 또는 프로세스 안 */
  encode(task: FlowSecondTask): Promise<FlowSecondResult>;
}

export interface FlowClock {
  nowMs(): number;
  /** wallMs까지 또는 abort가 풀릴 때까지 */
  sleepUntil(wallMs: number, abort: Promise<void>): Promise<void>;
}
export const systemFlowClock: FlowClock = {
  nowMs: () => Date.now(),
  sleepUntil: (t, abort) =>
    new Promise<void>((resolve) => {
      const h = setTimeout(resolve, Math.max(0, t - Date.now()));
      void abort.then(() => {
        clearTimeout(h);
        resolve();
      });
    }),
};

/** 시연 전용 행 이름 · 설비 접속 설정(비활성 · 루프백 기본값 · 태그 없음) */
export const DEMO_NAMES = { site: '시연 사이트', line: '시연 라인', device: '시연 설비' } as const;
export const DEMO_MODBUS = {
  host: '127.0.0.1',
  port: 502,
  unitId: 1,
  timeoutMs: 3000,
  retryCount: 0,
  maxRegsPerRequest: 125,
} as const;

/** publish 명령 본문 — 매번 새 값이라 항상 실제 변경(감사 · 무효화 체인이 돈다) */
export function demoDeviceName(runId: string, n: number): string {
  return `${DEMO_NAMES.device} ${runId.slice(0, 8)}-${n}`;
}

/** 명령 수 = durationSec × bizPerSec의 정수 부분 · j번째(0부터)는 publish 시작 + j ÷ bizPerSec초 */
export function commandPlan(durationSec: number, bizPerSec: number): number[] {
  if (bizPerSec <= 0) return [];
  const n = Math.floor(durationSec * bizPerSec);
  return Array.from({ length: n }, (_, j) => Math.round((j * 1000) / bizPerSec));
}

type CmdKind = 'ok' | 'pending' | 'failed';

async function classify(p: Promise<BizWriteOutcome>): Promise<CmdKind> {
  try {
    const out = await p;
    if (out.type === 'accepted') return 'pending';
    return out.httpStatus >= 200 && out.httpStatus < 300 ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

export class FlowRunExecutor implements RunExecutor {
  readonly type = 'flow' as const;

  constructor(
    private readonly deps: FlowDeps,
    private readonly clock: FlowClock = systemFlowClock,
    private readonly drainLimitMs = FLOW_DRAIN_LIMIT_MS,
  ) {}

  steps(): RunStepDef[] {
    return FLOW_STEPS.map((s) => ({ ...s }));
  }

  private submit(req: Omit<BizWriteRequest, 'actor' | 'idempotencyKey'>): Promise<BizWriteOutcome> {
    return this.deps.port.submit({ ...req, actor: null, idempotencyKey: null });
  }

  /** prepare의 생성 명령 — 적용(2xx)만 성공 · 대기 상한 초과 · 거절 · 불가는 실행 failed */
  private async create(
    kind: BizWriteRequest['kind'],
    params: Record<string, number>,
    body: unknown,
  ): Promise<unknown> {
    const out = await this.submit({ kind, params, body });
    if (out.type === 'accepted')
      throw new Error(
        `시연 전용 행 명령 ${kind}가 대기 상한을 넘었다(${out.status}) — 다음 실행이 다시 확인한다`,
      );
    if (out.httpStatus < 200 || out.httpStatus >= 300)
      throw new Error(`시연 전용 행 명령 ${kind} 응답 ${out.httpStatus}`);
    return out.body;
  }

  /** 시연 전용 행 — 코드로 찾고 없는 것만 만든다(사이트 → 라인 → 설비 → 비활성 patch) · 명령 결과까지 기다린 뒤 중단을 본다 */
  private async ensureDemo(state: RunState): Promise<number> {
    const checkStop = () => {
      if (state.stopRequested) throw new RunStopped();
    };
    let rows = await this.deps.findDemo();
    let siteId = rows.siteId;
    if (siteId === null) {
      const b = (await this.create(
        'master.site.create',
        {},
        { siteCode: DEMO_FLOW.siteCode, siteName: DEMO_NAMES.site },
      )) as {
        siteId: number;
      };
      siteId = b.siteId;
      checkStop();
      rows = await this.deps.findDemo(siteId);
    }
    let lineId = rows.lineId;
    if (lineId === null) {
      const b = (await this.create(
        'master.line.create',
        {},
        { siteId, lineCode: DEMO_FLOW.lineCode, lineName: DEMO_NAMES.line },
      )) as { lineId: number };
      lineId = b.lineId;
      checkStop();
    }
    let deviceId = rows.deviceId;
    let active = rows.deviceActive;
    if (deviceId === null) {
      const b = (await this.create(
        'master.device.create',
        {},
        {
          lineId,
          deviceCode: DEMO_FLOW.deviceCode,
          deviceName: DEMO_NAMES.device,
          vendor: null,
          model: null,
          modbusConfig: DEMO_MODBUS,
        },
      )) as { deviceId: number };
      deviceId = b.deviceId;
      active = true;
      checkStop();
    }
    // 생성 표면이 isActive를 받지 않아 비활성은 뒤따르는 patch가 한다 — 앞 실행이 patch 전에 끊겼으면 여기서 마저 한다
    if (active) {
      await this.create('master.device.patch', { id: deviceId }, { isActive: false });
      checkStop();
    }
    return deviceId;
  }

  async execute(state: RunState): Promise<RunEnding> {
    const pps = state.params.pps as number;
    const durationSec = state.params.durationSec as number;
    const bizPerSec = state.params.bizPerSec as number;
    const r = {
      pointsSent: 0,
      entriesSent: 0,
      commandsSent: 0,
      commandsOk: 0,
      commandsPending: 0,
      commandsFailed: 0,
      backpressurePauses: 0,
      drainMs: null as number | null,
    };
    state.result = { ...r };
    const sync = () => {
      state.result = { ...r };
    };
    let tags: FlowTag[] = [];
    let demoDeviceId = 0;
    let startBacklog = 0;
    try {
      await state.runStep('prepare', async () => {
        tags = await this.deps.loadTags();
        if (tags.length === 0) throw new Error('시드 활성 태그가 없다 — 시드 뒤 다시 시작');
        // 한 초 한 태그 점 수가 상한을 넘으면 ts 간격이 0이라 (태그 · ts)가 겹친다 — 시연 전용 행을 건드리기 전에 거절
        if (!flowTagsSuffice(pps, tags.length))
          throw new Error(
            `활성 태그 수가 pps에 비해 적다 — 활성 태그 ${tags.length}개 · pps ${pps}(한 초 한 태그 ${Math.ceil(pps / tags.length)}점 > ${FLOW_MAX_REPS_PER_TAG})`,
          );
        if (state.stopRequested) throw new RunStopped();
        demoDeviceId = await this.ensureDemo(state);
        const b = await this.deps.backlog().catch(() => null);
        startBacklog = b && b.lag !== null ? b.lag + b.pending : 0;
        if (state.stopRequested) throw new RunStopped();
        return { devices: new Set(tags.map((t) => t.deviceId)).size, tags: tags.length };
      });

      await state.runStep('publish', async () => {
        const gate = new BackpressureGate(this.deps.thresholds());
        const stop = state.stopSignal();
        const t0 = this.clock.nowMs();
        const first = Math.ceil(t0 / 1000) * 1000;
        const plan = commandPlan(durationSec, bizPerSec);
        const inflight: Promise<void>[] = [];
        let nextCmd = 0;
        const sendDue = (now: number) => {
          while (nextCmd < plan.length && (plan[nextCmd] as number) + first <= now && !state.stopRequested) {
            nextCmd += 1;
            r.commandsSent += 1;
            const n = r.commandsSent;
            inflight.push(
              classify(
                this.submit({
                  kind: 'master.device.patch',
                  params: { id: demoDeviceId },
                  body: { deviceName: demoDeviceName(state.runId, n) },
                }),
              ).then((k) => {
                if (k === 'ok') r.commandsOk += 1;
                else if (k === 'pending') r.commandsPending += 1;
                else r.commandsFailed += 1;
                sync();
              }),
            );
          }
        };
        let wasHalted = false;
        const detail = () => ({
          pointsSent: r.pointsSent,
          entriesSent: r.entriesSent,
          commandsSent: r.commandsSent,
          backpressurePauses: r.backpressurePauses,
        });
        for (let s = 0; s < durationSec && !state.stopRequested; s++) {
          const secondStart = first + s * 1000;
          const at = secondStart + 1000; // 초가 끝난 뒤 발행 — 미래 ts를 만들지 않는다
          // 명령은 초 안에서도 제 시각에 — 가장 가까운 명령 시각까지 끊어 잔다
          while (!state.stopRequested) {
            const now = this.clock.nowMs();
            sendDue(now);
            const due = nextCmd < plan.length ? (plan[nextCmd] as number) + first : Number.POSITIVE_INFINITY;
            const wake = Math.min(at, due);
            if (now >= at) break;
            await this.clock.sleepUntil(wake, stop);
          }
          if (state.stopRequested) break;
          const out = await this.deps.encode({ tags, pps, second: s, secondStartMs: secondStart });
          genPointsGenerated.inc({ mode: 'run', profile: 'RAMP' }, out.totalPoints);
          if (gate.halted) {
            if (!wasHalted) r.backpressurePauses += 1;
            wasHalted = true;
            genPublishHaltedEntries.inc({ mode: 'run' }, out.payloads.length);
            genPublishHaltedPoints.inc({ mode: 'run' }, out.totalPoints);
            gate.observe(await this.deps.backlog().catch(() => null));
          } else {
            wasHalted = false;
            let res: { results: (string | Error)[]; backlog: GroupBacklog | null };
            try {
              res = await this.deps.xaddBatch(out.payloads);
            } catch (e) {
              res = {
                results: out.payloads.map(() => (e instanceof Error ? e : new Error(String(e)))),
                backlog: null,
              };
            }
            let failed = false;
            res.results.forEach((x, i) => {
              const pts = out.points[i] ?? 0;
              if (x instanceof Error) {
                failed = true;
                genPublishHaltedEntries.inc({ mode: 'run' }, 1);
                genPublishHaltedPoints.inc({ mode: 'run' }, pts);
                return;
              }
              r.entriesSent += 1;
              r.pointsSent += pts;
            });
            if (failed) gate.xaddFailed();
            else gate.observe(res.backlog);
          }
          sync();
          state.patchDetail('publish', { ...detail(), progress: Math.min(1, (s + 1) / durationSec) });
        }
        sendDue(this.clock.nowMs());
        // 보낸 명령은 결과까지 센다(중단이어도)
        await Promise.all(inflight);
        sync();
        if (state.stopRequested) {
          state.patchDetail('publish', detail());
          throw new RunStopped();
        }
        return { ...detail(), progress: 1 };
      });

      await state.runStep('drain', async () => {
        const stop = state.stopSignal();
        const t0 = this.clock.nowMs();
        let timedOut = true;
        while (!state.stopRequested) {
          const b = await this.deps.backlog().catch(() => null);
          if (b && b.lag !== null && b.lag + b.pending <= startBacklog) {
            timedOut = false;
            break;
          }
          if (this.clock.nowMs() - t0 >= this.drainLimitMs) break;
          await this.clock.sleepUntil(this.clock.nowMs() + FLOW_DRAIN_POLL_MS, stop);
        }
        if (state.stopRequested) throw new RunStopped();
        r.drainMs = Math.round(this.clock.nowMs() - t0);
        sync();
        return { drainMs: r.drainMs, timedOut };
      });
    } catch (e) {
      state.skipPending();
      sync();
      if (e instanceof RunStopped) return { status: 'stopped', error: null };
      const error: RunError = runErrorOf(e);
      return { status: 'failed', error };
    }
    sync();
    return { status: 'completed', error: null };
  }
}
