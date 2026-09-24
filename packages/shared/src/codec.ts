// Stream 엔트리 MessagePack 코덱 — 정본 docs/06_pipeline/12_data_contract.md
// 언어 중립이 계약이다: 배열은 표준 msgpack 배열(타입 배열 확장 · bin 금지), 레코드 확장 금지(map),
// t0 · s는 정수 타입(uint64 계약)으로 싣는다 — 전환 조건 ①의 Python 생성기가 같은 Stream에 발행한다.
import { Packr } from 'msgpackr';
import { STREAM_SCHEMA_VERSION, type StreamEntry } from './stream-entry';

const packr = new Packr({ useRecords: false, int64AsType: 'number', mapsAsObjects: true });

/** 생성기 · Collector가 쓰는 입력 — 배열은 타입 배열이어도 된다 */
export interface EntryInput {
  d: number;
  s: number;
  t0: number;
  tg: ArrayLike<number>;
  dt: ArrayLike<number>;
  va: ArrayLike<number>;
  q: ArrayLike<number>;
}

export function encodeEntry(e: EntryInput): Buffer {
  return packr.pack({
    v: STREAM_SCHEMA_VERSION,
    d: e.d,
    s: BigInt(e.s),
    t0: BigInt(e.t0),
    tg: Array.from(e.tg),
    dt: Array.from(e.dt),
    va: Array.from(e.va),
    q: Array.from(e.q),
  });
}

export class UnknownSchemaVersionError extends Error {
  constructor(readonly version: unknown) {
    super(
      `알 수 없는 스키마 버전 v=${String(version)} — 소비자는 격리 · XACK한다(06_pipeline/12 §스키마 버전 v)`,
    );
  }
}

/** v로 해석을 고른다. 모르는 v는 추정하지 않고 오류로 돌려준다 */
export function decodeEntry(buf: Uint8Array): StreamEntry {
  const raw = packr.unpack(buf) as Record<string, unknown>;
  if (raw === null || typeof raw !== 'object' || !('v' in raw))
    throw new UnknownSchemaVersionError(undefined);
  if (raw.v !== STREAM_SCHEMA_VERSION) throw new UnknownSchemaVersionError(raw.v);
  return raw as unknown as StreamEntry;
}
