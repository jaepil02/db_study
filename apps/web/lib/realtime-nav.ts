// DSH-REALTIME 진입 · 설비 선택 — 정본 docs/08_screen/03_realtime_dashboard.md §진입 · 요소 표(사이트 · 라인 · 설비 선택기)
// 설비가 경로에 없으면 마지막으로 본 설비(브라우저 저장)를 쓰고, 그것도 없으면 설비 선택기를 연다.
import type { DeviceObjectBody } from './shared';

const LAST_DEVICE_KEY = 'db_study.realtime.lastDevice';

/** 마지막으로 본 설비 — 저장소가 막혔거나(사생활 모드) 값이 양의 정수가 아니면 null */
export function readLastDevice(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_DEVICE_KEY));
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeLastDevice(deviceId: number): void {
  try {
    localStorage.setItem(LAST_DEVICE_KEY, String(deviceId));
  } catch {
    // 저장소가 막히면 기억하지 않는다 — 다음 진입은 선택기로 간다
  }
}

/** 선택기 목록 — 라인으로 거르고(null이면 전체) 활성 설비를 앞에 · 비활성 설비는 끝에(흐리게 그린다) · 같은 활성끼리는 이름 순 */
export function orderDevices(
  devices: readonly DeviceObjectBody[],
  lineId: number | null,
): DeviceObjectBody[] {
  return devices
    .filter((d) => lineId === null || d.lineId === lineId)
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.deviceName.localeCompare(b.deviceName, 'ko') ||
        a.deviceId - b.deviceId,
    );
}
