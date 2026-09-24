// 태그별 프로파일 배정 — 시드 · 구성이 정하는 생성기 설정(06_pipeline/10 §티어 시드 구성)
import { SIGNAL_PROFILES, type SignalProfile } from '@db-study/shared';
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
