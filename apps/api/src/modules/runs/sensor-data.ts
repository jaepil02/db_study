// 센서 데이터 현황 · 지우기(D-16 결정 5) — 계약 packages/shared/src/api/data.ts · 정본 docs/07_api/09_datagen.md §센서 데이터 · docs/05_data_stores/08_retention_lifecycle.md §센서 데이터 지우기
// GET /api/v1/data/sensor/stats  — ⑤ 머리 · 지우기 확인 창이 읽는다(저장소별 행 · 크기 · 대기줄 · 마지막 비교 구간)
// POST /api/v1/data/sensor/purge — 쌓인 센서 데이터만 지운다: ClickHouse tag_raw · tag_1m · tag_1h · tag_1d TRUNCATE ·
//   PostgreSQL 비교 사본 전부(control_purge) · Redis stream:plc:raw · stream:plc:dlq 엔트리(XTRIM 0 · 소비 그룹은 남긴다) · rt:latest · 조회 사본.
//   남기는 것: 설비 · 태그 · 업무 · 실행 결과(run_result). 지우는 동안 새 행이 들어오면 지운 뒤 행 수가 0이 아니다 — 그래서 409 data.purge_blocked(details.reason):
//   ① run_in_progress 실행 진행 중 ② plant_running 설비 가동 원하는 상태 on · 켜는 중 · 수집기가 아직 도는 중(적용 상태 — 끈 직후 ≤ 1초)
//   ③ stream_backlog 대기줄(stream:plc:raw 소비 그룹)에 아직 적재 안 된 엔트리가 남음(lag + pending > 0 — 끈 직후 마지막 배치 · 앞 실행의 남은 적체).
//   지우는 동안은 SensorPurgeLock이 실행 시작(compare · flow)과 설비 켜기를 거절한다(r5 M4 — 프로세스 안 잠금 · APP_ROLE all · api 하나 기준).
// 상태를 바꾸는 POST라 Content-Type application/json의 빈 객체 {} 본문이 필요하다(requireJsonBody · 지침서 §5-4).
import type { PurgeBlockReason, SensorDataStatsBody, SensorPurgeResultBody } from '@db-study/shared';
import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { ApiError, parseOrThrow } from '../../common/http/api-error';
import { requireJsonBody } from '../../common/http/surface-defense';
import type { SensorPurgeLock } from '../plant/sensor-purge-lock';
import type { SensorStores } from './compare-stores';
import { completeIngestRange } from './run-result';

export const SENSOR_DATA = Symbol('SensorData');

/** 현황 캐시 — ⑤ 머리가 주기적으로 부른다 · PostgreSQL 행 수 세기가 비싸다(지우기 뒤에는 비운다) */
export const STATS_CACHE_MS = 5000;

export interface SensorDataDeps {
  stores: SensorStores;
  /** 진행 중 실행(running · stopping)이 있는가 */
  runActive(): boolean;
  /** 설비 가동 원하는 상태(Redis 키 · 기본값) */
  plantOn(): Promise<boolean>;
  /** 이 프로세스의 수집기가 아직 센서 데이터를 만드는 중인가(적용 상태) — 수집기가 없는 역할이면 null */
  plantRunning(): boolean | null;
  /** 대기줄 적체(lag + pending · lag를 모르면 pending만) — 읽지 못하면 null */
  backlog(): Promise<number | null>;
  lock: SensorPurgeLock;
  nowMs?(): number;
  monoMs?(): number;
}

const BLOCK_MESSAGE: Record<PurgeBlockReason, string> = {
  run_in_progress: '실행이 진행 중이라 지우지 않는다 — 실행이 끝난 뒤 다시',
  plant_running: '설비 가동이 켜져 있거나 아직 멈추는 중이라 지우지 않는다 — 설비 가동을 끄고 잠시 뒤 다시',
  stream_backlog: '대기줄에 아직 적재되지 않은 센서 데이터가 남아 지우지 않는다 — 잠시 뒤 다시',
};

/** POST purge 본문 — 빈 객체만(모르는 키 400) */
const PurgeBody = z.strictObject({});

export class SensorDataService {
  private cache: { at: number; body: SensorDataStatsBody } | null = null;
  private purging: Promise<SensorPurgeResultBody> | null = null;
  private readonly now: () => number;
  private readonly mono: () => number;

  constructor(private readonly d: SensorDataDeps) {
    this.now = d.nowMs ?? (() => Date.now());
    this.mono = d.monoMs ?? (() => performance.now());
  }

  async stats(): Promise<SensorDataStatsBody> {
    const t = this.mono();
    if (this.cache && t - this.cache.at < STATS_CACHE_MS) return this.cache.body;
    const totals = await this.d.stores.totals(false);
    const redis = await this.d.stores.redisCounts();
    // 비교 구간 — 마지막 넣기가 완료이고(중단 · 실패면 null · r5 M1) 지금도 ClickHouse에 행이 있을 때만(지우기 뒤에는 null)
    const last = await this.d.stores.lastIngest();
    const range = completeIngestRange(last);
    const has = range ? await this.d.stores.hasRows(range) : null;
    const live = range !== null && has?.clickhouse === true ? range : null;
    let compareRows: SensorDataStatsBody['compareRows'] = null;
    if (live) {
      // 넣기 verify가 센 구간 행 수를 쓴다 — 그 뒤 구간을 바꾸는 길은 지우기(→ null) · 보존 만료뿐이라 다시 세지 않는다
      // (PostgreSQL 수천만 행 count가 넣기 직후 ⑤ 조회 대결 측정과 겹치지 않게 · r5 L4). 옛 결과에 행 수가 없으면 그때만 센다.
      const rows = last?.rows ?? (await this.d.stores.rangeRows(live));
      compareRows = { clickhouse: rows.clickhouse, postgres: has?.postgres ? rows.postgres : 0 };
    }
    const body: SensorDataStatsBody = {
      at: new Date(this.now()).toISOString(),
      clickhouse: { rows: totals.ch.rows, bytes: totals.ch.bytes },
      postgres: { rows: totals.pg.rows, bytes: totals.pg.bytes },
      redis,
      compareRange: live
        ? { start: new Date(live.start).toISOString(), end: new Date(live.end).toISOString() }
        : null,
      compareRows,
    };
    this.cache = { at: t, body };
    return body;
  }

  /**
   * 막는 이유 — ① 실행 ② 설비 가동(원하는 상태 · 켜는 중 · 수집기 적용 상태) ③ 대기줄 적체 순서로 하나.
   * 가동 상태를 읽지 못하면 켜진 것으로 본다 — 지우는 동안 가동 데이터가 들어오면 지운 결과가 거짓이 된다.
   * 적체를 읽지 못하면 막지 않는다 — Redis가 불가면 가동 상태도 못 읽어 ②에서 이미 막힌다.
   */
  async blockReason(): Promise<PurgeBlockReason | null> {
    if (this.d.runActive()) return 'run_in_progress';
    if (this.d.lock.plantTurningOn) return 'plant_running';
    const on = await this.d.plantOn().catch(() => true);
    if (on || this.d.plantRunning() === true) return 'plant_running';
    const backlog = await this.d.backlog().catch(() => null);
    return backlog !== null && backlog > 0 ? 'stream_backlog' : null;
  }

  purge(): Promise<SensorPurgeResultBody> {
    // 겹친 요청은 진행 중인 지우기 하나를 나눠 받는다
    this.purging ??= this.doPurge().finally(() => {
      this.purging = null;
      this.cache = null;
    });
    return this.purging;
  }

  /** 잠금을 먼저 세우고(동기) 이유를 본다 — 확인과 TRUNCATE 사이에 실행 시작 · 설비 켜기가 끼어들지 못한다 */
  private async doPurge(): Promise<SensorPurgeResultBody> {
    if (!this.d.lock.tryBegin()) throw new Error('센서 데이터 지우기 잠금이 이미 잡혀 있다');
    try {
      return await this.purgeLocked();
    } finally {
      this.d.lock.end();
    }
  }

  private async purgeLocked(): Promise<SensorPurgeResultBody> {
    const reason = await this.blockReason();
    if (reason) throw new ApiError('data.purge_blocked', BLOCK_MESSAGE[reason], { reason });
    const before = await this.d.stores.totals(true);
    const t0 = this.mono();
    await this.d.stores.purgeClickHouse();
    const t1 = this.mono();
    await this.d.stores.purgePostgres();
    const t2 = this.mono();
    const redis = await this.d.stores.purgeRedis();
    const t3 = this.mono();
    const ms = (a: number, b: number) => Math.round((b - a) * 100) / 100;
    return {
      at: new Date(this.now()).toISOString(),
      clickhouse: { rows: before.ch.rows, elapsedMs: ms(t0, t1) },
      postgres: { rows: before.pg.rows, elapsedMs: ms(t1, t2) },
      redis: { streamEntries: redis.streamEntries, keys: redis.keys, elapsedMs: ms(t2, t3) },
    };
  }
}

@Controller('api/v1/data/sensor')
export class SensorDataController {
  constructor(@Inject(SENSOR_DATA) private readonly svc: SensorDataService) {}

  @Get('stats')
  @Header('Cache-Control', 'no-store')
  stats(): Promise<SensorDataStatsBody> {
    return this.svc.stats();
  }

  @Post('purge')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  purge(@Body() b: unknown, @Headers('content-type') ct: string | undefined): Promise<SensorPurgeResultBody> {
    parseOrThrow(PurgeBody, requireJsonBody(ct, b), 'body');
    return this.svc.purge();
  }
}
