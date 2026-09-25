// 모드 D 벡터 생성 + 적재 형식 인코딩 — 워커 안에서 돈다(04_architecture/02 §worker_threads 격리 — 신호 생성 · 대량 인코딩).
// 값은 신호 모듈(signal/profiles)이 (시드 · tag_id · k)로 정한다 — 모드 A · B와 같은 생성기다. 상태형(RANDOM_WALK · BINARY · COUNTER)은
// 태그마다 구간 첫 시점부터 순차 누적이라 태그 묶음 분할 · 워커 수와 무관하게 같은 비트가 나온다(REQ-GEN-03).
// 품질 전부 SIMULATED(9) · DROPOUT은 행 생략(06_pipeline/10 §생성 엔진에서 모드까지).
// 형식 둘 — ClickHouse RowBinary(ts Int64 ms · device UInt32 · tag UInt32 · value Float64 · quality UInt8 · scan_seq UInt64 · 전부 LE)
//          PostgreSQL COPY BINARY 튜플(필드 6 · 빅엔디언 · timestamptz = 2000-01-01 UTC 기준 μs)
import { QUALITY } from '@db-study/shared';
import { initialState, valueAt } from '../signal/profiles';

export type EncodeTarget = 'ch' | 'pg';

export interface EncodeTask {
  target: EncodeTarget;
  seed: number;
  /** 태그 묶음 — 같은 길이 셋 */
  deviceIds: Uint32Array;
  tagIds: Uint32Array;
  profiles: Uint8Array;
  k0: number;
  steps: number;
  periodMs: number;
  /** 상태형 프로파일의 직전 값 — null이면 구간 첫 창(initialState) */
  state: Float64Array | null;
}

export interface EncodeResult {
  data: Uint8Array;
  rows: number;
  dropout: number;
  /** 행 집합 지문 — 순서 무관 합(mod 2^32) · 두 형식 패스가 같은 벡터를 썼는지 대조한다 */
  checksum: number;
  state: Float64Array;
  busyMs?: number;
}

export const CH_ROW_BYTES = 8 + 4 + 4 + 8 + 1 + 8; // 33
/** 필드 수 int16 + (길이 int32 + 값) × 6 — ts 8 · device 4 · tag 4 · value 8 · quality 2 · scan_seq 8 */
export const PG_ROW_BYTES = 2 + (4 + 8) + (4 + 4) + (4 + 4) + (4 + 8) + (4 + 2) + (4 + 8); // 60
/** PostgreSQL 시각 원점(2000-01-01T00:00:00Z) epoch ms */
export const PG_EPOCH_MS = 946_684_800_000;
const TWO32 = 4_294_967_296;

/** COPY BINARY 머리(서명 11 + 플래그 4 + 확장 길이 4)와 꼬리(-1) */
export const PG_COPY_HEADER = Uint8Array.from([
  0x50, 0x47, 0x43, 0x4f, 0x50, 0x59, 0x0a, 0xff, 0x0d, 0x0a, 0x00, 0, 0, 0, 0, 0, 0, 0, 0,
]);
export const PG_COPY_TRAILER = Uint8Array.from([0xff, 0xff]);

function fmix32(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** 행 하나의 지문 — (tag · k · 값 비트) · 합산이라 쓰는 순서와 무관하다 */
export function rowPrint(tagId: number, k: number, lo: number, hi: number): number {
  return fmix32(lo ^ fmix32(hi ^ fmix32(Math.imul(tagId, 0x27d4eb2d) ^ (k >>> 0) ^ Math.floor(k / TWO32))));
}

export function initialStates(profiles: Uint8Array, seed: number, tagIds: Uint32Array): Float64Array {
  const s = new Float64Array(tagIds.length);
  for (let i = 0; i < tagIds.length; i++) s[i] = initialState(profiles[i] ?? 0, seed, tagIds[i] ?? 0);
  return s;
}

/** 시점 우선(k 바깥 · 태그 안쪽) — 대조군 BRIN(ts)이 기대하는 추가 순서에 가깝게 */
export function encodeWindow(t: EncodeTask): EncodeResult {
  const n = t.tagIds.length;
  const state = t.state ?? initialStates(t.profiles, t.seed, t.tagIds);
  const rowBytes = t.target === 'ch' ? CH_ROW_BYTES : PG_ROW_BYTES;
  const buf = new ArrayBuffer(n * t.steps * rowBytes);
  const dv = new DataView(buf);
  const f64 = new Float64Array(1);
  const u32 = new Uint32Array(f64.buffer); // 값 비트(LE 호스트 — lo = u32[0])
  let at = 0;
  let rows = 0;
  let dropout = 0;
  let checksum = 0;
  for (let s = 0; s < t.steps; s++) {
    const k = t.k0 + s;
    const ts = k * t.periodMs;
    const kHi = Math.floor(k / TWO32);
    const kLo = k - kHi * TWO32;
    let tsHi: number;
    let tsLo: number;
    if (t.target === 'ch') {
      tsHi = Math.floor(ts / TWO32);
      tsLo = ts - tsHi * TWO32;
    } else {
      const us = (ts - PG_EPOCH_MS) * 1000; // 2^53 안 — 정수 그대로 정확
      tsHi = Math.floor(us / TWO32);
      tsLo = us - tsHi * TWO32;
    }
    for (let i = 0; i < n; i++) {
      const tagId = t.tagIds[i] as number;
      const v = valueAt(t.profiles[i] ?? 0, t.seed, tagId, k, state, i);
      if (Number.isNaN(v)) {
        dropout++;
        continue;
      }
      f64[0] = v;
      checksum = (checksum + rowPrint(tagId, k, u32[0] as number, u32[1] as number)) >>> 0;
      const dev = t.deviceIds[i] as number;
      if (t.target === 'ch') {
        dv.setUint32(at, tsLo, true);
        dv.setInt32(at + 4, tsHi, true);
        dv.setUint32(at + 8, dev, true);
        dv.setUint32(at + 12, tagId, true);
        dv.setFloat64(at + 16, v, true);
        dv.setUint8(at + 24, QUALITY.SIMULATED);
        dv.setUint32(at + 25, kLo, true);
        dv.setUint32(at + 29, kHi, true);
      } else {
        dv.setInt16(at, 6);
        dv.setInt32(at + 2, 8);
        dv.setInt32(at + 6, tsHi);
        dv.setUint32(at + 10, tsLo);
        dv.setInt32(at + 14, 4);
        dv.setInt32(at + 18, dev);
        dv.setInt32(at + 22, 4);
        dv.setInt32(at + 26, tagId);
        dv.setInt32(at + 30, 8);
        dv.setFloat64(at + 34, v);
        dv.setInt32(at + 42, 2);
        dv.setInt16(at + 46, QUALITY.SIMULATED);
        dv.setInt32(at + 48, 8);
        dv.setUint32(at + 52, kHi);
        dv.setUint32(at + 56, kLo);
      }
      at += rowBytes;
      rows++;
    }
  }
  return { data: new Uint8Array(buf, 0, at), rows, dropout, checksum, state };
}
