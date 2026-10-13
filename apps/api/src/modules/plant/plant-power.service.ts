// 설비 가동 스위치 — 실행 중 켜고 끄는 상태(D-16 결정 3 · 계약 packages/shared/src/api/plant.ts PlantPower)
// 실행 중 상태 = Redis 봉인 계열 ctl:plant:power(on|off + 바뀐 시각) · 키가 없으면 기동 기본값 SENSOR_AUTOGEN(로컬 Compose off · 앱 기본 on).
// 쓰는 쪽은 표면(POST /api/v1/plant/power) 하나 · 따르는 쪽은 수집기 역할의 plant-runtime(1초마다 읽어 SIM · 모드 A · 폴링을 켜고 끈다).
// 읽기 실패(Redis 접속 불가)는 던진다 — 모르는 상태를 기본값으로 덮으면 "꺼졌다"고 거짓으로 답하게 된다(호출자가 503 · 유지로 옮긴다).
import type { PlantPowerBody } from '@db-study/shared';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { DurableKeyClient, type PlantPowerRecord } from '../../common/redis/durable-key-client';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import type { PlantPowerPort } from './plant-power.port';
import { SensorPurgeLock } from './sensor-purge-lock';

export interface PlantPowerView extends PlantPowerBody {
  /** 바뀐 시각(epoch ms) — 키가 없으면 null */
  changedAtMs: number | null;
}

function view(r: PlantPowerRecord | null, defaultOn: boolean): PlantPowerView {
  if (!r) return { on: defaultOn, changedAt: null, changedAtMs: null };
  return {
    on: r.state === 'on',
    changedAt: new Date(r.changedAtMs).toISOString(),
    changedAtMs: r.changedAtMs,
  };
}

@Injectable()
export class PlantPowerService implements PlantPowerPort {
  constructor(
    private readonly durable: DurableKeyClient,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Optional() private readonly purge: SensorPurgeLock = new SensorPurgeLock(),
  ) {}

  /** 기동 기본값 — 키가 없을 때의 상태(SENSOR_AUTOGEN) */
  defaultOn(): boolean {
    return this.cfg.sensorAutogen === 'on';
  }

  async read(): Promise<PlantPowerView> {
    return view(await this.durable.readPlantPower(), this.defaultOn());
  }

  /**
   * 켜기 · 끄기 — 지금 상태와 같으면 쓰지 않는다(바뀐 시각 유지 · 키가 없고 기본값과 같으면 키도 만들지 않는다).
   * 반영은 수집기 역할이 다음 읽기(≤ 1초)에 한다 — 응답은 "바꾸라고 적었다"이지 "포트가 다 열렸다"가 아니다.
   * 켜기는 센서 데이터를 지우는 동안 거절한다(400 · SensorPurgeLock) — 끄기는 언제나 받는다.
   */
  async set(on: boolean, nowMs = Date.now()): Promise<PlantPowerView> {
    if (!on) return this.write(false, nowMs);
    return this.purge.turningPlantOn(() => this.write(true, nowMs));
  }

  private async write(on: boolean, nowMs: number): Promise<PlantPowerView> {
    const cur = await this.read();
    if (cur.on === on) return cur;
    return view(await this.durable.writePlantPower(on ? 'on' : 'off', nowMs), this.defaultOn());
  }

  /** PLANT_POWER_PORT — 센서 데이터 지우기(runs)가 가동 중 409를 가른다 */
  async isOn(): Promise<boolean> {
    return (await this.read()).on;
  }

  /** 이번 기동은 기동 기본값부터 — 수집기 역할 기동 때 한 번(plant-runtime) */
  async resetToDefault(): Promise<void> {
    await this.durable.clearPlantPower();
  }
}
