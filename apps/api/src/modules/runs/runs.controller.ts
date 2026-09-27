// 라이브 실행 제어 표면 #2~#5 — 정본 docs/07_api/09_datagen.md §라이브 실행 제어(GEN-11 · 12)
// #2 POST /api/v1/runs(202) · #3 GET /api/v1/runs/current · #4 GET /api/v1/runs/{runId} · #5 POST /api/v1/runs/{runId}/stop(202 · 200)
// 게이트 없음(기본 존재) · 인증 · 인가(시작 · 중단 ENGINEER · ADMIN)는 S7 ② · BFF no-store.
import { type RunObjectBody, RunStartRequest } from '@db-study/shared';
import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiError, parseOrThrow } from '../../common/http/api-error';
import type { RunRegistry } from './run-registry';

export const RUN_REGISTRY = Symbol('RunRegistry');

const RunIdParam = z.strictObject({ runId: z.uuid() });

const notFound = () => new ApiError('common.not_found', '실행이 없다 — 옛 실행이거나 api 재기동 전 실행이다');

@Controller('api/v1/runs')
export class RunsController {
  constructor(@Inject(RUN_REGISTRY) private readonly runs: RunRegistry) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  start(@Body() b: unknown): RunObjectBody {
    const req = parseOrThrow(RunStartRequest, b ?? {}, 'body');
    return this.runs.start(req.type, { ...req.params }).toObject();
  }

  @Get('current')
  @Header('Cache-Control', 'no-store')
  current(): { run: RunObjectBody | null } {
    return { run: this.runs.currentRun()?.toObject() ?? null };
  }

  @Get(':runId')
  @Header('Cache-Control', 'no-store')
  one(@Param('runId') runId: string): RunObjectBody {
    const p = parseOrThrow(RunIdParam, { runId }, 'path');
    const s = this.runs.find(p.runId);
    if (!s) throw notFound();
    return s.toObject();
  }

  @Post(':runId/stop')
  @Header('Cache-Control', 'no-store')
  stop(@Param('runId') runId: string, @Res({ passthrough: true }) res: FastifyReply): RunObjectBody {
    const p = parseOrThrow(RunIdParam, { runId }, 'path');
    const out = this.runs.stop(p.runId);
    if (!out) throw notFound();
    res.status(out.httpStatus);
    return out.run;
  }
}
