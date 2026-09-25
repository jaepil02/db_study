// GEN 모드 A 기동 — SIM 포트가 뜬 뒤 시뮬레이션 설비의 태그마다 Buffer 갱신 대상을 만들고 틱을 돈다
import type { SignalProfile } from '@db-study/shared';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { CollectDefinitionService } from '../../collector/collect-definition.service';
import { PlcSimService } from '../../plc-sim/plc-sim.service';
import { genPointsDropout, genPointsGenerated } from '../datagen.service';
import { parseMix } from '../signal/assignment';
import { type ModeATarget, makeTarget, PROFILE_NAMES, writeTick } from './register-writer';

/**
 * 틱 간격 = 가장 짧은 scan_rate_ms ÷ 2 — 정본은 "scan_rate_ms 이하"만 정한다. 절반이면 새 시점 k가 시작된 뒤
 * 반 주기 안에 레지스터에 반영되어, 폴링이 같은 k를 두 번 읽거나 k 하나를 건너뛰는 일이 타이머 지터로는 생기지 않는다.
 */
export const MODE_A_TICK_DIVISOR = 2;

@Injectable()
export class ModeAService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('DatagenModeA');
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly definitions: CollectDefinitionService,
    private readonly sim: PlcSimService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  onApplicationBootstrap() {
    const mix = parseMix(this.cfg.genProfile);
    void this.definitions.whenLoaded().then(async (defs) => {
      await this.sim.whenStarted();
      if (this.stopped) return;
      const targets: ModeATarget[] = [];
      for (const d of defs) {
        for (const t of d.tags) {
          const area = this.sim.area(d.deviceId, t.functionCode);
          if (!area) break; // 실설비 · 포트 기동 실패 설비는 쓸 Buffer가 없다
          targets.push(makeTarget(area, t, mix));
        }
      }
      if (targets.length === 0) {
        this.log.warn('갱신할 시뮬레이션 태그 없음 — 모드 A를 돌리지 않는다');
        return;
      }
      const minRate = Math.min(...targets.map((t) => t.tag.scanRateMs));
      const tickMs = Math.max(1, Math.floor(minRate / MODE_A_TICK_DIVISOR));
      const tick = () => {
        const r = writeTick(targets, Date.now());
        r.written.forEach((n, code) => {
          if (n > 0) genPointsGenerated.inc({ mode: 'A', profile: PROFILE_NAMES[code] as SignalProfile }, n);
        });
        if (r.dropped > 0) genPointsDropout.inc({ mode: 'A' }, r.dropped);
      };
      tick();
      this.timer = setInterval(tick, tickMs);
      this.log.log(`레지스터 갱신 시작 — 태그 ${targets.length} · 구성 ${mix} · 틱 ${tickMs} ms`);
    });
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }
}
