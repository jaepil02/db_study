// COL-01 수집 정의 — 기동 로드 결과의 모양(정본 docs/06_pipeline/02_collect.md §기동 로드)
// 설비 · 접속 설정 · 활성 태그를 한 번 읽어 SIM(포트 · 영역 크기) · GEN 모드 A(주소 · 타입) · COL(폴링)이 같은 사본을 쓴다.
import type { TagMeta } from '../master/tag-meta';
import { DATA_TYPE_WORDS, isLoopbackHost, isRegisterDataType, isWordOrder } from './decode';
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

/** 스캔 그룹 = 설비 × scan_rate_ms — 그룹마다 폴링 루프 하나(COL-02 · S3) */
export interface ScanGroup {
  scanRateMs: number;
  tags: TagMeta[];
  blocks: RequestBlock<TagMeta>[];
}

export interface DeviceDef extends DeviceRow {
  /** 루프백 host = 시뮬레이션 설비 — SIM이 포트를 띄우고 정상 값은 SIMULATED(9) */
  simulated: boolean;
  /** 폴링하는 태그 전부(그룹 합) — SIM 영역 크기 · 모드 A 쓰기 대상 */
  tags: TagMeta[];
  /** scan_rate_ms 오름차순 */
  groups: ScanGroup[];
}

/** 태그의 레지스터 폭 — 지원 타입만 부른다(unsupported가 먼저 거른다) */
export function wordsOf(t: TagMeta): number {
  return isRegisterDataType(t.dataType) ? DATA_TYPE_WORDS[t.dataType] : 0;
}

/** 읽을 수 있는 태그인가 — 아니면 제외 사유(BOOL · FC01 · FC02는 지원하지 않는다 — §BOOL 판정) */
function unsupported(t: TagMeta): string | null {
  if (t.functionCode !== 3 && t.functionCode !== 4)
    return `function_code ${t.functionCode} — FC03 · FC04만(FC01 · FC02 시드 금지 유지)`;
  if (!isRegisterDataType(t.dataType))
    return `data_type ${t.dataType} — 레지스터 비트 BOOL은 지원하지 않는다`;
  if (DATA_TYPE_WORDS[t.dataType] > 1 && !isWordOrder(t.wordOrder))
    return `${t.dataType} · word_order ${String(t.wordOrder)} — 다중 워드 타입은 ABCD · CDAB · BADC · DCBA 중 하나`;
  return null;
}

/**
 * 설비 행 × 활성 태그 → 수집 정의. 지원하지 않는 태그 · 요청 상한보다 넓은 태그는 경고와 함께 뺀다.
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
    const limit = Math.min(d.maxRegsPerRequest, 125);
    const own = (byDevice.get(d.deviceId) ?? []).filter((t) => {
      if (wordsOf(t) <= limit) return true;
      warn(
        `태그 ${t.tagId}(${t.tagCode}) 제외 — 폭 ${wordsOf(t)}워드 > 설비 ${d.deviceId} 요청 상한 ${limit}`,
      );
      return false;
    });
    const rates = [...new Set(own.map((t) => t.scanRateMs))].sort((a, b) => a - b);
    const groups = rates.map((scanRateMs) => {
      const gt = own.filter((t) => t.scanRateMs === scanRateMs);
      return { scanRateMs, tags: gt, blocks: planBlocks(gt, wordsOf, limit) };
    });
    return { ...d, simulated: isLoopbackHost(d.host), tags: own, groups };
  });
}
