// 명령 조회 표면 — docs/07_api/01_conventions.md §명령 조회 표면 #1 GET /api/v1/commands/{cmdId}(횡단 · BFF 경유 no-store)
// 읽는 순서: 결과 키 biz:result → 없으면 원장 biz_command_log → 둘 다 없으면 pending(알 수 없는 키도 pending — 소비 전과 가를 수 없다).
// 결과 키 또는 원장의 actor가 요청자와 다르면 404(둘 다 NULL이면 같다 · 인증 도입 S7 ② 전은 사실상 판정 없음).
// 결과 키 미스에서 원장 값으로 다시 채우지 않는다 — 결과 키는 워커만 쓴다(05_data_stores/05 §인계 판정 #11).
import {
  BizResult,
  type BizResultBody,
  type CommandStatusBodyT,
  commandStatusOf,
  ERROR_HTTP_STATUS,
  type ErrorCode,
} from '@db-study/shared';
import { Controller, Get, Header, Injectable, Param, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError, validationFailed } from '../../common/http/api-error';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { BizLedger, type LedgerRow } from './biz-ledger';
import { requestActor } from './idempotency';

/** 원장 행 → 결과 모양 — status · actor는 컬럼이 정본(result jsonb는 BizResult 모양이지만 필드만 골라 읽는다) */
export function resultFromLedger(row: LedgerRow): BizResultBody {
  const res = (row.result ?? {}) as Record<string, unknown>;
  const error = BizResult.shape.error.safeParse(res.error);
  return {
    status: row.status,
    actor: row.actor,
    ...(typeof res.httpStatus === 'number' ? { httpStatus: res.httpStatus } : {}),
    ...('body' in res ? { body: res.body } : {}),
    ...(error.success && error.data ? { error: error.data } : {}),
  };
}

@Injectable()
export class CommandLookup {
  constructor(
    private readonly cache: CacheKeyClient,
    private readonly ledgerRows: BizLedger,
  ) {}

  /** 결과 키 — 미스 · 읽기 실패(degrade) · 모양 위반은 null */
  async resultKey(cmdId: string): Promise<BizResultBody | null> {
    const r = await this.cache.getBizResult(cmdId);
    if (!r.value) return null;
    try {
      const p = BizResult.safeParse(JSON.parse(r.value));
      return p.success ? p.data : null;
    } catch {
      return null;
    }
  }

  /** 원장 — PostgreSQL 불가는 common.postgres_unavailable */
  async ledger(cmdId: string): Promise<BizResultBody | null> {
    const row = await this.ledgerRows.find(cmdId);
    return row ? resultFromLedger(row) : null;
  }

  /** 결과 키 → 원장 · 둘 다 없으면 null(pending) */
  async find(cmdId: string): Promise<BizResultBody | null> {
    return (await this.resultKey(cmdId)) ?? (await this.ledger(cmdId));
  }

  /** 응답 경로용 — 원장까지 못 읽으면 null(쓰기 응답은 202로 물러난다) */
  async findQuiet(cmdId: string): Promise<BizResultBody | null> {
    try {
      return await this.find(cmdId);
    } catch {
      return null;
    }
  }
}

/** 결과 → 조회 본문(status 5) */
export function commandBody(cmdId: string, r: BizResultBody | null): CommandStatusBodyT {
  if (!r) return { cmdId, status: 'pending' };
  const status = commandStatusOf(r);
  switch (status) {
    case 'applied':
      return { cmdId, status, httpStatus: r.httpStatus ?? 200, result: r.body ?? null };
    case 'rejected':
    case 'failed': {
      const error = r.error ?? {
        code: 'common.postgres_unavailable',
        message: 'PostgreSQL에 접속할 수 없다',
      };
      const httpStatus = r.httpStatus ?? ERROR_HTTP_STATUS[error.code as ErrorCode] ?? 503;
      return { cmdId, status, httpStatus, error };
    }
    default:
      return { cmdId, status };
  }
}

const CMD_ID = z.uuid();

@Controller('api/v1/commands')
export class CommandsController {
  constructor(private readonly lookup: CommandLookup) {}

  @Get(':cmdId')
  @Header('Cache-Control', 'no-store')
  async get(@Param('cmdId') raw: string, @Req() req: FastifyRequest): Promise<CommandStatusBodyT> {
    if (!CMD_ID.safeParse(raw).success) throw validationFailed([{ path: 'path.cmdId', reason: 'format' }]);
    const cmdId = raw.toLowerCase();
    const r = await this.lookup.find(cmdId);
    if (r && (r.actor ?? null) !== (requestActor(req) ?? null)) {
      throw new ApiError('common.not_found', '명령이 없다');
    }
    return commandBody(cmdId, r);
  }
}
