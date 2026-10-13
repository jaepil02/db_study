// 태그별 프로파일 배정 — 시드 · 구성이 정하는 생성기 설정(06_pipeline/10 §티어 시드 구성)
// 종류가 있는 태그(카드 라인 · tag_master.tag_kind)는 종류가 신호를 정한다(KIND_PROFILE · signal/card-signal) — GEN_PROFILE 구성은 종류가 없는 태그(슬라이스 등)만 쓴다.
import { SIGNAL_PROFILES, type SignalProfile, type TagKind } from '@db-study/shared';
import { PROFILE_CODE } from './profiles';
import { tagParam } from './rng';

/** mixed = STEP 40% · SINE 40% · RANDOM_WALK 20%(압축 실험 혼합 구성) · all = 8종 균등 · 그 밖 = 단독 */
export type ProfileMix = 'mixed' | 'all' | SignalProfile;

export function profileFor(mix: ProfileMix, seed: number, tagId: number): number {
  if (mix === 'mixed') {
    const u = tagParam(seed, tagId, 0);
    return u < 0.4 ? PROFILE_CODE.STEP : u < 0.8 ? PROFILE_CODE.SINE : PROFILE_CODE.RANDOM_WALK;
  }
  if (mix === 'all') {
    const u = tagParam(seed, tagId, 0);
    return PROFILE_CODE[SIGNAL_PROFILES[Math.floor(u * SIGNAL_PROFILES.length)] as SignalProfile];
  }
  return PROFILE_CODE[mix];
}

export function parseMix(s: string): ProfileMix {
  if (s === 'mixed' || s === 'all' || (SIGNAL_PROFILES as readonly string[]).includes(s))
    return s as ProfileMix;
  throw new Error(`프로파일 구성 ${s} — mixed · all · 8종 이름 중 하나`);
}

/**
 * 태그 종류 → 신호 프로파일(D-16 결정 3) — 온도 RANDOM_WALK · 압력 SINE · 속도 STEP+잡음 · 전류 SINE+잡음 · 진동 SPIKE ·
 * 수량 COUNTER · 상태 상태 기계 · 기타 RANDOM_WALK. 상태 기계는 8종에 없다 — 구간별 상수라 STEP 칸으로 센다(gen_points_generated_total{profile}).
 * 실제 값은 signal/card-signal이 설비 운전 상태와 함께 만든다 — 이 표는 프로파일 이름(계측 레이블 · 문서)의 정본이다.
 */
export const KIND_PROFILE: Record<TagKind, SignalProfile> = {
  TEMP: 'RANDOM_WALK',
  PRESSURE: 'SINE',
  SPEED: 'STEP',
  CURRENT: 'SINE',
  VIBRATION: 'SPIKE',
  COUNT: 'COUNTER',
  STATE: 'STEP',
  OTHER: 'RANDOM_WALK',
};
