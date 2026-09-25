// 설비 하나의 폴링(COL-02) — 설비당 Modbus 연결 1 · 스캔 그룹(scan_rate_ms)마다 루프 1
// 한 연결 위에서는 한 번에 한 그룹의 사이클만 돈다 — 그룹 루프가 여럿이어도 동시 요청을 만들지 않고(§폴링 계약 연결 · 블록 순서 행),
// 블록의 ts(송신 직전)에 다른 그룹 요청을 기다린 시간이 섞이지 않는다 — 기다림은 사이클 시작 지연(poll_duration)으로만 드러난다.
// 루프 예외는 이 설비의 연결과 그룹 루프 전부를 재기동한다(REQ-COL-14) — 다른 설비 · 조회 API는 영향받지 않는다.
import { encodeEntry } from '@db-study/shared';
import { Logger } from '@nestjs/common';
import ModbusRTU from 'modbus-serial';
import { LATENCY_BUCKETS_SECONDS } from '../../common/metrics/registry';
import type { GroupBacklog } from '../../common/redis/durable-key-client';
import type { DeviceDef, ScanGroup } from './collect-definition';
import {
  colDeadbandSkipped,
  colModbusRtt,
  colPointsByQuality,
  colPolls,
  colPollTimeouts,
  pointsEmitted,
  pollDuration,
} from './collector-metrics';
import { type DeadbandFilterPort, PassthroughFilter } from './deadband-filter';
import type { PointBufferPort } from './point-buffer.port';
import {
  type Clock,
  type CycleEntry,
  type CycleResult,
  errorText,
  type RegisterReader,
  runCycle,
  systemClock,
} from './poll-cycle';

/**
 * 루프 재기동 간격 — 정본에 값이 없다. 재기동 사유는 연결 실패(SIM 포트 기동 실패 · 끊김)라
 * 곧바로 다시 붙으면 같은 실패를 초당 수백 번 되풀이한다. 1초는 S2 스캔 주기(1 Hz)와 같아
 * 복구 뒤 결측이 한 주기 안팎으로 끝난다.
 */
export const LOOP_RESTART_MS = 1000;

/**
 * 타임아웃 왕복의 관측값 — 카탈로그는 "타임아웃은 +Inf 칸"이다. prom-client는 Infinity 관측을 거절(TypeError)하므로
 * 최상위 버킷 경계의 2배(유한값)를 넣어 +Inf 칸에만 들어가게 한다. 대가: _sum이 타임아웃마다 이 값만큼 부푼다 —
 * 타임아웃 구간의 평균 왕복은 _sum이 아니라 버킷(분위수)으로 읽는다.
 */
export const RTT_TIMEOUT_OBSERVATION_SECONDS = (LATENCY_BUCKETS_SECONDS.at(-1) ?? 10) * 2;

/** 다음 격자 위상까지 기다릴 ms — 벽시계 wall에서 (k × period + offset) 중 가장 가까운 미래(같으면 0) */
export function phaseDelayMs(offsetMs: number, wallMs: number, periodMs: number): number {
  return (((offsetMs - wallMs) % periodMs) + periodMs) % periodMs;
}

export type Exclusive = <T>(run: () => Promise<T>) => Promise<T>;

/** 배타 구간 — 앞 작업이 끝나야(성공 · 실패) 다음 작업을 시작한다 */
export function exclusive(): Exclusive {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>): Promise<T> => {
    const p = tail.then(run, run);
    tail = p.catch(() => undefined);
    return p;
  };
}

/** 데드밴드 적용 — 전송할 점만 남긴 엔트리와 생략 수 */
export function applyDeadband(
  entry: CycleEntry,
  deadbandOf: (tagId: number) => number,
  filter: DeadbandFilterPort,
): { entry: CycleEntry; skipped: number } {
  const out: CycleEntry = { d: entry.d, t0: entry.t0, tg: [], dt: [], va: [], q: [] };
  let skipped = 0;
  for (let i = 0; i < entry.tg.length; i++) {
    const tagId = entry.tg[i] as number;
    const va = entry.va[i] as number;
    const q = entry.q[i] as number;
    if (!filter.admit(tagId, va, q, deadbandOf(tagId))) {
      skipped += 1;
      continue;
    }
    out.tg.push(tagId);
    out.dt.push(entry.dt[i] as number);
    out.va.push(va);
    out.q.push(q);
  }
  // t0 = 엔트리 안 ts 최솟값(min dt = 0) 계약 — 첫 블록 점이 생략됐으면 t0를 남은 점의 최솟값으로 옮긴다
  if (out.dt.length > 0) {
    const min = Math.min(...out.dt);
    if (min > 0) {
      out.t0 += min;
      out.dt = out.dt.map((x) => x - min);
    }
  }
  return { entry: out, skipped };
}

interface Sleeper {
  timer: NodeJS.Timeout;
  resolve: () => void;
}

export class DevicePoller {
  private readonly log: Logger;
  private readonly device: string;
  private readonly deadbands: Map<number, number>;
  private running = false;
  private client: ModbusRTU | null = null;
  private readonly sleepers = new Set<Sleeper>();
  private done: Promise<void> = Promise.resolve();
  /** 설비별 사이클 일련번호 — 그룹과 무관하게 설비 하나에 하나(기동 때 1부터 · 06_pipeline/12 §3단계 s) */
  private seq = 0;
  /** 마지막 발행 뒤의 grp:ingest 적체 — 보관만 한다. 백프레셔 단계 반응(경고 · 위험 · 스풀)은 S6이다 */
  lastBacklog: GroupBacklog | null = null;

  constructor(
    private readonly def: DeviceDef,
    private readonly buffer: PointBufferPort,
    private readonly clock: Clock = systemClock,
    /**
     * 폴링 시작 위상 — 설비 몫 (i + 0.5) ÷ N(0~1). null이면 연결 즉시 시작.
     * S2 판정: 위상을 기동마다 우연에 맡기면 창 W와의 어긋남이 기동마다 달라 fan-in 대기 · E2E가 반복마다 다른 조건이 된다(기록 011 폐기 사유).
     * S3 판정(스캔 그룹 여럿): 설비 단위 식을 그대로 두고 그룹마다 같은 몫을 자기 주기에 곱한다 —
     * 오프셋 = 몫 × 그룹 scan_rate_ms. 절대 ms를 공유하면 짧은 주기 그룹에서 오프셋이 주기를 넘어 뜻을 잃는다.
     */
    private readonly phaseFraction: number | null = null,
    private readonly filter: DeadbandFilterPort = new PassthroughFilter(),
  ) {
    this.log = new Logger(`Collector:${def.deviceCode}`);
    this.device = String(def.deviceId);
    this.deadbands = new Map(def.tags.map((t) => [t.tagId, t.deadband]));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.done = this.supervise();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wakeAll();
    this.closeClient(); // 진행 중 요청을 끊는다 — 응답 · 타임아웃을 기다리지 않는다
    await this.done;
  }

  /** 재기동 감독 — 루프가 던지면 연결을 닫고 잠시 뒤 새 연결로 다시 돈다 */
  private async supervise(): Promise<void> {
    while (this.running) {
      try {
        await this.session();
      } catch (e) {
        if (this.running) this.log.warn(`폴링 루프 예외 — ${LOOP_RESTART_MS} ms 뒤 재기동: ${errorText(e)}`);
      } finally {
        this.closeClient();
      }
      if (this.running) await this.sleep(LOOP_RESTART_MS);
    }
  }

  /** 연결 하나 위에서 그룹 루프 전부 — 하나가 던지면 연결을 닫아 나머지도 끝내고 첫 오류를 던진다 */
  private async session(): Promise<void> {
    const client = new ModbusRTU();
    this.client = client;
    await client.connectTCP(this.def.host, { port: this.def.port });
    client.setID(this.def.unitId);
    client.setTimeout(this.def.timeoutMs);
    const lock = exclusive();
    const blocks = this.def.groups.reduce((n, g) => n + g.blocks.length, 0);
    this.log.log(
      `연결 — ${this.def.host}:${this.def.port} · 그룹 ${this.def.groups.map((g) => `${g.scanRateMs} ms`).join(' · ')} · 블록 ${blocks}`,
    );
    const alive = { ok: true };
    let failure: unknown = null;
    await Promise.all(
      this.def.groups.map((g) =>
        this.groupLoop(g, client, lock, alive).catch((e) => {
          if (!alive.ok) return;
          alive.ok = false;
          failure = e;
          this.closeClient();
          this.wakeAll();
        }),
      ),
    );
    if (failure !== null) throw failure;
  }

  private async groupLoop(
    g: ScanGroup,
    reader: RegisterReader,
    lock: Exclusive,
    alive: { ok: boolean },
  ): Promise<void> {
    let next = this.clock.monoMs();
    if (this.phaseFraction !== null) {
      const delay = phaseDelayMs(this.phaseFraction * g.scanRateMs, this.clock.wallMs(), g.scanRateMs);
      next += delay;
      await this.sleep(delay);
    }
    while (this.running && alive.ok) {
      await this.cycle(g, reader, lock);
      // 주기 고정 — 사이클이 주기를 넘기면 밀린 틱을 몰아 돌지 않고 곧바로 다음 사이클로 간다
      next += g.scanRateMs;
      const now = this.clock.monoMs();
      if (next < now) next = now;
      await this.sleep(next - now);
    }
  }

  private async cycle(g: ScanGroup, reader: RegisterReader, lock: Exclusive): Promise<void> {
    const started = this.clock.monoMs();
    colPolls.inc({ device: this.device });
    // 요청 · 디코딩만 배타 구간 — 발행(XADD 왕복)은 다른 그룹의 요청을 막지 않는다
    const r = await lock(() => runCycle(reader, this.def, g, this.clock));
    for (const s of r.rtts) colModbusRtt.observe(Number.isFinite(s) ? s : RTT_TIMEOUT_OBSERVATION_SECONDS);
    await this.handle(r);
    pollDuration.observe({ device: this.device }, (this.clock.monoMs() - started) / 1000);
  }

  private async handle(r: CycleResult): Promise<void> {
    if (r.kind === 'timeout') {
      colPollTimeouts.inc({ device: this.device });
      return;
    }
    for (const q of r.entry.q) colPointsByQuality.inc({ quality: String(q) });
    const { entry, skipped } = applyDeadband(r.entry, (id) => this.deadbands.get(id) ?? 0, this.filter);
    if (skipped > 0) colDeadbandSkipped.inc({ device: this.device }, skipped);
    if (entry.tg.length === 0) return; // 전부 생략 — 엔트리 없음 · s를 쓰지 않는다
    this.seq += 1;
    const payload = encodeEntry({ ...entry, s: this.seq });
    // 발행 시도 수로 센다(생략분 제외) — 아래에서 버린 엔트리가 points_emitted − tag_raw 차로 드러난다
    pointsEmitted.inc({ device: this.device }, entry.tg.length);
    try {
      this.lastBacklog = (await this.buffer.publish(payload)).backlog;
    } catch (e) {
      // 스풀(COL-09)은 S6이다. XADD 실패를 삼키지 않고 경고로 남기고 이 엔트리는 버린다.
      // 버린 사실은 points_emitted와 tag_raw count의 차 · scan_seq의 빈 번호로 드러난다.
      this.log.warn(`XADD 실패 — 엔트리 s=${this.seq} 버림(스풀 없음 · S6): ${errorText(e)}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running) return resolve();
      const s: Sleeper = {
        timer: setTimeout(
          () => {
            this.sleepers.delete(s);
            resolve();
          },
          Math.max(0, ms),
        ),
        resolve,
      };
      this.sleepers.add(s);
    });
  }

  private wakeAll(): void {
    for (const s of this.sleepers) {
      clearTimeout(s.timer);
      s.resolve();
    }
    this.sleepers.clear();
  }

  private closeClient(): void {
    const c = this.client;
    this.client = null;
    if (c) c.close(() => undefined);
  }
}
