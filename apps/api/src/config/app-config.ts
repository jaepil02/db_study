// 환경변수 로더 — 이름 정본 docs/09_tech_stack/04_local_environment.md §환경변수 · 스위치 정본 docs/02_features/13_switch_matrix.md
// 전부 기동 시 1회만 읽는다(D-06 · ADR-08).
// 허용값 밖이면 — APP_ROLE · 측정 조건 · 워커 수는 기동을 거부하고, 스위치는 기본 구현을 주입하고 경고한다.
// 스위치의 실제 주입값은 runInfo · health가 보인다(09_tech_stack/04 §환경변수 역할 스위치 행 · 07_api/10 A형).
// S1 범위: APP_ROLE · 스위치 11 · MEMORY_PROFILE · CAPACITY_TIER · COMMIT_HASH · WORKER_POOL_SIZE.
// S2 추가: 저장소 접속 3(POSTGRES_URL · CLICKHOUSE_URL · REDIS_URL) — 비밀번호 자리는 Compose 변수 치환이 채운다(09_tech_stack/04).
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
  // 저장소를 쓰지 않는 역할(생성기 단독 실행)도 있어 선택이다 — 쓰는 모듈이 초기화 때 requireStoreUrls로 강제한다
  POSTGRES_URL: optional(z.url({ protocol: /^postgres(ql)?$/ })),
  CLICKHOUSE_URL: optional(z.url({ protocol: /^https?$/ })),
  REDIS_URL: optional(z.url({ protocol: /^rediss?$/ })),
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
  stores: { postgresUrl: string | null; clickhouseUrl: string | null; redisUrl: string | null };
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
    stores: {
      postgresUrl: base.data.POSTGRES_URL,
      clickhouseUrl: base.data.CLICKHOUSE_URL,
      redisUrl: base.data.REDIS_URL,
    },
  };
}

export type StoreUrls = { postgresUrl: string; clickhouseUrl: string; redisUrl: string };

/** 저장소를 쓰는 역할의 기동 조건 — 하나라도 없으면 기동 거부(조용히 연결 없이 뜨면 health가 거짓 down을 낸다) */
export function requireStoreUrls(cfg: AppConfig): StoreUrls {
  const { postgresUrl, clickhouseUrl, redisUrl } = cfg.stores;
  const missing = [
    postgresUrl ? null : 'POSTGRES_URL',
    clickhouseUrl ? null : 'CLICKHOUSE_URL',
    redisUrl ? null : 'REDIS_URL',
  ].filter(Boolean);
  if (!postgresUrl || !clickhouseUrl || !redisUrl) {
    throw new ConfigRejectedError(`기동 거부 — 저장소 접속 환경변수 없음: ${missing.join(' · ')}`);
  }
  return { postgresUrl, clickhouseUrl, redisUrl };
}

/**
 * stream:plc:raw MAXLEN — 값 정본 docs/05_data_stores/06_redis_memory.md §프로파일별 산정(2계층 조정값).
 * 프로파일마다 maxmemory가 달라 MAXLEN이 따라간다. 발행 역할에서 프로파일이 없으면 기동을 거부한다 —
 * MAXLEN을 추정으로 고르면 백프레셔 임계(MAXLEN 비율)와 maxmemory의 순서 계약을 검산할 수 없다.
 */
export const STREAM_MAXLEN: Record<'load' | 'dev' | 'mid', number> = {
  load: 200_000,
  dev: 50_000,
  mid: 150_000,
};

export function requireStreamMaxlen(cfg: AppConfig): number {
  if (!cfg.memoryProfile) {
    throw new ConfigRejectedError(
      '기동 거부 — MEMORY_PROFILE 없음: Stream MAXLEN을 정할 수 없다(05_data_stores/06)',
    );
  }
  return STREAM_MAXLEN[cfg.memoryProfile];
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
