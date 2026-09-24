// piscina 작업 파일 — 프로세스당 풀 하나를 모듈이 공유한다(09_tech_stack/02 §워커 풀 · ADR-25)
// 격리 대상(04_architecture/02 §worker_threads 격리 대상): 신호 벡터 생성 · 대량 인코딩 · MessagePack 해제 · gzip.
// 작업 종류는 piscina의 name 옵션으로 고른다 — 기본(default)은 S1 생성 창이다.
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeEntry, StreamEntryV1Consumer, UnknownSchemaVersionError } from '@db-study/shared';
import Piscina from 'piscina';
import { generateWindow, type WindowResult, type WindowTask } from '../../modules/datagen/signal/window';

class MovedResult {
  constructor(private readonly r: WindowResult) {}
  get [Piscina.transferableSymbol]() {
    return [this.r.payload.buffer, this.r.offsets.buffer, this.r.state.buffer, this.r.pointsByProfile.buffer];
  }
  get [Piscina.valueSymbol]() {
    return this.r;
  }
}

/** 생성 창(S1 · GEN-09) — 큰 배열은 복사하지 않고 소유권을 넘긴다 */
export default function window(task: WindowTask): unknown {
  const t0 = performance.now();
  const r = generateWindow(task);
  r.busyMs = performance.now() - t0; // 워커 사용률의 분자 — 작업 실행 시간
  // piscina 타입 선언의 전송 심볼이 unique symbol이 아니어서 캐스트한다(런타임 계약은 같다)
  return Piscina.move(new MovedResult(r) as unknown as Parameters<typeof Piscina.move>[0]);
}

export interface DecodeTask {
  payloads: Uint8Array[];
}

/** 해제된 행 — 엔트리 하나의 행들을 열 배열로 둔다(ts = t0 + dt) */
export interface DecodedEntry {
  ok: true;
  d: number;
  s: number;
  t0: number;
  tg: number[];
  dt: number[];
  va: number[];
  q: number[];
  negativeDt: number;
}
export interface UndecodableEntry {
  ok: false;
  reason: 'unknown_version' | 'malformed';
}
export interface DecodeResult {
  entries: (DecodedEntry | UndecodableEntry)[];
  busyMs: number;
}

/** MessagePack 해제 · 소비자 스키마 검증(ING-01 · 6b) — 해독 불가는 사유로 돌려준다(격리는 S3 DLQ) */
export function decode(task: DecodeTask): DecodeResult {
  const t0 = performance.now();
  const entries = task.payloads.map((p): DecodedEntry | UndecodableEntry => {
    try {
      const raw = decodeEntry(p);
      const e = StreamEntryV1Consumer.safeParse(raw);
      if (!e.success) return { ok: false, reason: 'malformed' };
      const negativeDt = e.data.dt.reduce((n, d) => (d < 0 ? n + 1 : n), 0);
      return { ok: true, ...e.data, negativeDt };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof UnknownSchemaVersionError ? 'unknown_version' : 'malformed',
      };
    }
  });
  return { entries, busyMs: performance.now() - t0 };
}

export interface BytesResult {
  data: Uint8Array;
  busyMs: number;
}

/** 조회 캐시 값 압축 · 해제(TSQ-04) — 응답 크기에 비례하는 CPU라 이벤트 루프 밖에서 한다 */
export function gzip(input: Uint8Array): BytesResult {
  const t0 = performance.now();
  const data = gzipSync(input);
  return { data, busyMs: performance.now() - t0 };
}
export function gunzip(input: Uint8Array): BytesResult {
  const t0 = performance.now();
  const data = gunzipSync(input);
  return { data, busyMs: performance.now() - t0 };
}
