// TSQ — 시계열 조회 raw 고정 · 조회 캐시(TSQ-01 · 04 — S2)
// SW-03 포트 구현은 모듈 초기화 때 한 번 고른다(ADR-08).
import { Module } from '@nestjs/common';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { WorkerPool } from '../../common/workers/worker-pool';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { TimeseriesController } from './timeseries.controller';
import { TimeseriesService } from './timeseries.service';
import {
  NoopTimeseriesCache,
  RedisTimeseriesCache,
  TIMESERIES_CACHE_PORT,
  type TimeseriesCachePort,
} from './timeseries-cache.port';

@Module({
  controllers: [TimeseriesController],
  providers: [
    {
      provide: TIMESERIES_CACHE_PORT,
      inject: [APP_CONFIG, SwitchRegistry, CacheKeyClient, WorkerPool],
      useFactory: (cfg: AppConfig, reg: SwitchRegistry, cache: CacheKeyClient, workers: WorkerPool) => {
        const value = cfg.switches['SW-03'];
        const impl: TimeseriesCachePort =
          value === 'on' ? new RedisTimeseriesCache(cache, workers) : new NoopTimeseriesCache();
        reg.register('SW-03', value, impl.implName);
        return impl;
      },
    },
    TimeseriesService,
  ],
})
export class TimeseriesModule {}
