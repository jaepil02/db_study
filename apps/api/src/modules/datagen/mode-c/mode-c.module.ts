// GEN 모드 C 부하 주입 표면(GEN-07 · S5) — api · all 역할만 싣는다(04_architecture/02 §APP_ROLE 배정).
// 게이트 DATAGEN_BULK_ENABLED는 기동 시 1회 읽는다 — 'true'가 아니면 주입기를 만들지 않고 라우트는 404 datagen.bulk_disabled만 낸다.
// 켜진 채 기동하면 경고 로그 1줄(SW-01 off 기동 경고와 같은 방식 · health 본문은 바꾸지 않는다 — 12_security/02).
import { Logger, Module } from '@nestjs/common';
import { DurableKeyClient } from '../../../common/redis/durable-key-client';
import { type AppConfig, ConfigRejectedError, requireStreamMaxlen } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { BackpressureGate, thresholdsFor } from '../mode-b/backpressure-gate';
import { BULK_INGESTOR, BulkIngestController } from './bulk-ingest.controller';
import { BulkIngestor } from './bulk-ingestor';

export function bulkIngestorFor(cfg: AppConfig, durable: DurableKeyClient): BulkIngestor | null {
  if (!cfg.datagenBulkEnabled) return null;
  // 조합 제약 #2(02_features/13) — Stream을 끈 구성에 Stream 직결 주입은 경로가 정의되지 않는다(모드 B와 같은 거부)
  if (cfg.switches['SW-01'] === 'off')
    throw new ConfigRejectedError('SW-01 off + 모드 C는 조합 금지(#2) — DATAGEN_BULK_ENABLED를 끄고 기동');
  const maxlen = requireStreamMaxlen(cfg);
  const gate = new BackpressureGate(thresholdsFor(maxlen));
  new Logger('DatagenModeC').warn(
    `DATAGEN_BULK_ENABLED=true — 부하 주입 표면 POST /api/v1/ingest/bulk가 열려 있다(S5 무인증 · 측정 전용 · 위험 임계 ${gate.thresholds.danger})`,
  );
  return new BulkIngestor(durable, gate, maxlen);
}

@Module({
  controllers: [BulkIngestController],
  providers: [
    { provide: BULK_INGESTOR, useFactory: bulkIngestorFor, inject: [APP_CONFIG, DurableKeyClient] },
  ],
})
export class DatagenModeCModule {}
