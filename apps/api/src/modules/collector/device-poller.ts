// 설비 하나의 폴링 루프(COL-02) — 설비당 Modbus 연결 1 · 루프 1(S2) · scan_rate_ms 주기
// 루프 예외는 이 설비 루프만 재기동한다(REQ-COL-14) — 다른 설비 · 조회 API는 영향받지 않는다.
import { encodeEntry } from '@db-study/shared';
import { Logger } from '@nestjs/common';
import ModbusRTU from 'modbus-serial';
import { LATENCY_BUCKETS_SECONDS } from '../../common/metrics/registry';
import type { GroupBacklog } from '../../common/redis/durable-key-client';
import type { DeviceDef } from './collect-definition';
import {
  colModbusRtt,
  colPointsByQuality,
  colPolls,
  colPollTimeouts,
  pointsEmitted,
  pollDuration,
} from './collector-metrics';
import type { PointBufferPort } from './point-buffer.port';
import { type Clock, type CycleResult, errorText, runCycle, systemClock } from './poll-cycle';

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

export class DevicePoller {
  private readonly log: Logger;
  private readonly device: string;
  private running = false;
  private client: ModbusRTU | null = null;
  private wake: (() => void) | null = null;
  private timer: NodeJS.Timeout | null = null;
  private done: Promise<void> = Promise.resolve();
  /** 설비별 사이클 일련번호 — 기동 때 1부터(재기동 재시작 허용 · 06_pipeline/12 §3단계 s) */
  private seq = 0;
  /**
   * 마지막 발행 뒤의 grp:ingest 적체 — 보관만 한다. 백프레셔 단계 반응(경고 · 위험 · 스풀)은 S6이다.
   */
  lastBacklog: GroupBacklog | null = null;

  constructor(
    private readonly def: DeviceDef,
    private readonly buffer: PointBufferPort,
    private readonly clock: Clock = systemClock,
  ) {
    this.log = new Logger(`Collector:${def.deviceCode}`);
    this.device = String(def.deviceId);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.done = this.supervise();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wake?.();
    this.closeClient(); // 진행 중 요청을 끊는다 — 응답 · 타임아웃을 기다리지 않는다
    await this.done;
  }

  /** 재기동 감독 — 루프가 던지면 연결을 닫고 잠시 뒤 새 연결로 다시 돈다 */
  private async supervise(): Promise<void> {
    while (this.running) {
      try {
        await this.loop();
      } catch (e) {
        if (this.running) this.log.warn(`폴링 루프 예외 — ${LOOP_RESTART_MS} ms 뒤 재기동: ${errorText(e)}`);
      } finally {
        this.closeClient();
      }
      if (this.running) await this.sleep(LOOP_RESTART_MS);
    }
  }

  private async loop(): Promise<void> {
    const client = new ModbusRTU();
    this.client = client;
    await client.connectTCP(this.def.host, { port: this.def.port });
    client.setID(this.def.unitId);
    client.setTimeout(this.def.timeoutMs);
    this.log.log(
      `연결 — ${this.def.host}:${this.def.port} · 블록 ${this.def.blocks.length} · 주기 ${this.def.scanRateMs} ms`,
    );
    let next = this.clock.monoMs();
    while (this.running) {
      await this.cycle(client);
      // 주기 고정 — 사이클이 주기를 넘기면 밀린 틱을 몰아 돌지 않고 곧바로 다음 사이클로 간다
      next += this.def.scanRateMs;
      const now = this.clock.monoMs();
      if (next < now) next = now;
      await this.sleep(next - now);
    }
  }

  private async cycle(client: ModbusRTU): Promise<void> {
    const started = this.clock.monoMs();
    colPolls.inc({ device: this.device });
    const r = await runCycle(client, this.def, this.clock);
    for (const s of r.rtts) colModbusRtt.observe(Number.isFinite(s) ? s : RTT_TIMEOUT_OBSERVATION_SECONDS);
    await this.handle(r);
    pollDuration.observe({ device: this.device }, (this.clock.monoMs() - started) / 1000);
  }

  private async handle(r: CycleResult): Promise<void> {
    if (r.kind === 'timeout') {
      colPollTimeouts.inc({ device: this.device });
      return;
    }
    if (r.kind === 'nonfinite') {
      this.log.warn(
        `비유한 값 — 태그 ${r.tagId} raw ${r.raw} · 이 사이클을 발행하지 않는다(S2 결함 신호 · BAD_RANGE는 S3)`,
      );
      return;
    }
    const { entry } = r;
    for (const q of entry.q) colPointsByQuality.inc({ quality: String(q) });
    this.seq += 1;
    const payload = encodeEntry({ ...entry, s: this.seq });
    // 발행 시도 수로 센다 — 아래에서 버린 엔트리가 points_emitted − tag_raw 차로 드러난다
    pointsEmitted.inc({ device: this.device }, entry.tg.length);
    try {
      this.lastBacklog = (await this.buffer.publish(payload)).backlog;
    } catch (e) {
      // S2 한계 — 스풀(COL-09)은 S6이다. XADD 실패를 삼키지 않고 경고로 남기고 이 엔트리는 버린다.
      // 버린 사실은 points_emitted와 tag_raw count의 차 · scan_seq의 빈 번호로 드러난다.
      this.log.warn(`XADD 실패 — 엔트리 s=${this.seq} 버림(스풀 없음 · S6): ${errorText(e)}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running) return resolve();
      this.wake = () => {
        if (this.timer) clearTimeout(this.timer);
        this.wake = null;
        resolve();
      };
      this.timer = setTimeout(() => this.wake?.(), Math.max(0, ms));
    });
  }

  private closeClient(): void {
    const c = this.client;
    this.client = null;
    if (c) c.close(() => undefined);
  }
}
