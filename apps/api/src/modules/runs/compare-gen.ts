// 직접 비교 센서 행 생성(순수 함수) — 카드 라인 태그(CARD_PROCESSES)의 주기대로 과거 구간을 다시 만든다(지침서 §E ingest)
// 엔트리 하나 = 설비 하나의 1초분(Stream 엔트리 계약 v1 — t0 = 그 초 시작 · dt = 점마다 0~900 ms · min(dt) = 0).
// 수집기는 주기 그룹마다 엔트리를 내지만 과거 구간 재생은 1초분을 한 엔트리로 묶는다 — 엔트리 수가 약 8분의 1이라 최대 속도 발행이
// Redis 명령 수가 아니라 적재(삽입 · COPY)에서 막힌다. 행(설비 · 태그 · 시각)과 값은 묶음과 무관하다.
// 값은 결정적이다(같은 구간이면 같은 행) — 종류별: 상태 2(가동) · 수량 단조 증가 · 그 밖 범위 안 사인 + 잔물결(FLOAT32로 반올림).
import {
  type CardTagTemplate,
  cardTagCode,
  encodeEntry,
  parseCardDeviceCode,
  QUALITY,
} from '@db-study/shared';

export interface GenTag {
  deviceId: number;
  tagId: number;
  kind: CardTagTemplate['kind'];
  scanRateMs: number;
  rangeMin: number | null;
  rangeMax: number | null;
}

export interface GenDevice {
  deviceId: number;
  deviceCode: string;
  lineCode: string;
  tags: GenTag[];
}

/** 시드 행(카드 라인 활성 설비 · 태그) — device_code · tag_code로 템플릿을 찾는다 */
export interface SeedTagRow {
  device_id: number | string;
  device_code: string;
  tag_id: number | string;
  tag_code: string;
}

/** 시드 행 → 설비별 생성 태그 — 템플릿에 없는 태그(재발급 · 수동 추가)는 뺀다 · 설비 · 태그 오름차순 */
export function genDevicesOf(rows: readonly SeedTagRow[]): GenDevice[] {
  const by = new Map<number, GenDevice>();
  for (const r of rows) {
    const parsed = parseCardDeviceCode(r.device_code);
    if (!parsed) continue;
    const tpl = parsed.process.tags.find((t) => cardTagCode(r.device_code, t.suffix) === r.tag_code);
    if (!tpl) continue;
    const deviceId = Number(r.device_id);
    let d = by.get(deviceId);
    if (!d) {
      d = { deviceId, deviceCode: r.device_code, lineCode: parsed.line, tags: [] };
      by.set(deviceId, d);
    }
    d.tags.push({
      deviceId,
      tagId: Number(r.tag_id),
      kind: tpl.kind,
      scanRateMs: tpl.scanRateMs,
      rangeMin: tpl.rangeMin,
      rangeMax: tpl.rangeMax,
    });
  }
  return [...by.values()]
    .sort((a, b) => a.deviceId - b.deviceId)
    .map((d) => ({ ...d, tags: d.tags.sort((a, b) => a.tagId - b.tagId) }));
}

/** 1초에 설비들이 내는 점 수 — Σ 1000 ÷ 주기 */
export function pointsPerSimSecond(devices: readonly GenDevice[]): number {
  let n = 0;
  for (const d of devices) for (const t of d.tags) n += Math.floor(1000 / t.scanRateMs);
  return n;
}

/** 구간의 전체 점 수 — 구간 길이가 1초의 배수일 때 정확하다 */
export function pointsInRange(devices: readonly GenDevice[], startMs: number, endMs: number): number {
  return pointsPerSimSecond(devices) * Math.floor((endMs - startMs) / 1000);
}

/** 수량 태그의 초당 증가 — 태그마다 1 · 2 · 3(결정적) */
export function counterRate(tagId: number): number {
  return 1 + (tagId % 3);
}

/** 점 하나의 값 — anchorMs는 수량의 0점(구간 시작) */
export function genValue(t: GenTag, tsMs: number, anchorMs: number): number {
  if (t.kind === 'STATE') return 2;
  if (t.kind === 'COUNT') return Math.floor(((tsMs - anchorMs) / 1000) * counterRate(t.tagId));
  const lo = t.rangeMin ?? 0;
  const hi = t.rangeMax ?? 100;
  const mid = (lo + hi) / 2;
  const amp = (hi - lo) * 0.35;
  const periodMs = 600_000 + (t.tagId % 7) * 60_000;
  const phase = (t.tagId % 13) / 13;
  const ripple = (((t.tagId * 7919 + Math.floor(tsMs / t.scanRateMs)) % 101) / 101 - 0.5) * (hi - lo) * 0.04;
  const v = mid + amp * Math.sin(2 * Math.PI * (tsMs / periodMs + phase)) + ripple;
  return Math.fround(Math.min(hi, Math.max(lo, v)));
}

export interface GenChunk {
  payloads: Buffer[];
  /** 엔트리별 점 수(payloads와 같은 순서) */
  points: number[];
  totalPoints: number;
}

/** 설비 하나의 1초분 엔트리 — 주기마다 그 초 안의 점(100 ms 태그 10점 · 200 ms 5점 · 1초 1점) */
export function deviceSecondEntry(
  d: GenDevice,
  secStartMs: number,
  anchorMs: number,
): { payload: Buffer; points: number } {
  const tg: number[] = [];
  const dt: number[] = [];
  const va: number[] = [];
  for (const t of d.tags) {
    for (let off = 0; off < 1000; off += t.scanRateMs) {
      tg.push(t.tagId);
      dt.push(off);
      va.push(genValue(t, secStartMs + off, anchorMs));
    }
  }
  const payload = encodeEntry({
    d: d.deviceId,
    s: Math.floor(secStartMs / 1000),
    t0: secStartMs,
    tg,
    dt,
    va,
    q: new Array<number>(tg.length).fill(QUALITY.SIMULATED),
  });
  return { payload, points: tg.length };
}

/**
 * 초 하나의 앞 limit점만 — (시각 · 설비 · 태그) 순으로 줄 세워 자른다(조회 대결이 원천을 자르는 순서와 같다). 넣기 건수가
 * 초당 점 수의 배수가 아니면 마지막 초가 이것이다. 점이 하나라도 실린 설비는 그 초 0 ms 점이 반드시 실린다(0 ms가 맨 앞이다) —
 * 엔트리 계약 min(dt) = 0을 지킨다. 설비 · 태그는 genDevicesOf가 오름차순으로 둔다.
 */
export function genSecondCut(
  devices: readonly GenDevice[],
  secStartMs: number,
  anchorMs: number,
  limit: number,
): GenChunk {
  const picks: { off: number; d: number; t: GenTag }[] = [];
  devices.forEach((dev, d) => {
    for (const t of dev.tags) for (let off = 0; off < 1000; off += t.scanRateMs) picks.push({ off, d, t });
  });
  picks.sort((a, b) => a.off - b.off || a.d - b.d || a.t.tagId - b.t.tagId);
  const by = new Map<number, { tg: number[]; dt: number[]; va: number[] }>();
  for (const p of picks.slice(0, Math.max(0, limit))) {
    let e = by.get(p.d);
    if (!e) {
      e = { tg: [], dt: [], va: [] };
      by.set(p.d, e);
    }
    e.tg.push(p.t.tagId);
    e.dt.push(p.off);
    e.va.push(genValue(p.t, secStartMs + p.off, anchorMs));
  }
  const payloads: Buffer[] = [];
  const points: number[] = [];
  for (const [d, e] of [...by.entries()].sort(([a], [b]) => a - b)) {
    const dev = devices[d] as GenDevice;
    payloads.push(
      encodeEntry({
        d: dev.deviceId,
        s: Math.floor(secStartMs / 1000),
        t0: secStartMs,
        tg: e.tg,
        dt: e.dt,
        va: e.va,
        q: new Array<number>(e.tg.length).fill(QUALITY.SIMULATED),
      }),
    );
    points.push(e.tg.length);
  }
  return { payloads, points, totalPoints: points.reduce((a, n) => a + n, 0) };
}

/** 시각 [fromSec, toSec)초의 모든 설비 엔트리 — 초 순서 · 설비 순서 */
export function genChunk(
  devices: readonly GenDevice[],
  fromSecMs: number,
  toSecMs: number,
  anchorMs: number,
): GenChunk {
  const payloads: Buffer[] = [];
  const points: number[] = [];
  let totalPoints = 0;
  for (let s = fromSecMs; s < toSecMs; s += 1000) {
    for (const d of devices) {
      if (d.tags.length === 0) continue;
      const e = deviceSecondEntry(d, s, anchorMs);
      payloads.push(e.payload);
      points.push(e.points);
      totalPoints += e.points;
    }
  }
  return { payloads, points, totalPoints };
}
