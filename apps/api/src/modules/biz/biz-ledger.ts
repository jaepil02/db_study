// 업무 명령 멱등 원장 biz_command_log — 정본 docs/05_data_stores/01_postgresql_schema.md §biz_command_log 설계 · 기전 06_pipeline/07 §멱등 · 재전달
// APPLIED 행은 업무 트랜잭션 안(COMMIT 직전) — 기존 쓰기 서비스의 tx()가 bizBeforeCommit 훅을 부른다(AsyncLocalStorage 범위가 있을 때만).
// REJECTED · EXPIRED 행은 롤백 뒤 별도 트랜잭션(단문 INSERT 자동 커밋). PostgreSQL 불가는 행을 남기지 않는다(결과 키만).
// 원장은 추가 전용이다(UPDATE · DELETE 권한 없음 — 008) · result jsonb = 결과 키 biz:result와 같은 모양(BizResult).
import { AsyncLocalStorage } from 'node:async_hooks';
import type { BizResultBody } from '@db-study/shared';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ApiError } from '../../common/http/api-error';
import { Postgres } from '../../common/postgres/postgres.module';
import type { BizApplyTrace } from './biz-contracts';

export type LedgerStatus = 'APPLIED' | 'REJECTED' | 'EXPIRED';

export interface LedgerRow {
  status: LedgerStatus;
  result: BizResultBody;
  actor: number | null;
}

/** 원장에 쓸 명령 식별 — 봉투 → 원장 대응(cmdId · kind · actor · requestedAt · payload는 싣지 않는다) */
export interface LedgerKey {
  cmdId: string;
  kind: string;
  actor: number | null;
  requestedAt: number;
}

/** 원장 UNIQUE(cmd_id) 충돌 — 겹친 워커 · 같은 cmdId가 먼저 판정됐다. 도메인 오류가 아니다(워커는 저장된 판정을 다시 읽는다) */
export class BizLedgerConflict extends Error {
  constructor(readonly cmdId: string) {
    super(`biz_command_log cmd_id ${cmdId} 이미 있다`);
  }
}

const pgDown = () => new ApiError('common.postgres_unavailable', 'PostgreSQL에 접속할 수 없다');

const INSERT_SQL = `INSERT INTO biz_command_log (cmd_id, kind, status, result, actor, requested_at)
  VALUES ($1, $2, $3, $4, $5, to_timestamp($6::double precision / 1000))`;

function insertArgs(k: LedgerKey, status: LedgerStatus, result: BizResultBody): unknown[] {
  return [k.cmdId, k.kind, status, JSON.stringify(result), k.actor, k.requestedAt];
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === '23505';

// ── 적용 범위(AsyncLocalStorage) — BizHandlers.apply가 열고 기존 쓰기 서비스의 tx() · 체인이 채운다

export interface BizApplyScope {
  /** 원장 APPLIED 행을 넣을 명령 — null이면(SW-12 direct) 넣지 않는다 */
  ledger: (LedgerKey & { httpStatus: number }) | null;
  trace: BizApplyTrace;
}

const scopeStore = new AsyncLocalStorage<BizApplyScope>();

export const emptyTrace = (): BizApplyTrace => ({
  txMs: null,
  invalidateMs: null,
  invalidatedKeys: 0,
  cacheinv: false,
});

export function runInBizScope<T>(scope: BizApplyScope, fn: () => Promise<T>): Promise<T> {
  return scopeStore.run(scope, fn);
}

/** 트랜잭션 안 COMMIT 직전 — 범위에 원장 명령이 있으면 APPLIED 행(업무 행 · audit_log와 같은 트랜잭션) */
export async function bizBeforeCommit(c: PoolClient, body: unknown): Promise<void> {
  const s = scopeStore.getStore();
  if (!s?.ledger) return;
  const { httpStatus, ...key } = s.ledger;
  const result: BizResultBody = { status: 'APPLIED', actor: key.actor, httpStatus, body };
  try {
    await c.query(INSERT_SQL, insertArgs(key, 'APPLIED', result));
  } catch (e) {
    if (isUniqueViolation(e)) throw new BizLedgerConflict(key.cmdId);
    throw e;
  }
}

/** ⑤ BEGIN → COMMIT 또는 롤백 ms */
export function noteBizTx(startedAt: number): void {
  const s = scopeStore.getStore();
  if (s) s.trace.txMs = performance.now() - startedAt;
}

/** ⑥ 체인 ②③ — 지운 키 수 · ch:cacheinv 발행 여부 · ms */
export function noteBizInvalidation(startedAt: number, deletedKeys: number, cacheinv: boolean): void {
  const s = scopeStore.getStore();
  if (!s) return;
  s.trace.invalidateMs = performance.now() - startedAt;
  s.trace.invalidatedKeys += deletedKeys;
  s.trace.cacheinv = s.trace.cacheinv || cacheinv;
}

@Injectable()
export class BizLedger {
  constructor(private readonly pg: Postgres) {}

  /** ③ 멱등 확인 · 명령 조회 — 행이 없으면 null · PostgreSQL 불가면 common.postgres_unavailable */
  async find(cmdId: string): Promise<LedgerRow | null> {
    let r: { rows: Record<string, unknown>[] };
    try {
      r = await this.pg.pool.query('SELECT status, result, actor FROM biz_command_log WHERE cmd_id = $1', [
        cmdId,
      ]);
    } catch {
      throw pgDown();
    }
    const row = r.rows[0];
    if (!row) return null;
    return {
      status: row.status as LedgerStatus,
      result: row.result as BizResultBody,
      actor: row.actor === null || row.actor === undefined ? null : Number(row.actor),
    };
  }

  /**
   * REJECTED · EXPIRED — 별도 트랜잭션(단문). 'conflict'면 같은 cmdId가 먼저 판정됐다(저장된 판정을 다시 읽는다).
   * 다른 실패는 common.postgres_unavailable — 거절은 결과 키로만 남고 같은 키 재요청이 판정을 다시 계산한다.
   */
  async record(
    key: LedgerKey,
    status: 'REJECTED' | 'EXPIRED',
    result: BizResultBody,
  ): Promise<'inserted' | 'conflict'> {
    try {
      await this.pg.pool.query(INSERT_SQL, insertArgs(key, status, result));
      return 'inserted';
    } catch (e) {
      if (isUniqueViolation(e)) return 'conflict';
      throw pgDown();
    }
  }
}
