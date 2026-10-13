import { Global, Module } from '@nestjs/common';
import { PLANT_POWER_PORT } from './plant-power.port';
import { PlantPowerService } from './plant-power.service';
import { SensorPurgeLock } from './sensor-purge-lock';

/**
 * 설비 가동 상태 읽기 · 쓰기(Redis ctl:plant:power) — 모든 역할에 싣는다(app.module 공통).
 * 전역이라 PLANT_POWER_PORT를 어느 모듈에서나 주입받는다(runs의 센서 데이터 지우기 · plant 표면 · plant-runtime).
 * 센서 데이터 지우기 잠금(SensorPurgeLock)도 여기서 하나만 만든다 — 설비 켜기(이 모듈)와 지우기 · 실행 시작(runs)이 같은 인스턴스를 본다.
 */
@Global()
@Module({
  providers: [
    SensorPurgeLock,
    PlantPowerService,
    { provide: PLANT_POWER_PORT, useExisting: PlantPowerService },
  ],
  exports: [PlantPowerService, PLANT_POWER_PORT, SensorPurgeLock],
})
export class PlantPowerModule {}
