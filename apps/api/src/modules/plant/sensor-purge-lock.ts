// 센서 데이터 지우기 잠금(프로세스 안) — 정본 docs/05_data_stores/08_retention_lifecycle.md §센서 데이터 지우기(r5 M4)
// 지우는 동안(TRUNCATE 수 초) 새 센서 데이터를 만드는 시작을 거절한다 — 실행 시작(compare · flow)과 설비 가동 켜기.
// 반대 방향도 막는다 — 설비 켜기가 진행 중이면 지우기가 plant_running으로 거절한다(키를 쓰기 전 · 쓰는 중 둘 다).
// 표지 세우기 · 확인은 동기 구간이라 두 요청이 같은 순간에 들어와도 하나만 지나간다.
// 한계: 같은 프로세스 안에서만 본다 — APP_ROLE all(로컬 기본)과 api 역할 하나에서 맞다. api를 여러 개 띄우면 서로 모른다.
// PlantPowerModule(전역 · 모든 역할)이 싣고 내보낸다 — runs(지우기 · 실행 시작)와 plant(설비 가동 표면)가 같은 인스턴스를 본다.
import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error';

/** 지우는 중에 온 실행 시작 · 설비 켜기 — 400 common.validation_failed · fields purge enum(새 코드 없이 · M3 설비 가동 거절과 같은 결) */
export function purgeInProgressError(): ApiError {
  return new ApiError('common.validation_failed', '센서 데이터를 지우는 중이에요 — 끝난 뒤 다시 해 주세요', {
    fields: [{ path: 'purge', reason: 'enum' }],
  });
}

@Injectable()
export class SensorPurgeLock {
  private purging = false;
  private turningOn = 0;

  /** 지우는 중인가 */
  get active(): boolean {
    return this.purging;
  }

  /** 설비 켜기가 진행 중인가(키를 쓰는 중) */
  get plantTurningOn(): boolean {
    return this.turningOn > 0;
  }

  /** 지우기 시작 — 이미 지우는 중이면 false */
  tryBegin(): boolean {
    if (this.purging) return false;
    this.purging = true;
    return true;
  }

  end(): void {
    this.purging = false;
  }

  /** 실행 시작 전(동기) — 지우는 중이면 던진다 */
  assertIdle(): void {
    if (this.purging) throw purgeInProgressError();
  }

  /** 설비 켜기 — 지우는 중이면 던지고, 켜는 동안은 지우기가 plant_running으로 막힌다 */
  async turningPlantOn<T>(fn: () => Promise<T>): Promise<T> {
    this.assertIdle();
    this.turningOn += 1;
    try {
      return await fn();
    } finally {
      this.turningOn -= 1;
    }
  }
}
