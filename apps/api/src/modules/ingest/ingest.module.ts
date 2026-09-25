// ING — Stream 소비 · 창 정렬 배치 · tag_raw 삽입 · 재시도 · DLQ · 회수 · 대조군 · XACK · 최신값(ING-01~08 · 11 · 12 — S2 · S3)
// 스위치 포트 구현은 모듈 초기화 때 한 번 고른다 — 경로 안 분기를 두지 않는다(ADR-08).
// 포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md(SW-08 BatchTokenPort · SW-09 ControlTableSinkPort · SW-11 LatestValueWritePort)
import { Logger, Module } from '@nestjs/common';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { DurableKeyClient } from '../../common/redis/durable-key-client';
import { FanoutPublisher } from '../../common/redis/fanout-publisher';
import { type AppConfig, INGEST_BATCH_PLANS, requireStoreUrls } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import {
  BATCH_TOKEN_PORT,
  type BatchTokenPort,
  DeterministicBatchToken,
  NoBatchToken,
} from './batch-token.port';
import {
  CONTROL_TABLE_SINK_PORT,
  type ControlTableSinkPort,
  controlCopyTimeoutMs,
  NoopControlSink,
  PostgresControlSink,
} from './control-table-sink.port';
import { IngestService } from './ingest.service';
import { labFaultState, labFaultWarning } from './lab-fault';
import {
  IngestLatestValueWriter,
  LATEST_VALUE_WRITE_PORT,
  type LatestValueWritePort,
} from './latest-value-write.port';

/** SW-11 collector는 S6 — ingest를 주입하고 이 경고를 싣는다(등록값은 실제 주입값 ingest) */
export const SW11_COLLECTOR_WARNING = 'collector_writer_not_implemented_s6';

/** SW-08 — on 결정적 토큰 · off 토큰 없음 + deduplicate_insert disable. 결함 주입이 켜져 있으면 경고로 드러낸다 */
export function batchTokenFactory(cfg: AppConfig, reg: SwitchRegistry): BatchTokenPort {
  const value = cfg.switches['SW-08'];
  const impl: BatchTokenPort = value === 'on' ? new DeterministicBatchToken() : new NoBatchToken();
  const fault = labFaultState(cfg.ingestLabFault);
  if (fault === 'already_fired') {
    new Logger('IngestLabFault').warn(
      'INGEST_LAB_FAULT — 발동 표지가 이미 있다(lab_fault_already_fired) · 이번 기동은 결함 주입 비활성',
    );
  }
  reg.register('SW-08', value, impl.implName, labFaultWarning(fault));
  return impl;
}

/** SW-09 — on PostgreSQL 대조군 COPY(전용 커넥션) · off 아무것도 하지 않는다(기본) */
export function controlSinkFactory(cfg: AppConfig, reg: SwitchRegistry): ControlTableSinkPort {
  const value = cfg.switches['SW-09'];
  const log = new Logger('ControlTableSink');
  const impl: ControlTableSinkPort =
    value === 'on'
      ? new PostgresControlSink(
          requireStoreUrls(cfg).postgresUrl,
          { error: (s) => log.error(s), warn: (s) => log.warn(s) },
          controlCopyTimeoutMs(INGEST_BATCH_PLANS[cfg.ingestBatchPlan].windowMs),
        )
      : new NoopControlSink();
  reg.register('SW-09', value, impl.implName);
  return impl;
}

/** SW-11 — ingest만 구현(S3) · collector가 와도 ingest를 주입하고 경고한다 */
export function latestWriterFactory(
  cfg: AppConfig,
  reg: SwitchRegistry,
  durable: DurableKeyClient,
  fanout: FanoutPublisher,
): LatestValueWritePort {
  const log = new Logger('LatestValueWriter');
  const requested = cfg.switches['SW-11'];
  if (requested === 'collector') {
    log.warn(
      'LATEST_VALUE_WRITER(SW-11)=collector — S3에는 CollectorLatestValueWriter가 없어 IngestLatestValueWriter(ingest)를 주입한다(비교는 S6)',
    );
  }
  const impl = new IngestLatestValueWriter(durable, fanout, (s) => log.warn(s));
  reg.register('SW-11', 'ingest', impl.implName, requested === 'collector' ? SW11_COLLECTOR_WARNING : null);
  return impl;
}

@Module({
  providers: [
    { provide: BATCH_TOKEN_PORT, useFactory: batchTokenFactory, inject: [APP_CONFIG, SwitchRegistry] },
    {
      provide: CONTROL_TABLE_SINK_PORT,
      useFactory: controlSinkFactory,
      inject: [APP_CONFIG, SwitchRegistry],
    },
    {
      provide: LATEST_VALUE_WRITE_PORT,
      useFactory: latestWriterFactory,
      inject: [APP_CONFIG, SwitchRegistry, DurableKeyClient, FanoutPublisher],
    },
    IngestService,
  ],
})
export class IngestModule {}
