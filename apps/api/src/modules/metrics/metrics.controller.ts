// OBS 표면 — 07_api/10_metrics.md #1 GET /api/v1/health · #2 GET /metrics(둘 다 공개 · 읽기 전용 · 캐시 없음)
import type { HealthBody } from '@db-study/shared';
import { Controller, Get, Header, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { appRegistry } from '../../common/metrics/registry';
import { HealthService } from './health.service';

@Controller()
export class MetricsController {
  constructor(private readonly health: HealthService) {}

  /** 200과 503이 같은 본문 — 에러 봉투를 쓰지 않는 예외(07_api/01 §에러 봉투) */
  @Get('api/v1/health')
  @Header('Cache-Control', 'no-store')
  async getHealth(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthBody> {
    const { httpStatus, body } = await this.health.check();
    reply.status(httpStatus);
    return body;
  }

  /** /api/v1 밖의 관례 경로 — Prometheus 텍스트 형식 */
  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  async getMetrics(@Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    reply.header('content-type', appRegistry.contentType);
    return appRegistry.metrics();
  }
}
