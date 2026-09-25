// 모드 D 대조군 저장소 — 정리(prune)의 희생 파티션 선택 · 파티션 경계 정규식 · app_owner 접속 문자열
// 저장소 없이 가짜 클라이언트(질의를 받아 적기만 한다)와 순수 함수로 확인한다 — 실제 DETACH · DROP은 통합 확인의 몫이다.
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, kstDayName } from '../src/modules/datagen/mode-d/mode-d-options';
import {
  CONTROL_PARTITIONS_SQL,
  ownerUrl,
  PostgresControlStore,
} from '../src/modules/datagen/mode-d/mode-d-stores';

const HOUR = 3_600_000;
/** KST 자정(y-m-d 00:00 +09:00)의 epoch ms */
const kstMidnight = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) - 9 * HOUR;

interface PartRow {
  name: string;
  lo: Date | null;
  hi: Date | null;
}

const dayRow = (y: number, m: number, d: number): PartRow => {
  const lo = kstMidnight(y, m, d);
  return { name: `plc_tag_raw_control_p${kstDayName(lo)}`, lo: new Date(lo), hi: new Date(lo + DAY_MS) };
};

/** 가짜 클라이언트 — rw는 파티션 목록을 돌려주고 owner는 받은 질의를 적는다 */
function storeWith(rows: PartRow[]) {
  const ownerSql: string[] = [];
  const rwSql: string[] = [];
  const ownerUrlOf = vi.fn(() => 'postgres://app_owner:x@db/plc');
  const store = new PostgresControlStore('postgres://app_rw:y@db/plc', ownerUrlOf);
  Object.assign(store, {
    rw: {
      query: async (sql: string) => {
        rwSql.push(sql);
        return { rows };
      },
    },
    owner: {
      query: async (sql: string) => {
        ownerSql.push(sql);
        return { rows: [] };
      },
    },
  });
  return { store, ownerSql, rwSql, ownerUrlOf };
}

/** 2026-09-20 ~ 2026-09-29 KST 일 파티션 + DEFAULT + 폭이 하루가 아닌 파티션 */
function fixture(): PartRow[] {
  const rows: PartRow[] = [{ name: 'plc_tag_raw_control_default', lo: null, hi: null }];
  rows.push({
    name: 'plc_tag_raw_control_wide',
    lo: new Date(kstMidnight(2026, 9, 17)),
    hi: new Date(kstMidnight(2026, 9, 19)),
  });
  for (let d = 20; d <= 29; d++) rows.push(dayRow(2026, 9, d));
  return rows;
}

describe('PostgresControlStore.partitions — 행 → ms 사상', () => {
  it('lo · hi Date는 epoch ms · DEFAULT는 null · 질의는 CONTROL_PARTITIONS_SQL', async () => {
    const { store, rwSql } = storeWith(fixture());
    const parts = await store.partitions();
    expect(rwSql).toEqual([CONTROL_PARTITIONS_SQL]);
    expect(parts[0]).toEqual({ name: 'plc_tag_raw_control_default', loMs: null, hiMs: null });
    expect(parts.find((p) => p.name.endsWith('p20260920'))).toEqual({
      name: 'plc_tag_raw_control_p20260920',
      loMs: kstMidnight(2026, 9, 20),
      hiMs: kstMidnight(2026, 9, 21),
    });
  });
});

describe('PostgresControlStore.prune — 희생 파티션 선택', () => {
  const NOW = kstMidnight(2026, 9, 26) + 12 * HOUR; // 2026-09-26 12:00 KST

  it('tag_raw에 남은 KST 일 밖의 과거 일 파티션만 DETACH → DROP 순서로 지운다', async () => {
    const { store, ownerSql } = storeWith(fixture());
    const dropped = await store.prune(['20260923', '20260924', '20260925'], NOW);
    expect(dropped).toEqual([
      { day: '20260920', partition: 'plc_tag_raw_control_p20260920' },
      { day: '20260921', partition: 'plc_tag_raw_control_p20260921' },
      { day: '20260922', partition: 'plc_tag_raw_control_p20260922' },
    ]);
    expect(ownerSql).toEqual([
      'ALTER TABLE plc_tag_raw_control DETACH PARTITION "plc_tag_raw_control_p20260920"',
      'DROP TABLE "plc_tag_raw_control_p20260920"',
      'ALTER TABLE plc_tag_raw_control DETACH PARTITION "plc_tag_raw_control_p20260921"',
      'DROP TABLE "plc_tag_raw_control_p20260921"',
      'ALTER TABLE plc_tag_raw_control DETACH PARTITION "plc_tag_raw_control_p20260922"',
      'DROP TABLE "plc_tag_raw_control_p20260922"',
    ]);
  });

  it('오늘(KST) 이후 파티션 · DEFAULT · 폭이 하루가 아닌 파티션은 raw 목록에 없어도 남긴다', async () => {
    const { store, ownerSql } = storeWith(fixture());
    const dropped = await store.prune([], NOW);
    const names = dropped.map((d) => d.partition);
    // 과거 일 6개(20~25)만 — 오늘 26 · 선행 생성분 27~29 · DEFAULT · wide는 남는다
    expect(dropped.map((d) => d.day)).toEqual([
      '20260920',
      '20260921',
      '20260922',
      '20260923',
      '20260924',
      '20260925',
    ]);
    for (const kept of [
      'plc_tag_raw_control_default',
      'plc_tag_raw_control_wide',
      'plc_tag_raw_control_p20260926',
      'plc_tag_raw_control_p20260927',
      'plc_tag_raw_control_p20260929',
    ]) {
      expect(names).not.toContain(kept);
      expect(ownerSql.join('\n')).not.toContain(`"${kept}"`);
    }
  });

  it('오늘 경계 — KST 자정 정각이면 전날이 과거 · 자정 1 ms 전이면 그날이 오늘이다', async () => {
    const atMidnight = storeWith(fixture());
    const d1 = await atMidnight.store.prune(
      ['20260920', '20260921', '20260922', '20260923', '20260924'],
      kstMidnight(2026, 9, 26),
    );
    expect(d1.map((d) => d.day)).toEqual(['20260925']);

    const justBefore = storeWith(fixture());
    const d2 = await justBefore.store.prune(
      ['20260920', '20260921', '20260922', '20260923', '20260924'],
      kstMidnight(2026, 9, 26) - 1,
    );
    expect(d2).toEqual([]);
  });

  it('UTC 날짜가 아니라 KST 날짜로 대조한다 — KST 00:00~08:59는 UTC로 전날이다', async () => {
    // now = 2026-09-26 01:00 KST(= 09-25 16:00 UTC) — 오늘은 KST 26일이므로 25일 파티션은 과거다
    const { store } = storeWith(fixture());
    const kept = ['20260920', '20260921', '20260922', '20260923', '20260924'];
    const dropped = await store.prune(kept, kstMidnight(2026, 9, 26) + HOUR);
    expect(dropped.map((d) => d.day)).toEqual(['20260925']);
  });

  it('희생이 없으면 app_owner 커넥션을 열지 않는다(ownerUrlOf 호출 없음)', async () => {
    const rows = fixture();
    const { store, ownerUrlOf } = storeWith(rows);
    Object.assign(store, { owner: null });
    const all = rows.filter((r) => r.lo && r.hi).map((r) => kstDayName((r.lo as Date).getTime()));
    expect(await store.prune(all, NOW)).toEqual([]);
    expect(ownerUrlOf).not.toHaveBeenCalled();
  });

  it('파티션 이름은 식별자 인용(큰따옴표 두 배)으로 싣는다', async () => {
    const lo = kstMidnight(2026, 9, 20);
    const { store, ownerSql } = storeWith([
      { name: 'p"x; DROP', lo: new Date(lo), hi: new Date(lo + DAY_MS) },
    ]);
    await store.prune([], NOW);
    expect(ownerSql).toEqual([
      'ALTER TABLE plc_tag_raw_control DETACH PARTITION "p""x; DROP"',
      'DROP TABLE "p""x; DROP"',
    ]);
  });
});

describe('CONTROL_PARTITIONS_SQL — 경계 정규식', () => {
  // SQL 문자열 리터럴 '...'('' = 작은따옴표 하나)에서 정규식 본문을 꺼낸다 · standard_conforming_strings on이면 \는 그대로다
  const patterns = Object.fromEntries(
    [
      ...CONTROL_PARTITIONS_SQL.matchAll(
        /regexp_match\(pg_get_expr\(c\.relpartbound, c\.oid\), '((?:[^']|'')*)'\)\)\[1\]::timestamptz AS (lo|hi)/g,
      ),
    ].map((m) => [m[2], (m[1] ?? '').replace(/''/g, "'")]),
  ) as Record<'lo' | 'hi', string>;
  const extract = (bound: string, which: 'lo' | 'hi') => new RegExp(patterns[which]).exec(bound)?.[1] ?? null;

  it("두 식(lo · hi)이 있고 SQL에 실리는 정규식은 FROM \\('([^']+)'\\) · TO \\('([^']+)'\\)이다", () => {
    expect(patterns.lo).toBe("FROM \\('([^']+)'\\)");
    expect(patterns.hi).toBe("TO \\('([^']+)'\\)");
  });

  it('pg_partman 일 파티션 경계 → lo · hi 시각 문자열', () => {
    const b = "FOR VALUES FROM ('2026-09-20 00:00:00+09') TO ('2026-09-21 00:00:00+09')";
    expect(extract(b, 'lo')).toBe('2026-09-20 00:00:00+09');
    expect(extract(b, 'hi')).toBe('2026-09-21 00:00:00+09');
    // 두 값이 KST 자정 · 하루 폭이다(prune · ensureDayPartitions의 일 판정과 맞물린다)
    const iso = (s: string) => Date.parse(s.replace(' ', 'T').replace(/\+09$/, '+09:00'));
    expect(iso(extract(b, 'lo') as string)).toBe(kstMidnight(2026, 9, 20));
    expect(iso(extract(b, 'hi') as string) - iso(extract(b, 'lo') as string)).toBe(DAY_MS);
  });

  it('DEFAULT · MINVALUE/MAXVALUE 경계는 null — 일 파티션으로 오인하지 않는다', () => {
    expect(extract('DEFAULT', 'lo')).toBeNull();
    expect(extract('DEFAULT', 'hi')).toBeNull();
    const b = "FOR VALUES FROM (MINVALUE) TO ('2026-09-20 00:00:00+09')";
    expect(extract(b, 'lo')).toBeNull();
    expect(extract(b, 'hi')).toBe('2026-09-20 00:00:00+09');
    expect(extract("FOR VALUES FROM ('2026-09-29 00:00:00+09') TO (MAXVALUE)", 'hi')).toBeNull();
  });

  it('부모는 public.plc_tag_raw_control · DEFAULT(lo null)가 맨 앞', () => {
    expect(CONTROL_PARTITIONS_SQL).toContain("i.inhparent = 'public.plc_tag_raw_control'::regclass");
    expect(CONTROL_PARTITIONS_SQL).toMatch(/ORDER BY lo NULLS FIRST\s*$/);
  });
});

describe('ownerUrl — app_owner 접속 문자열', () => {
  const RW = 'postgres://app_rw:rw-secret@postgres:5432/plc?sslmode=disable';

  afterEach(() => vi.restoreAllMocks());

  it('호스트 · 포트 · DB · 질의 문자열은 그대로 두고 사용자만 app_owner로 바꾼다', () => {
    const u = new URL(ownerUrl(RW, { APP_OWNER_PASSWORD: 'owner-pw' }));
    expect(u.username).toBe('app_owner');
    expect(u.password).toBe('owner-pw');
    expect(u.host).toBe('postgres:5432');
    expect(u.pathname).toBe('/plc');
    expect(u.search).toBe('?sslmode=disable');
    expect(u.toString()).not.toContain('rw-secret');
  });

  it('특수 문자 비밀번호가 pg 접속 문자열 파서에서 원문으로 복원된다', () => {
    // pg가 실제로 쓰는 파서(pg-connection-string)로 복원 — 인코딩이 두 번 걸리거나 빠지면 인증이 틀린다
    const req = createRequire(__filename);
    const fromPg = createRequire(req.resolve('pg'));
    const { parse } = fromPg('pg-connection-string') as {
      parse: (s: string) => { user?: string; password?: string };
    };
    const printable = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
    for (const pw of ['p@ss:w/rd#?', 'a%20b%zz', 'ㅂㅁ번호-🔑', printable]) {
      const out = ownerUrl(RW, { APP_OWNER_PASSWORD: pw });
      expect(decodeURIComponent(new URL(out).password)).toBe(pw);
      const c = parse(out);
      expect(c.user).toBe('app_owner');
      expect(c.password).toBe(pw);
    }
  });

  it('APP_OWNER_PASSWORD가 없거나 CHANGE_ME면 거부 · 메시지에 접속 문자열 · 비밀이 없다', () => {
    for (const env of [{}, { APP_OWNER_PASSWORD: '' }, { APP_OWNER_PASSWORD: 'CHANGE_ME' }]) {
      let msg = '';
      try {
        ownerUrl(RW, env);
      } catch (e) {
        msg = (e as Error).message;
      }
      expect(msg).toMatch(/APP_OWNER_PASSWORD 없음/);
      expect(msg).not.toContain('rw-secret');
      expect(msg).not.toContain('postgres://');
    }
  });

  it('로그 · 표준 출력에 아무것도 쓰지 않고 env를 바꾸지 않는다 · 잘못된 URL 오류 메시지에도 비밀이 없다', () => {
    const spies = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(process.stdout, 'write'),
      vi.spyOn(process.stderr, 'write'),
    ];
    const env = { APP_OWNER_PASSWORD: 'owner-secret' };
    ownerUrl(RW, env);
    expect(env).toEqual({ APP_OWNER_PASSWORD: 'owner-secret' });
    let msg = '';
    try {
      ownerUrl('not a url', env);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).not.toBe('');
    expect(msg).not.toContain('owner-secret');
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
