// 시드 구성 — 모양 정본 docs/05_data_stores/09_migrations_seed.md §시드 · 티어별 구성 docs/06_pipeline/10_datagen_inject.md §티어 시드 구성
// S2 판정(사용자 결정 2026-09-24): 티어 시드와 S2 슬라이스(설비 1 · 태그 8 — 티어 S의 부분 구성) 두 가지.
import { CAPACITY_TIERS, type CapacityTier } from '@db-study/shared';

export const SIM_BASE_PORT = 5020; // PlcSim 대역 5020~5119(REQ-SIM-01)
export const SEED_SCAN_RATE_MS: Record<CapacityTier, number> = { S: 1000, M: 1000, 'M+': 100, L: 100 };

export type SeedTarget = { kind: 'tier'; tier: CapacityTier } | { kind: 'slice' };

export interface SeedPlan {
  label: string;
  devices: number;
  tagsPerDevice: number;
  scanRateMs: number;
}

export function seedPlan(t: SeedTarget): SeedPlan {
  if (t.kind === 'slice') return { label: 'S2 슬라이스', devices: 1, tagsPerDevice: 8, scanRateMs: 1000 };
  const c = CAPACITY_TIERS[t.tier];
  return {
    label: `티어 ${t.tier}`,
    devices: c.devices,
    tagsPerDevice: c.tagsPerDevice,
    scanRateMs: SEED_SCAN_RATE_MS[t.tier],
  };
}

export interface SeedDevice {
  deviceCode: string;
  deviceName: string;
  port: number;
  tags: { tagCode: string; tagName: string; address: number }[];
}

/** 설비 코드 연번 · 루프백 host · port 5020부터 · 태그는 FC03 · 연속 주소(FLOAT32 = 2워드 · 갭 0) */
export function seedDevices(p: SeedPlan): SeedDevice[] {
  if (p.devices > 100) throw new Error('PlcSim 대역(5020~5119)을 넘는 설비 수');
  return Array.from({ length: p.devices }, (_, d) => ({
    deviceCode: `DEV-${String(d + 1).padStart(3, '0')}`,
    deviceName: `시뮬레이션 설비 ${d + 1}`,
    port: SIM_BASE_PORT + d,
    tags: Array.from({ length: p.tagsPerDevice }, (_, i) => ({
      tagCode: `DEV-${String(d + 1).padStart(3, '0')}-T${String(i + 1).padStart(3, '0')}`,
      tagName: `태그 ${i + 1}`,
      address: i * 2,
    })),
  }));
}
