import { Module } from '@nestjs/common';
import { InvalidationChain } from './invalidation-chain';
import { MasterController } from './master.controller';
import { MasterModule } from './master.module';
import { MasterWriteService } from './master-write.service';

/** MST 표면(S4) — 조회 6 · 쓰기 11 · 무효화 체인 ②③④. HTTP 표면이라 api · all 역할만 싣는다(collector 역할은 조회 서비스만) */
@Module({
  imports: [MasterModule],
  controllers: [MasterController],
  providers: [MasterWriteService, InvalidationChain],
})
export class MasterApiModule {}
