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

/** 모든 태그에 같은 값으로 거는 시드 옵션 — 데드밴드(SW-10 실험) · 범위(BAD_RANGE 실험 · AC-08) */
export interface SeedOptions {
  /** tag_master.deadband — 공학 단위 절대값 · 기본 0(= 데드밴드 없음) */
  deadband: number;
  /** tag_master.range_min · range_max — 기본 NULL(범위 판정 없음) */
  range: { min: number; max: number } | null;
}

function optValue(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) throw new Error(`${name} 값이 없다`);
  return v;
}

/**
 * --deadband <값> · --range <min>,<max> — 제약은 tag_master CHECK와 같다(deadband ≥ 0 · range_min < range_max).
 * 어기면 트랜잭션 전에 거부한다 — CHECK 위반을 롤백으로 알게 되면 어느 옵션이 틀렸는지 문장이 흐려진다.
 */
export function parseSeedOptions(argv: readonly string[]): SeedOptions {
  const db = optValue(argv, '--deadband');
  const deadband = db === null ? 0 : Number(db);
  if (!Number.isFinite(deadband) || deadband < 0) throw new Error(`--deadband ${db} — 0 이상 유한 수`);
  const rg = optValue(argv, '--range');
  let range: SeedOptions['range'] = null;
  if (rg !== null) {
    const parts = rg.split(',');
    const [min, max] = parts.map((x) => (x.trim() === '' ? Number.NaN : Number(x)));
    if (
      parts.length !== 2 ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      !((min as number) < (max as number))
    )
      throw new Error(`--range ${rg} — <min>,<max> 유한 수 · min < max`);
    range = { min: min as number, max: max as number };
  }
  return { deadband, range };
}

/** seed 완료 줄에 싣는 옵션 문장 — 측정 기록이 시드 조건을 로그에서 읽는다 */
export function describeSeedOptions(o: SeedOptions): string {
  return `deadband ${o.deadband} · range ${o.range ? `${o.range.min},${o.range.max}` : 'NULL'}`;
}
