import { Logger, Module } from '@nestjs/common';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { DurableKeyClient } from '../../common/redis/durable-key-client';
import { type AppConfig, requireStreamMaxlen } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { CollectDefinitionModule } from './collect-definition.module';
import { CollectorService } from './collector.service';
import {
  DEADBAND_FILTER_PORT,
  type DeadbandFilterPort,
  PassthroughFilter,
  TagDeadbandFilter,
} from './deadband-filter';
import { POINT_BUFFER_PORT, type PointBufferPort } from './point-buffer.port';
import { RedisStreamBuffer } from './redis-stream-buffer';

/**
 * SW-01 포트 선택 — 모듈 초기화에서 구현 하나를 고른다(ADR-08 · 경로 안 분기 없음).
 * S2에는 off 구현(InProcessQueueBuffer · S6)이 없어 off가 와도 on 구현을 주입하고 경고한다 — 등록값은 실제 주입값 on.
 */
function pointBufferFactory(
  cfg: AppConfig,
  switches: SwitchRegistry,
  durable: DurableKeyClient,
): PointBufferPort {
  if (cfg.switches['SW-01'] === 'off') {
    new Logger('Collector').warn(
      'REDIS_STREAM_BUFFER(SW-01)=off — S2에는 InProcessQueueBuffer가 없어 RedisStreamBuffer(on)를 주입한다(off 실험은 S6)',
    );
  }
  const buffer = new RedisStreamBuffer(durable, requireStreamMaxlen(cfg));
  switches.register('SW-01', 'on', 'RedisStreamBuffer', null);
  return buffer;
}

/** SW-10 포트 선택 — on = TagDeadbandFilter · off(기본) = PassthroughFilter(02_features/13 · 04_architecture/02) */
export function deadbandFilterFactory(cfg: AppConfig, switches: SwitchRegistry): DeadbandFilterPort {
  const on = cfg.switches['SW-10'] === 'on';
  switches.register('SW-10', on ? 'on' : 'off', on ? 'TagDeadbandFilter' : 'PassthroughFilter');
  return on ? new TagDeadbandFilter() : new PassthroughFilter();
}

/** COL — 수집 정의 로드 · 폴링 · 블록 병합 · 디코딩 · 품질 · 데드밴드 · 발행(COL-01~07) */
@Module({
  imports: [CollectDefinitionModule],
  providers: [
    {
      provide: POINT_BUFFER_PORT,
      useFactory: pointBufferFactory,
      inject: [APP_CONFIG, SwitchRegistry, DurableKeyClient],
    },
    {
      provide: DEADBAND_FILTER_PORT,
      useFactory: deadbandFilterFactory,
      inject: [APP_CONFIG, SwitchRegistry],
    },
    CollectorService,
  ],
  exports: [CollectorService],
})
export class CollectorModule {}
