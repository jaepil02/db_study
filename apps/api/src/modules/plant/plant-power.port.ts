// 설비 가동 상태 읽기 포트 — PlantModule(설비 가동 · HMI 개요)이 구현해 내보내고, 센서 데이터 지우기(runs 모듈)가 읽는다(D-16 결정 3 · 5).
// 실행 중 상태는 Redis 봉인 계열 ctl:plant:power · 키가 없으면 기동 기본값(SENSOR_AUTOGEN).
export const PLANT_POWER_PORT = Symbol('PlantPowerPort');

export interface PlantPowerPort {
  /** 지금 설비 가동이 켜져 있는가 */
  isOn(): Promise<boolean>;
}
