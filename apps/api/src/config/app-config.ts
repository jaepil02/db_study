// 환경변수 로더 — 이름 정본 docs/09_tech_stack/04_local_environment.md §환경변수 · 스위치 정본 docs/02_features/13_switch_matrix.md
// 전부 기동 시 1회만 읽는다(D-06 · ADR-08).
// 허용값 밖이면 — APP_ROLE · 측정 조건 · 워커 수는 기동을 거부하고, 스위치는 기본 구현을 주입하고 경고한다.
// 스위치의 실제 주입값은 runInfo · health가 보인다(09_tech_stack/04 §환경변수 역할 스위치 행 · 07_api/10 A형).
// S1 범위: APP_ROLE · 스위치 11 · MEMORY_PROFILE · CAPACITY_TIER · COMMIT_HASH · WORKER_POOL_SIZE. 저장소 접속 · 비밀은 S2부터.
import { readFileSync } from 'node:fs';
import { CAPACITY_TIER_NAMES, type CapacityTier } from '@db-study/shared';
import { z } from 'zod';

export const APP_ROLES = ['all', 'api', 'worker', 'collector', 'datagen'] as const;
export type AppRole = (typeof APP_ROLES)[number];

const onOff = (def: 'on' | 'off') => z.enum(['on', 'off']).default(def);

/** 스위치 11 — ID · 환경변수 · 기본값(정본 02_features/13) */
const SWITCH_ENV = {
  'SW-01': ['REDIS_STREAM_BUFFER', onOff('on')],
  'SW-02': ['REDIS_LATEST_CACHE', onOff('on')],
  'SW-03': ['REDIS_QUERY_CACHE', onOff('on')],
  'SW-04': ['CACHE_KEY_TIME_SNAP', onOff('on')],
  'SW-05': ['CACHE_STAMPEDE_LOCK', onOff('on')],
  'SW-06': ['REDIS_PUBSUB_FANOUT', onOff('on')],
  'SW-07': ['WS_THROTTLE_MS', z.coerce.number().int().min(0).default(100)],
  'SW-08': ['INGEST_IDEMPOTENCY', onOff('on')],
  'SW-09': ['CONTROL_TABLE_ENABLED', onOff('off')],
  'SW-10': ['COLLECTOR_DEADBAND', onOff('off')],
  'SW-11': ['LATEST_VALUE_WRITER', z.enum(['ingest', 'collector']).default('ingest')],
} as const;
export type SwitchId = keyof typeof SWITCH_ENV;
export type SwitchValues = { [K in SwitchId]: z.infer<(typeof SWITCH_ENV)[K][1]> };

const optional = <T extends z.ZodTypeAny>(t: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), t.nullable());

const EnvSchema = z.object({
  APP_ROLE: z.enum(APP_ROLES).default('all'),
  MEMORY_PROFILE: optional(z.enum(['load', 'dev', 'mid'])),
  CAPACITY_TIER: optional(z.enum(CAPACITY_TIER_NAMES as [CapacityTier, ...CapacityTier[]])),
  COMMIT_HASH: optional(z.string().regex(/^[0-9a-f]{7,40}$/)),
  // 워커 수가 기록에 없으면 S1 워커 1 · 2 · 4 비교가 섞인다 — 기본값을 두지 않는다
  WORKER_POOL_SIZE: z.coerce.number().int().min(1),
});

export interface AppConfig {
  appRole: AppRole;
  memoryProfile: 'load' | 'dev' | 'mid' | null;
  capacityTier: CapacityTier | null;
  commitHash: string | null;
  workerPoolSize: number;
  switches: SwitchValues;
  /** 허용값 밖이라 기본 구현으로 대체한 스위치 — 기동 로그 경고로 낸다 */
  switchWarnings: string[];
}

export class ConfigRejectedError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const base = EnvSchema.safeParse(env);
  const switches: Record<string, unknown> = {};
  const switchWarnings: string[] = [];
  for (const [id, [name, schema]] of Object.entries(SWITCH_ENV)) {
    const v = env[name] === '' ? undefined : env[name];
    const r = (schema as z.ZodTypeAny).safeParse(v);
    if (r.success) {
      switches[id] = r.data;
    } else {
      switches[id] = (schema as z.ZodTypeAny).parse(undefined); // 기본 구현
      switchWarnings.push(`${name}(${id})=${String(v)} 허용값 밖 — 기본값 ${String(switches[id])}으로 주입`);
    }
  }
  if (!base.success) {
    const problems = base.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new ConfigRejectedError(`기동 거부 — 환경변수 허용값 밖: ${problems.join(' · ')}`);
  }
  return {
    appRole: base.data.APP_ROLE,
    memoryProfile: base.data.MEMORY_PROFILE,
    capacityTier: base.data.CAPACITY_TIER,
    commitHash: base.data.COMMIT_HASH,
    workerPoolSize: base.data.WORKER_POOL_SIZE,
    switches: switches as SwitchValues,
    switchWarnings,
  };
}

/** cgroup v2의 실제 메모리 상한(MB) — 환경변수가 아니다(07_api/10). 상한이 없거나 읽을 수 없으면 null */
export function readMemoryLimitMb(path = '/sys/fs/cgroup/memory.max'): number | null {
  try {
    const raw = readFileSync(path, 'utf8').trim();
    if (raw === 'max') return null;
    const bytes = Number(raw);
    return Number.isFinite(bytes) ? Math.round(bytes / 1_048_576) : null;
  } catch {
    return null;
  }
}

/** health run · switches와 같은 모양 — 측정 기록 4요소의 원천(10_observability/04 §조건 칸) */
export function runInfo(cfg: AppConfig, memoryLimitMb = readMemoryLimitMb()) {
  return {
    run: {
      commitHash: cfg.commitHash,
      memoryProfile: cfg.memoryProfile,
      memoryLimitMb,
      capacityTier: cfg.capacityTier,
    },
    switches: cfg.switches,
  };
}
