// 마스터 표면 — 정본 docs/07_api/04_master.md(REST 17 · 태그 객체 16 · 수정 가능 11 · 스케일 2 · 불변 3)
// 저장 모양 정본 docs/05_data_stores/01_postgresql_schema.md · 결합 CHECK 정본 02_postgresql_constraints.md
// 쓰기 요청은 모르는 필드를 거절한다(strictObject). 불변 필드 · 스케일 판정은 스키마 밖(서비스)에서 한다 —
// 400 immutable · 409 master.scale_change_forbidden은 "현재 값과 다른가"를 알아야 가를 수 있다.
import { z } from 'zod';

export const FUNCTION_CODES = [1, 2, 3, 4] as const;
export const DATA_TYPES = ['UINT16', 'INT16', 'UINT32', 'INT32', 'FLOAT32', 'FLOAT64', 'BOOL'] as const;
export const WORD_ORDERS = ['ABCD', 'CDAB', 'BADC', 'DCBA'] as const;
/** 워드 순서가 없는(null이어야 하는) 형식 — 1워드 · 비트 */
export const SINGLE_WORD_TYPES: readonly string[] = ['UINT16', 'INT16', 'BOOL'];

const id = z.number().int().min(1).max(2_147_483_647);
const code = z.string().trim().min(1).max(64);
const name = z.string().trim().min(1).max(200);
const finite = z.number().refine(Number.isFinite, 'finite');

/** 태그 객체 16 필드 */
export const TagObject = z.strictObject({
  tagId: z.number().int(),
  deviceId: z.number().int(),
  tagCode: z.string(),
  tagName: z.string(),
  functionCode: z.number().int(),
  address: z.number().int(),
  dataType: z.enum(DATA_TYPES),
  wordOrder: z.enum(WORD_ORDERS).nullable(),
  scale: z.number(),
  offsetValue: z.number(),
  unit: z.string(),
  deadband: z.number(),
  scanRateMs: z.number().int(),
  rangeMin: z.number().nullable(),
  rangeMax: z.number().nullable(),
  isActive: z.boolean(),
});
export type TagObjectBody = z.infer<typeof TagObject>;

/** 수정 가능 11 · 스케일 2 · 불변 3 = 16(07_api/04 §#5 검산) */
export const TAG_EDITABLE_FIELDS = [
  'tagCode',
  'tagName',
  'unit',
  'deadband',
  'scanRateMs',
  'rangeMin',
  'rangeMax',
  'functionCode',
  'address',
  'dataType',
  'wordOrder',
] as const;
export const TAG_SCALE_FIELDS = ['scale', 'offsetValue'] as const;
export const TAG_IMMUTABLE_FIELDS = ['tagId', 'deviceId', 'isActive'] as const;

const tagFields = {
  tagCode: code,
  tagName: name,
  functionCode: z.number().int().min(1).max(4),
  address: z.number().int().min(0).max(65535),
  dataType: z.enum(DATA_TYPES),
  wordOrder: z.enum(WORD_ORDERS).nullable(),
  scale: finite,
  offsetValue: finite,
  unit: z.string().max(32),
  deadband: finite.pipe(z.number().min(0)),
  scanRateMs: z.number().int().min(1).max(86_400_000),
  rangeMin: finite.nullable(),
  rangeMax: finite.nullable(),
};

/** 결합 규칙 — 저장 CHECK와 같다(1워드 · BOOL은 wordOrder null · BOOL ↔ FC 1 · 2 · min < max) */
export interface TagShape {
  functionCode: number;
  dataType: string;
  wordOrder: string | null;
  rangeMin: number | null;
  rangeMax: number | null;
}
export function tagShapeIssues(t: TagShape): { path: string; reason: 'range' | 'enum' }[] {
  const out: { path: string; reason: 'range' | 'enum' }[] = [];
  if ((t.wordOrder === null) !== SINGLE_WORD_TYPES.includes(t.dataType))
    out.push({ path: 'wordOrder', reason: 'enum' });
  if ((t.dataType === 'BOOL') !== (t.functionCode === 1 || t.functionCode === 2))
    out.push({ path: 'functionCode', reason: 'enum' });
  if (t.rangeMin !== null && t.rangeMax !== null && !(t.rangeMin < t.rangeMax))
    out.push({ path: 'rangeMin', reason: 'range' });
  return out;
}

/** #4 POST /api/v1/tags — 스케일 · 단위 · 데드밴드 · 범위는 기본값(1 · 0 · '' · 0 · null)이 있다 */
export const TagCreateRequest = z.strictObject({
  deviceId: id,
  tagCode: tagFields.tagCode,
  tagName: tagFields.tagName,
  functionCode: tagFields.functionCode,
  address: tagFields.address,
  dataType: tagFields.dataType,
  wordOrder: tagFields.wordOrder.default(null),
  scale: tagFields.scale.default(1),
  offsetValue: tagFields.offsetValue.default(0),
  unit: tagFields.unit.default(''),
  deadband: tagFields.deadband.default(0),
  scanRateMs: tagFields.scanRateMs,
  rangeMin: tagFields.rangeMin.default(null),
  rangeMax: tagFields.rangeMax.default(null),
});
export type TagCreate = z.infer<typeof TagCreateRequest>;

/** #5 PATCH /api/v1/tags/{id} — 16 필드 전부를 받아 서비스가 갈래를 가른다(불변 400 · 스케일 409) */
export const TagPatchRequest = z.strictObject({
  tagCode: tagFields.tagCode.optional(),
  tagName: tagFields.tagName.optional(),
  unit: tagFields.unit.optional(),
  deadband: tagFields.deadband.optional(),
  scanRateMs: tagFields.scanRateMs.optional(),
  rangeMin: tagFields.rangeMin.optional(),
  rangeMax: tagFields.rangeMax.optional(),
  functionCode: tagFields.functionCode.optional(),
  address: tagFields.address.optional(),
  dataType: tagFields.dataType.optional(),
  wordOrder: tagFields.wordOrder.optional(),
  scale: tagFields.scale.optional(),
  offsetValue: tagFields.offsetValue.optional(),
  tagId: z.unknown().optional(),
  deviceId: z.unknown().optional(),
  isActive: z.unknown().optional(),
});
export type TagPatch = z.infer<typeof TagPatchRequest>;

/** #7 POST /api/v1/tags/{id}/reissue — newTagCode 필수 · scale · offsetValue 중 하나 이상은 현재와 달라야 한다(서비스 판정) */
export const TagReissueRequest = z.strictObject({
  newTagCode: tagFields.tagCode,
  scale: tagFields.scale.optional(),
  offsetValue: tagFields.offsetValue.optional(),
  reason: z.string().max(500).optional(),
  tagName: tagFields.tagName.optional(),
  unit: tagFields.unit.optional(),
  deadband: tagFields.deadband.optional(),
  scanRateMs: tagFields.scanRateMs.optional(),
  rangeMin: tagFields.rangeMin.optional(),
  rangeMax: tagFields.rangeMax.optional(),
  functionCode: tagFields.functionCode.optional(),
  address: tagFields.address.optional(),
  dataType: tagFields.dataType.optional(),
  wordOrder: tagFields.wordOrder.optional(),
});
export type TagReissue = z.infer<typeof TagReissueRequest>;

export const TagReissueResponse = z.strictObject({
  newTag: TagObject,
  oldTagId: z.number().int(),
  historyId: z.number().int(),
});

/** #3 GET /api/v1/tags — deviceId 필수 · includeInactive 기본 false */
export const TagListQuery = z.strictObject({
  deviceId: z.coerce.number().int().min(1).max(2_147_483_647),
  includeInactive: z.enum(['true', 'false']).default('false'),
});

// ── 사이트 · 라인

export const SiteObject = z.strictObject({
  siteId: z.number().int(),
  siteCode: z.string(),
  siteName: z.string(),
  timezone: z.string(),
});
export type SiteObjectBody = z.infer<typeof SiteObject>;
/** timezone은 받지 않는다 — 'Asia/Seoul' 고정(스키마 CHECK) */
export const SiteCreateRequest = z.strictObject({ siteCode: code, siteName: name });
export const SitePatchRequest = z.strictObject({
  siteCode: code.optional(),
  siteName: name.optional(),
  siteId: z.unknown().optional(),
  timezone: z.unknown().optional(),
});

export const LineObject = z.strictObject({
  lineId: z.number().int(),
  siteId: z.number().int(),
  lineCode: z.string(),
  lineName: z.string(),
});
export type LineObjectBody = z.infer<typeof LineObject>;
export const LineCreateRequest = z.strictObject({ siteId: id, lineCode: code, lineName: name });
export const LinePatchRequest = z.strictObject({
  lineCode: code.optional(),
  lineName: name.optional(),
  lineId: z.unknown().optional(),
  siteId: z.unknown().optional(),
});
export const LineListQuery = z.strictObject({
  siteId: z.coerce.number().int().min(1).max(2_147_483_647).optional(),
});

// ── 설비 · 접속 설정

/** host는 inet — IPv4 · IPv6 주소(호스트 이름을 받지 않는다 · 루프백 판정이 SIMULATED 원천이다) */
export const ModbusConfigObject = z.strictObject({
  host: z.union([z.ipv4(), z.ipv6()]),
  port: z.number().int().min(1).max(65535),
  unitId: z.number().int().min(0).max(247),
  timeoutMs: z.number().int().min(1).max(600_000),
  retryCount: z.number().int().min(0).max(100),
  maxRegsPerRequest: z.number().int().min(1).max(125),
});
export type ModbusConfigBody = z.infer<typeof ModbusConfigObject>;

export const DeviceObject = z.strictObject({
  deviceId: z.number().int(),
  lineId: z.number().int(),
  deviceCode: z.string(),
  deviceName: z.string(),
  vendor: z.string().nullable(),
  model: z.string().nullable(),
  isActive: z.boolean(),
});
export type DeviceObjectBody = z.infer<typeof DeviceObject>;

export const DeviceCreateRequest = z.strictObject({
  lineId: id,
  deviceCode: code,
  deviceName: name,
  vendor: z.string().max(200).nullable().default(null),
  model: z.string().max(200).nullable().default(null),
  modbusConfig: ModbusConfigObject,
});
export const DevicePatchRequest = z.strictObject({
  deviceCode: code.optional(),
  deviceName: name.optional(),
  vendor: z.string().max(200).nullable().optional(),
  model: z.string().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
  deviceId: z.unknown().optional(),
  lineId: z.unknown().optional(),
});
export const DeviceListQuery = z.strictObject({
  siteId: z.coerce.number().int().min(1).max(2_147_483_647),
  includeInactive: z.enum(['true', 'false']).default('false'),
});

/** 경로 식별자(정수) */
export const EntityIdParam = z.coerce.number().int().min(1).max(2_147_483_647);
