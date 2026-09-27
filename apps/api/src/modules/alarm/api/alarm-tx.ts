// 알람 쓰기 트랜잭션 · 감사 — master-write.service.ts의 tx() · audit()와 같은 모양(06_pipeline/07 §감사 트랜잭션)
// 쓰기 하나 = 트랜잭션 하나(변경 + audit_log · 감사 실패는 변경 전체 롤백 — REQ-ALM-03 · 15).
// 인증 전(S7 ②까지) 감사 행위자는 NULL이다 — 확인도 같다(07_api/07 §인증 전 확인 행위자 판정 · 확인 감사 행).
// 업무 명령 경로(SW-12 stream)에서는 명령 워커가 부른다 — 원장 APPLIED 행은 COMMIT 직전 같은 트랜잭션(bizBeforeCommit · 06_pipeline/07 §적용 단계 ⑤).
// 캐시 무효화는 커밋 뒤에만 건다 — 커밋 전에 지우면 그 사이 조회 · 판정이 옛 값으로 사본을 다시 채운다(REQ-ALM-02 · 13).
import type { PoolClient } from 'pg';
import { ApiError, validationFailed } from '../../../common/http/api-error';
import type { Postgres } from '../../../common/postgres/postgres.module';
import { BizLedgerConflict, bizBeforeCommit, noteBizTx } from '../../biz/biz-ledger';

export const pgDown = () => new ApiError('common.postgres_unavailable', 'PostgreSQL에 접속할 수 없다');

/** 제약 위반 → 설계된 실패 · 그 밖(접속 · 타임아웃)은 postgres_unavailable */
export function mapPgError(e: unknown): never {
  if (e instanceof ApiError) throw e;
  const err = e as { code?: string; constraint?: string };
  // alarm_rule.tag_id 외래 키 — 쓰기 본문이 참조하는 대상 없음은 400 reference(07_api/01 §요청 검증과 성공 본문)
  if (err.code === '23503') throw validationFailed([{ path: 'body.tagId', reason: 'reference' }]);
  if (err.code === '23514') throw validationFailed([{ path: 'body', reason: 'range' }]);
  throw pgDown();
}

/** 트랜잭션 — 성공하면 결과와 커밋 뒤 작업을 돌려준다. afterCommit은 COMMIT이 성공한 뒤에만 부른다 */
export async function inTx<T>(
  pg: Postgres,
  fn: (c: PoolClient) => Promise<{ result: T; afterCommit?: () => Promise<void> }>,
): Promise<T> {
  let client: PoolClient;
  try {
    client = await pg.pool.connect();
  } catch {
    throw pgDown();
  }
  let out: { result: T; afterCommit?: () => Promise<void> };
  const t0 = performance.now();
  try {
    await client.query('BEGIN');
    out = await fn(client);
    await bizBeforeCommit(client, out.result);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    noteBizTx(t0);
    if (e instanceof BizLedgerConflict) throw e;
    mapPgError(e);
  } finally {
    client.release();
  }
  noteBizTx(t0);
  if (out.afterCommit) await out.afterCommit();
  return out.result;
}

/** 감사 — 인증 전 행위자 NULL · 물리 DELETE 없음(INSERT · UPDATE만) */
export async function audit(
  c: PoolClient,
  action: 'INSERT' | 'UPDATE',
  table: 'alarm_rule' | 'alarm_event',
  key: string | number,
  before: unknown,
  after: unknown,
): Promise<void> {
  await c.query(
    `INSERT INTO audit_log (user_id, action, target_table, target_key, before_value, after_value)
     VALUES (NULL, $1, $2, $3, $4, $5)`,
    [action, table, String(key), before === null ? null : JSON.stringify(before), JSON.stringify(after)],
  );
}
