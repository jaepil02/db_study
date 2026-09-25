// 모드 B 실행 인자 · 태그 집합 — 진입점 apps/api/src/mode-b.ts
// 태그 집합 = 티어 시드와 같은 (device_id · tag_id)(06_pipeline/10 §티어 시드 구성) — PostgreSQL tag_master에서 읽고 티어 모양과 대조한다.
import { CAPACITY_TIER_NAMES, CAPACITY_TIERS, type CapacityTier } from '@db-study/shared';
import { type ProfileMix, parseMix } from '../signal/assignment';
import type { ModeBDevice } from './mode-b-generator';

export interface ModeBArgs {
  tier: CapacityTier;
  mix: ProfileMix;
  seed: number;
  durationSeconds: number;
  /** 초당 포인트 — 없으면 티어 값 */
  pps: number | null;
  undecodableEvery: number;
}

function arg(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} 값이 없다`);
  return v;
}

/** 정수 인자 — 범위 밖 · 소수 · NaN이면 거부한다(기록한 값과 실제 값이 어긋나지 않게) */
function intArg(
  argv: readonly string[],
  name: string,
  def: number | null,
  min: number,
  max: number,
): number | null {
  const raw = arg(argv, name);
  if (raw === null) return def;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`--${name} ${raw} — ${min}~${max} 정수`);
  return v;
}

export function parseModeBArgs(argv: readonly string[]): ModeBArgs {
  const tier = arg(argv, 'tier');
  if (!tier || !CAPACITY_TIER_NAMES.includes(tier as CapacityTier))
    throw new Error(`--tier ${String(tier)} — S · M · M+ · L`);
  return {
    tier: tier as CapacityTier,
    mix: parseMix(arg(argv, 'mix') ?? 'mixed'),
    seed: intArg(argv, 'seed', 42, 0, 4_294_967_295) as number, // 난수는 32비트 시드를 쓴다
    durationSeconds: intArg(argv, 'duration', 60, 1, 86_400) as number,
    pps: intArg(argv, 'pps', null, 1, 10_000_000),
    undecodableEvery: intArg(argv, 'undecodable-every', 0, 0, 1_000_000_000) as number,
  };
}

/** (device_id, tag_id) 행 → 설비별 태그 목록(설비 · 태그 오름차순) */
export function groupTags(rows: readonly { device_id: unknown; tag_id: unknown }[]): ModeBDevice[] {
  const by = new Map<number, number[]>();
  for (const r of rows) {
    const d = Number(r.device_id);
    const list = by.get(d) ?? [];
    list.push(Number(r.tag_id));
    by.set(d, list);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([deviceId, tagIds]) => ({ deviceId, tagIds: tagIds.sort((a, b) => a - b) }));
}

/**
 * 티어 시드 모양 대조 — 설비 수 · 설비당 태그가 티어와 다르면 거부한다. 다른 시드 위에서 돌면
 * 기록의 티어와 실제 발행 규모가 어긋난다.
 */
export function assertTierShape(devices: readonly ModeBDevice[], tier: CapacityTier): void {
  const t = CAPACITY_TIERS[tier];
  const bad = devices.filter((d) => d.tagIds.length !== t.tagsPerDevice);
  if (devices.length !== t.devices || bad.length > 0)
    throw new Error(
      `tag_master가 티어 ${tier} 시드 모양이 아니다 — 설비 ${devices.length}(기대 ${t.devices}) · 설비당 태그 ${t.tagsPerDevice}와 다른 설비 ${bad.length}`,
    );
}

/**
 * 초당 시점 수 = 초당 포인트 ÷ 태그 수 — 정수이고 1,000의 약수여야 한다(격자 ts가 정수 ms).
 * 기본(티어 초당 포인트)이면 티어 hz와 같다.
 */
export function stepsPerSecond(pps: number, tagCount: number): number {
  const steps = pps / tagCount;
  if (!Number.isInteger(steps) || steps < 1 || 1000 % steps !== 0)
    throw new Error(`--pps ${pps} ÷ 태그 ${tagCount} = ${steps} — 초당 시점은 1,000의 약수인 정수여야 한다`);
  return steps;
}

export const MODE_B_TAG_SELECT = `
SELECT t.device_id, t.tag_id
  FROM tag_master t JOIN device d ON d.device_id = t.device_id
 WHERE t.is_active = $1 AND d.is_active = $1
 ORDER BY t.device_id, t.tag_id`;
