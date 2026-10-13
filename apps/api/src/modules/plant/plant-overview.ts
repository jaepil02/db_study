// HMI 개요 판정 — 순수 함수(계약 packages/shared/src/api/plant.ts PlantOverview · 지침서 §C)
// 상태 판정: 설비 가동 꺼짐 → 전부 stopped / 마지막 갱신이 PLANT_OFFLINE_AFTER_MS 넘음 → offline / 그 밖 STATE 값(2 running · 1 idle · 0 stopped).
// 초당 점 수: 같은 프로세스에 수집기가 있으면 실제 발행을 센 값(measured · collector-metrics tagEmitTally 차분) · 아니면 통신 중 설비의 주기 합(nominal).
// 값은 rt:latest의 공학 단위 그대로 — 이 파일은 저장소를 부르지 않는다(plant-overview.service가 읽어 넘긴다).
import {
  CARD_TAG_DATA_TYPES,
  type CardProcess,
  type CardTagDataType,
  cardTagCode,
  DEVICE_STATE_CODE,
  PLANT_OFFLINE_AFTER_MS,
  type PlantDeviceBody,
  type PlantDeviceState,
  type PlantOverviewBody,
  type PlantTagBody,
  parseCardDeviceCode,
  QUALITY,
  TAG_KINDS,
  type TagKind,
} from '@db-study/shared';
import { parseLatestValue } from '../../common/redis/durable-key-client';

export interface PlantMetaTag {
  tagId: number;
  code: string;
  name: string;
  unit: string;
  dataType: CardTagDataType;
  scanRateMs: number;
  kind: TagKind;
}

export interface PlantMetaDevice {
  deviceId: number;
  code: string;
  name: string;
  lineCode: string;
  process: CardProcess;
  keyTagId: number | null;
  tags: PlantMetaTag[];
}

export interface PlantMetaLine {
  code: string;
  name: string;
  devices: PlantMetaDevice[];
}

/** 개요 메타 조회 행 — 카드 공장 사이트의 활성 설비 × 활성 태그(태그 없는 설비는 tag_id NULL 한 줄) */
export interface PlantMetaRow {
  line_code: unknown;
  line_name: unknown;
  device_id: unknown;
  device_code: unknown;
  device_name: unknown;
  tag_id: unknown;
  tag_code: unknown;
  tag_name: unknown;
  unit: unknown;
  data_type: unknown;
  scan_rate_ms: unknown;
  tag_kind: unknown;
}

const isKind = (v: unknown): v is TagKind => (TAG_KINDS as readonly unknown[]).includes(v);
const isCardType = (v: unknown): v is CardTagDataType =>
  (CARD_TAG_DATA_TYPES as readonly unknown[]).includes(v);

/** 종류 — tag_kind가 정본 · 없으면(마스터 표면으로 만든 태그 등) 템플릿 접미 · 그것도 없으면 기타 */
export function kindOf(tagKind: unknown, tagCode: string, deviceCode: string, process: CardProcess): TagKind {
  if (isKind(tagKind)) return tagKind;
  const t = process.tags.find((x) => cardTagCode(deviceCode, x.suffix) === tagCode);
  return t?.kind ?? 'OTHER';
}

/**
 * 행 → 라인 · 설비 · 태그(카드 라인 설비만 — 시연 설비 DEMO-FLOW-DEV · 슬라이스는 코드 모양이 달라 빠진다).
 * 계약 형식(FLOAT32 · UINT32 · UINT16) 밖의 태그는 뺀다 — skipped로 돌려 호출자가 경고한다.
 */
export function metaFromRows(rows: readonly PlantMetaRow[]): { lines: PlantMetaLine[]; skipped: string[] } {
  const lines = new Map<string, PlantMetaLine>();
  const devices = new Map<number, PlantMetaDevice>();
  const skipped: string[] = [];
  for (const r of rows) {
    const code = String(r.device_code);
    const parsed = parseCardDeviceCode(code);
    if (!parsed) continue;
    const lineCode = String(r.line_code);
    let line = lines.get(lineCode);
    if (!line) {
      line = { code: lineCode, name: String(r.line_name), devices: [] };
      lines.set(lineCode, line);
    }
    const deviceId = Number(r.device_id);
    let dev = devices.get(deviceId);
    if (!dev) {
      dev = {
        deviceId,
        code,
        name: String(r.device_name),
        lineCode,
        process: parsed.process,
        keyTagId: null,
        tags: [],
      };
      devices.set(deviceId, dev);
      line.devices.push(dev);
    }
    if (r.tag_id === null || r.tag_id === undefined) continue;
    const tagCode = String(r.tag_code);
    if (!isCardType(r.data_type)) {
      skipped.push(`${tagCode}(${String(r.data_type)})`);
      continue;
    }
    const tag: PlantMetaTag = {
      tagId: Number(r.tag_id),
      code: tagCode,
      name: String(r.tag_name),
      unit: String(r.unit ?? ''),
      dataType: r.data_type,
      scanRateMs: Number(r.scan_rate_ms),
      kind: kindOf(r.tag_kind, tagCode, code, parsed.process),
    };
    dev.tags.push(tag);
    const key = parsed.process.tags.find((t) => t.key);
    if (key && cardTagCode(code, key.suffix) === tagCode) dev.keyTagId = tag.tagId;
  }
  const out = [...lines.values()].sort((a, b) => a.code.localeCompare(b.code));
  for (const l of out) l.devices.sort((a, b) => a.process.order - b.process.order || a.deviceId - b.deviceId);
  return { lines: out, skipped };
}

export interface DeviceStateInput {
  power: boolean;
  nowMs: number;
  lastUpdateMs: number | null;
  stateValue: number | null;
  stateQuality: number | null;
  /** 설비 가동을 켠 시각(epoch ms) — 켠 직후 아직 첫 값이 오지 않은 설비를 통신 끊김으로 보지 않는다 */
  powerOnAtMs: number | null;
}

/** 설비 상태 4 판정 */
export function judgeDeviceState(i: DeviceStateInput): PlantDeviceState {
  if (!i.power) return 'stopped';
  const stale = i.lastUpdateMs === null || i.nowMs - i.lastUpdateMs > PLANT_OFFLINE_AFTER_MS;
  if (stale) {
    // 켠 지 PLANT_OFFLINE_AFTER_MS 안이면 아직 깨어나는 중 — 정지로 둔다(켜자마자 30대가 끊김으로 깜박이지 않게)
    const waking = i.powerOnAtMs !== null && i.nowMs - i.powerOnAtMs <= PLANT_OFFLINE_AFTER_MS;
    return waking ? 'stopped' : 'offline';
  }
  // 예외 응답(BAD_COMM)은 값이 와도 장비와 말이 안 통한 것이다
  if (i.stateQuality === QUALITY.BAD_COMM || i.stateValue === null) return 'offline';
  if (i.stateValue === DEVICE_STATE_CODE.RUNNING) return 'running';
  if (i.stateValue === DEVICE_STATE_CODE.IDLE) return 'idle';
  return 'stopped';
}

/**
 * 실제 초당 발행 점 수 — 태그별 발행 누계(tagEmitTally)의 표본을 남겨 차분으로 센다.
 * 기준 표본은 창(3초) 안에서 가장 오래된 것 · 0.9초보다 어리면 아직 셀 수 없다(null → 호출자가 nominal로).
 * 표본은 요청(rates)과 배경 타이머(sample — PlantOverviewService)가 함께 남긴다 — 요청만 남기면 첫 요청 · 3초 넘게 띄운 요청은 늘 null이다.
 */
export class EmitRateMeter {
  static readonly WINDOW_MS = 3000;
  static readonly MIN_SPAN_MS = 900;
  static readonly SAMPLE_EVERY_MS = 250;
  private samples: { t: number; counts: Map<number, number> }[] = [];

  /** 표본 하나(직전 표본에서 SAMPLE_EVERY_MS가 지났을 때만) · 창 밖 표본은 버린다 */
  sample(nowMs: number, tally: ReadonlyMap<number, number>): void {
    const last = this.samples.at(-1);
    if (!last || nowMs - last.t >= EmitRateMeter.SAMPLE_EVERY_MS)
      this.samples.push({ t: nowMs, counts: new Map(tally) });
    this.samples = this.samples.filter((s) => nowMs - s.t <= EmitRateMeter.WINDOW_MS);
  }

  rates(nowMs: number, tally: ReadonlyMap<number, number>): Map<number, number> | null {
    this.sample(nowMs, tally);
    const ref = this.samples[0];
    if (!ref || nowMs - ref.t < EmitRateMeter.MIN_SPAN_MS) return null;
    const span = (nowMs - ref.t) / 1000;
    const out = new Map<number, number>();
    for (const [id, n] of tally) out.set(id, Math.max(0, n - (ref.counts.get(id) ?? 0)) / span);
    return out;
  }
}

export interface OverviewInput {
  nowMs: number;
  power: boolean;
  powerOnAtMs: number | null;
  lines: readonly PlantMetaLine[];
  /** 설비 id → rt:latest Hash(tag_id → "ts,value,quality") */
  latest: ReadonlyMap<number, Record<string, string>>;
  /** 태그별 실제 초당 점 수 — null이면 nominal */
  rates: ReadonlyMap<number, number> | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 개요 본문 — 계약 PlantOverview 모양 그대로 */
export function buildOverview(i: OverviewInput): PlantOverviewBody {
  const totals = { running: 0, idle: 0, stopped: 0, offline: 0, pointsPerSec: 0 };
  const byKind = Object.fromEntries(TAG_KINDS.map((k) => [k, 0])) as Record<TagKind, number>;
  const lines = i.lines.map((line) => ({
    code: line.code,
    name: line.name,
    devices: line.devices.map((d): PlantDeviceBody => {
      const h = i.latest.get(d.deviceId) ?? {};
      let lastUpdateMs: number | null = null;
      let stateValue: number | null = null;
      let stateQuality: number | null = null;
      const tags: PlantTagBody[] = [];
      for (const t of d.tags) {
        const raw = h[String(t.tagId)];
        const v = raw === undefined ? null : parseLatestValue(raw);
        if (v && (lastUpdateMs === null || v.ts > lastUpdateMs)) lastUpdateMs = v.ts;
        if (t.kind === 'STATE' && v) {
          stateValue = v.value;
          stateQuality = v.quality;
        }
        tags.push({
          tagId: t.tagId,
          code: t.code,
          name: t.name,
          kind: t.kind,
          unit: t.unit,
          dataType: t.dataType,
          scanRateMs: t.scanRateMs,
          value: v ? v.value : null,
          ts: v ? new Date(v.ts).toISOString() : null,
          quality: v ? v.quality : null,
        });
      }
      const state = judgeDeviceState({
        power: i.power,
        nowMs: i.nowMs,
        lastUpdateMs,
        stateValue,
        stateQuality,
        powerOnAtMs: i.powerOnAtMs,
      });
      totals[state] += 1;
      // measured — 센 값 그대로(꺼진 직후엔 창만큼 꼬리가 남는다) · nominal — 가동 켜짐 · 통신 중인 설비만 주기 합
      const communicating = i.power && state !== 'offline';
      let pps = 0;
      for (const t of d.tags) {
        const r = i.rates ? (i.rates.get(t.tagId) ?? 0) : communicating ? 1000 / t.scanRateMs : 0;
        pps += r;
        byKind[t.kind] += r;
      }
      totals.pointsPerSec += pps;
      return {
        deviceId: d.deviceId,
        code: d.code,
        name: d.name,
        lineCode: d.lineCode,
        processCode: d.process.code,
        processName: d.process.name,
        order: d.process.order,
        state,
        lastUpdateAt: lastUpdateMs === null ? null : new Date(lastUpdateMs).toISOString(),
        pointsPerSec: round1(pps),
        keyTagId: d.keyTagId,
        tags,
      };
    }),
  }));
  totals.pointsPerSec = round1(totals.pointsPerSec);
  for (const k of TAG_KINDS) byKind[k] = round1(byKind[k]);
  return {
    at: new Date(i.nowMs).toISOString(),
    power: i.power,
    totals,
    pointsPerSecByKind: byKind,
    pointsPerSecBasis: i.rates ? 'measured' : 'nominal',
    lines,
  };
}
