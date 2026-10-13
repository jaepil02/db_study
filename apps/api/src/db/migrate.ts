// migrate — PostgreSQL 순번 마이그레이션 → ClickHouse DDL 순번(순서 정본 docs/05_data_stores/09_migrations_seed.md §저장소 간 적용 순서)
// 실행: docker compose run --rm api node dist/db/migrate.js (task migrate) — 이미지 안의 순번 파일(db/postgres · db/clickhouse)을 쓴다.
// ① 관리자 계정으로 001(확장 · 역할 · DB 기본 timezone UTC)만 적용하고 역할 비밀번호를 환경변수에서 맞춘다 — 비밀번호는 파일에 쓰지 않는다
// ② app_owner로 나머지 순번 — 런타임(app_rw)은 DDL 권한을 갖지 않는다(12_security/02 · 05_data_stores/02 §가드 트리거와 DB 권한)
// ③ ClickHouse — 이력 테이블 없이 전 파일을 매번 순서대로(IF NOT EXISTS 멱등)
// 순번은 D-16(2026-10-11) 새 기준선이다 — 남는 객체만 담아 001부터 다시 썼다(옛 시간대 전환 · 측정 도구 순번은 결과 상태만 반영 · 빈 볼륨에서 한 번에 끝난다).
// 옛 순번이 적용된 볼륨은 이력(pgmigrations) 이름이 달라 checkOrder가 거부한다 — 볼륨을 비우고 다시 migrate한다.
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@clickhouse/client';
import { Client } from 'pg';

const PG_DIR = resolve(process.env.MIGRATIONS_PG_DIR ?? join(process.cwd(), 'db/postgres'));
const CH_DIR = resolve(process.env.MIGRATIONS_CH_DIR ?? join(process.cwd(), 'db/clickhouse'));
const MIGRATIONS_TABLE = 'pgmigrations';
const BOOTSTRAP = '001_bootstrap';

/** 비밀 — 비었거나 자리표시와 같으면 거부(09_tech_stack/04 §환경변수 비밀 행) */
function secret(name: string): string {
  const v = process.env[name];
  if (!v || v === 'CHANGE_ME') throw new Error(`${name} 없음 — migrate 거부`);
  return v;
}

function pgUrl(user: string, password: string): string {
  const u = new URL(process.env.POSTGRES_URL ?? '');
  if (!u.host) throw new Error('POSTGRES_URL 없음 — migrate 거부');
  u.username = user;
  u.password = encodeURIComponent(password);
  return u.toString();
}

async function runPg(databaseUrl: string, opts: { file?: string }) {
  const { runner } = await import('node-pg-migrate');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await runner({
      dbClient: client,
      dir: PG_DIR,
      migrationsTable: MIGRATIONS_TABLE,
      direction: 'up',
      checkOrder: true,
      singleTransaction: true,
      log: (m: string) => process.stdout.write(`pg: ${m}\n`),
      ...(opts.file ? { file: opts.file } : {}),
    });
  } finally {
    await client.end();
  }
}

/** SCRAM-SHA-256 검증자(RFC 5802 · PostgreSQL 저장 형식) — 반복 4096 · 소금 16바이트 */
function scramVerifier(password: string, salt = randomBytes(16), iterations = 4096): string {
  const salted = pbkdf2Sync(password.normalize('NFKC'), salt, iterations, 32, 'sha256');
  const hmac = (key: Buffer, msg: string) => createHmac('sha256', key).update(msg).digest();
  const storedKey = createHash('sha256').update(hmac(salted, 'Client Key')).digest();
  const serverKey = hmac(salted, 'Server Key');
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}

async function setRolePasswords(adminUrl: string) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const roles: [string, string][] = [
      ['app_owner', secret('APP_OWNER_PASSWORD')],
      ['app_rw', secret('APP_RW_PASSWORD')],
      ['ch_reader', secret('CH_READER_PASSWORD')],
    ];
    // 평문이 서버 문장에 실리지 않게 한다 — ALTER ROLE은 유틸리티 문장이라 pg_stat_statements(track_utility 기본 on)가
    // 문장 원문을 저장하고, 그 저장소는 pgdata · 스냅샷에 남는다. ① 이 세션의 추적을 끄고 ② 평문 대신 SCRAM 검증자를 보낸다.
    await client.query('SET pg_stat_statements.track_utility = off');
    for (const [role, pw] of roles) {
      const r = await client.query<{ sql: string }>(
        'SELECT format($$ALTER ROLE %I PASSWORD %L$$, $1::text, $2::text) AS sql',
        [role, scramVerifier(pw)],
      );
      await client.query(r.rows[0]?.sql ?? '');
    }
    // 이전 migrate가 남긴 ALTER ROLE 기록 제거(수정 전 판에서 평문이 저장됐다)
    await client.query(
      `SELECT pg_stat_statements_reset(userid, dbid, queryid) FROM pg_stat_statements WHERE query ILIKE 'alter role%'`,
    );
  } finally {
    await client.end();
  }
}

/** ClickHouse DDL 순번 파일 → 문장 — 파일 하나에 문장이 여럿일 수 있다(004 · 005) · 줄 끝 세미콜론으로 가른다 */
function chFiles(): { file: string; statements: string[] }[] {
  return readdirSync(CH_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((file) => ({
      file,
      statements: readFileSync(join(CH_DIR, file), 'utf8')
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n')
        .split(/;\s*(?:\n|$)/)
        .map((q) => q.trim())
        .filter(Boolean),
    }));
}

async function runClickHouse() {
  const u = new URL(process.env.CLICKHOUSE_URL ?? '');
  if (!u.host) throw new Error('CLICKHOUSE_URL 없음 — migrate 거부');
  const ch = createClient({
    url: `${u.protocol}//${u.host}`,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  });
  try {
    for (const { file, statements } of chFiles()) {
      for (const query of statements) await ch.command({ query });
      process.stdout.write(`ch: ${file} 적용(멱등 · 문장 ${statements.length})\n`);
    }
  } finally {
    await ch.close();
  }
}

/**
 * pg_partman 준비 — 확장 생성은 관리자만 할 수 있다(신뢰 확장이 아니다). 004(대조군 일 파티션)가 app_owner로 create_parent를 부르므로
 * 여기서 schema partman · 확장 · app_owner 권한을 멱등하게 맞춘다(09_tech_stack/03 §PostgreSQL 확장 · 파생 이미지 infra/postgres/Dockerfile).
 */
async function ensurePartman(adminUrl: string) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS partman');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman');
    await client.query('GRANT ALL ON SCHEMA partman TO app_owner');
    await client.query('GRANT ALL ON ALL TABLES IN SCHEMA partman TO app_owner');
    await client.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA partman TO app_owner');
    await client.query('GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA partman TO app_owner');
  } finally {
    await client.end();
  }
}

/**
 * TimescaleDB 준비 — 009(비교 사본 hypertable · 열 압축 · ADR-32)가 app_owner로 create_hypertable을 부르므로 확장을 먼저 만든다.
 * 관리자 단계에 둔다 — 신뢰 확장이지만 pg_partman과 같은 자리에서 멱등하게 맞춘다(shared_preload_libraries에 timescaledb가 있어야 한다 · infra/postgres/postgresql.conf).
 */
async function ensureTimescale(adminUrl: string) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb');
  } finally {
    await client.end();
  }
}

/**
 * 저장소 통계 읽기 권한(S5 · OBS-02) — api 런타임(app_rw)이 다른 역할(app_owner · ch_reader)의 pg_stat_statements
 * queryid · pg_stat_activity state를 읽게 한다. 내장 역할 부여는 관리자만 할 수 있어 여기서 멱등하게 맞춘다.
 * 읽기 전용 통계 역할이며 데이터 권한을 늘리지 않는다(05_data_stores/02 §가드 트리거와 DB 권한).
 */
async function ensureStatsRead(adminUrl: string) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('GRANT pg_read_all_stats TO app_rw');
  } finally {
    await client.end();
  }
}

async function main() {
  const adminUrl = pgUrl('postgres', secret('POSTGRES_ADMIN_PASSWORD'));
  await runPg(adminUrl, { file: BOOTSTRAP });
  await ensurePartman(adminUrl);
  await ensureTimescale(adminUrl);
  await ensureStatsRead(adminUrl);
  await setRolePasswords(adminUrl);
  await runPg(pgUrl('app_owner', secret('APP_OWNER_PASSWORD')), {});
  await runClickHouse();
  process.stdout.write('migrate 완료\n');
}

main().catch((e) => {
  process.stderr.write(`migrate 실패 — ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
