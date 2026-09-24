// COL-01 수집 정의 — 기동 로드 결과의 모양(정본 docs/06_pipeline/02_collect.md §기동 로드)
// 설비 · 접속 설정 · 활성 태그를 한 번 읽어 SIM(포트) · GEN 모드 A(주소) · COL(폴링)이 같은 사본을 쓴다.
import type { TagMeta } from '../master/tag-meta';
import { isLoopbackHost } from './decode';
import { planBlocks, type RequestBlock } from './request-blocks';

export interface DeviceRow {
  deviceId: number;
  deviceCode: string;
  host: string;
  port: number;
  unitId: number;
  timeoutMs: number;
  retryCount: number;
  maxRegsPerRequest: number;
}

/** 설비 하나의 수집 정의 — S2는 스캔 그룹 1(폴링 1루프) */
export interface DeviceDef extends DeviceRow {
  /** 루프백 host = 시뮬레이션 설비 — SIM이 포트를 띄우고 정상 값은 SIMULATED(9) */
  simulated: boolean;
  scanRateMs: number;
  tags: TagMeta[];
  blocks: RequestBlock<TagMeta>[];
}

/** FLOAT32 = 2워드 — S2 디코딩이 다루는 유일한 타입 */
export const FLOAT32_WORDS = 2;

/** S2가 읽을 수 있는 태그인가 — 아니면 제외 사유 */
function unsupported(t: TagMeta): string | null {
  if (t.functionCode !== 3) return `function_code ${t.functionCode} — S2는 FC03만`;
  if (t.dataType !== 'FLOAT32' || t.wordOrder !== 'ABCD')
    return `${t.dataType} · ${String(t.wordOrder)} — S2는 FLOAT32 · ABCD만(S3 범위)`;
  return null;
}

/**
 * 설비 행 × 활성 태그 → 수집 정의. 지원하지 않는 태그 · 두 번째 이후 스캔 그룹은 경고와 함께 뺀다(S3 범위).
 * 태그가 하나도 남지 않은 설비도 정의에 남긴다 — SIM 포트는 설비 단위다.
 */
export function buildDeviceDefs(
  devices: readonly DeviceRow[],
  tags: readonly TagMeta[],
  warn: (msg: string) => void,
): DeviceDef[] {
  const byDevice = new Map<number, TagMeta[]>();
  for (const t of tags) {
    const why = unsupported(t);
    if (why) {
      warn(`태그 ${t.tagId}(${t.tagCode}) 제외 — ${why}`);
      continue;
    }
    const list = byDevice.get(t.deviceId) ?? [];
    list.push(t);
    byDevice.set(t.deviceId, list);
  }
  return devices.map((d) => {
    let own = byDevice.get(d.deviceId) ?? [];
    const limit = Math.min(d.maxRegsPerRequest, 125);
    if (limit < FLOAT32_WORDS) {
      warn(
        `설비 ${d.deviceId} — max_regs_per_request ${d.maxRegsPerRequest} < FLOAT32 폭 2 · 태그 전부 제외`,
      );
      own = [];
    }
    // S2는 폴링 1루프 — 가장 짧은 scan_rate_ms 그룹만 돈다. 여러 스캔 그룹은 S3(설비 연결 1 위의 루프 여럿)
    const rates = [...new Set(own.map((t) => t.scanRateMs))].sort((a, b) => a - b);
    const scanRateMs = rates[0] ?? 0;
    if (rates.length > 1) {
      const dropped = own.filter((t) => t.scanRateMs !== scanRateMs).map((t) => t.tagId);
      warn(
        `설비 ${d.deviceId} — 스캔 그룹 ${rates.length}개 · S2는 ${scanRateMs} ms만 폴링 · 제외 태그 ${dropped.join(',')}`,
      );
      own = own.filter((t) => t.scanRateMs === scanRateMs);
    }
    return {
      ...d,
      simulated: isLoopbackHost(d.host),
      scanRateMs,
      tags: own,
      blocks: planBlocks(own, () => FLOAT32_WORDS, limit),
    };
  });
}
