// 스캔 사이클 하나 — 요청 블록 순차 요청 → 디코딩 → 품질 → 엔트리 입력(06_pipeline/02 §수집 한 사이클)
// ts = 그 태그를 실은 요청 블록의 송신 직전 시각(epoch ms) · t0 = 사이클 첫 요청의 송신 직전 시각(§모드 A ts 채취 시점).
// 블록은 주소 오름차순으로 순차 요청하므로 뒤 블록 ts ≥ t0 — dt ≥ 0이 구조로 성립한다.
import type { EntryInput } from '@db-study/shared';
import type { DeviceDef } from './collect-definition';
import { decodeFloat32Abcd, normalQuality, toEng } from './decode';

export interface RegisterReader {
  readHoldingRegisters(address: number, length: number): Promise<{ data: number[] }>;
}

export interface Clock {
  /** 행 시각 — epoch ms(api 컨테이너 시계) */
  wallMs(): number;
  /** 왕복 계측 — 단조 시계 ms(루프백 왕복은 1 ms 미만이라 epoch ms로는 0이 된다) */
  monoMs(): number;
}

export const systemClock: Clock = { wallMs: () => Date.now(), monoMs: () => performance.now() };

/** s는 발행자가 붙인다 — 사이클이 엔트리가 될 때만 번호를 쓴다 */
export type CycleEntry = Omit<EntryInput, 's'> & { tg: number[]; dt: number[]; va: number[]; q: number[] };

export type CycleResult =
  | { kind: 'entry'; entry: CycleEntry; rtts: number[] }
  /** 응답이 timeout_ms 안에 오지 않았다 — 그 그룹 그 주기 행 없음(BAD_TIMEOUT 계수만) */
  | { kind: 'timeout'; rtts: number[] }
  /** S2에서 나오면 안 되는 비유한 값 — 사이클을 발행하지 않는다(결함이 드러나게) · BAD_RANGE 판정은 S3 */
  | { kind: 'nonfinite'; tagId: number; raw: number; rtts: number[] };

/**
 * modbus-serial의 응답 타임아웃 — errno ETIMEDOUT · 메시지 "Timed out".
 * 그 오류는 Error 인스턴스가 아니라 평범한 객체(TransactionTimedOutError)라 instanceof로 가르지 않는다.
 */
export function isModbusTimeout(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const x = e as { errno?: unknown; message?: unknown };
  return x.errno === 'ETIMEDOUT' || x.message === 'Timed out';
}

/** 로그용 오류 문장 — modbus-serial 오류는 Error가 아닌 객체일 수 있다 */
export function errorText(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'message' in e)
    return String((e as { message: unknown }).message);
  return String(e);
}

/**
 * 한 사이클을 돈다. 타임아웃이 아닌 오류(연결 끊김 · 예외 응답)는 던진다 — 호출자가 그 설비 루프만 재기동한다(REQ-COL-14).
 * 예외 응답의 BAD_COMM(2) 판정은 S3다.
 */
export async function runCycle(
  reader: RegisterReader,
  def: DeviceDef,
  clock: Clock = systemClock,
): Promise<CycleResult> {
  const quality = normalQuality(def.host);
  const rtts: number[] = [];
  const entry: CycleEntry = { d: def.deviceId, t0: 0, tg: [], dt: [], va: [], q: [] };
  let first = true;
  for (const b of def.blocks) {
    const ts = clock.wallMs();
    const sent = clock.monoMs();
    if (first) {
      entry.t0 = ts;
      first = false;
    }
    let data: number[];
    try {
      ({ data } = await reader.readHoldingRegisters(b.start, b.count));
    } catch (e) {
      if (!isModbusTimeout(e)) throw e;
      rtts.push(Number.POSITIVE_INFINITY);
      return { kind: 'timeout', rtts };
    }
    rtts.push((clock.monoMs() - sent) / 1000);
    if (data.length < b.count)
      throw new Error(`응답 워드 ${data.length} < 요청 ${b.count} — 주소 ${b.start}`);
    for (const { tag, offset } of b.tags) {
      const raw = decodeFloat32Abcd(data[offset] ?? 0, data[offset + 1] ?? 0);
      const eng = toEng(raw, tag.scale, tag.offsetValue);
      if (!Number.isFinite(eng)) return { kind: 'nonfinite', tagId: tag.tagId, raw, rtts };
      entry.tg.push(tag.tagId);
      entry.dt.push(ts - entry.t0);
      entry.va.push(eng);
      entry.q.push(quality);
    }
  }
  return { kind: 'entry', entry, rtts };
}
