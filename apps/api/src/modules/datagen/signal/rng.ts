// 결정적 난수 — (시드 · 태그 · 시점 · 흐름)에서 곧바로 값을 뽑는다(카운터 기반).
// 상태를 들고 다니는 PRNG와 달리 작업 분할 · 워커 수와 무관하게 같은 값이 나온다(REQ-GEN-03).

/** 32비트 정수 혼합(murmur3 fmix32) */
function fmix32(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** [0, 1) 균등 난수 — stream은 같은 (태그 · 시점)에서 서로 독립인 여러 값을 뽑을 때 가른다 */
export function uniform(seed: number, tagId: number, k: number, stream: number): number {
  let h = fmix32(seed ^ 0x9e3779b9);
  h = fmix32(h ^ Math.imul(tagId, 0x27d4eb2d));
  h = fmix32(h ^ Math.imul(k >>> 0, 0x165667b1));
  h = fmix32(h ^ Math.imul(Math.floor(k / 4_294_967_296), 0x61c88647));
  h = fmix32(h ^ Math.imul(stream, 0x2545f491));
  return h / 4_294_967_296;
}

/** 표준 정규 난수(Box–Muller) */
export function normal(seed: number, tagId: number, k: number, stream: number): number {
  const u1 = uniform(seed, tagId, k, stream) || 1 / 4_294_967_296;
  const u2 = uniform(seed, tagId, k, stream + 1);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** 태그마다 고정인 파라미터 — 시점 무관(k = -1 자리) */
export function tagParam(seed: number, tagId: number, stream: number): number {
  return uniform(seed, tagId, 0xffffffff, 1000 + stream);
}
