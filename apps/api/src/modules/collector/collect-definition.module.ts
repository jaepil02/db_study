import { Module } from '@nestjs/common';
import { MasterModule } from '../master/master.module';
import { CollectDefinitionService } from './collect-definition.service';

/** COL-01 기동 로드 — SIM · GEN 모드 A · COL이 import해 한 사본을 공유한다(한 번 읽는다) */
@Module({
  imports: [MasterModule],
  providers: [CollectDefinitionService],
  exports: [CollectDefinitionService],
})
export class CollectDefinitionModule {}
