// GEN-05 모드 A 레지스터 갱신 — 정본 docs/06_pipeline/10_datagen_inject.md §모드 A 레지스터 갱신
// 시각 k = floor(Date.now() / scan_rate_ms)의 벽시계 기반 — 같은 k면 다시 쓰지 않는다. ts는 생성기가 아니라 Collector 폴링 시각이다.
// S2 범위: 신호는 SINE 1종 · 태그는 FLOAT32 ABCD(기동 로드가 이미 거른 집합).
import { PROFILE_CODE, valueAt } from '../signal/profiles';

/**
 * 시드 고정 — 정본에 모드 A 시드 값이 없다. S1 생성기 단독 실행(bench)의 기본 시드 42와 같게 두어
 * 같은 (시드 · 태그 · 시점)이 두 경로에서 같은 값을 낸다(REQ-GEN-03 결정성 · REQ-SIM-06 같은 시드 2회 대조).
 */
export const MODE_A_SEED = 42;

/** S2 모드 A 신호 — SINE 1종(05_priorities_roadmap §S2 행) */
export const MODE_A_PROFILE = 'SINE' as const;

export interface ModeATag {
  tagId: number;
  address: number;
  scale: number;
  offsetValue: number;
  scanRateMs: number;
}

export interface ModeATarget {
  holding: Buffer;
  tag: ModeATag;
  /** 마지막으로 쓴 시점 k — 처음엔 -1 */
  lastK: number;
}

const NO_STATE = new Float64Array(1); // SINE은 상태가 없다

/** 신호 값을 공학 단위로 보고 레지스터에는 raw를 쓴다 — Collector가 raw × scale + offset_value로 되돌린다 */
export function engToRaw(eng: number, scale: number, offsetValue: number): number {
  return scale === 0 ? eng : (eng - offsetValue) / scale;
}

/** FLOAT32 ABCD — 상위 워드 먼저 · 빅엔디안 2워드를 태그 address에 쓴다 */
export function writeFloat32Abcd(holding: Buffer, address: number, raw: number): void {
  holding.writeFloatBE(raw, address * 2);
}

/** 시점 k의 모드 A 값(공학 단위) */
export function modeAValue(tagId: number, k: number, seed = MODE_A_SEED): number {
  return valueAt(PROFILE_CODE[MODE_A_PROFILE], seed, tagId, k, NO_STATE, 0);
}

/** 한 틱 — k가 바뀐 태그만 쓴다. 돌려주는 값 = 레지스터 갱신 수(gen_points_generated_total 증가분) */
export function writeTick(targets: readonly ModeATarget[], nowMs: number, seed = MODE_A_SEED): number {
  let written = 0;
  for (const t of targets) {
    const k = Math.floor(nowMs / t.tag.scanRateMs);
    if (k === t.lastK) continue;
    const eng = modeAValue(t.tag.tagId, k, seed);
    writeFloat32Abcd(t.holding, t.tag.address, engToRaw(eng, t.tag.scale, t.tag.offsetValue));
    t.lastK = k;
    written += 1;
  }
  return written;
}
