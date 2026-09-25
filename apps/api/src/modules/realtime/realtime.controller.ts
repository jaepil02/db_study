// RLT REST 표면 — 07_api/06_realtime.md #1(S2) · #2(S4) · 브라우저 직결 · S2~S6 무인증
import { DeviceIdParam, EntityIdParam, type LatestDeviceBody, type LatestTagBody } from '@db-study/shared';
import { Controller, Get, Header, Param } from '@nestjs/common';
import { parseOrThrow } from '../../common/http/api-error';
import { RealtimeService } from './realtime.service';

@Controller('api/v1/realtime')
export class RealtimeController {
  constructor(private readonly svc: RealtimeService) {}

  @Get('devices/:id/tags')
  @Header('Cache-Control', 'no-store')
  deviceTags(@Param('id') id: string): Promise<LatestDeviceBody> {
    return this.svc.deviceLatest(parseOrThrow(DeviceIdParam, id, 'path'));
  }

  @Get('tags/:id')
  @Header('Cache-Control', 'no-store')
  tag(@Param('id') id: string): Promise<LatestTagBody> {
    return this.svc.tagLatest(parseOrThrow(EntityIdParam, id, 'path'));
  }
}
