// 라이브 실행 제어 표면 #2~#5 — 정본 docs/07_api/09_datagen.md §라이브 실행 제어(GEN-12)
// #2 POST /api/v1/runs(202) · #3 GET /api/v1/runs/current · #4 GET /api/v1/runs/{runId} · #5 POST /api/v1/runs/{runId}/stop(202 · 200)
// D-16: GET /api/v1/runs/latest?type=compare(직접 비교 부분별 최근 결과 — PG run_result)
// 게이트 없음(기본 존재) · 인증 · 인가 없음(D-16 — 로그인 · 권한 삭제) · BFF no-store.
// 상태를 바꾸는 #2 · #5는 Content-Type application/json의 JSON 객체 본문이 필요하다(#5는 빈 객체 {} — requireJsonBody · 지침서 §5-4).
import { type CompareLatestBodyType, type RunObjectBody, RunStartRequest } from '@db-study/shared';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiError, parseOrThrow } from '../../common/http/api-error';
import { requireJsonBody } from '../../common/http/surface-defense';
import type { RunRegistry } from './run-registry';
import { RUN_RESULTS, type RunResultReader } from './run-result';

export const RUN_REGISTRY = Symbol('RunRegistry');

const LatestQuery = z.strictObject({ type: z.literal('compare') });
/** #5 본문 — 빈 객체만(모르는 키 400) */
const StopBody = z.strictObject({});

// runId는 randomUUID(소문자)로 발급한다 — 대문자로 온 같은 값을 404로 보내지 않게 정규화(commands.controller cmdId와 같다)
const RunIdParam = z.strictObject({ runId: z.uuid().transform((s) => s.toLowerCase()) });

const notFound = () => new ApiError('common.not_found', '실행이 없다 — 옛 실행이거나 api 재기동 전 실행이다');

@Controller('api/v1/runs')
export class RunsController {
  constructor(
    @Inject(RUN_REGISTRY) private readonly runs: RunRegistry,
    @Inject(RUN_RESULTS) private readonly results: RunResultReader,
  ) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  async start(@Body() b: unknown, @Headers('content-type') ct: string | undefined): Promise<RunObjectBody> {
    const req = parseOrThrow(RunStartRequest, requireJsonBody(ct, b), 'body');
    return (await this.runs.begin(req.type, { ...req.params })).toObject();
  }

  /** GET /api/v1/runs/latest?type=compare — 부분별 최근 완료 1건 + 부분별 마지막 시도(PG run_result) · ':runId'보다 먼저 등록한다 */
  @Get('latest')
  @Header('Cache-Control', 'no-store')
  async latest(@Query() q: unknown): Promise<CompareLatestBodyType> {
    parseOrThrow(LatestQuery, q ?? {}, 'query');
    return this.results.latestCompare();
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
  stop(
    @Param('runId') runId: string,
    @Body() b: unknown,
    @Headers('content-type') ct: string | undefined,
    @Res({ passthrough: true }) res: FastifyReply,
  ): RunObjectBody {
    const p = parseOrThrow(RunIdParam, { runId }, 'path');
    parseOrThrow(StopBody, requireJsonBody(ct, b), 'body');
    const out = this.runs.stop(p.runId);
    if (!out) throw notFound();
    res.status(out.httpStatus);
    return out.run;
  }
}
