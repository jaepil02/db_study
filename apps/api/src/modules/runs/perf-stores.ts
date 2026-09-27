// perf 저장소 동작 — 정본 docs/06_pipeline/10_datagen_inject.md §성능 비교 실행 — perf · §취소 · 정리 · 판정 .omc/run-fix-rulings.md M7
// PostgreSQL: 런타임은 app_rw뿐이다(DDL 권한 없음) — 객체 생성 · 정리는 SECURITY DEFINER 함수 run_perf_create · run_perf_drop(마이그레이션 010).
//   채우기 · ANALYZE · 쿼리는 실행 수명 동안 전용 연결 1(풀 밖 · app_rw)로 하고 prepare에서 pg_backend_pid를 기록한다.
//   취소는 다른 연결(풀 · 같은 역할 app_rw)에서 그 pid에 pg_cancel_backend. 세션 시간대 UTC(ADR-27).
// ClickHouse: 긴 INSERT … SELECT를 위해 요청 상한이 긴 전용 클라이언트 · 문장마다 query_id = {runId}:{순번} — KILL QUERY가 이 실행만 겨눈다.
import type { ClickHouseClient } from '@clickhouse/client';
import { Client, type Pool } from 'pg';
import type { PerfStores } from './perf-runner';
import {
  chCreateSql,
  chDropSql,
  chFillParams,
  chFillSql,
  chKillSql,
  chParamsSql,
  chQuerySql,
  chStorageSql,
  PERF_NAMES,
  type PerfNames,
  type PerfQuery,
  type PerfQueryParams,
  PG_CREATE_CALL,
  PG_DROP_CALL,
  PG_EXISTS_SQL,
  pgAnalyzeSql,
  pgCreateArgs,
  pgFillParams,
  pgFillSql,
  pgQuerySql,
  pgStorageSql,
  queryArgs,
} from './perf-sql';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** DROP IF EXISTS 둘 — cleanup · 부팅 정리가 같은 함수를 쓴다(객체가 이미 없어도 실패하지 않는다) */
export async function dropPerfObjects(ch: ClickHouseClient, pool: Pick<Pool, 'query'>): Promise<number> {
  const errors: string[] = [];
  await ch.command({ query: chDropSql() }).catch((e: unknown) => errors.push(`ClickHouse — ${msg(e)}`));
  await pool.query(PG_DROP_CALL).catch((e: unknown) => errors.push(`PostgreSQL — ${msg(e)}`));
  if (errors.length) throw new Error(`실행 객체 DROP 실패 — ${errors.join(' · ')}`);
  return 2;
}

export class LivePerfStores implements PerfStores {
  private pg: Client | null = null;
  private pid: number | null = null;
  private runId = '';
  private seq = 0;

  constructor(
    /** 요청 상한이 긴 전용 ClickHouse 클라이언트 */
    private readonly ch: ClickHouseClient,
    /** 런타임 접속 문자열(app_rw) — 전용 연결을 이것으로 연다 */
    private readonly postgresUrl: string,
    /** 풀(app_rw) — 취소 · 정리 · 남은 객체 확인 */
    private readonly pool: Pick<Pool, 'query'>,
    private readonly names: PerfNames = PERF_NAMES,
  ) {}

  private qid(): string {
    this.seq += 1;
    return `${this.runId}:${this.seq}`;
  }

  private conn(): Client {
    if (!this.pg) throw new Error('전용 PostgreSQL 연결 없음 — prepare 전');
    return this.pg;
  }

  async prepare(runId: string, startSec: number, maxExponent: number): Promise<number> {
    this.runId = runId;
    this.seq = 0;
    // 남은 객체와 부딪히면 이어 쓰지 않는다 — 앞 실행의 행이 섞인 채 재면 결과가 틀린다(부팅 정리 · 정리 실패의 잔여)
    const left = await this.pool.query(PG_EXISTS_SQL);
    if (left.rows[0]?.present)
      throw new Error(
        '실행 수명 객체 run_perf_raw가 남아 있다(앞 실행의 정리 실패) — 이번 실행의 정리가 지운다 · 다시 시작',
      );
    const c = new Client({ connectionString: this.postgresUrl, application_name: 'db_study-run-perf' });
    c.on('error', () => undefined); // 취소 · 끊김은 문장 쪽에서 드러난다
    await c.connect();
    this.pg = c;
    await c.query("SET TIME ZONE 'UTC'");
    const r = await c.query('SELECT pg_backend_pid() AS pid');
    this.pid = Number(r.rows[0]?.pid);
    await this.ch.command({ query: chCreateSql(this.names), query_id: this.qid() });
    await c.query(PG_CREATE_CALL, pgCreateArgs(startSec, maxExponent));
    return 2;
  }

  async fillCh(k: number, startSec: number): Promise<void> {
    await this.ch.command({
      query: chFillSql(this.names),
      query_params: chFillParams(startSec, k),
      query_id: this.qid(),
    });
  }

  async fillPg(k: number, startSec: number): Promise<void> {
    const c = this.conn();
    await c.query(pgFillSql(this.names), pgFillParams(startSec, k));
    await c.query(pgAnalyzeSql(this.names));
  }

  async storageBytesCh(): Promise<number> {
    const rs = await this.ch.query({
      query: chStorageSql(),
      query_params: { t: this.names.ch },
      format: 'JSONEachRow',
      query_id: this.qid(),
    });
    const rows = await rs.json<{ b: string }>();
    return Number(rows[0]?.b ?? 0);
  }

  async storageBytesPg(): Promise<number> {
    const r = await this.conn().query(pgStorageSql(), [this.names.pg]);
    return Number(r.rows[0]?.b ?? 0);
  }

  async queryParams(): Promise<{ device: number; tag: number; v: number }> {
    const rs = await this.ch.query({
      query: chParamsSql(this.names),
      format: 'JSONEachRow',
      query_id: this.qid(),
    });
    const row = (await rs.json<{ device: number | string; tag: number | string; v: string }>())[0];
    if (!row) throw new Error('쿼리 매개변수 조회 결과 없음');
    return { device: Number(row.device), tag: Number(row.tag), v: Number(row.v) };
  }

  async queryCh(q: PerfQuery, p: PerfQueryParams): Promise<number> {
    const rs = await this.ch.query({
      query: chQuerySql(q, this.names),
      query_params: queryArgs(q, p).ch,
      format: 'JSONCompactEachRow',
      query_id: this.qid(),
    });
    return (await rs.json<unknown[]>()).length;
  }

  async queryPg(q: PerfQuery, p: PerfQueryParams): Promise<number> {
    // 이름 붙은 준비문 — 연결마다 한 번 PREPARE(grid.py와 같은 서버 쪽 바인딩)
    const r = await this.conn().query({
      name: `run_${q}`,
      text: pgQuerySql(q, this.names),
      values: queryArgs(q, p).pg,
    });
    return r.rowCount ?? r.rows.length;
  }

  async cancel(): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    if (this.runId) jobs.push(this.ch.command({ query: chKillSql(this.runId) }));
    // 같은 역할(app_rw) 백엔드라 슈퍼유저 없이 신호할 수 있다
    if (this.pid !== null) jobs.push(this.pool.query('SELECT pg_cancel_backend($1)', [this.pid]));
    await Promise.allSettled(jobs);
  }

  async cleanup(): Promise<number> {
    const c = this.pg;
    this.pg = null;
    this.pid = null;
    if (c) await c.end().catch(() => undefined);
    return dropPerfObjects(this.ch, this.pool);
  }
}
