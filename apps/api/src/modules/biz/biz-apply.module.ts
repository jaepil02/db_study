// 업무 명령 적용 쪽 — BIZ_HANDLERS(kind 14 → 기존 쓰기 서비스) · 원장 BizLedger. 컨트롤러가 없다.
// 명령 워커(BizWorkerModule · worker · all)와 SW-12 direct 포트(BizWriteModule · api · all)가 이 모듈을 import한다.
import { Module } from '@nestjs/common';
import { AlarmWriteModule } from '../alarm/api/alarm-api.module';
import { MasterWriteModule } from '../master/master.module';
import { BIZ_HANDLERS } from './biz-contracts';
import { BizHandlersImpl } from './biz-handlers';
import { BizLedger } from './biz-ledger';

@Module({
  imports: [MasterWriteModule, AlarmWriteModule],
  providers: [BizLedger, { provide: BIZ_HANDLERS, useClass: BizHandlersImpl }],
  exports: [BizLedger, BIZ_HANDLERS],
})
export class BizApplyModule {}
