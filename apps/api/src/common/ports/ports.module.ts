import { Global, Logger, Module } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { FanoutPublisher } from '../redis/fanout-publisher';
import {
  DirectGatewayFanout,
  REALTIME_FANOUT_PORT,
  type RealtimeFanoutPort,
  RedisPubSubFanout,
} from './realtime-fanout.port';
import { SwitchRegistry } from './switch-registry';

/** SW-06 — off는 게이트웨이와 한 프로세스(APP_ROLE all)일 때만 뜻이 있다(제약 #6) · 다른 역할이면 on을 주입하고 경고한다 */
export function realtimeFanoutFactory(
  cfg: AppConfig,
  reg: SwitchRegistry,
  fanout: FanoutPublisher,
): RealtimeFanoutPort {
  const requested = cfg.switches['SW-06'];
  const direct = requested === 'off' && cfg.appRole === 'all';
  if (requested === 'off' && !direct)
    new Logger('RealtimeFanout').warn(
      `REDIS_PUBSUB_FANOUT(SW-06)=off — APP_ROLE ${cfg.appRole}는 게이트웨이와 다른 프로세스일 수 있어 RedisPubSubFanout을 주입한다(제약 #6)`,
    );
  const impl: RealtimeFanoutPort = direct ? new DirectGatewayFanout() : new RedisPubSubFanout(fanout);
  reg.register(
    'SW-06',
    direct ? 'off' : 'on',
    impl.implName,
    requested === 'off' && !direct ? 'combo_6_role_not_all' : null,
  );
  return impl;
}

/** SW-06 포트 — 저장소를 쓰는 역할에만 싣는다(발행 래퍼가 Redis 연결을 요구한다) */
@Global()
@Module({
  providers: [
    {
      provide: REALTIME_FANOUT_PORT,
      useFactory: realtimeFanoutFactory,
      inject: [APP_CONFIG, SwitchRegistry, FanoutPublisher],
    },
  ],
  exports: [REALTIME_FANOUT_PORT],
})
export class RealtimeFanoutModule {}

/** 스위치의 물리적 자리(04_architecture/02 §리포지터리 구조 common/ports) */
@Global()
@Module({ providers: [SwitchRegistry], exports: [SwitchRegistry] })
export class PortsModule {}
