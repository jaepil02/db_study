// SIM — 수집 정의의 시뮬레이션 설비(modbus_config.host가 루프백)마다 포트 하나를 연다
// 포트 · 레지스터 주소는 COL과 같은 수집 정의 사본에서 안다(modbus_config.port · tag_master.address · function_code).
// 기동 실패는 SIM이 오류를 내지 않는다 — 기동 로그와 sim_listen_failed_ports로 남기고 COL 쪽 결측으로 드러난다(REQ-SIM-03).
// 주입 계획(SIM_FAULT_PLAN)은 검증 실패면 기동을 거부한다(09_tech_stack/05) — 스키마는 모듈 초기화, 시드 포트 규칙은 기동 로드 뒤.
// 포트를 여닫는 것은 설비 가동 스위치다(plant/plant-runtime · D-16) — 켜면 start(사본) · 끄면 stop. 기동만으로는 포트를 열지 않는다.
// 계획 파일의 스키마 · 포트 검증은 설비 가동과 무관하게 기동에서 한다 — 설정 오류는 스위치를 켜기 전에 드러난다.
// 주입 시간표의 기준(시작 오프셋 0)은 포트를 연 시각 — 설비 가동을 켤 때마다 다시 선다.

import type { SimFaultPlanBody } from '@db-study/shared';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Gauge } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { type DeviceDef, wordsOf } from '../collector/collect-definition';
import { CollectDefinitionService } from '../collector/collect-definition.service';
import { DeviceSimServer } from './device-sim-server';
import { assertPlanPorts, FaultSchedule, loadFaultPlan } from './fault-plan';

/** 포트 대역 5020~5119(1계층 구조값 · 100 = 티어 L 설비 수) — 밖이면 경고만 한다(포트 정본은 modbus_config.port) */
export const SIM_PORT_MIN = 5020;
export const SIM_PORT_MAX = 5119;

const listenFailedPorts = new Gauge({
  name: 'sim_listen_failed_ports',
  help: '기동 실패한 SIM 포트 수',
  registers: [appRegistry],
});
listenFailedPorts.set(0);

let schedule = FaultSchedule.empty();
new Gauge({
  name: 'sim_fault_injection_active',
  help: '지금 적용 중인 주입 계획(종류별 0 · 1)',
  labelNames: ['kind'],
  registers: [appRegistry],
  collect() {
    const active = schedule.activeKinds();
    for (const kind of ['delay', 'exception'] as const) this.set({ kind }, active.has(kind) ? 1 : 0);
  },
});

/** 영역별 레지스터 수 — 그 function_code 태그의 (address + 폭) 최댓값 */
export function areaWords(d: DeviceDef, fc: 3 | 4): number {
  return d.tags.filter((t) => t.functionCode === fc).reduce((n, t) => Math.max(n, t.address + wordsOf(t)), 0);
}

@Injectable()
export class PlcSimService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('PlcSim');
  private readonly servers = new Map<number, DeviceSimServer>();
  private plan: SimFaultPlanBody | null = null;
  /** 포트 여닫기 직렬화 — 켜기 · 끄기가 겹쳐도 앞 전환이 끝난 뒤 다음을 한다 */
  private chain: Promise<void> = Promise.resolve();
  private running = false;

  constructor(
    private readonly definitions: CollectDefinitionService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  /** 계획 파일 · 스키마 검증 — 던지면 Nest 기동이 실패한다(기동 거부) */
  onModuleInit() {
    if (!this.cfg.simFaultPlan) return;
    this.plan = loadFaultPlan(this.cfg.simFaultPlan);
    this.log.log(
      `주입 계획 ${this.cfg.simFaultPlan} — ${this.plan.faults.length}건${this.plan.note ? ` · ${this.plan.note}` : ''}`,
    );
  }

  /** 계획이 있으면 기동 로드 뒤 "시드된 설비 포트 안"을 검사한다 — 어기면 기동 거부(설비 가동과 무관) */
  onApplicationBootstrap() {
    const plan = this.plan;
    if (!plan) return;
    void this.definitions.whenLoaded().then((defs) => {
      try {
        assertPlanPorts(plan, new Set(defs.filter((d) => d.simulated).map((d) => d.port)));
      } catch (e) {
        this.refuse(e);
      }
    });
  }

  /** 포트를 연다(설비 가동 켬) — 이미 열려 있으면 그대로 · 끝나면 풀린다(모드 A가 그 뒤 Buffer를 받는다) */
  start(defs: readonly DeviceDef[]): Promise<void> {
    return this.serialize(async () => {
      if (this.running) return;
      this.running = true;
      await this.startServers(defs);
    });
  }

  /** 포트를 닫는다(설비 가동 끔) — 열린 연결을 끊고 주입 시간표를 비운다 · 이미 닫혀 있으면 그대로 */
  stop(): Promise<void> {
    return this.serialize(async () => {
      if (!this.running) return;
      this.running = false;
      await this.closeServers();
    });
  }

  private serialize(fn: () => Promise<void>): Promise<void> {
    const p = this.chain.then(fn);
    this.chain = p.catch(() => undefined);
    return p;
  }

  private async closeServers(): Promise<void> {
    schedule = FaultSchedule.empty();
    await Promise.all([...this.servers.values()].map((s) => s.close()));
    this.servers.clear();
    listenFailedPorts.set(0);
  }

  private async startServers(defs: readonly DeviceDef[]): Promise<void> {
    const sims = defs.filter((d) => d.simulated); // 실설비는 LAN 너머 — SIM이 띄울 대상이 아니다
    let failed = 0;
    for (const d of sims) {
      if (d.port < SIM_PORT_MIN || d.port > SIM_PORT_MAX)
        this.log.warn(`설비 ${d.deviceId} 포트 ${d.port} — 대역 ${SIM_PORT_MIN}~${SIM_PORT_MAX} 밖`);
      const srv = new DeviceSimServer({
        holdingWords: areaWords(d, 3),
        inputWords: areaWords(d, 4),
        // 계획 시간표는 포트 기동이 끝난 뒤에 선다 — 그 전 요청은 빈 시간표(주입 없음)를 본다
        faultFor: (start, count) => schedule.match(d.port, start, count),
      });
      try {
        await srv.listen(d.port);
        this.servers.set(d.deviceId, srv);
      } catch (e) {
        failed += 1;
        this.log.warn(
          `포트 ${d.port} 기동 실패(설비 ${d.deviceId}) — ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    listenFailedPorts.set(failed);
    // 시작 오프셋의 기준 = 포트 기동 완료 시각("기동 뒤 언제 켜고" — 06_pipeline/10 §SIM 주입 제어)
    if (this.plan) schedule = new FaultSchedule(this.plan.faults, Date.now());
    this.log.log(`Modbus 서버 ${this.servers.size}개 기동 · 실패 ${failed}`);
  }

  /** 기동 거부 — 기동 로드 뒤라 예외로 Nest 기동을 막을 수 없다. 종료 신호로 정상 종료 훅을 태우고 종료 코드 1을 남긴다 */
  private refuse(e: unknown): void {
    this.log.error(`기동 거부 — ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
    process.kill(process.pid, 'SIGTERM');
  }

  async onModuleDestroy() {
    await this.stop();
  }

  /** 열린 Modbus 서버 수 — 설비 가동이 꺼져 있으면 0 */
  serverCount(): number {
    return this.servers.size;
  }

  /** 설비의 레지스터 영역 — 모드 A 전용 쓰기 자리 · 서버가 없으면 null */
  area(deviceId: number, fc: number): Buffer | null {
    const s = this.servers.get(deviceId);
    if (!s) return null;
    return fc === 4 ? s.input : s.holding;
  }
}
