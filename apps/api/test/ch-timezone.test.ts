// ClickHouse 시간대 전환 단계(ADR-27 · 09_migrations_seed §DB 시간대 전환 · 구현 목록 #8) — 가짜 카탈로그로 판정 · 순서 · 멱등을 확인한다.
// 실제 저장소 경로(KST 볼륨 → UTC · 빈 볼륨 · 중단 뒤 재실행)는 임시 컨테이너 시험의 몫이다(보고 참조).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CH_TZ_MODIFY,
  CH_TZ_REBUILD,
  CH_TZ_SUFFIX,
  type ChTzPort,
  convertClickHouseTimezone,
  rebuildStatement,
} from '../src/db/ch-timezone';

const DDL_DIR = join(__dirname, '../../../infra/clickhouse/ddl');
/** migrate.ts chFiles와 같은 가름 */
const statements = readdirSync(DDL_DIR)
  .filter((f) => /^\d{3}_.+\.sql$/.test(f))
  .sort()
  .flatMap((f) =>
    readFileSync(join(DDL_DIR, f), 'utf8')
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n')
      .split(/;\s*(?:\n|$)/)
      .map((q) => q.trim())
      .filter(Boolean),
  );

type Col = { table: string; name: string; type: string };
const KST_COLS: Col[] = [
  { table: 'tag_raw', name: 'ts', type: "DateTime64(3, 'Asia/Seoul')" },
  { table: 'tag_raw', name: 'ingested_at', type: "DateTime64(3, 'Asia/Seoul')" },
  { table: 'alarm_eval', name: 'ts', type: "DateTime64(3, 'Asia/Seoul')" },
  ...(['tag_1m', 'tag_1h', 'tag_1d'] as const).flatMap((t) => [
    { table: t, name: 'bucket', type: "DateTime('Asia/Seoul')" },
    { table: t, name: 'last_v', type: "AggregateFunction(argMax, Float64, DateTime64(3, 'Asia/Seoul'))" },
  ]),
  { table: 'work_order_control', name: 'planned_start', type: "DateTime64(3, 'Asia/Seoul')" },
  { table: 'work_order_control', name: 'planned_end', type: "DateTime64(3, 'Asia/Seoul')" },
  { table: 'work_order_control_rmt', name: 'planned_start', type: "DateTime64(3, 'Asia/Seoul')" },
  { table: 'work_order_control_rmt', name: 'planned_end', type: "DateTime64(3, 'Asia/Seoul')" },
  { table: 'production_log_control', name: 'recorded_at', type: "DateTime64(3, 'Asia/Seoul')" },
];
const RAW_COLS = ['ts', 'device_id', 'tag_id', 'value', 'quality', 'scan_seq', 'ingested_at'];

/** 가짜 ClickHouse — 판정 대상 컬럼 · 전환용 테이블 · 행 수만 흉내 낸다. 명령은 순서대로 적는다 */
class FakeCh implements ChTzPort {
  log: string[] = [];
  settings: Record<string, Record<string, string | number> | undefined> = {};
  dbExists = true;
  kst: Col[];
  tables = new Set<string>();
  /** 옛 · 새 테이블 행 수 — 새 테이블 값을 바꾸면 불일치 */
  rowsOld = 10;
  rowsNew: number | null = null;
  constructor(kst: Col[] = KST_COLS, leftovers: string[] = []) {
    this.kst = kst.map((c) => ({ ...c }));
    for (const l of leftovers) this.tables.add(l);
  }
  async command(q: string, settings?: Record<string, string | number>) {
    this.log.push(q);
    this.settings[q] = settings;
    const create = /^CREATE TABLE plc\.(\w+)/.exec(q);
    if (create?.[1]) this.tables.add(create[1]);
    const drop = /^DROP TABLE (?:IF EXISTS )?plc\.(\w+)/.exec(q);
    if (drop?.[1]) this.tables.delete(drop[1]);
    const ex = /^EXCHANGE TABLES plc\.(\w+) AND plc\.(\w+)/.exec(q);
    // 교환 뒤 원 이름은 UTC 정의를 갖는다 — 그 테이블의 KST 컬럼이 사라진다
    if (ex?.[2]) this.kst = this.kst.filter((c) => c.table !== ex[2]);
    const mod = /^ALTER TABLE plc\.(\w+) MODIFY COLUMN `(\w+)` (.+)$/.exec(q);
    if (mod) this.kst = this.kst.filter((c) => !(c.table === mod[1] && c.name === mod[2]));
  }
  async rows<T>(q: string, params?: Record<string, unknown>): Promise<T[]> {
    if (q.includes('system.databases')) return [{ n: this.dbExists ? '1' : '0' }] as T[];
    if (q.includes('endsWith(name'))
      return [...this.tables].filter((t) => t.endsWith(CH_TZ_SUFFIX)).map((name) => ({ name })) as T[];
    if (q.includes("position(type, 'Asia/Seoul')")) {
      const tables = params?.tables as string[];
      return this.kst.filter((c) => tables.includes(c.table)) as T[];
    }
    if (q.includes('default_kind')) {
      const t = String(params?.t);
      return (t.startsWith('tag_raw') ? RAW_COLS : ['a', 'b']).map((name) => ({ name })) as T[];
    }
    const m = /FROM plc\.(\w+)$/.exec(q.trim());
    if (m?.[1])
      return [
        { n: String(m[1].endsWith(CH_TZ_SUFFIX) ? (this.rowsNew ?? this.rowsOld) : this.rowsOld) },
      ] as T[];
    throw new Error(`가짜가 모르는 질의: ${q}`);
  }
}

describe('ClickHouse 시간대 전환 — 판정', () => {
  it('데이터베이스가 없으면(빈 볼륨) 아무것도 하지 않는다', async () => {
    const ch = new FakeCh();
    ch.dbExists = false;
    expect(await convertClickHouseTimezone(ch, 'plc', statements)).toEqual({
      rebuilt: [],
      modified: [],
      droppedLeftovers: [],
    });
    expect(ch.log).toEqual([]);
  });

  it('판정 대상 8에 Asia/Seoul 컬럼이 없으면 건너뛴다 — MV(mv_tag_1d.bucket)는 판정 대상이 아니다', async () => {
    const ch = new FakeCh([{ table: 'mv_tag_1d', name: 'bucket', type: "DateTime('Asia/Seoul')" }]);
    const r = await convertClickHouseTimezone(ch, 'plc', statements);
    expect(r.rebuilt).toEqual([]);
    expect(ch.log).toEqual([]);
    expect([...CH_TZ_REBUILD, ...CH_TZ_MODIFY]).toHaveLength(8);
    expect([...CH_TZ_REBUILD, ...CH_TZ_MODIFY].some((t) => t.startsWith('mv_'))).toBe(false);
  });

  it('남은 전환용 테이블은 판정 전에 지운다(중단 뒤 재실행)', async () => {
    const ch = new FakeCh([], [`tag_raw${CH_TZ_SUFFIX}`]);
    const r = await convertClickHouseTimezone(ch, 'plc', statements);
    expect(r.droppedLeftovers).toEqual([`tag_raw${CH_TZ_SUFFIX}`]);
    expect(ch.log).toEqual([`DROP TABLE IF EXISTS plc.tag_raw${CH_TZ_SUFFIX} SYNC`]);
  });
});

describe('ClickHouse 시간대 전환 — KST 볼륨', () => {
  it('MV 3을 입구부터 내린 뒤 재구성 5를 순서대로(생성 → 복사 → 대조 → EXCHANGE → DROP) · 업무 대조 3은 인자만', async () => {
    const ch = new FakeCh();
    const r = await convertClickHouseTimezone(ch, 'plc', statements);
    expect(r.rebuilt).toEqual(['tag_raw', 'alarm_eval', 'tag_1m', 'tag_1h', 'tag_1d']);
    expect(r.modified).toEqual(['work_order_control', 'work_order_control_rmt', 'production_log_control']);
    expect(ch.log.slice(0, 3)).toEqual([
      'DROP TABLE IF EXISTS plc.mv_tag_1m SYNC',
      'DROP TABLE IF EXISTS plc.mv_tag_1h SYNC',
      'DROP TABLE IF EXISTS plc.mv_tag_1d SYNC',
    ]);
    const creates = ch.log.filter((q) => q.startsWith('CREATE TABLE'));
    expect(creates.map((q) => /^CREATE TABLE plc\.(\w+)/.exec(q)?.[1])).toEqual(
      CH_TZ_REBUILD.map((t) => `${t}${CH_TZ_SUFFIX}`),
    );
    for (const c of creates) expect(c).not.toContain('Asia/Seoul');
    // tag_1h · tag_1d는 이미 UTC로 바뀐 tag_1m의 구조를 물려받는다
    expect(creates[3]).toContain(`AS plc.tag_1m\n`);
    // 한 테이블의 단계 순서
    const i = (q: string) => ch.log.indexOf(q);
    const tmp = `plc.tag_raw${CH_TZ_SUFFIX}`;
    const insert = ch.log.find((q) => q.startsWith(`INSERT INTO ${tmp}`)) as string;
    expect(i(insert)).toBeGreaterThan(i(creates[0] as string));
    expect(i(`EXCHANGE TABLES ${tmp} AND plc.tag_raw`)).toBeGreaterThan(i(insert));
    expect(i(`DROP TABLE ${tmp} SYNC`)).toBeGreaterThan(i(`EXCHANGE TABLES ${tmp} AND plc.tag_raw`));
    // ingested_at을 컬럼 목록에 명시 · 중복 제거 해제 두 설정
    expect(insert).toContain('`ingested_at`) SELECT');
    expect(ch.settings[insert]).toEqual({ insert_deduplicate: 0, deduplicate_insert_select: 'disable' });
    // 업무 대조 — 파티션 키가 없어 MODIFY COLUMN(인자만 UTC)
    expect(ch.log).toContain(
      "ALTER TABLE plc.work_order_control MODIFY COLUMN `planned_start` DateTime64(3, 'UTC')",
    );
    expect(ch.log).toContain(
      "ALTER TABLE plc.production_log_control MODIFY COLUMN `recorded_at` DateTime64(3, 'UTC')",
    );
    expect(ch.log.some((q) => /^ALTER TABLE plc\.tag_/.test(q))).toBe(false);
    // MV를 여기서 다시 만들지 않는다 — DDL 재적용이 위에서 아래로 세운다
    expect(ch.log.some((q) => q.includes('MATERIALIZED VIEW'))).toBe(false);
  });

  it('업무 대조만 남았으면 MV를 내리지 않는다', async () => {
    const ch = new FakeCh(KST_COLS.filter((c) => c.table === 'production_log_control'));
    const r = await convertClickHouseTimezone(ch, 'plc', statements);
    expect(r).toEqual({ rebuilt: [], modified: ['production_log_control'], droppedLeftovers: [] });
    expect(ch.log).toEqual([
      "ALTER TABLE plc.production_log_control MODIFY COLUMN `recorded_at` DateTime64(3, 'UTC')",
    ]);
  });

  it('행 수가 어긋나면 EXCHANGE 전에 멈춘다 — 옛 테이블은 그대로', async () => {
    const ch = new FakeCh();
    ch.rowsNew = 9;
    await expect(convertClickHouseTimezone(ch, 'plc', statements)).rejects.toThrow(
      /tag_raw 행 수 불일치 10 ≠ 9/,
    );
    expect(ch.log.some((q) => q.startsWith('EXCHANGE'))).toBe(false);
  });

  it('두 번째 실행은 아무것도 하지 않는다(카탈로그 멱등)', async () => {
    const ch = new FakeCh();
    await convertClickHouseTimezone(ch, 'plc', statements);
    ch.log = [];
    const r = await convertClickHouseTimezone(ch, 'plc', statements);
    expect(r).toEqual({ rebuilt: [], modified: [], droppedLeftovers: [] });
    expect(ch.log).toEqual([]);
  });
});

describe('rebuildStatement — DDL 파일이 정의의 정본', () => {
  it('이름만 전환용으로 · IF NOT EXISTS 없이(남은 것은 앞에서 지웠다)', () => {
    const s = rebuildStatement(statements, 'plc', 'tag_raw');
    expect(s.startsWith(`CREATE TABLE plc.tag_raw${CH_TZ_SUFFIX}\n`)).toBe(true);
    expect(s).toContain("ts          DateTime64(3, 'UTC')");
    expect(s).toContain('PARTITION BY toYYYYMMDD(ts)');
  });

  it('DDL에 Asia/Seoul이 남아 있거나 정의가 없으면 거부 — tag_raw_x 같은 앞 일치로 오인하지 않는다', () => {
    const kst = ["CREATE TABLE IF NOT EXISTS plc.tag_raw\n(ts DateTime64(3, 'Asia/Seoul'))"];
    expect(() => rebuildStatement(kst, 'plc', 'tag_raw')).toThrow(/Asia\/Seoul/);
    expect(() =>
      rebuildStatement(['CREATE TABLE IF NOT EXISTS plc.tag_raw_x (a UInt8)'], 'plc', 'tag_raw'),
    ).toThrow(/정의가 없다/);
  });

  it('현행 DDL — 달력 의미 경계(mv_tag_1d)만 Asia/Seoul을 갖는다(구현 목록 #6 · #7)', () => {
    const withKst = statements.filter((s) => s.includes("'Asia/Seoul'"));
    expect(withKst).toHaveLength(1);
    expect(withKst[0]).toMatch(/^CREATE MATERIALIZED VIEW IF NOT EXISTS plc\.mv_tag_1d/);
    expect(withKst[0]).toContain("toStartOfDay(bucket, 'Asia/Seoul')");
  });
});
