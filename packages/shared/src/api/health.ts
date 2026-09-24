// GET /api/v1/health 본문 — 정본 docs/07_api/10_metrics.md §응답 — 본문 필드 이름 판정
// 200(ok)과 503(degraded)이 같은 필드 집합을 낸다 — 불가 순간에도 어느 저장소가 원인인지 본문에서 읽는다(REQ-OBS-09).
import { z } from 'zod';
import { CAPACITY_TIER_NAMES } from '../tiers';

export const STORE_NAMES = ['postgres', 'clickhouse', 'redis'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export const StoreCheck = z.strictObject({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().int().nullable(),
  error: z.enum(['timeout', 'refused', 'error']).nullable(), // 원문 오류 메시지를 싣지 않는다 — 접속 문자열이 섞인다
});
export type StoreCheckResult = z.infer<typeof StoreCheck>;

export const SwitchState = z.strictObject({
  name: z.string(),
  value: z.union([z.string(), z.number().int()]),
  /** 실제 주입된 구현 — null은 포트가 아직 코드에 없는 스위치(도입 전 단계 · value는 기동 설정값) */
  impl: z.string().nullable(),
  warning: z.string().nullable(),
});
export type SwitchStateBody = z.infer<typeof SwitchState>;

export const RunInfo = z.strictObject({
  commitHash: z.string().nullable(),
  memoryProfile: z.enum(['load', 'dev', 'mid']).nullable(),
  memoryLimitMb: z.number().int().nullable(),
  capacityTier: z.enum(CAPACITY_TIER_NAMES as unknown as [string, ...string[]]).nullable(),
});
export type RunInfoBody = z.infer<typeof RunInfo>;

export const HealthResponse = z.strictObject({
  status: z.enum(['ok', 'degraded']),
  checkedAt: z.iso.datetime(),
  stores: z.strictObject({ postgres: StoreCheck, clickhouse: StoreCheck, redis: StoreCheck }),
  /** 키 = 스위치 ID · 정본 스위치 전부(07_api/10) — 도입 전 스위치는 impl null(주입되지 않은 구현 이름을 적지 않는다) */
  switches: z.record(z.string(), SwitchState),
  run: RunInfo,
});
export type HealthBody = z.infer<typeof HealthResponse>;
