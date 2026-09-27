// MST 표면 — docs/07_api/04_master.md 표면 17(조회 6 · 쓰기 11). 전 표면 BFF 경유(조회 revalidate · 쓰기 성공 시 BFF가 ⑤).
// 쓰기 11은 업무 쓰기 포트(SW-12)를 거친다 — 검증은 여기서 끝내고 적용은 포트가 고른 경로(stream 명령 워커 · direct 직접 커밋)가 한다.
// 상태 코드 · 본문 · 에러 봉투는 옛 직접 커밋 경로와 같다 · 202 pending · expired와 Idempotency-Key 되싣기는 07_api/01 §업무 쓰기 경로.
// 물리 삭제 표면이 없다 — DELETE 메서드를 두지 않는다(설비 · 태그는 is_active false). 인가(ADMIN)는 S7.
import {
  DeviceCreateRequest,
  DeviceListQuery,
  DevicePatchRequest,
  EntityIdParam,
  LineCreateRequest,
  LineListQuery,
  LinePatchRequest,
  ModbusConfigObject,
  SiteCreateRequest,
  SitePatchRequest,
  TagCreateRequest,
  TagListQuery,
  TagPatchRequest,
  TagReissueRequest,
} from '@db-study/shared';
import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseOrThrow } from '../../common/http/api-error';
import { BIZ_WRITE_PORT, type BizWritePort } from '../biz/biz-contracts';
import { submitWrite } from '../biz/idempotency';
import { MasterReadService } from './master-read.service';

const list = <T>(items: T[]) => ({ items, meta: { count: items.length } });
const idOf = (v: unknown) => parseOrThrow(EntityIdParam, v, 'path');

@Controller('api/v1')
export class MasterController {
  constructor(
    private readonly read: MasterReadService,
    @Inject(BIZ_WRITE_PORT) private readonly port: BizWritePort,
  ) {}

  // ── 태그 #3 · #4 · #5 · #6 · #7 · #8

  @Get('tags')
  @Header('Cache-Control', 'no-store')
  async tags(@Query() q: unknown) {
    const p = parseOrThrow(TagListQuery, q, 'query');
    return list(await this.read.listTags(p.deviceId, p.includeInactive === 'true'));
  }

  @Get('tags/:id')
  @Header('Cache-Control', 'no-store')
  tag(@Param('id') id: string) {
    return this.read.getTag(idOf(id));
  }

  @Post('tags')
  createTag(@Body() b: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const body = parseOrThrow(TagCreateRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.tag.create', {}, body);
  }

  @Patch('tags/:id')
  patchTag(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const params = { id: idOf(id) };
    const body = parseOrThrow(TagPatchRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.tag.patch', params, body);
  }

  @Post('tags/:id/deactivate')
  deactivate(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return submitWrite(this.port, req, res, 'master.tag.deactivate', { id: idOf(id) });
  }

  @Post('tags/:id/reissue')
  reissue(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const params = { id: idOf(id) };
    const body = parseOrThrow(TagReissueRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.tag.reissue', params, body);
  }

  // ── 사이트 · 라인 #1 · #9~#13

  @Get('sites')
  @Header('Cache-Control', 'no-store')
  async sites() {
    return list(await this.read.listSites());
  }

  @Post('sites')
  createSite(@Body() b: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const body = parseOrThrow(SiteCreateRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.site.create', {}, body);
  }

  @Patch('sites/:id')
  patchSite(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const params = { id: idOf(id) };
    const body = parseOrThrow(SitePatchRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.site.patch', params, body);
  }

  @Get('lines')
  @Header('Cache-Control', 'no-store')
  async lines(@Query() q: unknown) {
    return list(await this.read.listLines(parseOrThrow(LineListQuery, q, 'query').siteId));
  }

  @Post('lines')
  createLine(@Body() b: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const body = parseOrThrow(LineCreateRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.line.create', {}, body);
  }

  @Patch('lines/:id')
  patchLine(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const params = { id: idOf(id) };
    const body = parseOrThrow(LinePatchRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.line.patch', params, body);
  }

  // ── 설비 · 접속 설정 #2 · #14 · #15 · #16 · #17

  @Get('devices')
  @Header('Cache-Control', 'no-store')
  async devices(@Query() q: unknown) {
    const p = parseOrThrow(DeviceListQuery, q, 'query');
    return list(await this.read.listDevices(p.siteId, p.includeInactive === 'true'));
  }

  @Post('devices')
  createDevice(
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const body = parseOrThrow(DeviceCreateRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.device.create', {}, body);
  }

  @Patch('devices/:id')
  patchDevice(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const params = { id: idOf(id) };
    const body = parseOrThrow(DevicePatchRequest, b, 'body');
    return submitWrite(this.port, req, res, 'master.device.patch', params, body);
  }

  @Get('devices/:id/modbus-config')
  @Header('Cache-Control', 'no-store')
  modbus(@Param('id') id: string) {
    return this.read.getModbusConfig(idOf(id));
  }

  @Put('devices/:id/modbus-config')
  putModbus(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const params = { id: idOf(id) };
    const body = parseOrThrow(ModbusConfigObject, b, 'body');
    return submitWrite(this.port, req, res, 'master.modbus.put', params, body);
  }
}
