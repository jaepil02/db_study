// ALM 판정기 — 기동 역할 all · worker(IngestModule이 import한다 · 04_architecture/02 §APP_ROLE 배정 worker 행)
// 판정기는 프로세스 안 하나다 — worker 컨테이너 2 이상은 판정 분할 수단 전에는 두지 않는다(06_pipeline/08 §판정 경로 직렬성).
// 저장소 접근은 래퍼 3종만 — alarm:state는 DurableKeyClient(봉인) · cache:alarmrules는 CacheKeyClient(캐시) · ch:alarm은 SW-06 포트(ADR-13).
import { Inject, Injectable, Logger, Module, type OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ClickHouse } from '../../../common/clickhouse/clickhouse.module';
import { FlowPublisher } from '../../../common/flow/flow-publisher';
import { REALTIME_FANOUT_PORT, type RealtimeFanoutPort } from '../../../common/ports/realtime-fanout.port';
import { Postgres } from '../../../common/postgres/postgres.module';
import { CacheKeyClient } from '../../../common/redis/cache-key-client';
import { DurableKeyClient } from '../../../common/redis/durable-key-client';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { DeterministicBatchToken, NoBatchToken } from '../../ingest/batch-token.port';
import { STALE_MULTIPLIER } from '../../realtime/realtime.service';
import { alarmMetrics } from './alarm-eval.metrics';
import { ALARM_HANDOFF_PORT, type AlarmBatch, AlarmEvaluator, type AlarmHandoffPort } from './evaluator';
import { AlarmRuleSource, PostgresAlarmRuleDb } from './rules';
import { ClickHouseAlarmEvalSink, PostgresAlarmConfirm } from './stores';

@Injectable()
export class AlarmEvalService implements AlarmHandoffPort, OnApplicationBootstrap {
  private readonly log = new Logger('AlarmEval');
  private readonly evaluator: AlarmEvaluator;
  private readonly confirm: PostgresAlarmConfirm;
  private stopping = false;

  constructor(
    @Inject(APP_CONFIG) cfg: AppConfig,
    pg: Postgres,
    ch: ClickHouse,
    durable: DurableKeyClient,
    cache: CacheKeyClient,
    @Inject(REALTIME_FANOUT_PORT) fanout: RealtimeFanoutPort,
    @Optional() @Inject(FlowPublisher) flow: FlowPublisher | null = null,
  ) {
    const warn = (s: string) => this.log.warn(s);
    this.confirm = new PostgresAlarmConfirm(pg.pool, { warn });
    // 토큰 설정은 SW-08 값에 따른 같은 구현 — 등록(SwitchRegistry)은 IngestModule이 한다
    const tokens = cfg.switches['SW-08'] === 'on' ? new DeterministicBatchToken() : new NoBatchToken();
    this.evaluator = new AlarmEvaluator({
      rules: new AlarmRuleSource(
        // failed = degrade(래퍼가 가른다) — PostgreSQL 직행 · 채우지 않는다(rules.ts AlarmRuleSource)
        {
          get: () => cache.getAlarmRules(),
          set: (json) => cache.setAlarmRules(json),
        },
        new PostgresAlarmRuleDb(pg.pool),
        { warn },
      ),
      state: {
        read: (ids) => durable.readAlarmStates(ids),
        write: (states) => durable.writeAlarmStates(states),
      },
      confirm: this.confirm,
      evalSink: new ClickHouseAlarmEvalSink(ch.client, tokens),
      fanout,
      staleMultiplier: STALE_MULTIPLIER,
      sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
      stopping: () => this.stopping,
      log: { warn, error: (s) => this.log.error(s) },
      flow,
    });
  }

  handoff(batch: AlarmBatch): Promise<void> {
    return this.evaluator.handoff(batch);
  }

  /**
   * 종료 — IngestService.beforeApplicationShutdown이 마지막 인계(flusher 드레인) 뒤에 부르는 유일한 정지 경로다.
   * 여기서부터 alarm_eval 재시도를 더 기다리지 않는다(무효 구간). Nest 훅 순서에 기대지 않으려고 자체 종료 훅을 두지 않는다 —
   * 훅으로 먼저 멈추면 수집 드레인 중 마지막 배치들의 전수 재시도가 끊긴다.
   */
  drain(): Promise<void> {
    this.stopping = true;
    return this.evaluator.drain();
  }

  /** alm_active_alarms 초기값 — 심각도별 열린 행 수(이후 확정 열기 · 닫기로 증감) · 실패는 기동을 막지 않는다 */
  async onApplicationBootstrap() {
    try {
      for (const { severity, n } of await this.confirm.openCounts())
        alarmMetrics.active.set({ severity: String(severity) }, n);
    } catch (e) {
      this.log.warn(`열린 알람 수 초기화 실패 — ${(e as Error).message} · 0에서 증감한다`);
    }
  }
}

@Module({
  providers: [AlarmEvalService, { provide: ALARM_HANDOFF_PORT, useExisting: AlarmEvalService }],
  exports: [ALARM_HANDOFF_PORT],
})
export class AlarmEvalModule {}
