import { Module } from '@nestjs/common';
import { PlcSimModule } from '../../plc-sim/plc-sim.module';
import { ModeAService } from './mode-a.service';

/** GEN 모드 A — PlcSim 레지스터 갱신(GEN-05) · SIM · COL과 한 프로세스(ADR-22) · 켜고 끄기는 plant/plant-runtime */
@Module({
  imports: [PlcSimModule],
  providers: [ModeAService],
  exports: [ModeAService],
})
export class DatagenModeAModule {}
