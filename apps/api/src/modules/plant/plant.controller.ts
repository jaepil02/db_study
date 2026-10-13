// 설비 가동 · HMI 개요 표면 — 계약 packages/shared/src/api/plant.ts · 표면 정본 docs/07_api(설비 가동 · HMI 개요 절)
// GET · POST /api/v1/plant/power · GET /api/v1/plant/overview — BFF 경유(브라우저 직결 표면 아님 · CORS 없음) · 인증 없음(D-16) · no-store.
// Redis 접속 불가는 503 realtime.latest_unavailable(설비 가동 · 지금 값 둘 다 Redis 실시간 계열이다).
import { type PlantOverviewBody, type PlantPowerBody, PlantPowerRequest } from '@db-study/shared';
import { Body, Controller, Get, Header, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiError, parseOrThrow } from '../../common/http/api-error';
import { requireJsonBody } from '../../common/http/surface-defense';
import { PlantOverviewService } from './plant-overview.service';
import { PlantPowerService, type PlantPowerView } from './plant-power.service';

const redisDown = () =>
  new ApiError('realtime.latest_unavailable', 'Redis에 접속할 수 없어 설비 가동 상태를 읽거나 바꾸지 못했다');

const body = (v: PlantPowerView): PlantPowerBody => ({ on: v.on, changedAt: v.changedAt });

@Controller('api/v1/plant')
export class PlantController {
  constructor(
    private readonly power: PlantPowerService,
    private readonly overviews: PlantOverviewService,
  ) {}

  @Get('power')
  @Header('Cache-Control', 'no-store')
  async getPower(): Promise<PlantPowerBody> {
    try {
      return body(await this.power.read());
    } catch {
      throw redisDown();
    }
  }

  /**
   * 켜기 · 끄기 — 200 · 반영은 수집기 역할이 1초 안에 한다(응답은 적은 상태).
   * 본문은 Content-Type application/json의 JSON 객체여야 한다(requireJsonBody — 다른 출처의 폼 · 단순 요청 차단).
   * 센서 데이터를 지우는 동안 켜기는 400(SensorPurgeLock) — 설계된 거절은 그대로 내고, 그 밖의 실패만 Redis 불가로 옮긴다.
   */
  @Post('power')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async setPower(
    @Body() b: unknown,
    @Headers('content-type') ct: string | undefined,
  ): Promise<PlantPowerBody> {
    const req = parseOrThrow(PlantPowerRequest, requireJsonBody(ct, b), 'body');
    try {
      return body(await this.power.set(req.on));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw redisDown();
    }
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview(): Promise<PlantOverviewBody> {
    return this.overviews.overview();
  }
}
