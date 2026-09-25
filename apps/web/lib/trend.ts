// ANL-TREND 순수 로직 — 정본 docs/08_screen/04_trend_analysis.md
// 조회 조건 ↔ 쿼리 문자열 · 결과 표지 줄 문장 · 진행 구간 분할 · staleTime 분류 · 품질 끊김. 화면 컴포넌트는 이것을 부르기만 한다.
import { TS_RECENT_WINDOW_MS, TS_STALE_CURRENT_MS, TS_STALE_PAST_MS } from './config';
import { AGGREGATIONS, INTERVALS, type TimeseriesQueryBody } from './shared';
import { formatKst, toKstOffsetIso } from './time';

export type Interval = (typeof INTERVALS)[number];
export type Aggregation = (typeof AGGREGATIONS)[number];

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 범위 프리셋 — 최근 1시간 · 24시간 · 7일 · 30일 · 90일 · 1년(끝 = 현재) */
export const PRESETS = [
  { id: '1h', label: '최근 1시간', ms: HOUR },
  { id: '24h', label: '최근 24시간', ms: DAY },
  { id: '7d', label: '최근 7일', ms: 7 * DAY },
  { id: '30d', label: '최근 30일', ms: 30 * DAY },
  { id: '90d', label: '최근 90일', ms: 90 * DAY },
  { id: '1y', label: '최근 1년', ms: 365 * DAY },
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];

export interface TrendParams {
  tagIds: number[];
  /** 프리셋이면 끝 = 현재(조회 순간에 from · to를 정한다) · null이면 사용자 지정 */
  preset: PresetId | null;
  fromMs: number;
  toMs: number;
  /** null = 자동(interval 생략) */
  interval: Interval | null;
  aggregations: Aggregation[];
}

export const DEFAULT_PARAMS: TrendParams = {
  tagIds: [],
  preset: '24h',
  fromMs: 0,
  toMs: 0,
  interval: null,
  aggregations: ['avg', 'min', 'max'],
};

/** 쿼리 문자열 → 조건 — 범위는 오프셋 포함 ISO(다른 시간대 브라우저여도 같은 구간) */
export function decodeParams(q: URLSearchParams): TrendParams {
  const tagIds = (q.get('tags') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const preset = PRESETS.find((p) => p.id === q.get('preset'))?.id ?? null;
  const from = Date.parse(q.get('from') ?? '');
  const to = Date.parse(q.get('to') ?? '');
  const custom = !preset && Number.isFinite(from) && Number.isFinite(to) && from < to;
  const iv = q.get('interval');
  const aggs = (q.get('aggs') ?? '')
    .split(',')
    .filter((a): a is Aggregation => (AGGREGATIONS as readonly string[]).includes(a));
  return {
    tagIds: [...new Set(tagIds)],
    preset: custom ? null : (preset ?? DEFAULT_PARAMS.preset),
    fromMs: custom ? from : 0,
    toMs: custom ? to : 0,
    interval: (INTERVALS as readonly string[]).includes(iv ?? '') ? (iv as Interval) : null,
    aggregations: aggs.length > 0 ? aggs : DEFAULT_PARAMS.aggregations,
  };
}

export function encodeParams(p: TrendParams): URLSearchParams {
  const q = new URLSearchParams();
  if (p.tagIds.length > 0) q.set('tags', p.tagIds.join(','));
  if (p.preset) q.set('preset', p.preset);
  else {
    q.set('from', toKstOffsetIso(p.fromMs));
    q.set('to', toKstOffsetIso(p.toMs));
  }
  if (p.interval) q.set('interval', p.interval);
  q.set('aggs', p.aggregations.join(','));
  return q;
}

/** 조회 순간의 범위 — 프리셋은 끝 = now */
export function rangeOf(p: TrendParams, nowMs: number): { fromMs: number; toMs: number; endsNow: boolean } {
  if (p.preset) {
    const ms = PRESETS.find((x) => x.id === p.preset)?.ms ?? DAY;
    return { fromMs: nowMs - ms, toMs: nowMs, endsNow: true };
  }
  return { fromMs: p.fromMs, toMs: p.toMs, endsNow: p.toMs >= nowMs };
}

const BUCKET_MS: Record<Interval, number> = { raw: MIN, '1m': MIN, '1h': HOUR, '1d': DAY };
const KST_OFFSET_MS = 9 * HOUR;
function floorToBucket(ms: number, interval: Interval): number {
  const b = BUCKET_MS[interval];
  return interval === '1d'
    ? Math.floor((ms + KST_OFFSET_MS) / b) * b - KST_OFFSET_MS
    : Math.floor(ms / b) * b;
}

/**
 * staleTime — 받은 응답의 실제 끝(meta.to)과 해상도로 서버 TTL 구간을 같은 규칙으로 가른다(08_screen/01 §갱신 주기와 캐시 층 정렬).
 * 최근 5분 → 0(서버가 캐시하지 않는다) · 현재 버킷 → 24초 · 그 밖 → 240초
 */
export function staleTimeFor(meta: { interval: Interval; to: string }, nowMs: number): number {
  const to = Date.parse(meta.to);
  if (to > nowMs - TS_RECENT_WINDOW_MS) return 0;
  return to >= floorToBucket(nowMs, meta.interval) ? TS_STALE_CURRENT_MS : TS_STALE_PAST_MS;
}

/**
 * 진행 구간 분할 — 1차 응답의 실제 끝(버킷 경계로 내린 to)부터 현재까지를 같은 해상도로 따로 받는다(REQ-TSQ-13).
 * 1차 끝이 현재와 1초 안이면(스냅 off · 경계 직후) 분할하지 않는다
 */
export function progressRange(
  first: { interval: Interval; to: string },
  nowMs: number,
): { fromMs: number; toMs: number; interval: Interval } | null {
  const from = Date.parse(first.to);
  if (!(nowMs - from > 1000)) return null;
  return { fromMs: from, toMs: nowMs, interval: first.interval };
}

/** 결과 표지 줄 — meta 6필드를 사람이 읽는 조각으로(표지 줄 표) */
export function resultBadges(
  meta: TimeseriesQueryBody['meta'],
  req: { interval: Interval | null; fromMs: number; toMs: number },
): string[] {
  const out: string[] = [];
  const got = meta.interval;
  if (req.interval === null) out.push(`해상도 ${got}(요청 자동 — 범위 길이로 선택)`);
  else if (req.interval !== got) out.push(`요청 ${req.interval} → 받음 ${got}(점 상한 초과로 상향)`);
  else out.push(`해상도 ${got}`);
  out.push(`점 ${meta.pointCount.toLocaleString('ko-KR')}`);
  out.push(meta.downsampled ? 'LTTB로 줄임 — 스파이크는 보존 · 원시는 내보내기' : '다운샘플 아님');
  if (meta.cached) out.push('캐시');
  const f = Date.parse(meta.from);
  const t = Date.parse(meta.to);
  if (f !== req.fromMs || t !== req.toMs)
    out.push(`실제 범위 — 버킷 경계로 내림 ${formatKst(f)} ~ ${formatKst(t)}`);
  if (got !== 'raw' && meta.columns.includes('p95')) out.push('p95는 근사(TDigest)');
  return out;
}

/** 품질 끊김 — 2 BAD · 4 COMM_FAIL · 5 STALE 점은 선을 끊는다(9 SIMULATED는 잇는다 · 08_screen/01 §차트 표준) */
const BREAK_QUALITY = new Set([2, 4, 5]);

/**
 * 한 series의 points → 그릴 열. raw는 value(품질 끊김) · 롤업은 선 열(avg 우선 · 없으면 첫 집계)과 min · max 음영(둘 다 있을 때만)
 */
export function seriesColumns(
  columns: readonly string[],
  points: readonly (readonly (number | null)[])[],
): { x: number[]; y: (number | null)[]; lo: (number | null)[] | null; hi: (number | null)[] | null } {
  const col = (name: string) => columns.indexOf(name);
  const x = points.map((p) => p[0] as number);
  if (columns[1] === 'value') {
    const qi = col('quality');
    return {
      x,
      y: points.map((p) => (qi >= 0 && BREAK_QUALITY.has(p[qi] as number) ? null : (p[1] ?? null))),
      lo: null,
      hi: null,
    };
  }
  const line = col('avg') >= 0 ? col('avg') : 1;
  const mi = col('min');
  const ma = col('max');
  const band = mi >= 0 && ma >= 0;
  return {
    x,
    y: points.map((p) => p[line] ?? null),
    lo: band ? points.map((p) => p[mi] ?? null) : null,
    hi: band ? points.map((p) => p[ma] ?? null) : null,
  };
}

/** 내보내기 파일 이름 — 스트림이 오류로 끝나면 "불완전" 표기(종결 청크 없음 = 완결 아님) */
export function exportFileName(format: 'csv' | 'parquet', fromMs: number, complete: boolean): string {
  const stamp = toKstOffsetIso(fromMs).slice(0, 16).replace(/[-:T]/g, '');
  return `timeseries-${stamp}${complete ? '' : '-불완전'}.${format}`;
}
