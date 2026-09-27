// perf 라이브 실행 — 생성 식 · 규모 구간 · 동일 쿼리 5종 텍스트 · 단계 전이 · 취소 · 정리(정본 06_pipeline/10 §성능 비교 실행 · 05_data_stores/10 §실행 수명 객체)
// 저장소 없이 가짜 PerfStores로 본다. SQL은 문자열로 고정하고, 생성 식은 SQL 식을 JS로 옮긴 값과 판정 식(M1)을 대조한다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RunObject } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/common/http/api-error';
import { PerfRunExecutor, type PerfStores, perfSteps } from '../src/modules/runs/perf-runner';
import {
  chCreateSql,
  chFillParams,
  chFillSql,
  chKillSql,
  chQuerySql,
  PERF_QUERIES,
  type PerfQuery,
  type PerfQueryParams,
  PG_CREATE_CALL,
  PG_DROP_CALL,
  perfStartSec,
  perfStepCount,
  pgCreateArgs,
  pgFillParams,
  pgFillSql,
  pgQuerySql,
  queryArgs,
  scaleEndMs,
  scaleRows,
  scaleSeconds,
} from '../src/modules/runs/perf-sql';
import { RunRegistry } from '../src/modules/runs/run-registry';

describe('규모 구간 · 시각 축(M2)', () => {
  it('단계 수 = 3 × (max − 4) + 2 — 5 → 5 · 7 → 11 · 8 → 14', () => {
    expect([5, 7, 8].map(perfStepCount)).toEqual([5, 11, 14]);
    expect(perfSteps(7).map((s) => s.key)).toEqual([
      'prepare',
      'fill-ch@5',
      'fill-pg@5',
      'query@5',
      'fill-ch@6',
      'fill-pg@6',
      'query@6',
      'fill-ch@7',
      'fill-pg@7',
      'query@7',
      'cleanup',
    ]);
    expect(perfSteps(8)).toHaveLength(14);
  });

  it('증가분 행 번호 — k = 5 [0, 10^5) · k > 5 [10^(k−1), 10^k) · 누적 합 = 10^max', () => {
    expect(scaleRows(5)).toEqual({ lo: 0, hi: 100_000 });
    expect(scaleRows(6)).toEqual({ lo: 100_000, hi: 1_000_000 });
    expect(scaleRows(8)).toEqual({ lo: 10_000_000, hi: 100_000_000 });
    const total = [5, 6, 7].reduce((n, k) => n + scaleRows(k).hi - scaleRows(k).lo, 0);
    expect(total).toBe(10 ** 7);
  });

  it('S = 실행 시작(초 내림) − 10^max ÷ 10^4 · 마지막 규모 끝 = 실행 시작(미래 ts 없음)', () => {
    const start = Date.UTC(2026, 8, 28, 5, 12, 3, 740);
    const S = perfStartSec(start, 7);
    expect(S).toBe(Math.floor(start / 1000) - 1000);
    expect(scaleSeconds(S, 5)).toEqual({ from: S, to: S + 10 });
    expect(scaleSeconds(S, 6)).toEqual({ from: S + 10, to: S + 100 });
    expect(scaleSeconds(S, 7)).toEqual({ from: S + 100, to: S + 1000 });
    expect(scaleEndMs(S, 7)).toBe(Math.floor(start / 1000) * 1000);
  });

  it('PostgreSQL 생성 구간 — [S, S + 10^max ÷ 10^4초) UTC(파티션은 함수가 UTC 일로 가른다)', () => {
    const S = Date.UTC(2026, 8, 28, 23, 0, 0) / 1000;
    expect(pgCreateArgs(S, 8)).toEqual(['2026-09-28T23:00:00.000Z', '2026-09-29T01:46:40.000Z']);
    expect(PG_CREATE_CALL).toBe('SELECT run_perf_create($1::timestamptz, $2::timestamptz) AS parts');
    expect(PG_DROP_CALL).toBe('SELECT run_perf_drop()');
  });
});

describe('생성 식(M1) — 두 저장소 같은 식', () => {
  /** 판정 식 그대로 */
  const spec = (n: number, S: number) => {
    const sec = Math.floor(n / 10000);
    const idx = n % 10000;
    const tag = idx + 1;
    return {
      ts: S + sec,
      device: Math.floor(idx / 200) + 1,
      tag,
      value: ((tag * 7 + sec * 13) % 1000) / 10,
      quality: 9,
    };
  };
  /** SQL 식을 JS로 옮긴 것 — intDiv · % · 정수 산술 뒤 ÷ 10 한 번 */
  const sqlExpr = (n: number, S: number) => ({
    ts: S + Math.floor(n / 10000),
    device: Math.floor((n % 10000) / 200) + 1,
    tag: (n % 10000) + 1,
    value: ((((n % 10000) + 1) * 7 + Math.floor(n / 10000) * 13) % 1000) / 10,
    quality: 9,
  });

  it('행 번호 표본에서 판정 식과 같다(device 1~50 · tag 1~10000)', () => {
    const S = 1_790_000_000;
    for (const n of [0, 1, 199, 200, 9999, 10000, 123_456, 99_999_999])
      expect(sqlExpr(n, S)).toEqual(spec(n, S));
    expect(spec(9999, S).device).toBe(50);
    expect(spec(9999, S).tag).toBe(10000);
  });

  it('ClickHouse 채우기 — numbers(lo, cnt) · ORDER BY number · 식 · UTC · quality 9', () => {
    const sql = chFillSql();
    expect(sql).toContain('INSERT INTO plc.run_perf_raw (ts, device_id, tag_id, value, quality, scan_seq)');
    expect(sql).toContain("toDateTime64({s:Int64} + intDiv(number, 10000), 3, 'UTC')");
    expect(sql).toContain('toUInt32(intDiv(number % 10000, 200) + 1) AS device_id');
    expect(sql).toContain('toUInt32(number % 10000 + 1) AS tag_id');
    expect(sql).toContain('((number % 10000 + 1) * 7 + intDiv(number, 10000) * 13) % 1000 / 10 AS value');
    expect(sql).toContain('toUInt8(9) AS quality');
    expect(sql).toContain('FROM numbers({lo:UInt64}, {cnt:UInt64})\nORDER BY number');
    expect(chFillParams(100, 6)).toEqual({ s: 100, lo: 100_000, cnt: 900_000 });
  });

  it('PostgreSQL 채우기 — generate_series(lo, hi) · ORDER BY n · 같은 식 · 대조군 컬럼 순서', () => {
    const sql = pgFillSql();
    expect(sql).toContain('INSERT INTO run_perf_raw (ts, value, scan_seq, device_id, tag_id, quality)');
    expect(sql).toContain('to_timestamp($1::bigint + n / 10000)');
    expect(sql).toContain('(((n % 10000 + 1) * 7 + (n / 10000) * 13) % 1000)::double precision / 10');
    expect(sql).toContain('(n % 10000) / 200 + 1');
    expect(sql).toContain('FROM generate_series($2::bigint, $3::bigint) AS n\nORDER BY n');
    expect(pgFillParams(100, 5)).toEqual([100, 0, 99_999]);
    expect(pgFillParams(100, 7)).toEqual([100, 1_000_000, 9_999_999]);
  });
});

describe('실행 수명 객체 DDL · 동일 쿼리 5종(테이블 이름만 run_perf_raw)', () => {
  it('ClickHouse — tag_raw 동형 · TTL 없음 · UTC', () => {
    const sql = chCreateSql();
    expect(sql).toContain('CREATE TABLE plc.run_perf_raw');
    expect(sql).toContain("ts          DateTime64(3, 'UTC')");
    expect(sql).toContain(
      'ENGINE = MergeTree\nPARTITION BY toYYYYMMDD(ts)\nORDER BY (device_id, tag_id, ts)',
    );
    expect(sql).not.toContain('TTL');
  });

  it('PostgreSQL — 마이그레이션 010: app_owner SECURITY DEFINER 함수 2 · LIKE 대조군 · UTC 일 파티션 · I2 · app_rw 권한', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../infra/postgres/migrations/010_run_perf_functions.sql'),
      'utf8',
    );
    expect(sql).toContain('SET ROLE app_owner;');
    expect(sql.match(/SECURITY DEFINER SET search_path = public/g)).toHaveLength(2);
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS run_perf_raw (LIKE plc_tag_raw_control INCLUDING DEFAULTS) PARTITION BY RANGE (ts)',
    );
    expect(sql).toContain('ON run_perf_raw USING brin (ts)');
    expect(sql).toContain('ON run_perf_raw (device_id, tag_id, ts)');
    expect(sql).toContain("d := date_trunc('day', p_from AT TIME ZONE 'UTC');");
    expect(sql).toContain('GRANT SELECT, INSERT, MAINTAIN ON run_perf_raw TO app_rw');
    expect(sql).toContain('DROP TABLE IF EXISTS run_perf_raw CASCADE');
    expect(sql).toContain('REVOKE ALL ON FUNCTION run_perf_create(timestamptz, timestamptz) FROM PUBLIC');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION run_perf_drop() TO app_rw');
  });

  it('쿼리 텍스트 — grid.py CH_SQL · PG_PREPARE와 같다(시간대 인자 UTC)', () => {
    expect(chQuerySql('Q1')).toBe(`SELECT ts, value, quality FROM plc.run_perf_raw
WHERE device_id = {device:UInt32} AND tag_id = {tag:UInt32} AND ts >= {end:DateTime64(3, 'UTC')} - INTERVAL 1 HOUR AND ts < {end:DateTime64(3, 'UTC')}
ORDER BY ts`);
    expect(chQuerySql('Q4')).toContain('countIf(quality IN (2, 4))');
    expect(chQuerySql('Q5')).toBe('SELECT count() FROM plc.run_perf_raw WHERE value > {v:Float64}');
    expect(
      pgQuerySql('Q2'),
    ).toBe(`SELECT date_trunc('hour', ts) AS b, avg(value), min(value), max(value), count(*) FROM run_perf_raw
WHERE device_id = $1::integer AND tag_id = $2::integer AND ts >= $3::timestamptz - interval '7 days' AND ts < $3::timestamptz
GROUP BY b ORDER BY b`);
    expect(pgQuerySql('Q3')).toContain("ts >= $2::timestamptz - interval '1 day' AND ts < $2::timestamptz");
    expect(pgQuerySql('Q4')).toContain('count(*) FILTER (WHERE quality IN (2, 4))');
    expect(pgQuerySql('Q5')).toBe('SELECT count(*) FROM run_perf_raw WHERE value > $1::double precision');
    // 자리표시 타입은 grid.py PREPARE q(integer, integer, timestamptz · double precision)와 같게 캐스트로 준다
    expect(pgQuerySql('Q1')).toContain('$3::timestamptz - interval');
    // Q5x(조건 없는 count)는 돌리지 않는다
    expect(PERF_QUERIES).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
  });

  it('매개변수 — 두 저장소 같은 값 · {end}는 UTC', () => {
    const p: PerfQueryParams = { device: 1, tag: 1, endMs: Date.UTC(2026, 8, 28, 5, 0, 0), v: 49.95 };
    expect(queryArgs('Q1', p)).toEqual({
      ch: { device: 1, tag: 1, end: '2026-09-28 05:00:00.000' },
      pg: [1, 1, '2026-09-28T05:00:00.000Z'],
    });
    expect(queryArgs('Q4', p).pg).toEqual(['2026-09-28T05:00:00.000Z']);
    expect(queryArgs('Q5', p)).toEqual({ ch: { v: 49.95 }, pg: [49.95] });
  });

  it('KILL QUERY는 runId 접두만 겨눈다 · 식별자 형식 검사', () => {
    expect(chKillSql('7d3f0a52-1c2e-4b8e-9a61-3f5e2b9c4d10')).toBe(
      "KILL QUERY WHERE startsWith(query_id, '7d3f0a52-1c2e-4b8e-9a61-3f5e2b9c4d10') ASYNC",
    );
    expect(() => chKillSql("x' OR 1=1 --")).toThrow();
    expect(() => chCreateSql({ ch: 'bad name', pg: 'x' })).toThrow();
  });
});

// ── 실행기

type Hook = (op: string) => Promise<void> | void;

class FakeStores implements PerfStores {
  log: string[] = [];
  hook: Hook = () => undefined;
  cancelled = 0;
  cleanupError: Error | null = null;
  private pending: { reject: (e: Error) => void } | null = null;
  private async op(name: string) {
    this.log.push(name);
    await this.hook(name);
  }
  /** 시험이 걸어 둔 문장 — cancel이 거절시킨다 */
  block(): Promise<void> {
    return new Promise((_, reject) => {
      this.pending = { reject };
    });
  }
  async prepare() {
    await this.op('prepare');
    return 2;
  }
  async fillCh(k: number) {
    await this.op(`fillCh@${k}`);
  }
  async fillPg(k: number) {
    await this.op(`fillPg@${k}`);
  }
  async storageBytesCh() {
    return 1000;
  }
  async storageBytesPg() {
    return 3000;
  }
  async queryParams() {
    this.log.push('params');
    return { device: 1, tag: 1, v: 49.95 };
  }
  async queryCh(q: PerfQuery) {
    await this.op(`ch:${q}`);
    return q === 'Q1' ? 10 : 1;
  }
  async queryPg(q: PerfQuery) {
    await this.op(`pg:${q}`);
    return q === 'Q1' ? 10 : 1;
  }
  async cancel() {
    this.cancelled += 1;
    this.pending?.reject(new Error('canceling statement due to user request'));
    this.pending = null;
  }
  async cleanup() {
    await this.op('cleanup');
    if (this.cleanupError) throw this.cleanupError;
    return 2;
  }
}

let mono = 0;
const clock = { nowMs: () => Date.now(), monoMs: () => (mono += 5) };

async function runPerf(
  stores: FakeStores,
  maxExponent: number,
  onStart?: (reg: RunRegistry, id: string) => void,
) {
  const reg = new RunRegistry([new PerfRunExecutor(stores, clock)]);
  const s = reg.start('perf', { maxExponent });
  onStart?.(reg, s.runId);
  await reg.settled();
  return RunObject.parse(s.toObject());
}

describe('perf 실행기 — 단계 전이 · 결과 · 종결 3', () => {
  it('완료 — 전 단계 done · 규모마다 Q1~Q5 × 두 저장소 × (워밍업 1 + 3) · 결과 scales', async () => {
    const st = new FakeStores();
    const o = await runPerf(st, 6);
    expect(o.status).toBe('completed');
    expect(o.error).toBeNull();
    expect(o.steps.every((x) => x.status === 'done')).toBe(true);
    expect(o.steps[0]?.detail).toEqual({ objects: 2 });
    expect(o.steps.find((x) => x.key === 'fill-ch@6')?.detail).toMatchObject({
      rows: 900_000,
      storageBytes: 1000,
    });
    expect(o.steps.find((x) => x.key === 'query@5')?.detail).toEqual({ done: 10, total: 10 });
    expect(o.steps.at(-1)?.detail).toEqual({ objects: 2 });
    expect(st.log.filter((x) => x === 'ch:Q3')).toHaveLength(2 * 4);
    // Q5 문턱 · 쿼리 쌍은 첫 규모 직후 한 번
    expect(st.log.filter((x) => x === 'params')).toHaveLength(1);
    const res = o.result as {
      scales: { exponent: number; rows: number; queries: { values?: number[] }[] }[];
    };
    expect(res.scales.map((s) => [s.exponent, s.rows])).toEqual([
      [5, 100_000],
      [6, 1_000_000],
    ]);
    const q1 = (o.result as { scales: { queries: Record<string, unknown>[] }[] }).scales[0]?.queries[0];
    expect(q1).toMatchObject({
      q: 'Q1',
      ch: { values: [5, 5, 5], median: 5, rows: 10 },
      resultMatch: true,
      ratio: 1,
    });
    // 순서: prepare → fill-ch@5 → fill-pg@5 → query → … → cleanup
    expect(st.log.slice(0, 3)).toEqual(['prepare', 'fillCh@5', 'fillPg@5']);
    expect(st.log.at(-1)).toBe('cleanup');
  });

  it('중단(fill-pg@5 진행 중) — 취소 호출 · 진행 중 stopped · 나머지 skipped · cleanup done · stopped · 반쪽 규모 미기재', async () => {
    const st = new FakeStores();
    let reg: RunRegistry | null = null;
    let id = '';
    st.hook = (op) => {
      if (op === 'fillPg@5') {
        const p = st.block();
        reg?.stop(id);
        return p;
      }
    };
    const o = await runPerf(st, 7, (r, runId) => {
      reg = r;
      id = runId;
    });
    expect(st.cancelled).toBe(1);
    expect(o.status).toBe('stopped');
    expect(o.error).toBeNull();
    expect(o.steps.map((x) => x.status)).toEqual([
      'done',
      'done',
      'stopped',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
      'done',
    ]);
    expect((o.result as { scales: unknown[] }).scales).toEqual([]);
  });

  it('단계 예외 — failed · error 기존 코드 · cleanup은 돈다', async () => {
    const st = new FakeStores();
    st.hook = (op) => {
      if (op === 'fillCh@6') throw new ApiError('common.postgres_unavailable', '디스크 부족');
    };
    const o = await runPerf(st, 6);
    expect(o.status).toBe('failed');
    expect(o.error).toEqual({ code: 'common.postgres_unavailable', message: '디스크 부족' });
    expect(o.steps.map((x) => x.status)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'failed',
      'skipped',
      'skipped',
      'done',
    ]);
    expect(st.log.at(-1)).toBe('cleanup');
    // 끝난 규모(10^5)는 싣는다
    expect((o.result as { scales: unknown[] }).scales).toHaveLength(1);
  });

  it('정상 경로 정리 실패 → failed(객체가 남은 실행을 완료로 보이지 않는다) · cleanup failed', async () => {
    const st = new FakeStores();
    st.cleanupError = new Error('DROP 실패');
    const o = await runPerf(st, 5);
    expect(o.status).toBe('failed');
    expect(o.error).toEqual({ code: null, message: 'DROP 실패' });
    expect(o.steps.at(-1)?.status).toBe('failed');
  });

  it('중단 뒤 정리 실패 → stopped 유지 · error {code null, message}', async () => {
    const st = new FakeStores();
    st.cleanupError = new ApiError('common.postgres_unavailable', 'pg 끊김');
    let reg: RunRegistry | null = null;
    let id = '';
    st.hook = (op) => {
      if (op === 'fillCh@5') reg?.stop(id);
    };
    const o = await runPerf(st, 5, (r, runId) => {
      reg = r;
      id = runId;
    });
    expect(o.status).toBe('stopped');
    expect(o.error).toEqual({ code: null, message: 'pg 끊김' });
    // 단계 경계에서 받은 중단 — fill-ch@5는 끝났으므로 done
    expect(o.steps.map((x) => x.status)).toEqual(['done', 'done', 'skipped', 'skipped', 'failed']);
  });

  it('cleanup 중 중단 → 무시 · completed', async () => {
    const st = new FakeStores();
    let reg: RunRegistry | null = null;
    let id = '';
    let resp: number | undefined;
    st.hook = (op) => {
      if (op === 'cleanup') resp = reg?.stop(id)?.httpStatus;
    };
    const o = await runPerf(st, 5, (r, runId) => {
      reg = r;
      id = runId;
    });
    expect(resp).toBe(202);
    expect(st.cancelled).toBe(0);
    expect(o.status).toBe('completed');
  });
});
