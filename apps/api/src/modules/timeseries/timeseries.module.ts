// TSQ — 시계열 조회(TSQ-01~08) · 내보내기(TSQ-09). 스위치 포트 구현은 모듈 초기화 때 한 번 고른다(ADR-08).
// SW-03 TimeseriesCachePort · SW-04 CacheKeyNormalizerPort · SW-05 RebuildLockPort(정본 04_architecture/02).
import { Module } from '@nestjs/common';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { WorkerPool } from '../../common/workers/worker-pool';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { type CacheKeyNormalizerPort, RawTimeKeyNormalizer, TimeSnapKeyNormalizer } from './resolution';
import { TimeseriesController } from './timeseries.controller';
import { KEY_NORMALIZER_PORT, TimeseriesService } from './timeseries.service';
import {
  NoopRebuildLock,
  NoopTimeseriesCache,
  REBUILD_LOCK_PORT,
  type RebuildLockPort,
  RedisRebuildLock,
  RedisTimeseriesCache,
  TIMESERIES_CACHE_PORT,
  type TimeseriesCachePort,
} from './timeseries-cache.port';
import { TimeseriesExportService } from './timeseries-export.service';

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
    {
      provide: KEY_NORMALIZER_PORT,
      inject: [APP_CONFIG, SwitchRegistry],
      useFactory: (cfg: AppConfig, reg: SwitchRegistry) => {
        const value = cfg.switches['SW-04'];
        const impl: CacheKeyNormalizerPort =
          value === 'on' ? new TimeSnapKeyNormalizer() : new RawTimeKeyNormalizer();
        // 조합 제약 #1 — SW-03 off면 키가 쓰이지 않아 SW-04 차이가 0이다(측정 금지 조합 · 기록 판정이 거른다)
        reg.register(
          'SW-04',
          value,
          impl.implName,
          cfg.switches['SW-03'] === 'off' ? 'combo_1_query_cache_off' : null,
        );
        return impl;
      },
    },
    {
      provide: REBUILD_LOCK_PORT,
      inject: [APP_CONFIG, SwitchRegistry, CacheKeyClient],
      useFactory: (cfg: AppConfig, reg: SwitchRegistry, cache: CacheKeyClient) => {
        const value = cfg.switches['SW-05'];
        // 조합 제약 #1 — SW-03 off면 캐시가 없어 락도 쓰이지 않아야 한다(대기 50 ms × 3이 off 측정을 오염시킨다 · 검수 M1)
        const cacheOff = cfg.switches['SW-03'] === 'off';
        const impl: RebuildLockPort =
          value === 'on' && !cacheOff ? new RedisRebuildLock(cache) : new NoopRebuildLock();
        reg.register(
          'SW-05',
          value,
          impl.implName,
          cfg.switches['SW-03'] === 'off' ? 'combo_1_query_cache_off' : null,
        );
        return impl;
      },
    },
    TimeseriesService,
    TimeseriesExportService,
  ],
})
export class TimeseriesModule {}
