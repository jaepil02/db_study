// RLT — 최신값 표면 · WebSocket 게이트웨이(RLT-01 · 03 · 04 · 05 — S2)
// SW-02 포트 구현은 모듈 초기화 때 한 번 고른다 — 조회 경로 안에 if를 두지 않는다(ADR-08).
import { Module } from '@nestjs/common';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { DurableKeyClient } from '../../common/redis/durable-key-client';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { MasterModule } from '../master/master.module';
import {
  ClickHouseLatestValueReader,
  LATEST_VALUE_READ_PORT,
  type LatestValueReadPort,
  RedisLatestValueReader,
} from './latest-value-read.port';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';
import { RESTORE_WINDOW_MINUTES, RealtimeService } from './realtime.service';

@Module({
  imports: [MasterModule],
  controllers: [RealtimeController],
  providers: [
    {
      provide: LATEST_VALUE_READ_PORT,
      inject: [APP_CONFIG, SwitchRegistry, DurableKeyClient, ClickHouse],
      useFactory: (cfg: AppConfig, reg: SwitchRegistry, durable: DurableKeyClient, ch: ClickHouse) => {
        const value = cfg.switches['SW-02'];
        const impl: LatestValueReadPort =
          value === 'on'
            ? new RedisLatestValueReader(durable)
            : new ClickHouseLatestValueReader(ch, RESTORE_WINDOW_MINUTES);
        reg.register('SW-02', value, impl.implName);
        return impl;
      },
    },
    RealtimeService,
    RealtimeGateway,
  ],
})
export class RealtimeModule {}
