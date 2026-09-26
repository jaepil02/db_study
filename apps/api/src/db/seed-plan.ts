// 시드 구성 — 모양 정본 docs/05_data_stores/09_migrations_seed.md §시드 · 티어별 구성 docs/06_pipeline/10_datagen_inject.md §티어 시드 구성
// S2 판정(사용자 결정 2026-09-24): 티어 시드와 S2 슬라이스(설비 1 · 태그 8 — 티어 S의 부분 구성) 두 가지.
import { randomBytes } from 'node:crypto';
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

/**
 * --scan-rate <ms>(S5 판정 6 · 모드 A 계단) — 티어 시드의 모든 태그 tag_master.scan_rate_ms · 없으면 null(티어 기본).
 * 제약은 CHECK(scan_rate_ms > 0)와 같고 정수 ms다 — 모드 A 틱 · Collector 폴링 격자가 정수 ms다.
 */
export function parseScanRate(argv: readonly string[]): number | null {
  const sr = optValue(argv, '--scan-rate');
  if (sr === null) return null;
  const v = Number(sr);
  if (!(Number.isInteger(v) && v > 0 && v <= 3_600_000))
    throw new Error(`--scan-rate ${sr} — 1~3,600,000 정수(ms)`);
  return v;
}

/** 티어 시드의 모든 태그에 거는 scan_rate_ms — --scan-rate가 있으면 그 값 */
export function effectiveScanRateMs(p: SeedPlan, scanRateMs: number | null): number {
  return scanRateMs ?? p.scanRateMs;
}

/** seed 완료 줄에 싣는 옵션 문장 — 측정 기록이 시드 조건을 로그에서 읽는다(scan_rate_ms는 완료 줄이 따로 싣는다) */
export function describeSeedOptions(o: SeedOptions): string {
  return `deadband ${o.deadband} · range ${o.range ? `${o.range.min},${o.range.max}` : 'NULL'}`;
}

// ── S7 ① 계정 · 역할 시드 — 정본 docs/05_data_stores/09_migrations_seed.md §S7 ① 계정 · 역할 시드(행 7 = 역할 3 + 계정 1 + 부여 3)

/** 이 순서로 넣어 IDENTITY role_id가 빈 볼륨마다 같다(OPERATOR 1 · ENGINEER 2 · ADMIN 3) */
export const SEED_ROLES = ['OPERATOR', 'ENGINEER', 'ADMIN'] as const;
/** 학습자 계정 email — 리드 판정 2026-09-26(비밀이 아닌 설계 값) · ALARM_ACK_ACTOR_EMAIL 값은 이 값과 같아야 한다 */
export const SEED_LEARNER_EMAIL = 'learner@localhost';
/** .env.example 자리표시(infra/init-env.sh) — 이 값이거나 비었으면 seed 거부(12_security/02 §자리표시 비밀로는 기동하지 않는다) */
export const SECRET_PLACEHOLDER = 'CHANGE_ME';

/** SEED_USER_PASSWORD — 트랜잭션 전에 거부한다. 원문은 로그 · 에러 문장에 싣지 않는다 */
export function seedUserPassword(env: NodeJS.ProcessEnv = process.env): string {
  const v = env.SEED_USER_PASSWORD;
  if (!v || v === SECRET_PLACEHOLDER)
    throw new Error('SEED_USER_PASSWORD가 비었거나 자리표시다 — seed 거부(.env에 학습자 비밀번호를 정한다)');
  return v;
}

/**
 * 비밀번호 해시 — 알고리즘 Argon2id(판정 12_security/01) · 결과는 자기 기술 문자열($argon2id$v=19$m=…,t=…,p=…$salt$hash).
 * 비용 파라미터 값은 2계층 미정(12_security/01 §미확인) — 구현이 고른 값이 문자열에 남는다.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
}

/** 자기 기술 문자열이 Argon2id인가 — 다른 알고리즘 해시가 user_account에 들어가는 것을 막는다 */
export function isArgon2idEncoded(h: string): boolean {
  return /^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/.test(h);
}

/**
 * Argon2id — hash-wasm(순수 WASM · alpine 네이티브 빌드 없음 · 버전 고정 09_tech_stack/03 "비밀번호 해시 라이브러리(Argon2id)" 행).
 * 비용 파라미터(2계층 · 소유 12_security/01): 현행 OWASP Password Storage Cheat Sheet 최소 구성 m = 19 MiB · t = 2 · p = 1 · 솔트 16바이트.
 * 출력은 자기 기술 문자열($argon2id$v=19$m=…) — 로그인(S7 ②)은 같은 문자열에서 파라미터를 읽어 검증한다.
 */
export const ARGON2ID_PARAMS = { memorySize: 19_456, iterations: 2, parallelism: 1, hashLength: 32 } as const;

export function argon2idHasher(): PasswordHasher {
  return {
    async hash(plain: string): Promise<string> {
      const { argon2id } = await import('hash-wasm');
      return argon2id({
        password: plain,
        salt: randomBytes(16),
        ...ARGON2ID_PARAMS,
        outputType: 'encoded',
      });
    },
  };
}
