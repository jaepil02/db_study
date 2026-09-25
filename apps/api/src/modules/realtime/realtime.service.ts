// F-03 최신값 조회 — 판정 트리 정본 docs/06_pipeline/05_realtime_read.md §최신값 조회 판정 트리 · 응답 모양 07_api/06 #1
// 503은 Redis 접속 불가 하나뿐이다 — 키가 비는 것 · ClickHouse가 멈춘 것 · PostgreSQL이 멈춘 것은 설비 전체 조회에서 200이다.
import type { LatestDeviceBody, LatestItemBody } from '@db-study/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Counter } from 'prom-client';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { ApiError } from '../../common/http/api-error';
import { appRegistry } from '../../common/metrics/registry';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { DurableKeyClient, type LatestTuple } from '../../common/redis/durable-key-client';
import { MasterReadService } from '../master/master-read.service';
import {
  argMaxLatest,
  LATEST_VALUE_READ_PORT,
  type LatestPoint,
  LatestSourceUnavailable,
  type LatestValueReadPort,
} from './latest-value-read.port';

/** STALE 배수 — 2계층 현행 참고 3(소유 06_pipeline/05 §STALE 판정 계약) */
export const STALE_MULTIPLIER = 3;
/** 빈 키 복원 창 · 기동 복원과 같은 값 — 현행 참고 10분(소유 06_pipeline/05) */
export const RESTORE_WINDOW_MINUTES = 10;
/**
 * 복원 쿼리 타임아웃 · lock:rebuild:rt 만료 — 계약 "만료 ≥ 복원 쿼리 타임아웃"(05_data_stores/05 §TTL 조회 계약)
 * S2 판정: 타임아웃 2,000 ms · 만료 5,000 ms(시계열 락과 같은 값) — 만료가 곧 빈 결과 재복원 억제 시간이다.
 */
export const RESTORE_QUERY_TIMEOUT_MS = 2000;
export const RESTORE_LOCK_TTL_MS = 5000;
/** 락 실패 대기 — 2계층 현행 미정 → S2 판정: 시계열 락과 같은 모양 50 ms × 3회(06_pipeline/05 §미확인 등재) */
export const LOCK_WAIT_MS = 50;
export const LOCK_WAIT_TRIES = 3;

const reg = [appRegistry];
const restores = new Counter({
  name: 'rlt_latest_restores_total',
  help: '키 없음 → ClickHouse 복원 결과',
  labelNames: ['result'],
  registers: reg,
});
const waitExhausted = new Counter({
  name: 'rlt_latest_lock_wait_exhausted_total',
  help: '최신값 락 실패 뒤 대기 소진',
  registers: reg,
});
const served = new Counter({
  name: 'rlt_latest_points_served_total',
  help: '응답한 태그 값 — STALE 비율의 분모 · 분자',
  labelNames: ['freshness'],
  registers: reg,
});

type Source = LatestDeviceBody['meta']['source'];

@Injectable()
export class RealtimeService {
  private readonly log = new Logger('RealtimeService');
  constructor(
    @Inject(LATEST_VALUE_READ_PORT) private readonly reader: LatestValueReadPort,
    private readonly durable: DurableKeyClient,
    private readonly cache: CacheKeyClient,
    private readonly ch: ClickHouse,
    private readonly master: MasterReadService,
  ) {}

  async deviceLatest(deviceId: number): Promise<LatestDeviceBody> {
    const { points, source, restored } = await this.resolve(deviceId);
    return this.present(deviceId, points, source, restored);
  }

  private async resolve(
    deviceId: number,
  ): Promise<{ points: LatestPoint[]; source: Source; restored: boolean }> {
    const viaRedis = this.reader.implName === 'RedisLatestValueReader';
    let points: LatestPoint[];
    try {
      points = await this.reader.readDevice(deviceId);
    } catch (e) {
      if (e instanceof LatestSourceUnavailable) {
        // SW-02 off의 ClickHouse 불가도 같은 코드로 낸다(실험 전용 경로 · S2 판정)
        throw new ApiError('realtime.latest_unavailable', '최신값 원천에 접속할 수 없다');
      }
      throw e;
    }
    if (points.length > 0) return { points, source: viaRedis ? 'redis' : 'clickhouse', restored: false };
    // 키 없음 — 404는 마스터 기준이다(REQ-RLT-07). PostgreSQL 불가면 존재로 보고 복원 경로를 탄다 —
    // 설비 전체 조회의 503은 Redis 불가 하나뿐이다(06_pipeline/05 판정 트리 · 07_api/06 #1)
    const exists = await this.master.deviceExists(deviceId).catch(() => {
      this.log.warn(`설비 ${deviceId} 존재 확인 불가(PostgreSQL) — 존재로 보고 복원 경로`);
      return true;
    });
    if (!exists) throw new ApiError('common.not_found', '마스터에 없는 설비');
    if (!viaRedis) return { points: [], source: 'clickhouse', restored: false };
    return this.restore(deviceId);
  }

  /** 빈 키 복원 — 설비당 락 1 · 락을 잃은 요청은 대기 뒤 재읽기만 하고 원천을 부르지 않는다 */
  private async restore(
    deviceId: number,
  ): Promise<{ points: LatestPoint[]; source: Source; restored: boolean }> {
    const lock = await this.cache.acquireRtRebuildLock(deviceId, RESTORE_LOCK_TTL_MS);
    if (lock.token || lock.failed) {
      let rows: LatestPoint[];
      try {
        rows = await Promise.race([
          argMaxLatest(this.ch, deviceId, RESTORE_WINDOW_MINUTES),
          timeout(RESTORE_QUERY_TIMEOUT_MS),
        ]);
      } catch {
        // ClickHouse 불가는 일시적이라 락을 즉시 푼다 — 복구 직후 첫 요청이 복원해야 한다
        if (lock.token) await this.cache.releaseRtRebuildLock(deviceId, lock.token);
        restores.inc({ result: 'failed' });
        return { points: [], source: 'restored', restored: true };
      }
      if (rows.length === 0) {
        // 신규 설비 — 락을 풀지 않고 만료에 맡긴다: 새 키 없이 부정 캐시를 얻는다(§신규 설비 판정)
        restores.inc({ result: 'empty' });
        return { points: [], source: 'restored', restored: true };
      }
      const tuples: LatestTuple[] = rows.map((r) => [r.tagId, r.ts, r.value, r.quality]);
      try {
        await this.durable.writeLatestIfNewer(deviceId, tuples);
      } catch {
        // 워밍 실패는 응답을 막지 않는다 — 복원 값은 이미 손에 있다
      }
      if (lock.token) await this.cache.releaseRtRebuildLock(deviceId, lock.token);
      restores.inc({ result: 'success' });
      return { points: rows, source: 'restored', restored: true };
    }
    for (let i = 0; i < LOCK_WAIT_TRIES; i++) {
      await sleep(LOCK_WAIT_MS);
      let again: LatestPoint[];
      try {
        again = await this.reader.readDevice(deviceId);
      } catch (e) {
        // 재읽기의 Redis 불가도 판정 트리의 503이다 — 빈 목록 200으로 숨기지 않는다
        if (e instanceof LatestSourceUnavailable)
          throw new ApiError('realtime.latest_unavailable', '최신값 원천에 접속할 수 없다');
        throw e;
      }
      if (again.length > 0) return { points: again, source: 'redis', restored: false };
    }
    waitExhausted.inc();
    return { points: [], source: 'redis', restored: false };
  }

  /** STALE 판정 · 메타 부착 — 판정은 응답 직전 · 저장값은 바꾸지 않는다 */
  private async present(
    deviceId: number,
    points: LatestPoint[],
    source: Source,
    restored: boolean,
  ): Promise<LatestDeviceBody> {
    const now = Date.now();
    const meta = await this.master.tagMeta(points.map((p) => p.tagId));
    let metaMissing = 0;
    const items: LatestItemBody[] = points.map((p) => {
      const m = meta.get(p.tagId) ?? null;
      if (!m) {
        metaMissing++;
        // 판정 불가 점도 응답한 값이다 — STALE 표지를 달지 않았으므로 fresh로 센다(분모에서 빠지면 비율이 부푼다)
        served.inc({ freshness: 'fresh' });
        // 메타가 비면 판정식의 주기를 모른다 — 저장 품질 그대로 · staleAfterMs null(판정 불가 표지)
        return {
          tagId: p.tagId,
          tagCode: null,
          tagName: null,
          unit: null,
          ts: p.ts,
          value: p.value,
          quality: p.quality,
          staleAfterMs: null,
        };
      }
      const staleAfterMs = m.scanRateMs * STALE_MULTIPLIER;
      const stale = now - p.ts > staleAfterMs;
      served.inc({ freshness: stale ? 'stale' : 'fresh' });
      return {
        tagId: p.tagId,
        tagCode: m.tagCode,
        tagName: m.tagName,
        unit: m.unit,
        ts: p.ts,
        value: p.value,
        quality: stale ? 5 : p.quality,
        staleAfterMs,
      };
    });
    return {
      meta: { deviceId, servedAt: new Date(now).toISOString(), source, restored, metaMissing },
      items,
    };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('복원 쿼리 시간 초과')), ms));
}
