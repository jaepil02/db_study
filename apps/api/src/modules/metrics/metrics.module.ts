// OBS — health · /metrics · E2E 게이지(OBS-01 · 04 · 05 · 06 — S2). 각 도메인 모듈이 자기 계측을 등록하고 OBS는 모으기만 한다(REQ-OBS-02).
import { Inject, Module } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { E2eGaugeService } from './e2e-gauge.service';
import { HealthService } from './health.service';
import { MetricsController } from './metrics.controller';
import { installEventLoopP95, installRunInfo } from './obs.metrics';

@Module({ controllers: [MetricsController], providers: [HealthService, E2eGaugeService] })
export class MetricsModule {
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    installEventLoopP95();
    installRunInfo(cfg);
  }
}
