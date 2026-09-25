// 스캔 사이클 하나 — 요청 블록 순차 요청 → 디코딩 → 품질 → 엔트리 입력(06_pipeline/02 §수집 한 사이클)
// ts = 그 태그를 실은 요청 블록의 송신 직전 시각(epoch ms · 재시도면 성공한 시도의 송신 직전) · t0 = 사이클 첫 요청의 송신 직전 시각.
// 블록은 순차 요청하므로 뒤 블록 ts ≥ t0 — dt ≥ 0이 구조로 성립한다.
// 품질 판정 트리(§품질 판정): 타임아웃 → 행 없음(그 그룹 그 주기 전체) · 예외 응답 → 그 블록 태그 전부 2 · 범위 밖 4 · 그 밖 9 또는 0.
import { type EntryInput, QUALITY } from '@db-study/shared';
import type { DeviceRow, ScanGroup } from './collect-definition';
import {
  decodeRaw,
  finiteOrPlaceholder,
  normalQuality,
  type RegisterDataType,
  toEng,
  valueQuality,
  type WordOrder,
} from './decode';

export interface RegisterReader {
  readHoldingRegisters(address: number, length: number): Promise<{ data: number[] }>;
  readInputRegisters(address: number, length: number): Promise<{ data: number[] }>;
}

export interface Clock {
  /** 행 시각 — epoch ms(api 컨테이너 시계) */
  wallMs(): number;
  /** 왕복 · 남은 시간 계측 — 단조 시계 ms(루프백 왕복은 1 ms 미만이라 epoch ms로는 0이 된다) */
  monoMs(): number;
}

export const systemClock: Clock = { wallMs: () => Date.now(), monoMs: () => performance.now() };

/** s는 발행자가 붙인다 — 사이클이 엔트리가 될 때만 번호를 쓴다 */
export type CycleEntry = Omit<EntryInput, 's'> & { tg: number[]; dt: number[]; va: number[]; q: number[] };

export type CycleResult =
  | { kind: 'entry'; entry: CycleEntry; rtts: number[]; retries: number; exceptionBlocks: number }
  /** 재시도까지 timeout_ms 안에 응답이 없었다 — 그 그룹 그 주기 행 없음(BAD_TIMEOUT 계수만) */
  | { kind: 'timeout'; rtts: number[]; retries: number };

/**
 * modbus-serial의 응답 타임아웃 — errno ETIMEDOUT · 메시지 "Timed out".
 * 그 오류는 Error 인스턴스가 아니라 평범한 객체(TransactionTimedOutError)라 instanceof로 가르지 않는다.
 */
export function isModbusTimeout(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const x = e as { errno?: unknown; message?: unknown };
  return x.errno === 'ETIMEDOUT' || x.message === 'Timed out';
}

/** Modbus 예외 응답 — modbus-serial이 modbusCode(예외 코드)를 단 Error로 거절한다 */
export function isModbusException(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && typeof (e as { modbusCode?: unknown }).modbusCode === 'number'
  );
}

/** 로그용 오류 문장 — modbus-serial 오류는 Error가 아닌 객체일 수 있다 */
export function errorText(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'message' in e)
    return String((e as { message: unknown }).message);
  return String(e);
}

function read(reader: RegisterReader, fc: number, start: number, count: number) {
  return fc === 4 ? reader.readInputRegisters(start, count) : reader.readHoldingRegisters(start, count);
}

/**
 * 한 그룹의 한 사이클. 타임아웃이 아닌 오류(연결 끊김 등)는 던진다 — 호출자가 그 설비 루프를 재기동한다(REQ-COL-14).
 * 재시도(modbus_config.retry_count)는 타임아웃에만 한다 — 예외 응답은 장비의 확정 답이다. 같은 주기 안에서만,
 * 재시도의 최악 소요(timeout_ms)가 주기 끝(사이클 시작 + scan_rate_ms)을 넘지 않을 때만 한다(§폴링 재시도 행).
 */
export async function runCycle(
  reader: RegisterReader,
  def: Pick<DeviceRow, 'deviceId' | 'host' | 'timeoutMs' | 'retryCount'>,
  group: ScanGroup,
  clock: Clock = systemClock,
): Promise<CycleResult> {
  const normal = normalQuality(def.host);
  const deadline = clock.monoMs() + group.scanRateMs;
  const rtts: number[] = [];
  let retries = 0;
  let exceptionBlocks = 0;
  const entry: CycleEntry = { d: def.deviceId, t0: 0, tg: [], dt: [], va: [], q: [] };
  let first = true;
  for (const b of group.blocks) {
    let data: number[] | null = null;
    let ts = 0;
    for (let attempt = 0; ; attempt++) {
      ts = clock.wallMs();
      const sent = clock.monoMs();
      if (first) {
        entry.t0 = ts;
        first = false;
      }
      try {
        ({ data } = await read(reader, b.fc, b.start, b.count));
        rtts.push((clock.monoMs() - sent) / 1000);
        break;
      } catch (e) {
        if (isModbusException(e)) {
          rtts.push((clock.monoMs() - sent) / 1000);
          break; // data = null → 블록 전체 BAD_COMM
        }
        if (!isModbusTimeout(e)) throw e;
        rtts.push(Number.POSITIVE_INFINITY);
        if (attempt < def.retryCount && clock.monoMs() + def.timeoutMs <= deadline) {
          retries += 1;
          continue;
        }
        return { kind: 'timeout', rtts, retries };
      }
    }
    if (data === null) {
      // 예외 응답은 블록 단위 — 값을 받지 못했으므로 값 자리는 0(자리 채움 · 판독은 품질 2)
      exceptionBlocks += 1;
      for (const { tag } of b.tags) {
        entry.tg.push(tag.tagId);
        entry.dt.push(ts - entry.t0);
        entry.va.push(0);
        entry.q.push(QUALITY.BAD_COMM);
      }
      continue;
    }
    if (data.length < b.count)
      throw new Error(`응답 워드 ${data.length} < 요청 ${b.count} — FC${b.fc} 주소 ${b.start}`);
    for (const { tag, offset } of b.tags) {
      const raw = decodeRaw(
        data,
        offset,
        tag.dataType as RegisterDataType,
        (tag.wordOrder ?? 'ABCD') as WordOrder,
      );
      const eng = toEng(raw, tag.scale, tag.offsetValue);
      entry.tg.push(tag.tagId);
      entry.dt.push(ts - entry.t0);
      entry.va.push(finiteOrPlaceholder(eng));
      entry.q.push(valueQuality(eng, tag, normal));
    }
  }
  return { kind: 'entry', entry, rtts, retries, exceptionBlocks };
}
