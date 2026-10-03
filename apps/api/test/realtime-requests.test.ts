// rlt_latest_requests_total — 설비 최신값 조회 요청 단위 계수(deviceLatest 1회 = 1 · hit · restored · error · 닫힌 레이블 0 초기화)
// 표면 #1과 흐름 실행의 조회 섞기가 같은 메서드라 둘 다 센다. 저장소 없이 가짜 리더 · 가짜 ClickHouse로 본다.
import { describe, expect, it } from 'vitest';
import type { ClickHouse } from '../src/common/clickhouse/clickhouse.module';
import { ApiError } from '../src/common/http/api-error';
import { appRegistry } from '../src/common/metrics/registry';
import type { CacheKeyClient } from '../src/common/redis/cache-key-client';
import type { DurableKeyClient } from '../src/common/redis/durable-key-client';
import type { MasterReadService } from '../src/modules/master/master-read.service';
import {
  type LatestPoint,
  LatestSourceUnavailable,
  type LatestValueReadPort,
} from '../src/modules/realtime/latest-value-read.port';
import { RealtimeService } from '../src/modules/realtime/realtime.service';

async function count(result: string): Promise<number> {
  const m = await appRegistry.getSingleMetric('rlt_latest_requests_total')?.get();
  return m?.values.find((x) => x.labels.result === result)?.value ?? 0;
}

function svc(
  read: () => Promise<LatestPoint[]>,
  exists = true,
  opts: { impl?: LatestValueReadPort['implName']; lockHeld?: boolean } = {},
): RealtimeService {
  const reader: LatestValueReadPort = {
    implName: opts.impl ?? 'RedisLatestValueReader',
    readDevice: read,
  };
  const cache = {
    acquireRtRebuildLock: async () => ({ token: opts.lockHeld ? null : 't', failed: false }),
    releaseRtRebuildLock: async () => {},
  } as unknown as CacheKeyClient;
  // 복원 쿼리 실패 — 빈 복원 응답(restored)
  const ch = {
    client: {
      query: async () => {
        throw new Error('ch down');
      },
    },
  } as unknown as ClickHouse;
  const master = {
    deviceExists: async () => exists,
    tagMeta: async (ids: number[]) => new Map(ids.map((id) => [id, null])),
  } as unknown as MasterReadService;
  return new RealtimeService(reader, {} as DurableKeyClient, cache, ch, master);
}

describe('rlt_latest_requests_total — 요청 단위', () => {
  it('닫힌 레이블 0 초기화 — hit · restored · bypass · error', async () => {
    const v = await appRegistry.getSingleMetric('rlt_latest_requests_total')?.get();
    expect(new Set(v?.values.map((x) => x.labels.result))).toEqual(
      new Set(['hit', 'restored', 'bypass', 'error']),
    );
  });

  it('키에서 답하면 hit 1(점 수와 무관) · 빈 키면 restored · 원천 불가 · 404는 error', async () => {
    const b = { hit: await count('hit'), restored: await count('restored'), error: await count('error') };
    const pts = Array.from({ length: 200 }, (_, i) => ({
      tagId: i + 1,
      ts: Date.now(),
      value: 1,
      quality: 0,
    }));
    await svc(async () => pts).deviceLatest(1);
    expect(await count('hit')).toBe(b.hit + 1);

    const r = await svc(async () => []).deviceLatest(1);
    expect(r.meta.source).toBe('restored');
    expect(await count('restored')).toBe(b.restored + 1);

    await expect(
      svc(async () => {
        throw new LatestSourceUnavailable('redis down');
      }).deviceLatest(1),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(svc(async () => [], false).deviceLatest(1)).rejects.toBeInstanceOf(ApiError);
    expect(await count('error')).toBe(b.error + 2);
    expect(await count('hit')).toBe(b.hit + 1);
  });

  it('SW-02 off(ClickHouse 리더)는 bypass · 락 대기 소진 뒤 빈 응답은 error', async () => {
    const b = { bypass: await count('bypass'), error: await count('error'), hit: await count('hit') };
    const pts = [{ tagId: 1, ts: Date.now(), value: 1, quality: 0 }];
    await svc(async () => pts, true, { impl: 'ClickHouseLatestValueReader' }).deviceLatest(1);
    await svc(async () => [], true, { impl: 'ClickHouseLatestValueReader' }).deviceLatest(1);
    expect(await count('bypass')).toBe(b.bypass + 2);
    const r = await svc(async () => [], true, { lockHeld: true }).deviceLatest(1);
    expect(r.items).toEqual([]);
    expect(await count('error')).toBe(b.error + 1);
    expect(await count('hit')).toBe(b.hit);
  });
});
