// GEN-05 모드 A 레지스터 갱신 — 정본 docs/06_pipeline/10_datagen_inject.md §모드 A 레지스터 갱신
// 시점 k = floor(Date.now() / scan_rate_ms)의 벽시계 격자 — 같은 k면 다시 쓰지 않는다. ts는 생성기가 아니라 Collector 폴링 시각이다.
// S3: 태그별 프로파일은 GEN_PROFILE(mixed · all · 8종 단독)이 시드 42로 배정한다(S1 assignment 재사용).
// 레지스터에는 태그의 data_type · word_order로 인코딩해 쓴다 — Collector 디코딩의 역(collector/decode encodeWords).
// 범위 밖 값(AC-08 BAD_RANGE)은 여기서 만든다 — SPIKE 등 프로파일 값이 tag_master range를 넘으면 Collector가 4로 판정한다.
import { SIGNAL_PROFILES } from '@db-study/shared';
import { encodeWords, type RegisterDataType, type WordOrder } from '../../collector/decode';
import { type ProfileMix, profileFor } from '../signal/assignment';
import { initialState, PROFILE_CODE, valueAt } from '../signal/profiles';

/**
 * 시드 고정 — 정본에 모드 A 시드 값이 없다. S1 생성기 단독 실행(bench)의 기본 시드 42와 같게 두어
 * 같은 (시드 · 태그 · 시점)이 두 경로에서 같은 값을 낸다(REQ-GEN-03 결정성 · REQ-SIM-06 같은 시드 2회 대조).
 */
export const MODE_A_SEED = 42;

/**
 * 상태형 프로파일(RANDOM_WALK · BINARY · COUNTER)이 건너뛴 시점을 따라 잡는 상한 — 정본에 값이 없다.
 * 틱이 밀려 k가 여러 칸 뛰면 사이 시점을 차례로 돌려 상태가 "시점마다 한 걸음"을 지키게 한다.
 * 기동 뒤 첫 쓰기는 따라 잡지 않는다(상태의 시작점은 첫 k) — 1,000칸이면 1 Hz에서 약 17분 정지까지 덮는다.
 */
export const MODE_A_MAX_CATCHUP_STEPS = 1000;

/** 프로파일 코드 → 이름(코드 = SIGNAL_PROFILES 순번) */
export const PROFILE_NAMES = SIGNAL_PROFILES;

/** 직전 값을 이어 가는 프로파일 — 이것만 따라 잡는다(나머지는 (시드 · 태그 · k)만으로 값이 정해진다) */
const STATEFUL: ReadonlySet<number> = new Set([
  PROFILE_CODE.RANDOM_WALK,
  PROFILE_CODE.BINARY,
  PROFILE_CODE.COUNTER,
]);

export interface ModeATag {
  tagId: number;
  address: number;
  dataType: string;
  wordOrder: string | null;
  scale: number;
  offsetValue: number;
  scanRateMs: number;
}

export interface ModeATarget {
  /** 태그 function_code의 영역 — 3 holding · 4 input */
  area: Buffer;
  tag: ModeATag;
  /** 프로파일 코드(signal/profiles PROFILE_CODE) */
  profile: number;
  /** 상태형 프로파일의 직전 값 — 첫 쓰기 전에 initialState로 채운다 */
  state: Float64Array;
  /** 마지막으로 계산한 시점 k — 처음엔 -1 */
  lastK: number;
}

export function makeTarget(area: Buffer, tag: ModeATag, mix: ProfileMix, seed = MODE_A_SEED): ModeATarget {
  const profile = profileFor(mix, seed, tag.tagId);
  const state = new Float64Array(1);
  state[0] = initialState(profile, seed, tag.tagId);
  return { area, tag, profile, state, lastK: -1 };
}

/** 신호 값을 공학 단위로 보고 레지스터에는 raw를 쓴다 — Collector가 raw × scale + offset_value로 되돌린다 */
export function engToRaw(eng: number, scale: number, offsetValue: number): number {
  return scale === 0 ? eng : (eng - offsetValue) / scale;
}

/** 태그 address에 data_type · word_order로 인코딩한 워드를 쓴다 */
export function writeRegisters(area: Buffer, tag: ModeATag, raw: number): void {
  const words = encodeWords(raw, tag.dataType as RegisterDataType, (tag.wordOrder ?? 'ABCD') as WordOrder);
  words.forEach((w, i) => {
    area.writeUInt16BE(w, (tag.address + i) * 2);
  });
}

/** 시점 k의 모드 A 값(공학 단위) — 상태형은 state를 한 걸음 나아가게 한다 · NaN = DROPOUT 결측 */
export function modeAValue(
  tagId: number,
  k: number,
  profile = PROFILE_CODE.SINE,
  state: Float64Array = new Float64Array(1),
  seed = MODE_A_SEED,
): number {
  return valueAt(profile, seed, tagId, k, state, 0);
}

export interface TickResult {
  /** 레지스터 갱신 수 — 프로파일 코드별(gen_points_generated_total{mode=A,profile}) */
  written: Uint32Array;
  /** DROPOUT 결측 — 쓰지 않았다(레지스터는 직전 값을 유지 · 모드 A의 통신 장애 재현은 SIM 주입이 한다) */
  dropped: number;
}

/** 한 틱 — k가 바뀐 태그만 계산한다 */
export function writeTick(targets: readonly ModeATarget[], nowMs: number, seed = MODE_A_SEED): TickResult {
  const written = new Uint32Array(PROFILE_NAMES.length);
  let dropped = 0;
  for (const t of targets) {
    const k = Math.floor(nowMs / t.tag.scanRateMs);
    if (k === t.lastK) continue;
    // 상태형이 건너뛴 시점을 따라 잡는다(첫 쓰기 · 상한 초과는 따라 잡지 않는다)
    if (STATEFUL.has(t.profile) && t.lastK >= 0 && k - t.lastK - 1 <= MODE_A_MAX_CATCHUP_STEPS)
      for (let j = t.lastK + 1; j < k; j++) modeAValue(t.tag.tagId, j, t.profile, t.state, seed);
    const eng = modeAValue(t.tag.tagId, k, t.profile, t.state, seed);
    t.lastK = k;
    if (Number.isNaN(eng)) {
      dropped += 1;
      continue;
    }
    writeRegisters(t.area, t.tag, engToRaw(eng, t.tag.scale, t.tag.offsetValue));
    written[t.profile] = (written[t.profile] ?? 0) + 1;
  }
  return { written, dropped };
}
