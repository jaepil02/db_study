// 태그 메타 — 원천 PostgreSQL tag_master · 사본 cache:tagmeta:{tag_id}(Hash · 현행 참고 600초 · 05_data_stores/05 §TTL 조회 계약)
export const TAGMETA_TTL_SECONDS = 600;

export interface TagMeta {
  tagId: number;
  deviceId: number;
  tagCode: string;
  tagName: string;
  functionCode: number;
  address: number;
  dataType: string;
  wordOrder: string | null;
  scale: number;
  offsetValue: number;
  unit: string;
  deadband: number;
  scanRateMs: number;
  rangeMin: number | null;
  rangeMax: number | null;
  isActive: boolean;
}

/** tag_master 행 조회 SQL — numeric은 Float64로 표현한다(07_api/01 §수치 직렬화 마스터 numeric 행) */
export const TAG_META_SELECT = `
SELECT tag_id, device_id, tag_code, tag_name, function_code, address, data_type, word_order,
       scale::float8 AS scale, offset_value::float8 AS offset_value, unit, deadband::float8 AS deadband,
       scan_rate_ms, range_min::float8 AS range_min, range_max::float8 AS range_max, is_active
  FROM tag_master`;

export function rowToTagMeta(r: Record<string, unknown>): TagMeta {
  return {
    tagId: Number(r.tag_id),
    deviceId: Number(r.device_id),
    tagCode: String(r.tag_code),
    tagName: String(r.tag_name),
    functionCode: Number(r.function_code),
    address: Number(r.address),
    dataType: String(r.data_type),
    wordOrder: r.word_order === null ? null : String(r.word_order),
    scale: Number(r.scale),
    offsetValue: Number(r.offset_value),
    unit: String(r.unit),
    deadband: Number(r.deadband),
    scanRateMs: Number(r.scan_rate_ms),
    rangeMin: r.range_min === null ? null : Number(r.range_min),
    rangeMax: r.range_max === null ? null : Number(r.range_max),
    isActive: Boolean(r.is_active),
  };
}

/** Hash 필드 — 값은 10진 문자열 · 구조는 평면(05_data_stores/05 §네이밍 규칙 값 인코딩) · NULL은 빈 필드로 싣지 않는다 */
export function tagMetaToHash(m: TagMeta): Record<string, string> {
  const h: Record<string, string> = {
    device_id: String(m.deviceId),
    tag_code: m.tagCode,
    tag_name: m.tagName,
    function_code: String(m.functionCode),
    address: String(m.address),
    data_type: m.dataType,
    scale: String(m.scale),
    offset_value: String(m.offsetValue),
    unit: m.unit,
    deadband: String(m.deadband),
    scan_rate_ms: String(m.scanRateMs),
    is_active: m.isActive ? '1' : '0',
  };
  if (m.wordOrder !== null) h.word_order = m.wordOrder;
  if (m.rangeMin !== null) h.range_min = String(m.rangeMin);
  if (m.rangeMax !== null) h.range_max = String(m.rangeMax);
  return h;
}

export function hashToTagMeta(tagId: number, h: Record<string, string>): TagMeta {
  return {
    tagId,
    deviceId: Number(h.device_id),
    tagCode: h.tag_code ?? '',
    tagName: h.tag_name ?? '',
    functionCode: Number(h.function_code),
    address: Number(h.address),
    dataType: h.data_type ?? '',
    wordOrder: h.word_order ?? null,
    scale: Number(h.scale),
    offsetValue: Number(h.offset_value),
    unit: h.unit ?? '',
    deadband: Number(h.deadband),
    scanRateMs: Number(h.scan_rate_ms),
    rangeMin: h.range_min === undefined ? null : Number(h.range_min),
    rangeMax: h.range_max === undefined ? null : Number(h.range_max),
    isActive: h.is_active === '1',
  };
}
