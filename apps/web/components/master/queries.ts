'use client';
// ADM-MASTER 쿼리 — 쿼리 키는 lib/cache-signal의 masterKeys(신호 무효화와 같은 키) · staleTime = BFF revalidate 창 30초
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { retryOn503 } from '../../lib/api';
import { masterKeys } from '../../lib/cache-signal';
import { MASTER_STALE_MS } from '../../lib/config';
import { bffGet } from '../../lib/master-api';
import { DeviceObject, LineObject, ModbusConfigObject, SiteObject, TagObject } from '../../lib/shared';

/** 목록 응답 { items, meta.count } → 항목 배열 */
function listOf<T>(schema: { parse(x: unknown): T }) {
  return {
    parse: (x: unknown): T[] => {
      const items = (x as { items?: unknown }).items;
      if (!Array.isArray(items)) throw new Error('목록 응답이 아니다');
      return items.map((i) => schema.parse(i));
    },
  };
}

const common = { staleTime: MASTER_STALE_MS, retry: retryOn503 } as const;

export const useSites = () =>
  useQuery({ queryKey: masterKeys.sites(), queryFn: () => bffGet('sites', listOf(SiteObject)), ...common });

/** 사이트를 아직 모르면(null) 부르지 않는다 — siteId=0으로 부르면 BFF가 400을 낸다(useDevices와 같은 방식) */
export const linesQuery = (siteId: number | null) => ({
  queryKey: masterKeys.lines(siteId ?? 0),
  queryFn: () => bffGet(`lines?siteId=${siteId}`, listOf(LineObject)),
  enabled: siteId !== null,
  ...common,
});

export const useLines = (siteId: number | null) => useQuery(linesQuery(siteId));

export const useDevices = (siteId: number | null, includeInactive = true) =>
  useQuery({
    queryKey: masterKeys.devices(siteId ?? 0, includeInactive),
    queryFn: () =>
      bffGet(`devices?siteId=${siteId}&includeInactive=${includeInactive}`, listOf(DeviceObject)),
    enabled: siteId !== null,
    ...common,
  });

export const useTags = (deviceId: number | null, includeInactive: boolean) =>
  useQuery({
    queryKey: masterKeys.tags(deviceId ?? 0, includeInactive),
    queryFn: () => bffGet(`tags?deviceId=${deviceId}&includeInactive=${includeInactive}`, listOf(TagObject)),
    enabled: deviceId !== null,
    ...common,
  });

export const useTag = (tagId: number | null) =>
  useQuery({
    queryKey: masterKeys.tag(tagId ?? 0),
    queryFn: () => bffGet(`tags/${tagId}`, TagObject),
    enabled: tagId !== null,
    ...common,
  });

/** 접속 설정 — BFF no-store · 브라우저도 staleTime 0 */
export const useModbus = (deviceId: number) =>
  useQuery({
    queryKey: masterKeys.modbus(deviceId),
    queryFn: () => bffGet(`devices/${deviceId}/modbus-config`, ModbusConfigObject),
    staleTime: 0,
    retry: retryOn503,
  });

/** 쓴 탭의 로컬 무효화 — 응답을 받은 뒤에만(낙관적 갱신 없음) */
export function useLocalInvalidate() {
  const qc = useQueryClient();
  return (...keys: (readonly unknown[])[]) => {
    for (const k of keys) void qc.invalidateQueries({ queryKey: [...k] });
  };
}
