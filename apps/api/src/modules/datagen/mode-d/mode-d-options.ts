// 모드 D(GEN-08) + 대조군 동일 행(GEN-10) 실행 인자 — CLI 정본 .omc/s5-interfaces.md §모드 D · 절차 정본 docs/06_pipeline/10_datagen_inject.md §모드 D
// 구간 [from, to)는 원시 보존 창 안이어야 한다 — 창 밖 ts는 tag_raw TTL 머지로 곧 사라지고 대조군에만 남는다(05_data_stores/08 §대조군 보존 정합).
// 일 단위는 UTC 자정 경계다(ADR-27) — tag_raw PARTITION BY toYYYYMMDD(ts)(컬럼 인자 UTC) · 대조군 일 파티션 경계(DB timezone UTC)와 같다.
import { CAPACITY_TIER_NAMES, CAPACITY_TIERS, type CapacityTier, SIGNAL_PROFILES } from '@db-study/shared';
import { type ProfileMix, parseMix } from '../signal/assignment';

/** tag_raw TTL toDateTime(ts) + INTERVAL 7 DAY(infra/clickhouse/ddl/002 · 05_data_stores/08) — 대조군 보존도 같은 7일 */
export const RAW_RETENTION_DAYS = 7;
export const DAY_MS = 86_400_000;

export interface ModeDRunArgs {
  action: 'fill';
  tier: CapacityTier;
  mix: ProfileMix;
  /** --profile(전 태그 한 프로파일) — 주면 mix를 대신한다 */
  profile: string | null;
  seed: number;
  fromMs: number;
  toMs: number;
  control: boolean;
  rollup: boolean;
  /** 태그 집합 부분(앞 설비 N · 설비당 앞 태그 N) — 없으면 티어 시드 전부 */
  devices: number | null;
  tagsPerDevice: number | null;
}
export interface ModeDPruneArgs {
  action: 'prune-control';
  /** tag_raw에 남은 일이 하나도 없을 때도 정리한다 — 기본은 거부(과거 대조군 일 파티션 전부를 되돌릴 수 없게 지운다 · 검수 #13 관찰) */
  allowEmptyRaw: boolean;
}
export type ModeDArgs = ModeDRunArgs | ModeDPruneArgs;

function arg(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} 값이 없다`);
  return v;
}

function intArg(argv: readonly string[], name: string, def: number | null, min: number, max: number) {
  const raw = arg(argv, name);
  if (raw === null) return def;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`--${name} ${raw} — ${min}~${max} 정수`);
  return v;
}

function onOffArg(argv: readonly string[], name: string, def: boolean): boolean {
  const raw = arg(argv, name);
  if (raw === null) return def;
  if (raw !== 'on' && raw !== 'off') throw new Error(`--${name} ${raw} — on · off`);
  return raw === 'on';
}

/** ISO 8601 — 시간대 표기가 없는 문자열은 받지 않는다(호스트 시간대에 따라 구간이 달라진다) */
export function parseIsoMs(name: string, s: string | null): number {
  if (s === null) throw new Error(`--${name} 필요(ISO 8601 · 시간대 포함)`);
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) throw new Error(`--${name} ${s} — 시간대(Z · +09:00)가 있어야 한다`);
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) throw new Error(`--${name} ${s} — ISO 8601이 아니다`);
  return ms;
}

export function parseModeDArgs(argv: readonly string[]): ModeDArgs {
  if (argv.includes('--prune-control'))
    return { action: 'prune-control', allowEmptyRaw: argv.includes('--allow-empty-raw') };
  const tier = arg(argv, 'tier');
  if (!tier || !CAPACITY_TIER_NAMES.includes(tier as CapacityTier))
    throw new Error(`--tier ${String(tier)} — S · M · M+ · L`);
  const profile = arg(argv, 'profile');
  if (profile !== null && !(SIGNAL_PROFILES as readonly string[]).includes(profile))
    throw new Error(`--profile ${profile} — 신호 프로파일 8종 중 하나`);
  const mix = parseMix(profile ?? arg(argv, 'mix') ?? 'mixed');
  const fromMs = parseIsoMs('from', arg(argv, 'from'));
  const toMs = parseIsoMs('to', arg(argv, 'to'));
  if (!(fromMs < toMs)) throw new Error('--from < --to 여야 한다');
  return {
    action: 'fill',
    tier: tier as CapacityTier,
    mix,
    profile,
    seed: intArg(argv, 'seed', 42, 0, 4_294_967_295) as number,
    fromMs,
    toMs,
    control: onOffArg(argv, 'control', true),
    rollup: onOffArg(argv, 'rollup', true),
    devices: intArg(argv, 'devices', null, 1, 100),
    tagsPerDevice: intArg(argv, 'tags-per-device', null, 1, 500),
  };
}

/**
 * 구간이 원시 보존 창 안인가 — from은 now − 7일 이후 · to는 now 이하(미래 ts는 실시간 조회 · STALE을 오염시킨다).
 * 창 경계에 걸친 머리 일은 TTL 머지가 먼저 지운다 — 경계 여유는 호출자(격자 러너의 적재 시간 예산)가 둔다.
 */
export function assertInRetention(fromMs: number, toMs: number, nowMs: number): void {
  const floor = nowMs - RAW_RETENTION_DAYS * DAY_MS;
  if (fromMs < floor)
    throw new Error(
      `--from ${new Date(fromMs).toISOString()} — 원시 보존 창(${RAW_RETENTION_DAYS}일 · ${new Date(floor).toISOString()} 이후) 밖`,
    );
  if (toMs > nowMs)
    throw new Error(`--to ${new Date(toMs).toISOString()} — 미래 ts는 모드 D가 채우지 않는다`);
}

/** 그 ms가 속한 UTC 일의 자정(epoch ms) — epoch 연산이라 프로세스 TZ에 기대지 않는다 */
export function utcDayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** UTC 일 이름 YYYYMMDD — tag_raw 파티션 ID(toYYYYMMDD)와 같은 모양 */
export function utcDayName(ms: number): string {
  const d = new Date(utcDayStart(ms));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

export interface DaySegment {
  /** UTC 일 YYYYMMDD */
  day: string;
  dayStartMs: number;
  /** 이 호출이 채우는 그 일의 부분 구간 [fromMs, toMs) */
  fromMs: number;
  toMs: number;
  /** 구간이 그 일 전부인가 — ⑧ 수리가 파티션 TRUNCATE를 쓸 수 있는지 */
  wholeDay: boolean;
}

/** [from, to)를 UTC 일 경계로 자른다(④ 일 단위 반복 · 한 INSERT가 여러 파티션에 걸치지 않게) */
export function splitUtcDays(fromMs: number, toMs: number): DaySegment[] {
  const out: DaySegment[] = [];
  for (let start = utcDayStart(fromMs); start < toMs; start += DAY_MS) {
    const a = Math.max(fromMs, start);
    const b = Math.min(toMs, start + DAY_MS);
    if (a < b)
      out.push({
        day: utcDayName(start),
        dayStartMs: start,
        fromMs: a,
        toMs: b,
        wholeDay: a === start && b === start + DAY_MS,
      });
  }
  return out;
}

/** 티어 격자 주기(ms) — 1,000 ÷ hz(M 1,000 · M+ · L 100) */
export function periodMsOf(tier: CapacityTier): number {
  const p = 1000 / CAPACITY_TIERS[tier].hz;
  if (!Number.isInteger(p)) throw new Error(`티어 ${tier} 주기 ${p} ms — 정수 ms여야 한다`);
  return p;
}

/** 구간 [from, to)의 격자 시점 번호 [k0, k1) — ts = k × 주기(벽시계 epoch 격자 · 모드 B와 같은 k) */
export function gridRange(fromMs: number, toMs: number, periodMs: number): { k0: number; k1: number } {
  return { k0: Math.ceil(fromMs / periodMs), k1: Math.ceil(toMs / periodMs) };
}

/** 분 경계로 넓힌 구간 — tag_1m 버킷은 분이라 분에 맞지 않는 구간은 이웃 행과 같은 버킷을 나눈다 */
export function minuteCover(fromMs: number, toMs: number): { fromMs: number; toMs: number } {
  return { fromMs: Math.floor(fromMs / 60_000) * 60_000, toMs: Math.ceil(toMs / 60_000) * 60_000 };
}
