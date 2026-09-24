// COL-04 디코딩 · COL-05 품질 판정 — 기전 정본 docs/06_pipeline/02_collect.md §디코딩 · §품질 판정
// S2 범위: FLOAT32 · ABCD만(워드 순서 적용 → Float32 빅엔디안 → eng = raw × scale + offset_value)
// 품질은 GOOD(0) · SIMULATED(9)만 — 범위 밖 BAD_RANGE(4) · 예외 응답 BAD_COMM(2)은 S3다.
import { isIPv4, isIPv6 } from 'node:net';
import { QUALITY } from '@db-study/shared';

const scratch = Buffer.alloc(4);

/** FLOAT32 ABCD — 응답 순서 그대로 W0 W1(상위 워드 먼저 · 빅엔디안) */
export function decodeFloat32Abcd(w0: number, w1: number): number {
  scratch.writeUInt16BE(w0 & 0xffff, 0);
  scratch.writeUInt16BE(w1 & 0xffff, 2);
  return scratch.readFloatBE(0);
}

/** ③ 공학 단위 변환 — 범위 판정(S3)은 이 값으로 한다 */
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

/** 정상 값의 품질 — 출처 표지는 설비 단위 규칙이다(REQ-COL-07). 건강 코드(2 · 4) 판정은 S3에서 이 앞에 선다 */
export function normalQuality(host: string): number {
  return isLoopbackHost(host) ? QUALITY.SIMULATED : QUALITY.GOOD;
}
