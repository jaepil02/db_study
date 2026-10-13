// GEN 모드 A — SIM 포트가 열린 뒤 시뮬레이션 설비의 태그마다 Buffer 갱신 대상을 만들고 틱을 돈다
// 틱을 돌리고 멈추는 것은 설비 가동 스위치다(plant/plant-runtime · D-16) — 켜면 start(사본) · 끄면 stop. 기동만으로는 돌지 않는다.
// 태그 상태(누계 · 온도 · 랜덤 워크 값)는 껐다 켜도 이어 간다 — 다시 켤 때 따라 잡기는 하지 않는다(꺼진 동안은 시점이 흐르지 않은 것으로 본다).
import type { SignalProfile } from '@db-study/shared';
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Histogram } from 'prom-client';
import { appRegistry } from '../../../common/metrics/registry';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import type { DeviceDef } from '../../collector/collect-definition';
import { PlcSimService } from '../../plc-sim/plc-sim.service';
import { genPointsDropout, genPointsGenerated } from '../gen.metrics';
import { parseMix } from '../signal/assignment';
import { MODE_A_SEED, type ModeATarget, makeTarget, PROFILE_NAMES, writeTick } from './register-writer';

/**
 * 틱 간격 = 가장 짧은 scan_rate_ms ÷ 2 — 정본은 "scan_rate_ms 이하"만 정한다. 절반이면 새 시점 k가 시작된 뒤
 * 반 주기 안에 레지스터에 반영되어, 폴링이 같은 k를 두 번 읽거나 k 하나를 건너뛰는 일이 타이머 지터로는 생기지 않는다.
 */
export const MODE_A_TICK_DIVISOR = 2;

/**
 * gen_register_update_seconds — 구간 #1 신호 → 레지스터(10_observability/02 · 지연 예산 #1 · S5).
 * 이 구현은 태그마다 값을 계산하고 곧바로 쓴다 — "벡터 완료" 시점이 따로 없어 틱 한 번의 계산 + 쓰기 시간을 관측한다(쓴 태그가 있는 틱만).
 * 버킷은 원본 예산 2 ms를 경계로 포함한다(01_metrics §이름 규약 분위수 행).
 */
const registerUpdate = new Histogram({
  name: 'gen_register_update_seconds',
  help: '모드 A 틱 한 번의 신호 계산 → 레지스터 쓰기 완료(구간 #1)',
  buckets: [0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [appRegistry],
});

@Injectable()
export class ModeAService implements OnModuleDestroy {
  private readonly log = new Logger('DatagenModeA');
  private timer: NodeJS.Timeout | null = null;
  /** 태그별 상태 — 설비 가동을 껐다 켜도 이어 쓴다 */
  private readonly states = new Map<number, Float64Array>();

  constructor(
    private readonly sim: PlcSimService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  /** 틱을 시작한다 — SIM 포트가 열린 뒤(plant-runtime이 순서를 지킨다) · 이미 돌고 있으면 그대로 */
  start(defs: readonly DeviceDef[]): void {
    if (this.timer) return;
    const mix = parseMix(this.cfg.genProfile);
    const targets: ModeATarget[] = [];
    for (const d of defs) {
      for (const t of d.tags) {
        const area = this.sim.area(d.deviceId, t.functionCode);
        if (!area) break; // 실설비 · 포트 기동 실패 설비는 쓸 Buffer가 없다
        const target = makeTarget(area, t, mix, MODE_A_SEED, this.states.get(t.tagId));
        this.states.set(t.tagId, target.state);
        targets.push(target);
      }
    }
    if (targets.length === 0) {
      this.log.warn('갱신할 시뮬레이션 태그 없음 — 모드 A를 돌리지 않는다');
      return;
    }
    const minRate = Math.min(...targets.map((t) => t.tag.scanRateMs));
    const tickMs = Math.max(1, Math.floor(minRate / MODE_A_TICK_DIVISOR));
    const tick = () => {
      const t0 = performance.now();
      const r = writeTick(targets, Date.now());
      if (r.written.some((n) => n > 0)) registerUpdate.observe((performance.now() - t0) / 1000);
      r.written.forEach((n, code) => {
        if (n > 0) genPointsGenerated.inc({ mode: 'A', profile: PROFILE_NAMES[code] as SignalProfile }, n);
      });
      if (r.dropped > 0) genPointsDropout.inc({ mode: 'A' }, r.dropped);
    };
    tick();
    this.timer = setInterval(tick, tickMs);
    const kinds = targets.filter((t) => t.card).length;
    this.log.log(
      `레지스터 갱신 시작 — 태그 ${targets.length}(종류 신호 ${kinds} · 구성 ${mix} ${targets.length - kinds}) · 틱 ${tickMs} ms`,
    );
  }

  /** 틱을 멈춘다 — 상태는 남긴다 · 이미 멈춰 있으면 그대로 */
  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.log.log('레지스터 갱신 정지');
  }

  onModuleDestroy() {
    this.stop();
  }

  /** 틱이 돌고 있는가 — 설비 가동이 꺼져 있으면 false */
  ticking(): boolean {
    return this.timer !== null;
  }
}
