// MST 표면 — docs/07_api/04_master.md 표면 17(조회 6 · 쓰기 11). 전 표면 BFF 경유(조회 revalidate · 쓰기 성공 시 BFF가 ⑤).
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
import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { parseOrThrow } from '../../common/http/api-error';
import { MasterReadService } from './master-read.service';
import { MasterWriteService } from './master-write.service';

const list = <T>(items: T[]) => ({ items, meta: { count: items.length } });
const idOf = (v: unknown) => parseOrThrow(EntityIdParam, v, 'path');

@Controller('api/v1')
export class MasterController {
  constructor(
    private readonly read: MasterReadService,
    private readonly write: MasterWriteService,
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
  createTag(@Body() b: unknown) {
    return this.write.createTag(parseOrThrow(TagCreateRequest, b, 'body'));
  }

  @Patch('tags/:id')
  patchTag(@Param('id') id: string, @Body() b: unknown) {
    return this.write.patchTag(idOf(id), parseOrThrow(TagPatchRequest, b, 'body'));
  }

  @Post('tags/:id/deactivate')
  @HttpCode(200)
  deactivate(@Param('id') id: string) {
    return this.write.deactivateTag(idOf(id));
  }

  @Post('tags/:id/reissue')
  reissue(@Param('id') id: string, @Body() b: unknown) {
    return this.write.reissueTag(idOf(id), parseOrThrow(TagReissueRequest, b, 'body'));
  }

  // ── 사이트 · 라인 #1 · #9~#13

  @Get('sites')
  @Header('Cache-Control', 'no-store')
  async sites() {
    return list(await this.read.listSites());
  }

  @Post('sites')
  createSite(@Body() b: unknown) {
    return this.write.createSite(parseOrThrow(SiteCreateRequest, b, 'body'));
  }

  @Patch('sites/:id')
  patchSite(@Param('id') id: string, @Body() b: unknown) {
    return this.write.patchSite(idOf(id), parseOrThrow(SitePatchRequest, b, 'body'));
  }

  @Get('lines')
  @Header('Cache-Control', 'no-store')
  async lines(@Query() q: unknown) {
    return list(await this.read.listLines(parseOrThrow(LineListQuery, q, 'query').siteId));
  }

  @Post('lines')
  createLine(@Body() b: unknown) {
    return this.write.createLine(parseOrThrow(LineCreateRequest, b, 'body'));
  }

  @Patch('lines/:id')
  patchLine(@Param('id') id: string, @Body() b: unknown) {
    return this.write.patchLine(idOf(id), parseOrThrow(LinePatchRequest, b, 'body'));
  }

  // ── 설비 · 접속 설정 #2 · #14 · #15 · #16 · #17

  @Get('devices')
  @Header('Cache-Control', 'no-store')
  async devices(@Query() q: unknown) {
    const p = parseOrThrow(DeviceListQuery, q, 'query');
    return list(await this.read.listDevices(p.siteId, p.includeInactive === 'true'));
  }

  @Post('devices')
  createDevice(@Body() b: unknown) {
    return this.write.createDevice(parseOrThrow(DeviceCreateRequest, b, 'body'));
  }

  @Patch('devices/:id')
  patchDevice(@Param('id') id: string, @Body() b: unknown) {
    return this.write.patchDevice(idOf(id), parseOrThrow(DevicePatchRequest, b, 'body'));
  }

  @Get('devices/:id/modbus-config')
  @Header('Cache-Control', 'no-store')
  modbus(@Param('id') id: string) {
    return this.read.getModbusConfig(idOf(id));
  }

  @Put('devices/:id/modbus-config')
  putModbus(@Param('id') id: string, @Body() b: unknown) {
    return this.write.putModbusConfig(idOf(id), parseOrThrow(ModbusConfigObject, b, 'body'));
  }
}
