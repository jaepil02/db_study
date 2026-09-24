import { Module } from '@nestjs/common';
import { CollectDefinitionModule } from '../collector/collect-definition.module';
import { PlcSimService } from './plc-sim.service';

/** SIM — 설비당 Modbus TCP 서버(SIM-01~03) · 포트 · 주소는 COL-01 기동 로드 사본에서 */
@Module({
  imports: [CollectDefinitionModule],
  providers: [PlcSimService],
  exports: [PlcSimService],
})
export class PlcSimModule {}
