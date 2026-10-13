// 설비 가동 · HMI 개요 계약(D-16 결정 3) — 표면 정본 docs/07_api(설비 가동 · HMI 개요 절)
// 설비 가동은 실행 중 켜고 끄는 스위치다 — 기동 기본값은 SENSOR_AUTOGEN(로컬 off), 실행 중 상태는 Redis(봉인 계열 ctl:plant:power).
// 지금 값은 Redis만 읽는다(rt:latest) — 요청마다 PostgreSQL · ClickHouse를 부르지 않는다. 메타(설비 · 태그 · 종류)는 api 프로세스 메모리 사본(PostgreSQL에서 10초마다 다시 읽음).
import { z } from 'zod';
import { CARD_TAG_DATA_TYPES, TAG_KINDS } from '../card-line';

/** #POST /api/v1/plant/power 본문 */
export const PlantPowerRequest = z.strictObject({ on: z.boolean() });
export type PlantPowerRequestBody = z.infer<typeof PlantPowerRequest>;

/** #GET · POST /api/v1/plant/power 응답 — changedAt은 이번 기동 뒤 마지막으로 바뀐 시각(기동 기본값 그대로면 null) */
export const PlantPower = z.strictObject({
  on: z.boolean(),
  changedAt: z.iso.datetime().nullable(),
});
export type PlantPowerBody = z.infer<typeof PlantPower>;

/** 설비 상태 4 — running 가동 · idle 대기 · stopped 정지(STATE 태그 값) · offline 통신 끊김(지금 값이 PLANT_OFFLINE_AFTER_MS 넘게 안 바뀜) */
export const PLANT_DEVICE_STATES = ['running', 'idle', 'stopped', 'offline'] as const;
export type PlantDeviceState = (typeof PLANT_DEVICE_STATES)[number];

/** 통신 끊김 판정 — 마지막 갱신에서 이만큼 지나면 offline */
export const PLANT_OFFLINE_AFTER_MS = 5000;

export const PlantTag = z.strictObject({
  tagId: z.number().int(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(TAG_KINDS),
  unit: z.string(),
  dataType: z.enum(CARD_TAG_DATA_TYPES),
  scanRateMs: z.number().int().positive(),
  /** 지금 값(공학 단위) — 아직 없으면 null */
  value: z.number().nullable(),
  ts: z.iso.datetime().nullable(),
  quality: z.number().int().nullable(),
});
export type PlantTagBody = z.infer<typeof PlantTag>;

export const PlantDevice = z.strictObject({
  deviceId: z.number().int(),
  code: z.string(),
  name: z.string(),
  lineCode: z.string(),
  processCode: z.string(),
  processName: z.string(),
  /** 라인 안 순서 1~10 */
  order: z.number().int(),
  state: z.enum(PLANT_DEVICE_STATES),
  /** 태그 지금 값 중 가장 최근 ts */
  lastUpdateAt: z.iso.datetime().nullable(),
  /** 초당 보내는 점 수 — 기준은 PlantOverview.pointsPerSecBasis */
  pointsPerSec: z.number().nonnegative(),
  keyTagId: z.number().int().nullable(),
  tags: z.array(PlantTag),
});
export type PlantDeviceBody = z.infer<typeof PlantDevice>;

const kindNumbers = z.strictObject(
  Object.fromEntries(TAG_KINDS.map((k) => [k, z.number().nonnegative()])) as Record<
    (typeof TAG_KINDS)[number],
    z.ZodNumber
  >,
);

/** #GET /api/v1/plant/overview — 1초마다 부른다 */
export const PlantOverview = z.strictObject({
  at: z.iso.datetime(),
  power: z.boolean(),
  totals: z.strictObject({
    running: z.number().int(),
    idle: z.number().int(),
    stopped: z.number().int(),
    offline: z.number().int(),
    pointsPerSec: z.number().nonnegative(),
  }),
  /** 종류별 초당 점 수 */
  pointsPerSecByKind: kindNumbers,
  /** measured — 실제 갱신을 센 값 · nominal — 통신 중인 설비의 태그 주기 합(Σ 1000 ÷ 주기) */
  pointsPerSecBasis: z.enum(['measured', 'nominal']),
  lines: z.array(
    z.strictObject({
      code: z.string(),
      name: z.string(),
      devices: z.array(PlantDevice),
    }),
  ),
});
export type PlantOverviewBody = z.infer<typeof PlantOverview>;
