// 카드 라인 가상 PLC 값 — 태그 종류(tag_master.tag_kind)별 신호 · 설비 운전 상태 연동(D-16 결정 3 · 정본 docs/06_pipeline/10_datagen_inject.md §모드 A 레지스터 갱신)
// ① 설비 단위로 운전 상태(가동 2 · 대기 1 · 정지 0)를 먼저 정한다 — (시드 · 설비 · 시각)만으로 정해지는 결정적 상태 기계(기동 · 재시작과 무관).
// ② 태그 값은 종류 프로파일로 만들고 상태에 맞춘다 — 가동이 아니면 속도 0 · 수량 멈춤 · 압력 · 전류 · 진동 0 근처 · 온도 천천히 하강.
// ③ 값은 템플릿 범위(tag_master range_min · range_max) 안 — 범위 밖 값(BAD_RANGE)은 만들지 않는다(AC-08 실험은 슬라이스 + GEN_PROFILE이 한다).
// 파라미터(설정점 · 주기 · 진폭 · 증가율)는 태그마다 시드로 정해지는 생성기 설정이며 설계 수치가 아니다(signal/profiles와 같은 규칙).
import { DEVICE_STATE_CODE, type TagKind } from '@db-study/shared';
import { normal, tagParam, uniform } from './rng';

/** 운전 상태 한 칸의 길이 — 칸마다 상태를 새로 뽑는다(가동이 이어지면 평균 약 4.8분 · 대기 · 정지는 대개 40초~1분 남짓) */
export const DEVICE_STATE_SLOT_MS = 40_000;
/** 칸마다 상태 확률 — 대부분 가동 · 가끔 대기 · 드물게 정지(설비 30대면 한 순간 평균 가동 약 26 · 대기 3 · 정지 1) */
export const DEVICE_STATE_P = { running: 0.86, idle: 0.1 } as const;

/** 상태 · 설비 파라미터 흐름 번호 — 태그 흐름(0~1063)과 겹치지 않게 비킨다(같은 수가 설비 id이자 태그 id일 수 있다) */
const STREAM_DEVICE_STATE = 9000;
const STREAM_DEVICE_PHASE = 9001;

/**
 * 시각 tMs의 설비 운전 상태 코드(DEVICE_STATE_CODE) — 설비마다 칸 경계를 비켜 30대가 한꺼번에 바뀌지 않게 한다.
 * 같은 (시드 · 설비 · 시각)이면 늘 같은 값이다 — 설비 가동을 껐다 켜도 상태 흐름은 시계를 따라간다.
 */
export function deviceStateAt(seed: number, deviceId: number, tMs: number): number {
  const phase = Math.floor(uniform(seed, deviceId, 0xffffffff, STREAM_DEVICE_PHASE) * DEVICE_STATE_SLOT_MS);
  const slot = Math.floor((tMs + phase) / DEVICE_STATE_SLOT_MS);
  const u = uniform(seed, deviceId, slot, STREAM_DEVICE_STATE);
  if (u < DEVICE_STATE_P.running) return DEVICE_STATE_CODE.RUNNING;
  if (u < DEVICE_STATE_P.running + DEVICE_STATE_P.idle) return DEVICE_STATE_CODE.IDLE;
  return DEVICE_STATE_CODE.STOPPED;
}

/** 누적 수량 중 불량 · 오류 계수(증가율이 작다) — 태그 코드 접미(card-line.ts 템플릿) */
export const DEFECT_COUNTER_SUFFIXES = ['DEFECTS', 'REJECTED', 'ENC_ERR'] as const;

export interface CardSignalSpec {
  tagId: number;
  deviceId: number;
  kind: TagKind;
  scanRateMs: number;
  rangeMin: number | null;
  rangeMax: number | null;
  /** 불량 · 오류 계수인가(COUNT만 본다) */
  defect: boolean;
}

/** 직전 값을 이어 가는 종류 — 이것만 건너뛴 시점을 따라 잡는다 */
export const STATEFUL_KINDS: ReadonlySet<TagKind> = new Set(['TEMP', 'COUNT', 'OTHER']);

const UINT32 = 4_294_967_296;
/** 온도 시정수 — 가동하면 2분 안팎으로 설정점에 붙고 · 멈추면 15분 시정수로 천천히 식는다 */
const TEMP_HEAT_TAU_S = 120;
const TEMP_COOL_TAU_S = 900;
/** 기타(정렬 오차 · 레이저 출력 · 조명) — 가운데로 되돌아오는 랜덤 워크의 시정수 */
const OTHER_TAU_S = 60;

function bounds(s: CardSignalSpec): { min: number; max: number; span: number } {
  const min = s.rangeMin ?? 0;
  const max = s.rangeMax ?? min + 100;
  return { min, max, span: max - min };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 0 근처 — 하한(대개 0) 위로 아주 작은 흔들림 */
function nearFloor(s: CardSignalSpec, seed: number, k: number, stream: number): number {
  const { min, max, span } = bounds(s);
  return clamp(min + Math.abs(normal(seed, s.tagId, k, stream)) * 0.005 * span, min, max);
}

/** 온도 · 기타의 설정점(태그 고정) */
function setpoint(s: CardSignalSpec, seed: number, lo: number, width: number): number {
  const { min, span } = bounds(s);
  return min + span * (lo + width * tagParam(seed, s.tagId, 11));
}

/** 상태형 종류의 첫 상태(첫 쓰기 직전) — 온도는 가동 설정점 · 수량은 시드로 정한 시작 누계 · 기타는 가운데 */
export function cardInitialState(s: CardSignalSpec, seed: number): number {
  switch (s.kind) {
    case 'TEMP':
      return setpoint(s, seed, 0.55, 0.25);
    case 'COUNT':
      return s.defect
        ? Math.floor(tagParam(seed, s.tagId, 12) * 1_000)
        : Math.floor(tagParam(seed, s.tagId, 12) * 100_000);
    case 'OTHER':
      return setpoint(s, seed, 0.4, 0.3);
    default:
      return 0;
  }
}

/**
 * 시점 k(= floor(시각 ÷ scan_rate_ms))의 값(공학 단위). deviceState는 같은 시각의 설비 운전 상태(deviceStateAt).
 * 상태형(TEMP · COUNT · OTHER)은 state[0]을 한 걸음 나아가게 한다.
 */
export function cardValueAt(
  s: CardSignalSpec,
  seed: number,
  k: number,
  state: Float64Array,
  deviceState: number,
): number {
  const running = deviceState === DEVICE_STATE_CODE.RUNNING;
  const { min, max, span } = bounds(s);
  const tMs = k * s.scanRateMs;
  const dt = s.scanRateMs / 1000;
  switch (s.kind) {
    case 'STATE':
      return deviceState;
    case 'SPEED': {
      // 구간별 설정 속도(STEP) + 잡음 — 1~5분마다 설정이 바뀐다
      if (!running) return min;
      const holdMs = 60_000 + Math.floor(240_000 * tagParam(seed, s.tagId, 2));
      const seg = Math.floor(tMs / holdMs);
      const level = min + span * (0.65 + 0.25 * uniform(seed, s.tagId, seg, 30));
      return clamp(level + 0.005 * span * normal(seed, s.tagId, k, 31), min, max);
    }
    case 'PRESSURE': {
      // 프레스 행정(SINE) — 4~20초 주기
      if (!running) return nearFloor(s, seed, k, 41);
      const periodMs = 4_000 + Math.floor(16_000 * tagParam(seed, s.tagId, 2));
      const center = min + span * (0.55 + 0.15 * tagParam(seed, s.tagId, 3));
      const amp = span * (0.1 + 0.1 * tagParam(seed, s.tagId, 4));
      const phase = 2 * Math.PI * tagParam(seed, s.tagId, 5);
      const v = center + amp * Math.sin((2 * Math.PI * tMs) / periodMs + phase);
      return clamp(v + 0.01 * span * normal(seed, s.tagId, k, 42), min, max);
    }
    case 'CURRENT': {
      // 모터 부하(SINE) + 잡음 — 2~10초 주기
      if (!running) return nearFloor(s, seed, k, 51);
      const periodMs = 2_000 + Math.floor(8_000 * tagParam(seed, s.tagId, 2));
      const center = min + span * (0.45 + 0.2 * tagParam(seed, s.tagId, 3));
      const phase = 2 * Math.PI * tagParam(seed, s.tagId, 5);
      const v = center + 0.08 * span * Math.sin((2 * Math.PI * tMs) / periodMs + phase);
      return clamp(v + 0.02 * span * normal(seed, s.tagId, k, 52), min, max);
    }
    case 'VIBRATION': {
      // 바탕 진동 + 드문 튐(SPIKE) — 튐도 상한 안에서 자른다
      if (!running) return nearFloor(s, seed, k, 61);
      const base = min + span * (0.15 + 0.15 * tagParam(seed, s.tagId, 2));
      const spike =
        uniform(seed, s.tagId, k, 62) < 0.003 ? span * (0.2 + 0.25 * uniform(seed, s.tagId, k, 63)) : 0;
      return clamp(base + 0.03 * span * normal(seed, s.tagId, k, 64) + spike, min, max);
    }
    case 'TEMP': {
      // 설정점으로 끌려가는 랜덤 워크 — 가동이면 설정점 · 아니면 하한 근처로 천천히 내려간다
      const target = running ? setpoint(s, seed, 0.55, 0.25) : min + span * 0.05;
      const tau = running ? TEMP_HEAT_TAU_S : TEMP_COOL_TAU_S;
      const cur = state[0] ?? target;
      const v =
        cur +
        (target - cur) * Math.min(1, dt / tau) +
        0.002 * span * Math.sqrt(dt) * normal(seed, s.tagId, k, 71);
      state[0] = clamp(v, min, max);
      return state[0];
    }
    case 'COUNT': {
      // 누계 — 가동 중에만 는다(초당 0.8~2.5개 · 불량 · 오류는 0.01~0.04개) · UINT32 랩어라운드
      const cur = state[0] ?? 0;
      if (!running) return cur;
      const rate = s.defect
        ? 0.01 + 0.03 * tagParam(seed, s.tagId, 2)
        : 0.8 + 1.7 * tagParam(seed, s.tagId, 2);
      const inc = Math.floor(rate * dt + uniform(seed, s.tagId, k, 81));
      state[0] = (cur + inc) % UINT32;
      return state[0];
    }
    case 'OTHER': {
      // 가운데로 되돌아오는 랜덤 워크 — 운전 상태와 무관
      const center = setpoint(s, seed, 0.4, 0.3);
      const cur = state[0] ?? center;
      const v =
        cur +
        (center - cur) * Math.min(1, dt / OTHER_TAU_S) +
        0.003 * span * Math.sqrt(dt) * normal(seed, s.tagId, k, 91);
      state[0] = clamp(v, min, max);
      return state[0];
    }
  }
}
