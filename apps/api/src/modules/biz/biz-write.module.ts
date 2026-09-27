// 업무 쓰기 포트(SW-12) · 명령 조회 표면 — HTTP 표면이라 api · all 역할만 싣는다(명령 워커는 BizWorkerModule · all · worker)
// 스위치 포트 구현은 모듈 초기화 때 한 번 고른다 — 경로 안 분기를 두지 않는다(ADR-08 · 정본 docs/02_features/13_switch_matrix.md SW-12).
import { Global, Module } from '@nestjs/common';
import { FlowPublisher } from '../../common/flow/flow-publisher';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { RedisConnections } from '../../common/redis/connections';
import { DurableKeyClient } from '../../common/redis/durable-key-client';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { BizApplyModule } from './biz-apply.module';
import { BIZ_HANDLERS, BIZ_WRITE_PORT, type BizHandlers, type BizWritePort } from './biz-contracts';
import { CommandLookup, CommandsController } from './commands.controller';
import { DirectBizWriter } from './direct-biz-writer';
import { StreamBizWriter } from './stream-biz-writer';

/**
 * SW-12 — stream 명령 스트림 + 워커 결과 대기(기본) · direct 옛 경로(api 직접 커밋).
 * stream은 worker 역할이 도는 구성(all · api + worker)에서만 뜻이 있다(제약 #10) — api 역할만으로는 worker 컨테이너 유무를 알 수 없어 경고하지 않는다.
 */
export function bizWritePortFactory(
  cfg: AppConfig,
  reg: SwitchRegistry,
  durable: DurableKeyClient,
  conns: RedisConnections,
  lookup: CommandLookup,
  handlers: BizHandlers,
  flow: FlowPublisher,
): BizWritePort {
  const value = cfg.switches['SW-12'];
  let impl: BizWritePort;
  if (value === 'direct') {
    impl = new DirectBizWriter(handlers, flow);
  } else {
    const stream = new StreamBizWriter(durable, lookup);
    stream.listen(conns.subscriberConnection());
    impl = stream;
  }
  reg.register('SW-12', value, impl.implName);
  return impl;
}

@Global()
@Module({
  imports: [BizApplyModule],
  controllers: [CommandsController],
  providers: [
    CommandLookup,
    {
      provide: BIZ_WRITE_PORT,
      useFactory: bizWritePortFactory,
      inject: [
        APP_CONFIG,
        SwitchRegistry,
        DurableKeyClient,
        RedisConnections,
        CommandLookup,
        BIZ_HANDLERS,
        FlowPublisher,
      ],
    },
  ],
  exports: [BIZ_WRITE_PORT],
})
export class BizWriteModule {}
