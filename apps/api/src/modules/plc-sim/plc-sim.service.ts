// SIM 기동 — 기동 로드 결과의 시뮬레이션 설비(modbus_config.host가 루프백)마다 포트 하나를 연다
// 포트 · 레지스터 주소는 COL과 같은 기동 로드 사본에서 안다(modbus_config.port · tag_master.address).
// 기동 실패는 SIM이 오류를 내지 않는다 — 기동 로그와 sim_listen_failed_ports로 남기고 COL 쪽 결측으로 드러난다(REQ-SIM-03).
import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Gauge } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';
import { FLOAT32_WORDS } from '../collector/collect-definition';
import { CollectDefinitionService } from '../collector/collect-definition.service';
import { DeviceSimServer } from './device-sim-server';

/** 포트 대역 5020~5119(1계층 구조값 · 100 = 티어 L 설비 수) — 밖이면 경고만 한다(포트 정본은 modbus_config.port) */
export const SIM_PORT_MIN = 5020;
export const SIM_PORT_MAX = 5119;

const listenFailedPorts = new Gauge({
  name: 'sim_listen_failed_ports',
  help: '기동 실패한 SIM 포트 수',
  registers: [appRegistry],
});
listenFailedPorts.set(0);

@Injectable()
export class PlcSimService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('PlcSim');
  private readonly servers = new Map<number, DeviceSimServer>();
  private resolveStarted!: () => void;
  private readonly started = new Promise<void>((r) => {
    this.resolveStarted = r;
  });

  constructor(private readonly definitions: CollectDefinitionService) {}

  onApplicationBootstrap() {
    void this.definitions.whenLoaded().then(async (defs) => {
      let failed = 0;
      for (const d of defs) {
        if (!d.simulated) continue; // 실설비는 LAN 너머 — SIM이 띄울 대상이 아니다
        if (d.port < SIM_PORT_MIN || d.port > SIM_PORT_MAX)
          this.log.warn(`설비 ${d.deviceId} 포트 ${d.port} — 대역 ${SIM_PORT_MIN}~${SIM_PORT_MAX} 밖`);
        const words = d.tags.reduce((n, t) => Math.max(n, t.address + FLOAT32_WORDS), 0);
        const srv = new DeviceSimServer(words);
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
      this.log.log(`Modbus 서버 ${this.servers.size}개 기동 · 실패 ${failed}`);
      this.resolveStarted();
    });
  }

  async onModuleDestroy() {
    await Promise.all([...this.servers.values()].map((s) => s.close()));
  }

  /** 포트 기동이 끝나면 풀린다 — 모드 A가 Buffer를 받기 전에 기다린다 */
  whenStarted(): Promise<void> {
    return this.started;
  }

  /** 설비의 holding 레지스터 Buffer — 모드 A 전용 쓰기 자리 · 서버가 없으면 null */
  holding(deviceId: number): Buffer | null {
    return this.servers.get(deviceId)?.holding ?? null;
  }
}
