import { Module } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MasterModule, MasterWriteModule } from './master.module';

/** MST 표면(S4) — 조회 6 · 쓰기 11. HTTP 표면이라 api · all 역할만 싣는다(collector 역할은 조회 서비스만 · 쓰기 서비스는 MasterWriteModule) */
@Module({
  imports: [MasterModule, MasterWriteModule],
  controllers: [MasterController],
})
export class MasterApiModule {}
