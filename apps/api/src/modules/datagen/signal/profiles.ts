// 신호 프로파일 8종 — 생성 규칙 정본 docs/11_glossary/03_enums_state_machines.md §신호 프로파일
// 파라미터(주기 · 진폭 · 확률)는 태그마다 시드로 정해지는 생성기 설정이며 설계 수치가 아니다.
// 상태형(RANDOM_WALK · BINARY · COUNTER)은 직전 값을 state로 받아 이어 간다 — 창 경계에서 끊기지 않는다.
import type { SignalProfile } from '@db-study/shared';
import { normal, tagParam, uniform } from './rng';

export const PROFILE_CODE: Record<SignalProfile, number> = {
  SINE: 0,
  RANDOM_WALK: 1,
  RAMP: 2,
  STEP: 3,
  BINARY: 4,
  COUNTER: 5,
  SPIKE: 6,
  DROPOUT: 7,
};

const UINT32 = 4_294_967_296;

/** 상태형 프로파일의 첫 상태(k = 0 직전) */
export function initialState(code: number, seed: number, tagId: number): number {
  switch (code) {
    case PROFILE_CODE.RANDOM_WALK:
      return 50 + 50 * tagParam(seed, tagId, 1);
    case PROFILE_CODE.BINARY:
      return tagParam(seed, tagId, 1) < 0.5 ? 0 : 1;
    case PROFILE_CODE.COUNTER:
      return Math.floor(tagParam(seed, tagId, 1) * 1_000_000);
    default:
      return 0;
  }
}

function sine(seed: number, tagId: number, k: number): number {
  const period = 30 + Math.floor(270 * tagParam(seed, tagId, 2)); // 30~300 시점
  const amp = 1 + 19 * tagParam(seed, tagId, 3);
  const base = 100 * tagParam(seed, tagId, 4);
  const phase = 2 * Math.PI * tagParam(seed, tagId, 5);
  return amp * Math.sin((2 * Math.PI * k) / period + phase) + base + 0.01 * amp * normal(seed, tagId, k, 10);
}

/**
 * 시점 k의 값. 반환 NaN = 행 생략(DROPOUT 결측 — BAD를 달지 않는다 · 06_pipeline/10).
 * 상태형은 state[i]를 갱신한다.
 */
export function valueAt(
  code: number,
  seed: number,
  tagId: number,
  k: number,
  state: Float64Array,
  i: number,
): number {
  switch (code) {
    case PROFILE_CODE.SINE:
      return sine(seed, tagId, k);
    case PROFILE_CODE.RANDOM_WALK: {
      const sigma = 0.1 + 0.9 * tagParam(seed, tagId, 2);
      const v = (state[i] ?? 0) + sigma * normal(seed, tagId, k, 20);
      state[i] = v;
      return v;
    }
    case PROFILE_CODE.RAMP: {
      const cycle = 60 + Math.floor(540 * tagParam(seed, tagId, 2)); // 선형 증가 후 리셋
      const slope = 0.1 + 9.9 * tagParam(seed, tagId, 3);
      return (k % cycle) * slope;
    }
    case PROFILE_CODE.STEP: {
      const hold = 30 + Math.floor(570 * tagParam(seed, tagId, 2)); // 구간별 상수
      const seg = Math.floor(k / hold);
      return Math.round(100 * uniform(seed, tagId, seg, 30));
    }
    case PROFILE_CODE.BINARY: {
      const p = 0.001 + 0.049 * tagParam(seed, tagId, 2); // 베르누이 토글
      const cur = state[i] ?? 0;
      const v = uniform(seed, tagId, k, 40) < p ? 1 - cur : cur;
      state[i] = v;
      return v;
    }
    case PROFILE_CODE.COUNTER: {
      const inc = 1 + Math.floor(10 * uniform(seed, tagId, k, 50)); // 단조 증가 · UInt32 랩어라운드
      const v = ((state[i] ?? 0) + inc) % UINT32;
      state[i] = v;
      return v;
    }
    case PROFILE_CODE.SPIKE: {
      const base = 20 + 60 * tagParam(seed, tagId, 2);
      const spike = uniform(seed, tagId, k, 60) < 0.005;
      return base + normal(seed, tagId, k, 61) + (spike ? 50 + 50 * uniform(seed, tagId, k, 63) : 0);
    }
    case PROFILE_CODE.DROPOUT: {
      const p = 0.01 + 0.09 * tagParam(seed, tagId, 2); // 확률적 결측 — 기저 신호는 SINE
      return uniform(seed, tagId, k, 70) < p ? Number.NaN : sine(seed, tagId, k);
    }
    default:
      throw new Error(`알 수 없는 프로파일 코드 ${code}`);
  }
}
