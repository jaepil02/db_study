// COL 기동 — 기동 로드가 끝나면 설비마다 폴링 루프 하나를 띄운다(S2 폴링 1루프)
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { GroupBacklog } from '../../common/redis/durable-key-client';
import { CollectDefinitionService } from './collect-definition.service';
import { pointsEmitted } from './collector-metrics';
import { DevicePoller } from './device-poller';
import { POINT_BUFFER_PORT, type PointBufferPort } from './point-buffer.port';

@Injectable()
export class CollectorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('Collector');
  private readonly pollers = new Map<number, DevicePoller>();
  private stopped = false;

  constructor(
    private readonly definitions: CollectDefinitionService,
    @Inject(POINT_BUFFER_PORT) private readonly buffer: PointBufferPort,
  ) {}

  onApplicationBootstrap() {
    void this.definitions.whenLoaded().then((defs) => {
      if (this.stopped) return;
      const polled = defs.filter((def) => {
        if (def.blocks.length > 0) return true;
        this.log.warn(`설비 ${def.deviceId}(${def.deviceCode}) — 폴링할 태그 없음 · 루프를 띄우지 않는다`);
        return false;
      });
      polled.forEach((def, i) => {
        // 시작 위상 = 벽시계 주기 격자 + 설비별 균등 오프셋((i + 0.5) × 주기 ÷ N) — 설비들의 발행이 창 안에 고르게 퍼지고
        // 기동마다 같은 위상이 된다. 0.5칸은 모드 A 생성기의 격자(k = floor(now ÷ 주기)) 갱신 순간과 겹치지 않게 비킨다.
        const offset = ((i + 0.5) * def.scanRateMs) / polled.length;
        const p = new DevicePoller(def, this.buffer, undefined, offset);
        this.pollers.set(def.deviceId, p);
        p.start();
      });
    });
  }

  async onModuleDestroy() {
    this.stopped = true;
    await Promise.all([...this.pollers.values()].map((p) => p.stop()));
    // 정지 시점 발행 누계 — 프로세스가 끝나면 /metrics로 읽을 수 없다. AC-01 모드 A 분모를 정지 뒤 대조에 넘긴다
    const total = (await pointsEmitted.get()).values.reduce((a, v) => a + v.value, 0);
    this.log.log(`수집 정지 — points_emitted 누계 ${total}`);
  }

  /** 설비별 마지막 적체 — 보관값(백프레셔 단계 반응은 S6) */
  lastBacklog(deviceId: number): GroupBacklog | null {
    return this.pollers.get(deviceId)?.lastBacklog ?? null;
  }
}
