// ClickHouse 시간대 전환 단계(ADR-27 · 절차 정본 docs/05_data_stores/09_migrations_seed.md §DB 시간대 전환 · 구현 목록 #8)
// migrate가 PostgreSQL 순번 뒤 · ClickHouse DDL 순번 적용 전에 부른다 — 순번 파일 밖 · 카탈로그(system.columns)로 멱등 판정.
// 판정 대상은 테이블 8이고 MV는 뺀다 — mv_tag_1d.bucket의 DateTime('Asia/Seoul')은 달력 의미 경계 #1이라 정상이다.
// ① 파티션 식이 시각 컬럼에 기대는 5는 재구성(인자만 바꾸면 옛 파트의 KST 파티션 ID와 새 파트가 한 파티션에 섞인다 — 확인한 사실 #3)
// ② 업무 대조 3은 파티션 키가 없어 MODIFY COLUMN 인자만(메타데이터). 저장값(epoch)은 어느 쪽에서도 바뀌지 않는다.
// 쓰기 정지(⓪ 전제)를 믿지 않고 확인한다 — 시작 전 system.processes에 판정 대상으로 가는 INSERT가 있으면 거부하고,
// EXCHANGE 직전 원본을 병합 불변 척도로 다시 재 복사 시점 값과 다르면 멈춘다(복사 뒤 들어온 행은 새 테이블에 없다 · 옛 테이블 유지 · 재실행 수렴).
// 척도 — MergeTree(tag_raw · alarm_eval)는 count() · AggregatingMergeTree(tag_1*)는 countMerge(cnt)(백그라운드 병합이 물리 행을 줄여도 불변).

/** 판정 대상 테이블 8 — 재구성 5는 이 순서로 돈다(tag_1m이 tag_1h · tag_1d보다 먼저 — 둘은 AS tag_1m으로 구조를 물려받는다) */
export const CH_TZ_REBUILD = ['tag_raw', 'alarm_eval', 'tag_1m', 'tag_1h', 'tag_1d'] as const;
export const CH_TZ_MODIFY = [
  'work_order_control',
  'work_order_control_rmt',
  'production_log_control',
] as const;
/** MV 3 — 입구(mv_tag_1m)를 먼저 내린다 · 다시 세우는 것은 DDL 재적용(위에서 아래로) */
export const CH_TZ_MVS = ['mv_tag_1m', 'mv_tag_1h', 'mv_tag_1d'] as const;
/** 전환용 새 테이블의 이름 접미 — 시작 때 남은 것을 지운다(멱등) */
export const CH_TZ_SUFFIX = '__tz_utc';

const KST = "'Asia/Seoul'";
const UTC = "'UTC'";
/**
 * 복사 중복 제거 해제(04_clickhouse_rollup §백필 절차 ④와 같은 근거 — 26.8은 뒤 설정이 앞 설정을 대체한다) ·
 * optimize_on_insert 0 — 집계 테이블(tag_1m · 1h · 1d)은 기본값에서 삽입 블록 안 같은 키 행을 미리 합쳐 물리 행 수가 줄어든다
 * (운영 전환 실측 2026-09-28: tag_1m 3,052,600 → 2,986,709 · countMerge는 같음). 행을 1:1로 옮겨야 엄격한 행 수 대조가 선다.
 */
const COPY_SETTINGS = { insert_deduplicate: 0, deduplicate_insert_select: 'disable', optimize_on_insert: 0 };

export interface ChTzPort {
  command(query: string, settings?: Record<string, string | number>): Promise<void>;
  rows<T>(query: string, params?: Record<string, unknown>): Promise<T[]>;
}

export interface ChTzResult {
  rebuilt: string[];
  modified: string[];
  droppedLeftovers: string[];
}

/** DDL 순번 문장에서 테이블 하나의 CREATE 문 — 이름만 전환용으로 바꾼다(정의의 정본은 DDL 파일 하나) */
export function rebuildStatement(statements: string[], db: string, table: string): string {
  const head = new RegExp(`^CREATE TABLE IF NOT EXISTS ${db}\\.${table}\\b`);
  const found = statements.find((s) => head.test(s));
  if (!found) throw new Error(`ClickHouse 시간대 전환 — DDL에 ${db}.${table} 정의가 없다`);
  const stmt = found.replace(head, `CREATE TABLE ${db}.${table}${CH_TZ_SUFFIX}`);
  if (stmt.includes(KST))
    throw new Error(`ClickHouse 시간대 전환 — ${table} DDL에 'Asia/Seoul' 인자가 남아 있다`);
  return stmt;
}

/** 'Asia/Seoul' 인자를 가진 판정 대상 컬럼(MV 제외) */
async function kstColumns(ch: ChTzPort, db: string) {
  return ch.rows<{ table: string; name: string; type: string }>(
    `SELECT table, name, type FROM system.columns
      WHERE database = {db:String} AND table IN {tables:Array(String)} AND position(type, ${KST}) > 0
      ORDER BY table, position`,
    { db, tables: [...CH_TZ_REBUILD, ...CH_TZ_MODIFY] },
  );
}

/** 판정 대상으로 가는 INSERT 정규식 — DB 접두가 있는 문장 · 없는 문장(current_database가 db일 때만) */
export function insertPatterns(db: string): { qualified: string; bare: string } {
  const tables = [...CH_TZ_REBUILD, ...CH_TZ_MODIFY].join('|');
  const head = '(?i)^\\s*INSERT\\s+INTO\\s+(?:TABLE\\s+)?';
  const tail = `\`?(?:${tables})\`?(?:\\s|\\(|$)`;
  return { qualified: `${head}\`?${db}\`?\\.${tail}`, bare: `${head}${tail}` };
}

/** 지금 판정 대상으로 가는 INSERT 수(system.processes 한 시점) */
async function runningInserts(ch: ChTzPort, db: string): Promise<number> {
  const re = insertPatterns(db);
  const r = await ch.rows<{ n: string }>(
    `SELECT count() AS n FROM system.processes
      WHERE query_kind = 'Insert'
        AND (match(query, {qualified:String}) OR (current_database = {db:String} AND match(query, {bare:String})))`,
    { db, ...re },
  );
  return Number(r[0]?.n ?? 0);
}

async function count(ch: ChTzPort, sql: string): Promise<string> {
  const r = await ch.rows<{ n: string }>(sql);
  return String(r[0]?.n ?? '0');
}

export async function convertClickHouseTimezone(
  ch: ChTzPort,
  db: string,
  ddlStatements: string[],
  log: (m: string) => void = () => {},
): Promise<ChTzResult> {
  const result: ChTzResult = { rebuilt: [], modified: [], droppedLeftovers: [] };
  const dbs = await ch.rows<{ n: string }>(
    'SELECT count() AS n FROM system.databases WHERE name = {db:String}',
    { db },
  );
  if (Number(dbs[0]?.n ?? 0) === 0) {
    log(`ch: 시간대 전환 — 데이터베이스 ${db} 없음(빈 볼륨) · 건너뜀`);
    return result;
  }

  // 중간에 멈춘 이전 실행의 전환용 테이블 — EXCHANGE 전이면 미완 복사본 · 뒤면 옛 KST 테이블이라 어느 쪽이든 지워도 잃는 것이 없다
  const leftovers = await ch.rows<{ name: string }>(
    'SELECT name FROM system.tables WHERE database = {db:String} AND endsWith(name, {suffix:String})',
    { db, suffix: CH_TZ_SUFFIX },
  );
  for (const { name } of leftovers) {
    await ch.command(`DROP TABLE IF EXISTS ${db}.${name} SYNC`);
    result.droppedLeftovers.push(name);
  }

  const cols = await kstColumns(ch, db);
  const judged = new Set(cols.map((c) => c.table));
  if (judged.size === 0) {
    log('ch: 시간대 전환 — 판정 대상 테이블 8에 Asia/Seoul 컬럼 없음 · 건너뜀(MV 제외)');
    return result;
  }

  // ⓪ 전제 확인 — 복사 중 원본에 들어온 행은 새 테이블에 없어 EXCHANGE 뒤 사라진다
  const inserting = await runningInserts(ch, db);
  if (inserting > 0)
    throw new Error(
      `ClickHouse 시간대 전환 — 판정 대상 테이블로 가는 INSERT ${inserting}건이 돌고 있다 · 적재 · 명령 워커를 먼저 멈춘다(api 정지 뒤 다시 migrate)`,
    );

  const rebuild = CH_TZ_REBUILD.filter((t) => judged.has(t));
  if (rebuild.length > 0) {
    // 복사 전에 MV를 내린다 — 원시 복사분이 롤업에 한 번 더 들어가지 않게(롤업은 롤업대로 복사) · ④ DDL 재적용이 입구를 마지막에 연다
    for (const mv of CH_TZ_MVS) await ch.command(`DROP TABLE IF EXISTS ${db}.${mv} SYNC`);
    for (const t of rebuild) {
      const tmp = `${t}${CH_TZ_SUFFIX}`;
      await ch.command(rebuildStatement(ddlStatements, db, t));
      // 컬럼 목록 명시 — ingested_at을 빼면 DEFAULT now64(3)가 복사 시각을 넣어 적재 지연 이력이 사라진다
      const names = (
        await ch.rows<{ name: string }>(
          `SELECT name FROM system.columns WHERE database = {db:String} AND table = {t:String}
             AND default_kind NOT IN ('MATERIALIZED', 'ALIAS', 'EPHEMERAL') ORDER BY position`,
          { db, t: tmp },
        )
      ).map((r) => `\`${r.name}\``);
      const list = names.join(', ');
      await ch.command(`INSERT INTO ${db}.${tmp} (${list}) SELECT ${list} FROM ${db}.${t}`, COPY_SETTINGS);
      const [a, b] = [
        await count(ch, `SELECT count() AS n FROM ${db}.${t}`),
        await count(ch, `SELECT count() AS n FROM ${db}.${tmp}`),
      ];
      if (a !== b)
        throw new Error(`ClickHouse 시간대 전환 — ${t} 행 수 불일치 ${a} ≠ ${b} · 옛 테이블은 그대로다`);
      // 재검사 척도 — 집계 테이블은 복사 뒤에도 백그라운드 병합이 원본 물리 행을 줄이므로 count()로 재면 오탐 중단한다
      const aggregated = t.startsWith('tag_1');
      const measure = aggregated ? 'countMerge(cnt)' : 'count()';
      let base = a;
      if (aggregated) {
        const [ca, cb] = [
          await count(ch, `SELECT countMerge(cnt) AS n FROM ${db}.${t}`),
          await count(ch, `SELECT countMerge(cnt) AS n FROM ${db}.${tmp}`),
        ];
        if (ca !== cb)
          throw new Error(
            `ClickHouse 시간대 전환 — ${t} countMerge 불일치 ${ca} ≠ ${cb} · 옛 테이블은 그대로다`,
          );
        base = ca;
      }
      // EXCHANGE 직전 원본 재검사(병합 불변 척도) — 대조 뒤 들어온 행을 새 테이블이 잃지 않게
      const again = await count(ch, `SELECT ${measure} AS n FROM ${db}.${t}`);
      if (again !== base)
        throw new Error(
          `ClickHouse 시간대 전환 — ${t} 원본 ${measure} 값이 복사 뒤 바뀌었다 ${base} → ${again} · 쓰기가 멈추지 않았다 · 옛 테이블은 그대로다(적재 · 명령 워커를 멈추고 다시 migrate)`,
        );
      await ch.command(`EXCHANGE TABLES ${db}.${tmp} AND ${db}.${t}`);
      await ch.command(`DROP TABLE ${db}.${tmp} SYNC`);
      result.rebuilt.push(t);
      log(`ch: 시간대 전환 — ${t} 재구성(행 ${a})`);
    }
  }

  for (const t of CH_TZ_MODIFY.filter((x) => judged.has(x))) {
    for (const c of cols.filter((x) => x.table === t)) {
      await ch.command(`ALTER TABLE ${db}.${t} MODIFY COLUMN \`${c.name}\` ${c.type.replaceAll(KST, UTC)}`, {
        mutations_sync: 2,
      });
    }
    result.modified.push(t);
    log(`ch: 시간대 전환 — ${t} 인자 교체(메타데이터)`);
  }

  const left = await kstColumns(ch, db);
  if (left.length > 0) {
    throw new Error(
      `ClickHouse 시간대 전환 — Asia/Seoul 컬럼이 남았다: ${left.map((c) => `${c.table}.${c.name}`).join(' · ')}`,
    );
  }
  return result;
}
