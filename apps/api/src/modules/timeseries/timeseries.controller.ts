// TSQ 표면 — 07_api/05_timeseries.md #1 POST /api/v1/timeseries/query(S2 raw 고정 · 브라우저 직결)
import { type TimeseriesQueryBody, TimeseriesQueryRequest } from '@db-study/shared';
import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { parseOrThrow } from '../../common/http/api-error';
import { TimeseriesService } from './timeseries.service';

@Controller('api/v1/timeseries')
export class TimeseriesController {
  constructor(private readonly svc: TimeseriesService) {}

  @Post('query')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  query(@Body() body: unknown): Promise<TimeseriesQueryBody> {
    return this.svc.query(parseOrThrow(TimeseriesQueryRequest, body, 'body'));
  }
}
