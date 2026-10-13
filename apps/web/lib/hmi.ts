// ⑦ 설비 현황판 판독 — 정본 docs/08_screen/11_hmi_screen.md §HMI-PLANT.
// 계약 packages/shared/src/api/plant.ts(PlantOverview — 1초마다) · 설비 구성 정본 packages/shared/src/card-line.ts.
// 숫자는 api가 준 값만 쓴다 — 개요(지금 값 · 상태 · 초당 개수)와 시계열 조회(최근 10분). 여기서 새 숫자를 만들지 않는다.
// 하나의 예외: 설비 가동이 꺼져 초당 개수가 전부 0이면 종류 비율은 태그 주기(Σ 1000 ÷ 주기 — api nominal과 같은 식)로 "켜면 보낼 몫"을 내고 표지한다.
// 순수 함수만 둔다(단위 시험 test/hmi.test.ts) — 읽기는 components/hmi/data.ts가 한다.
import { DEVICE_STATE_CODE, TAG_KIND_LABEL, TAG_KINDS, type TagKind } from '@db-study/shared/src/card-line';
import type {
  PlantDeviceBody,
  PlantDeviceState,
  PlantOverviewBody,
  PlantTagBody,
  TimeseriesQuery,
  TimeseriesQueryBody,
} from './shared';
import { toKstOffsetIso } from './time';

// ── 상태 4 ──

export interface StateView {
  label: string;
  /** 칸 위 색 띠 */
  band: string;
  /** 모양 기호 색 — 흰 바탕 3:1 이상(그림 요소) */
  mark: string;
  /** 그 상태를 말하는 글자 색 — 흰 바탕 4.5:1 이상 */
  ink: string;
}

/**
 * 상태 색 — 저장소 색(Redis 빨강 · PostgreSQL 파랑 · ClickHouse 주황 — components/ui/store.ts)과 겹치지 않게 고른다.
 * 가동 초록 · 대기 노랑 · 정지 연회색(멈춘 설비는 조용하게) · 통신 끊김 진회색(신호 없음). 색만으로 가르지 않는다 — 모양(▶ ‖ ■ 끊긴 고리)과 글자를 함께 쓴다.
 * 대비 실측(흰 바탕): 가동 mark 3.30 · ink 5.02 / 대기 mark 3.25 · ink 4.92 / 정지 mark 4.76 · ink 7.58 / 끊김 mark 7.58 · ink 10.4(slate-700).
 * 색 구분(dataviz validate_palette — 모든 쌍 · 색각 이상 모의): 가동↔대기 ΔE 11.3 · 대기↔CH 주황 ΔE 12.9 — 보라는 PG 파랑과 색각 이상에서 ΔE 0.4라 버렸다.
 */
export const STATE_VIEW: Record<PlantDeviceState, StateView> = {
  running: { label: '가동', band: '#16a34a', mark: '#16a34a', ink: '#15803d' },
  idle: { label: '대기', band: '#eab308', mark: '#b8860b', ink: '#a16207' },
  stopped: { label: '정지', band: '#cbd5e1', mark: '#64748b', ink: '#475569' },
  offline: { label: '통신 끊김', band: '#475569', mark: '#475569', ink: '#334155' },
};

/** STATE 태그 값(UINT16) → 쉬운 말 — 0 정지 · 1 대기 · 2 가동(card-line DEVICE_STATE_CODE) */
export function stateCodeText(v: number): string {
  if (v === DEVICE_STATE_CODE.RUNNING) return '가동';
  if (v === DEVICE_STATE_CODE.IDLE) return '대기';
  if (v === DEVICE_STATE_CODE.STOPPED) return '정지';
  return `코드 ${v}`;
}

// ── 형식 ──

/** 실수 표기 — 0은 0 · 1000 이상 정수(쉼표) · 1 이상 소수 1자리 · 1 미만 소수 2자리(정렬 오차 0.03mm 같은 작은 값) · 반올림해 −0이면 0 */
export function numText(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  const digits = a >= 1000 ? 0 : a >= 1 ? 1 : 2;
  const p = 10 ** digits;
  const r = Math.round(v * p) / p;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 태그 지금 값 표기 — 상태는 쉬운 말 · 누적 · 상태 코드(UINT32 · UINT16)는 정수 · 실수는 numText · 값 없음은 — */
export function valueText(tag: Pick<PlantTagBody, 'value' | 'dataType' | 'kind'>): string {
  const v = tag.value;
  if (v === null || !Number.isFinite(v)) return '—';
  if (tag.kind === 'STATE') return stateCodeText(v);
  if (tag.dataType !== 'FLOAT32') return Math.round(v).toLocaleString('ko-KR');
  return numText(v);
}

/** 보내는 주기 — 100 → 0.1s · 200 → 0.2s · 1000 → 1s */
export const periodText = (ms: number): string => `${Number((ms / 1000).toFixed(2))}s`;

/** 초당 개수 — 10 이상 정수 · 미만 소수 1자리(0.5 같은 실측) · 쉼표 */
export function ppsText(n: number): string {
  const r = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return r.toLocaleString('ko-KR');
}

// ── 설비 · 태그 ──

const kindRank = (k: TagKind): number => TAG_KINDS.indexOf(k);

/** 설비가 보내는 데이터 종류 — TAG_KINDS 순서(칸의 종류 기호 줄) */
export function deviceKinds(d: Pick<PlantDeviceBody, 'tags'>): TagKind[] {
  return TAG_KINDS.filter((k) => d.tags.some((t) => t.kind === k));
}

/** 상세 목록 순서 — 종류별로 모으고(TAG_KINDS 순서) 같은 종류 안은 api 순서(주소 순) 그대로 */
export function tagsByKind<T extends Pick<PlantTagBody, 'kind'>>(tags: readonly T[]): T[] {
  return [...tags].sort((a, b) => kindRank(a.kind) - kindRank(b.kind));
}

/** 칸에 크게 보일 핵심 값 태그 — keyTagId가 없거나 태그 목록에 없으면 null */
export function keyTagOf(d: Pick<PlantDeviceBody, 'keyTagId' | 'tags'>): PlantTagBody | null {
  return d.keyTagId === null ? null : (d.tags.find((t) => t.tagId === d.keyTagId) ?? null);
}

/**
 * 상세 목록 자리 수 — 가장 태그가 많은 설비의 태그 수(카드 라인은 5).
 * 상세 칸은 이 줄 수만큼의 높이를 늘 차지한다 — 태그가 적은 설비를 골라도 칸 높이가 그대로라 라인 판이 들썩이지 않는다.
 */
export function tagSlots(devices: readonly Pick<PlantDeviceBody, 'tags'>[]): number {
  return devices.reduce((m, d) => Math.max(m, d.tags.length), 0);
}

/** 모든 설비(라인 순 · 공정 순) */
export function allDevices(ov: Pick<PlantOverviewBody, 'lines'>): PlantDeviceBody[] {
  return ov.lines.flatMap((l) => [...l.devices].sort((a, b) => a.order - b.order));
}

/** 공정 열 머리 — 첫 라인의 공정 순서(카드 라인 3개는 공정 10이 같다 · 라인마다 빠진 공정이 있어도 열은 가장 긴 라인 기준) */
export function processColumns(
  ov: Pick<PlantOverviewBody, 'lines'>,
): { order: number; code: string; name: string }[] {
  const byOrder = new Map<number, { order: number; code: string; name: string }>();
  for (const l of ov.lines)
    for (const d of l.devices)
      if (!byOrder.has(d.order))
        byOrder.set(d.order, { order: d.order, code: d.processCode, name: d.processName });
  return [...byOrder.values()].sort((a, b) => a.order - b.order);
}

// ── 요약 ──

/** 종류 비율 한 칸 */
export interface KindShare {
  kind: TagKind;
  label: string;
  /** 초당 개수(basis가 period면 태그 주기로 센 몫) */
  pps: number;
  /** 전체 대비 0~1 */
  share: number;
}

export interface KindMix {
  /** live — api 초당 개수(measured 또는 nominal) · period — 설비 가동 꺼짐이라 태그 주기로 센 "켜면 보낼 몫" */
  basis: 'live' | 'period';
  total: number;
  rows: KindShare[];
}

/** 종류 비율 — 8종 전부 TAG_KINDS 순서로(0인 종류도 칸을 남겨 1초마다 칸이 움직이지 않게) */
export function kindMix(ov: Pick<PlantOverviewBody, 'pointsPerSecByKind' | 'lines'>): KindMix {
  const live = TAG_KINDS.reduce((a, k) => a + ov.pointsPerSecByKind[k], 0);
  const per = Object.fromEntries(TAG_KINDS.map((k) => [k, 0])) as Record<TagKind, number>;
  let basis: KindMix['basis'] = 'live';
  if (live > 0) for (const k of TAG_KINDS) per[k] = ov.pointsPerSecByKind[k];
  else {
    basis = 'period';
    for (const d of allDevices(ov)) for (const t of d.tags) per[t.kind] += 1000 / t.scanRateMs;
  }
  const total = TAG_KINDS.reduce((a, k) => a + per[k], 0);
  return {
    basis,
    total,
    rows: TAG_KINDS.map((k) => ({
      kind: k,
      label: TAG_KIND_LABEL[k],
      pps: per[k],
      share: total > 0 ? per[k] / total : 0,
    })),
  };
}

/** 비율 표기 — 0은 0% · 1% 미만은 "1% 미만" · 그 밖 정수 % */
export function shareText(share: number): string {
  if (share <= 0) return '0%';
  if (share < 0.01) return '1% 미만';
  return `${Math.round(share * 100)}%`;
}

/** 초당 개수의 기준 — nominal이면 "(주기 기준)"을 숫자 옆에 단다 */
export const BASIS_NOTE: Record<PlantOverviewBody['pointsPerSecBasis'], string | null> = {
  measured: null,
  nominal: '주기 기준',
};

/**
 * 지금 값이 멈춘 값일 때의 한 줄 — 설비 가동이 꺼지면 Redis 지금 값은 멈추기 전 마지막 값으로 남는다(상태 태그가 "가동"으로 남아 있을 수 있다).
 * 통신 끊김도 마지막으로 받은 값이다. 그 밖에는 null(지금 값 그대로).
 */
export function staleNote(power: boolean, state: PlantDeviceState): string | null {
  if (!power) return '보이는 값은 멈추기 전 마지막 값이에요';
  if (state === 'offline') return '값이 5s 넘게 안 바뀌었어요 — 마지막으로 받은 값이에요';
  return null;
}

export const POWER_OFF_TEXT = '설비 가동이 꺼져 있어요 — 오른쪽 위 스위치로 켜 보세요';
export const OVERVIEW_FAILED_TEXT = '설비 상태를 읽지 못했어요 — 다시 읽는 중이에요';

// ── 최근 10분 작은 선 ──

/** 작은 선 창 — 최근 10분 */
export const TREND_WINDOW_MS = 10 * 60_000;
/** 서버 스냅 단위 — 원시(raw) 조회도 범위 양 끝을 1분 경계로 내린다(SW-04 TimeSnapKeyNormalizer · 06_pipeline/06) */
const TREND_SNAP_MS = 60_000;
/**
 * 작은 선 요청 점 수 — 서버는 raw 예상 포인트를 주기 1초로 셈한다(07_api/05 §S4 표면). 요청 범위는 10분 + 다음 분 경계까지(1분 미만)라 최대 660점.
 * 이보다 작게 보내면 서버가 1분 해상도로 올려 10분이 10점이 된다. 0.1초 태그(최대 6,600점)는 서버가 LTTB로 660점까지 줄인다.
 */
export const TREND_MAX_POINTS = (TREND_WINDOW_MS + TREND_SNAP_MS) / 1000;

/**
 * 시계열 조회 본문 — 원시(raw) · 최근 10분 · 오프셋 포함 시각.
 * 끝은 다음 분 경계로 올려 보낸다 — 지금으로 보내면 서버가 1분 경계로 내려 진행 중인 1분이 빠지고, 설비 가동을 켠 직후 최대 1분 동안 선이 빈다.
 * 미래 끝은 계약이 받고, 최근 5분 창이라 서버가 캐시하지 않는다. 앞 끝 내림으로 더 온 점은 readTrend가 자른다.
 */
export function trendRequest(tagIds: readonly number[], nowMs: number): TimeseriesQuery {
  return {
    tagIds: [...tagIds],
    from: toKstOffsetIso(nowMs - TREND_WINDOW_MS),
    to: toKstOffsetIso(Math.ceil(nowMs / TREND_SNAP_MS) * TREND_SNAP_MS),
    interval: 'raw',
    maxPoints: TREND_MAX_POINTS,
  };
}

export type TrendPoint = [ts: number, value: number];

export interface TrendRead {
  /** 요청 기준 시각(창 끝) */
  toMs: number;
  /** 태그별 점(시각 순) — 값이 숫자가 아닌 점은 뺀다 */
  byTag: Map<number, TrendPoint[]>;
}

/** 응답 → 태그별 [ts, value] — 열 위치는 meta.columns(raw면 ts · value · quality, 롤업이면 ts · avg) · 창(toMs 전 10분)보다 앞선 점은 뺀다 */
export function readTrend(body: TimeseriesQueryBody, toMs: number): TrendRead {
  const fromMs = toMs - TREND_WINDOW_MS;
  const vi = Math.max(
    1,
    body.meta.columns.findIndex((c) => c === 'value' || c === 'avg'),
  );
  const byTag = new Map<number, TrendPoint[]>();
  for (const s of body.series) {
    const pts: TrendPoint[] = [];
    for (const p of s.points) {
      const ts = p[0];
      const v = p[vi];
      if (typeof ts === 'number' && ts >= fromMs && typeof v === 'number' && Number.isFinite(v))
        pts.push([ts, v]);
    }
    pts.sort((a, b) => a[0] - b[0]);
    byTag.set(s.tagId, pts);
  }
  return { toMs, byTag };
}

export interface SparkGeom {
  /** SVG path d — 끊긴 구간(설비 가동 꺼짐 · 통신 끊김)은 선을 잇지 않는다 */
  d: string;
  min: number;
  max: number;
  /** 마지막 점 위치 */
  end: { x: number; y: number } | null;
}

/** 이만큼 넘게 점이 없으면 선을 끊는다 — 주기의 3배와 5초(통신 끊김 판정) 중 큰 쪽 */
export const gapLimitMs = (scanRateMs: number): number => Math.max(3 * scanRateMs, 5_000);

/**
 * 작은 선 모양 — 가로는 시각(창 [from, to] 고정 — 점이 없는 시간은 빈자리로 남는다) · 세로는 그 태그의 최소~최대(같으면 가운데 한 줄).
 * 상태(step)는 계단으로 — 값이 바뀌는 순간 수직으로 꺾는다. pad는 위아래 여백(선 굵기 · 끝 점이 잘리지 않게).
 */
export function sparkGeom(
  pts: readonly TrendPoint[],
  o: {
    width: number;
    height: number;
    fromMs: number;
    toMs: number;
    step: boolean;
    gapMs: number;
    pad?: number;
  },
): SparkGeom {
  if (pts.length === 0 || o.width <= 0 || o.height <= 0) return { d: '', min: 0, max: 0, end: null };
  const pad = o.pad ?? 3;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const [, v] of pts) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = o.toMs - o.fromMs || 1;
  const x = (ts: number) => ((Math.min(Math.max(ts, o.fromMs), o.toMs) - o.fromMs) / span) * o.width;
  const inner = o.height - 2 * pad;
  const y = (v: number) => (max === min ? o.height / 2 : pad + (1 - (v - min) / (max - min)) * inner);
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = '';
  let prev: TrendPoint | null = null;
  for (const p of pts) {
    const px = r(x(p[0]));
    const py = r(y(p[1]));
    if (prev === null || p[0] - prev[0] > o.gapMs) d += `M${px} ${py}`;
    else if (o.step) d += `H${px}V${py}`;
    else d += `L${px} ${py}`;
    prev = p;
  }
  const last = pts[pts.length - 1] as TrendPoint;
  return { d, min, max, end: { x: r(x(last[0])), y: r(y(last[1])) } };
}

/** 가리킨 가로 위치(0~width)에 가장 가까운 점 — 시각 순 배열을 이분 탐색 */
export function nearestPoint(
  pts: readonly TrendPoint[],
  atX: number,
  o: { width: number; fromMs: number; toMs: number },
): TrendPoint | null {
  if (pts.length === 0 || o.width <= 0) return null;
  const ts = o.fromMs + (Math.min(Math.max(atX, 0), o.width) / o.width) * (o.toMs - o.fromMs);
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((pts[mid] as TrendPoint)[0] < ts) lo = mid + 1;
    else hi = mid;
  }
  const a = pts[lo] as TrendPoint;
  const b = lo > 0 ? (pts[lo - 1] as TrendPoint) : null;
  return b && Math.abs(b[0] - ts) <= Math.abs(a[0] - ts) ? b : a;
}
