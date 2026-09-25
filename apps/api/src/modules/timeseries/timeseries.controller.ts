// TSQ 표면 — 07_api/05_timeseries.md #1 POST /api/v1/timeseries/query · #2 GET /api/v1/timeseries/export(브라우저 직결)
import { TimeseriesExportQuery, type TimeseriesQueryBody, TimeseriesQueryRequest } from '@db-study/shared';
import { Body, Controller, Get, Header, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { parseOrThrow } from '../../common/http/api-error';
import { TimeseriesService } from './timeseries.service';
import { EXPORT_CONTENT_TYPE, TimeseriesExportService } from './timeseries-export.service';

@Controller('api/v1/timeseries')
export class TimeseriesController {
  constructor(
    private readonly svc: TimeseriesService,
    private readonly exporter: TimeseriesExportService,
  ) {}

  @Post('query')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  query(@Body() body: unknown): Promise<TimeseriesQueryBody> {
    return this.svc.query(parseOrThrow(TimeseriesQueryRequest, body, 'body'));
  }

  /** 청크 스트림 — 상태 줄 200 뒤의 실패는 코드로 알릴 수 없어 종결 청크 없이 끊는다 */
  @Get('export')
  async export(@Query() q: unknown, @Res() reply: FastifyReply): Promise<void> {
    const p = parseOrThrow(TimeseriesExportQuery, q, 'query');
    const { stream, onAbort } = await this.exporter.open(p);
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': EXPORT_CONTENT_TYPE[p.format],
      'Content-Disposition': `attachment; filename="tag_raw_${p.from.slice(0, 10)}.${p.format}"`,
      'Cache-Control': 'no-store',
    });
    stream.on('error', () => {
      onAbort();
      res.destroy();
    });
    res.on('close', () => {
      if (!res.writableFinished) stream.destroy();
    });
    stream.pipe(res);
  }
}
