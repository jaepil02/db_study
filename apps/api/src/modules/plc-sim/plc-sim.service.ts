// SIM 기동 — 기동 로드 결과의 시뮬레이션 설비(modbus_config.host가 루프백)마다 포트 하나를 연다
// 포트 · 레지스터 주소는 COL과 같은 기동 로드 사본에서 안다(modbus_config.port · tag_master.address · function_code).
// 기동 실패는 SIM이 오류를 내지 않는다 — 기동 로그와 sim_listen_failed_ports로 남기고 COL 쪽 결측으로 드러난다(REQ-SIM-03).
// 주입 계획(SIM_FAULT_PLAN)은 검증 실패면 기동을 거부한다(09_tech_stack/05) — 스키마는 모듈 초기화, 시드 포트 규칙은 기동 로드 뒤.

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
  private resolveStarted!: () => void;
  private readonly started = new Promise<void>((r) => {
    this.resolveStarted = r;
  });

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

  onApplicationBootstrap() {
    void this.definitions.whenLoaded().then((defs) => this.startServers(defs));
  }

  private async startServers(defs: DeviceDef[]): Promise<void> {
    const sims = defs.filter((d) => d.simulated); // 실설비는 LAN 너머 — SIM이 띄울 대상이 아니다
    if (this.plan) {
      try {
        assertPlanPorts(this.plan, new Set(sims.map((d) => d.port)));
      } catch (e) {
        return this.refuse(e);
      }
    }
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
    this.resolveStarted();
  }

  /** 기동 거부 — 기동 로드 뒤라 예외로 Nest 기동을 막을 수 없다. 종료 신호로 정상 종료 훅을 태우고 종료 코드 1을 남긴다 */
  private refuse(e: unknown): void {
    this.log.error(`기동 거부 — ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
    process.kill(process.pid, 'SIGTERM');
  }

  async onModuleDestroy() {
    schedule = FaultSchedule.empty();
    await Promise.all([...this.servers.values()].map((s) => s.close()));
  }

  /** 포트 기동이 끝나면 풀린다 — 모드 A가 Buffer를 받기 전에 기다린다 */
  whenStarted(): Promise<void> {
    return this.started;
  }

  /** 설비의 레지스터 영역 — 모드 A 전용 쓰기 자리 · 서버가 없으면 null */
  area(deviceId: number, fc: number): Buffer | null {
    const s = this.servers.get(deviceId);
    if (!s) return null;
    return fc === 4 ? s.input : s.holding;
  }
}
