// 판정 경로 PostgreSQL 문장의 상한 — A1 규칙 조회 · ⑤ 확정 열기 · 닫기 · acked 조회(06_pipeline/08 §부분 실패)
// 트랜잭션 안 SET LOCAL statement_timeout으로 그 문장만 끊는다(store-stats 수집 쿼리와 같은 방식). 연결 획득 대기는 이 상한 밖이다 —
// PostgreSQL 장애의 비용은 배치 단위 멈춤(judge.ts BatchHalt)이 배치당 실패 1회로 묶는다.
import type { Pool, QueryResult, QueryResultRow } from 'pg';

/** 판정 경로 문장 상한(ms · 2계층 현행 참고 — 판정 구간 p95 ≤ 플러시 주기 관계 안) */
export const ALARM_PG_STATEMENT_TIMEOUT_MS = 1000;

export async function queryBounded<R extends QueryResultRow>(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<R>> {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN; SET LOCAL statement_timeout = ${ALARM_PG_STATEMENT_TIMEOUT_MS}`);
    const res = await client.query<R>(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
