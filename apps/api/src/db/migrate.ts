// migrate — PostgreSQL 순번 마이그레이션 → ClickHouse DDL 순번(순서 정본 docs/05_data_stores/09_migrations_seed.md §저장소 간 적용 순서)
// 실행: docker compose run --rm api node dist/db/migrate.js (task migrate) — 이미지 안의 순번 파일(db/postgres · db/clickhouse)을 쓴다.
// ① 관리자 계정으로 001(확장 · 역할 · DB timezone)만 적용하고 역할 비밀번호를 환경변수에서 맞춘다 — 비밀번호는 파일에 쓰지 않는다
// ② app_owner로 나머지 순번 — 런타임(app_rw)은 DDL 권한을 갖지 않는다(12_security/02 · 05_data_stores/02 §가드 트리거와 DB 권한)
// ③ ClickHouse는 이력 테이블 없이 전 파일을 매번 순서대로(IF NOT EXISTS 멱등)
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

async function runClickHouse() {
  const u = new URL(process.env.CLICKHOUSE_URL ?? '');
  if (!u.host) throw new Error('CLICKHOUSE_URL 없음 — migrate 거부');
  const ch = createClient({
    url: `${u.protocol}//${u.host}`,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  });
  try {
    const files = readdirSync(CH_DIR)
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .sort();
    for (const f of files) {
      const sql = readFileSync(join(CH_DIR, f), 'utf8')
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n')
        .trim()
        .replace(/;\s*$/, '');
      await ch.command({ query: sql });
      process.stdout.write(`ch: ${f} 적용(멱등)\n`);
    }
  } finally {
    await ch.close();
  }
}

async function main() {
  const adminUrl = pgUrl('postgres', secret('POSTGRES_ADMIN_PASSWORD'));
  await runPg(adminUrl, { file: BOOTSTRAP });
  await setRolePasswords(adminUrl);
  await runPg(pgUrl('app_owner', secret('APP_OWNER_PASSWORD')), {});
  await runClickHouse();
  process.stdout.write('migrate 완료\n');
}

main().catch((e) => {
  process.stderr.write(`migrate 실패 — ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
