// SW-02 REDIS_LATEST_CACHE — LatestValueReadPort(포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md)
// 읽기 포트만 교체한다 — off에서도 Ingest의 rt:latest 갱신과 ch:rt 발행은 그대로다(02_features/13 §스위치별 판정).
// 응답 모양은 두 구현이 같다(REQ-RLT-08) — 원천은 meta.source가 말한다.
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { DurableKeyClient, parseLatestValue } from '../../common/redis/durable-key-client';

export const LATEST_VALUE_READ_PORT = Symbol('LatestValueReadPort');

export interface LatestPoint {
  tagId: number;
  ts: number;
  value: number;
  quality: number;
}

export interface LatestValueReadPort {
  readonly implName: 'RedisLatestValueReader' | 'ClickHouseLatestValueReader';
  /** 설비 전체 최신값 — 빈 배열은 "키 없음"(Redis) · "창 안에 행 없음"(ClickHouse) */
  readDevice(deviceId: number): Promise<LatestPoint[]>;
}

/** 원천 접속 불가 — Redis면 503 realtime.latest_unavailable로 옮긴다 */
export class LatestSourceUnavailable extends Error {}

/** on — rt:latest:{device_id} HGETALL 1회 */
export class RedisLatestValueReader implements LatestValueReadPort {
  readonly implName = 'RedisLatestValueReader' as const;
  constructor(private readonly durable: DurableKeyClient) {}

  async readDevice(deviceId: number): Promise<LatestPoint[]> {
    let raw: Record<string, string>;
    try {
      raw = await this.durable.readLatest(deviceId);
    } catch (e) {
      throw new LatestSourceUnavailable((e as Error).message);
    }
    const out: LatestPoint[] = [];
    for (const [field, v] of Object.entries(raw)) {
      const p = parseLatestValue(v);
      if (p) out.push({ tagId: Number(field), ...p });
    }
    return out.sort((a, b) => a.tagId - b.tagId);
  }
}

/**
 * 최근 창 argMax — 빈 키 복원(RLT-04)과 SW-02 off 점조회가 같은 쿼리를 쓴다.
 * 창은 복원 창 현행 참고 10분(소유 06_pipeline/05) — 창 밖의 값은 어차피 배수 × 주기를 넘어 STALE이다.
 */
export async function argMaxLatest(
  ch: ClickHouse,
  deviceId: number,
  windowMinutes: number,
): Promise<LatestPoint[]> {
  const rs = await ch.client.query({
    query: `SELECT tag_id, toUnixTimestamp64Milli(max(ts)) AS ts_ms, argMax(value, ts) AS last_value, argMax(quality, ts) AS last_quality
              FROM plc.tag_raw
             WHERE device_id = {device:UInt32} AND ts >= now64(3) - INTERVAL {minutes:UInt32} MINUTE
             GROUP BY tag_id
             ORDER BY tag_id`,
    query_params: { device: deviceId, minutes: windowMinutes },
    format: 'JSONEachRow',
  });
  const rows = await rs.json<{ tag_id: number; ts_ms: string; last_value: number; last_quality: number }>();
  return rows.map((r) => ({
    tagId: Number(r.tag_id),
    ts: Number(r.ts_ms),
    value: Number(r.last_value),
    quality: Number(r.last_quality),
  }));
}

/** off(실험 전용) — ClickHouse argMax 점조회 */
export class ClickHouseLatestValueReader implements LatestValueReadPort {
  readonly implName = 'ClickHouseLatestValueReader' as const;
  constructor(
    private readonly ch: ClickHouse,
    private readonly windowMinutes: number,
  ) {}

  async readDevice(deviceId: number): Promise<LatestPoint[]> {
    try {
      return await argMaxLatest(this.ch, deviceId, this.windowMinutes);
    } catch (e) {
      throw new LatestSourceUnavailable((e as Error).message);
    }
  }
}
