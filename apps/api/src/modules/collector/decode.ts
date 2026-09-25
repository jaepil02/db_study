// COL-04 디코딩 · COL-05 품질 판정 — 기전 정본 docs/06_pipeline/02_collect.md §디코딩 · §품질 판정
// 순서: ① 워드 순서 적용 → ② 타입 변환 → ③ eng = raw × scale + offset_value. 범위 판정은 ③의 공학 단위 값으로 한다.
// data_type 6종(UINT16 · INT16 · UINT32 · INT32 · FLOAT32 · FLOAT64) × word_order 4 — BOOL은 지원하지 않는다(§BOOL 판정).
// 인코딩(encodeWords)은 디코딩의 역이다 — GEN 모드 A가 레지스터에 쓸 때 같은 규칙을 쓴다(한 규칙 두 방향).
import { isIPv4, isIPv6 } from 'node:net';
import { QUALITY } from '@db-study/shared';

/** 지원 data_type과 워드 수(11_glossary/03 §Modbus 매핑 enum) — BOOL은 비트라 여기 없다 */
export const DATA_TYPE_WORDS = {
  UINT16: 1,
  INT16: 1,
  UINT32: 2,
  INT32: 2,
  FLOAT32: 2,
  FLOAT64: 4,
} as const;
export type RegisterDataType = keyof typeof DATA_TYPE_WORDS;

export const WORD_ORDERS = ['ABCD', 'CDAB', 'BADC', 'DCBA'] as const;
export type WordOrder = (typeof WORD_ORDERS)[number];

/** FLOAT32 = 2워드 */
export const FLOAT32_WORDS = DATA_TYPE_WORDS.FLOAT32;

export function isRegisterDataType(t: string): t is RegisterDataType {
  return Object.hasOwn(DATA_TYPE_WORDS, t);
}

export function isWordOrder(o: string | null): o is WordOrder {
  return o !== null && (WORD_ORDERS as readonly string[]).includes(o);
}

/**
 * word_order = 워드 순서 축 × 바이트 순서 축(§FLOAT64 4워드 순서 판정).
 * 하위 워드 먼저(CDAB · DCBA)는 n워드 완전 역순 · 바이트 교환(BADC · DCBA)은 워드 안 두 바이트 교환.
 */
function axes(order: WordOrder): { reverseWords: boolean; swapBytes: boolean } {
  return {
    reverseWords: order === 'CDAB' || order === 'DCBA',
    swapBytes: order === 'BADC' || order === 'DCBA',
  };
}

const scratch = Buffer.alloc(8);

/** 16비트 타입은 워드 순서 적용 없음(enum 표 "없음") — word_order가 있어도 무시한다 */
function orderFor(type: RegisterDataType, order: WordOrder): WordOrder {
  return DATA_TYPE_WORDS[type] === 1 ? 'ABCD' : order;
}

/** ① 응답 워드 n개를 A가 최상위인 빅엔디안 바이트로 scratch에 모은다 */
function gather(words: ArrayLike<number>, at: number, n: number, order: WordOrder): void {
  const { reverseWords, swapBytes } = axes(order);
  for (let i = 0; i < n; i++) {
    const w = (words[reverseWords ? at + n - 1 - i : at + i] ?? 0) & 0xffff;
    scratch.writeUInt16BE(swapBytes ? ((w & 0xff) << 8) | (w >>> 8) : w, i * 2);
  }
}

/** ② 타입 변환 — 응답 워드 배열 words[at..]에서 raw 하나 */
export function decodeRaw(
  words: ArrayLike<number>,
  at: number,
  type: RegisterDataType,
  order: WordOrder,
): number {
  gather(words, at, DATA_TYPE_WORDS[type], orderFor(type, order));
  switch (type) {
    case 'UINT16':
      return scratch.readUInt16BE(0);
    case 'INT16':
      return scratch.readInt16BE(0);
    case 'UINT32':
      return scratch.readUInt32BE(0);
    case 'INT32':
      return scratch.readInt32BE(0);
    case 'FLOAT32':
      return scratch.readFloatBE(0);
    case 'FLOAT64':
      return scratch.readDoubleBE(0);
  }
}

const INT_RANGE: Partial<Record<RegisterDataType, [number, number]>> = {
  UINT16: [0, 0xffff],
  INT16: [-0x8000, 0x7fff],
  UINT32: [0, 0xffff_ffff],
  INT32: [-0x8000_0000, 0x7fff_ffff],
};

/**
 * 디코딩의 역 — raw 하나를 레지스터 워드 배열(응답 순서)로. 정수 타입은 반올림하고 표현 범위로 포화한다
 * (모드 A가 신호 값을 정수 레지스터에 쓸 때 — 포화는 범위 판정이 아니라 표현 한계다).
 */
export function encodeWords(raw: number, type: RegisterDataType, order: WordOrder): number[] {
  const range = INT_RANGE[type];
  const v = range ? Math.min(range[1], Math.max(range[0], Math.round(raw))) : raw;
  switch (type) {
    case 'UINT16':
      scratch.writeUInt16BE(v, 0);
      break;
    case 'INT16':
      scratch.writeInt16BE(v, 0);
      break;
    case 'UINT32':
      scratch.writeUInt32BE(v, 0);
      break;
    case 'INT32':
      scratch.writeInt32BE(v, 0);
      break;
    case 'FLOAT32':
      scratch.writeFloatBE(v, 0);
      break;
    case 'FLOAT64':
      scratch.writeDoubleBE(v, 0);
      break;
  }
  const n = DATA_TYPE_WORDS[type];
  const { reverseWords, swapBytes } = axes(orderFor(type, order));
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const w = scratch.readUInt16BE(i * 2);
    out[reverseWords ? n - 1 - i : i] = swapBytes ? ((w & 0xff) << 8) | (w >>> 8) : w;
  }
  return out;
}

/** FLOAT32 ABCD — S2 경로의 기지값 대조용(decodeRaw의 한 칸) */
export function decodeFloat32Abcd(w0: number, w1: number): number {
  return decodeRaw([w0, w1], 0, 'FLOAT32', 'ABCD');
}

/** ③ 공학 단위 변환 — 범위 판정은 이 값으로 한다 */
export function toEng(raw: number, scale: number, offsetValue: number): number {
  return raw * scale + offsetValue;
}

/**
 * 컨테이너 루프백(127.0.0.0/8 · ::1) = 시뮬레이션 설비(02_features/03 §모드 A의 SIMULATED 표지 판정).
 * IPv4 매핑 표기(::ffff:127.x.x.x)도 같은 127.0.0.0/8 주소라 루프백으로 본다.
 */
export function isLoopbackHost(host: string): boolean {
  const h = host.startsWith('::ffff:') ? host.slice('::ffff:'.length) : host;
  if (isIPv4(h)) return h.split('.')[0] === '127';
  return isIPv6(h) && (h === '::1' || h === '0:0:0:0:0:0:0:1');
}

/** 정상 값의 품질 — 출처 표지는 설비 단위 규칙이다(REQ-COL-07) */
export function normalQuality(host: string): number {
  return isLoopbackHost(host) ? QUALITY.SIMULATED : QUALITY.GOOD;
}

export interface RangeSpec {
  rangeMin: number | null;
  rangeMax: number | null;
}

/**
 * 응답을 받은 값의 품질 — 판정 트리의 뒤 세 가지(§품질 판정). 타임아웃(행 없음) · 예외 응답(2)은 요청 단위라 호출자가 먼저 가른다.
 * 비유한 값(NaN · 무한대)은 어느 범위에도 들지 않으므로 BAD_RANGE다 — range가 NULL이어도(12_data_contract va 행).
 */
export function valueQuality(eng: number, range: RangeSpec, normal: number): number {
  if (!Number.isFinite(eng)) return QUALITY.BAD_RANGE;
  if (range.rangeMin !== null && eng < range.rangeMin) return QUALITY.BAD_RANGE;
  if (range.rangeMax !== null && eng > range.rangeMax) return QUALITY.BAD_RANGE;
  return normal;
}

/**
 * 비유한 값의 싣는 값 — va는 유한이어야 한다(StreamEntryV1). 정본에 자리 채움 값이 없다:
 * NaN은 0, ±무한대는 ±Number.MAX_VALUE로 부호만 남긴다. 판독은 품질 4가 한다 — 값 자체는 뜻이 없다.
 */
export function finiteOrPlaceholder(eng: number): number {
  if (Number.isFinite(eng)) return eng;
  if (Number.isNaN(eng)) return 0;
  return eng > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
}
