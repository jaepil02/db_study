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
      for (const def of defs) {
        if (def.blocks.length === 0) {
          this.log.warn(`설비 ${def.deviceId}(${def.deviceCode}) — 폴링할 태그 없음 · 루프를 띄우지 않는다`);
          continue;
        }
        const p = new DevicePoller(def, this.buffer);
        this.pollers.set(def.deviceId, p);
        p.start();
      }
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
