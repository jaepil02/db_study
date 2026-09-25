// 실험 전용 결함 주입(EXP-13 · INGEST_LAB_FAULT) — crash-after-insert:n
// n번째 배치의 ClickHouse 삽입이 성공한 직후 · 대조군 COPY와 XACK 전에 프로세스를 끝낸다 — 크래시 재전달(같은 토큰 재삽입)을 재현한다.
// 비활성이 기본이다(환경변수 없음). 켜져 있으면 SW-08 등록 경고 lab_fault_crash_after_insert로 health에 드러난다.
// 한 번만 발동한다 — api는 restart: unless-stopped라 같은 환경변수로 재기동되어 n배치마다 다시 죽는 루프가 된다.
// 발동 직전에 표지 파일을 쓰고 fsync한 뒤 끝내며, 기동 시 표지가 있으면 비활성으로 보고 lab_fault_already_fired를 싣는다.
// 표지 삭제는 실험 러너의 복원(spooldata 비움)이 한다 — 코드는 지우지 않는다.
import { closeSync, existsSync, fsyncSync, openSync, writeSync } from 'node:fs';
import type { AppConfig } from '../../config/app-config';

export const LAB_FAULT_WARNING = 'lab_fault_crash_after_insert';
export const LAB_FAULT_ALREADY_FIRED_WARNING = 'lab_fault_already_fired';
/** SIGKILL과 같은 종료 코드 — 드레인 · 종료 훅 없이 끝난다 */
export const LAB_FAULT_EXIT_CODE = 137;
/** 발동 표지 — spooldata 볼륨(/app/spool)이라 재기동을 넘는다(리드 판정 · 경로 상수) */
export const LAB_FAULT_MARKER_PATH = '/app/spool/lab-fault-fired';

export type LabFaultState = 'off' | 'armed' | 'already_fired';

export function labFaultState(
  spec: AppConfig['ingestLabFault'],
  markerPath = LAB_FAULT_MARKER_PATH,
): LabFaultState {
  if (!spec) return 'off';
  return existsSync(markerPath) ? 'already_fired' : 'armed';
}

/** SW-08 등록 경고 — 켜짐 · 이미 발동을 health에 드러낸다 */
export function labFaultWarning(state: LabFaultState): string | null {
  if (state === 'armed') return LAB_FAULT_WARNING;
  if (state === 'already_fired') return LAB_FAULT_ALREADY_FIRED_WARNING;
  return null;
}

export interface LabFault {
  readonly enabled: boolean;
  readonly state: LabFaultState;
  /** 삽입이 성공한 배치마다 한 번 — n번째에서 돌아오지 않는다 */
  afterInsert(): void;
}

function writeMarker(path: string, body: string): void {
  const fd = openSync(path, 'w');
  try {
    writeSync(fd, body);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function createLabFault(
  spec: AppConfig['ingestLabFault'],
  exit: (code: number) => never = (code) => process.exit(code),
  markerPath = LAB_FAULT_MARKER_PATH,
): LabFault {
  const state = labFaultState(spec, markerPath);
  if (!spec || state !== 'armed') return { enabled: false, state, afterInsert() {} };
  let inserted = 0;
  return {
    enabled: true,
    state,
    afterInsert() {
      inserted++;
      if (inserted === spec.afterBatches) {
        const rec = JSON.stringify({
          event: 'lab_fault',
          kind: spec.kind,
          batch: inserted,
          exit: LAB_FAULT_EXIT_CODE,
        });
        writeMarker(markerPath, `${rec}\n`);
        process.stderr.write(`${rec}\n`);
        exit(LAB_FAULT_EXIT_CODE);
      }
    },
  };
}
