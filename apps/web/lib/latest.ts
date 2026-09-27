// 최신값 병합 · STALE 판정 — 정본 docs/08_screen/03_realtime_dashboard.md §갱신과 값 병합 · 요소 표 STALE 행
// 같은 태그의 값이 REST 응답 · WS 프레임 · 재연결 동기화 세 경로로 온다. 이 파일의 순수 함수가 하나로 합친다.
import { WS_CLOSE } from './shared';

/** 품질 코드 — STALE 5는 REST 응답에서만 온다(rt 프레임에는 실리지 않는다 — 07_api/11 §STALE과 푸시) */
export const QUALITY_STALE = 5;

export interface TagLatest {
  tagId: number;
  ts: number;
  value: number;
  /** 저장 품질 — 서버 STALE(5)이면 5 */
  quality: number;
  /** REST 응답이 quality 5로 낸 상태 — 더 큰 ts 프레임이 끈다 */
  serverStale: boolean;
}

export interface IncomingValue {
  tagId: number;
  ts: number;
  value: number;
  quality: number;
}

/**
 * ts 최대값 우선 — 저장된 ts 이상일 때만 받아들인다(서버 조건부 쓰기 ts ≥와 같은 기준).
 * 받아들이지 않으면 prev를 그대로 돌려준다(참조 동일 — 호출자가 변경 여부를 비교한다).
 * source 'rest'의 quality 5는 서버 STALE을 켠다. 'ws'는 ts가 더 클 때만 STALE을 끈다 — 같은 ts의 프레임은 값만 갱신한다.
 */
export function mergeLatest(
  prev: TagLatest | undefined,
  incoming: IncomingValue,
  source: 'rest' | 'ws',
): TagLatest | undefined {
  if (prev && incoming.ts < prev.ts) return prev;
  let serverStale: boolean;
  if (source === 'rest') serverStale = incoming.quality === QUALITY_STALE;
  else serverStale = prev !== undefined && incoming.ts === prev.ts ? prev.serverStale : false;
  return {
    tagId: incoming.tagId,
    ts: incoming.ts,
    value: incoming.value,
    quality: incoming.quality,
    serverStale,
  };
}

/**
 * 서버 시계 오프셋 — 추정 서버 현재 = 브라우저 현재 + (servedAt − 응답 수신 시각).
 * REST 응답마다(재연결 동기화 포함) 다시 잰다(07_api/11 §STALE과 푸시).
 */
export function clockOffsetMs(servedAtIso: string, receivedAtMs: number): number {
  return Date.parse(servedAtIso) - receivedAtMs;
}

export type Freshness =
  | { kind: 'fresh'; ageMs: number }
  | { kind: 'stale'; ageMs: number; by: 'server' | 'screen' }
  /** staleAfterMs null(메타 없음) — 판정하지 않고 값의 나이만 보인다 */
  | { kind: 'unjudged'; ageMs: number };

/**
 * STALE 판정 — 두 자리의 합집합: REST quality 5(서버) 또는 추정 서버 현재 − ts > staleAfterMs(화면).
 * 화면은 배수를 따로 갖지 않는다 — staleAfterMs는 서버가 응답에 싣는다.
 */
export function judgeFreshness(
  tag: Pick<TagLatest, 'ts' | 'serverStale'>,
  staleAfterMs: number | null,
  browserNowMs: number,
  offsetMs: number,
): Freshness {
  const ageMs = browserNowMs + offsetMs - tag.ts;
  if (tag.serverStale) return { kind: 'stale', ageMs, by: 'server' };
  if (staleAfterMs === null) return { kind: 'unjudged', ageMs };
  if (ageMs > staleAfterMs) return { kind: 'stale', ageMs, by: 'screen' };
  return { kind: 'fresh', ageMs };
}

/**
 * 통신 이상 품질 — 명세 문구는 "품질 2 · 4"다(08_screen/03 목적 · 2 BAD_COMM · 4 BAD_RANGE — 값 대신 표지).
 * 3 BAD_TIMEOUT을 함께 두는 이유 — 3은 저장하지 않는 코드라(11_glossary/03 품질 표) REST · 프레임에 오지 않아 평소 세어지지 않는다.
 * 계약 밖으로 3이 오면 BAD 계열 값을 정상 값처럼 그리지 않도록 같은 표지로 센다 — 명세의 2 · 4 집계는 바뀌지 않는다.
 */
export const BAD_QUALITIES: ReadonlySet<number> = new Set([2, 3, 4]);

/**
 * 머리 숫자 — "STALE n/N · 통신 이상 m"(08_screen/03 레이아웃).
 * STALE은 두 판정의 합집합(REST quality 5 · 화면 판정 staleAfterMs 초과)을 표와 같은 judgeFreshness로 센다 —
 * 표와 머리가 다른 시계 · 배수를 쓰면 서로 다른 태그를 STALE이라 말한다. 메타 없음(staleAfterMs null)은 판정하지 않아 세지 않는다.
 */
export function headerCounts(
  tags: readonly { tag: Pick<TagLatest, 'ts' | 'serverStale' | 'quality'>; staleAfterMs: number | null }[],
  browserNowMs: number,
  offsetMs: number,
): { total: number; stale: number; bad: number } {
  let stale = 0;
  let bad = 0;
  for (const { tag, staleAfterMs } of tags) {
    if (judgeFreshness(tag, staleAfterMs, browserNowMs, offsetMs).kind === 'stale') stale++;
    if (BAD_QUALITIES.has(tag.quality)) bad++;
  }
  return { total: tags.length, stale, bad };
}

/** 추세 열이 그리는 링 버퍼의 마지막 구간 점 수 — 별도 조회 없이 버퍼 끝만 쓴다(08_screen/03 "추세 열은 별도 조회를 부르지 않는다") */
export const SPARK_POINTS = 60;

/**
 * 스파크라인 SVG 경로 — 링 버퍼 뷰의 마지막 SPARK_POINTS점을 w × h 상자에 맞춘다. 점이 2개 미만이면 null.
 * 값이 모두 같으면 가운데 수평선. 시각 축은 점의 ts 비례(프레임 간격이 달라도 모양이 시간에 맞는다).
 */
export function sparkPath(
  ts: ArrayLike<number>,
  vals: ArrayLike<number>,
  w: number,
  h: number,
): string | null {
  const n = Math.min(ts.length, vals.length);
  const start = Math.max(0, n - SPARK_POINTS);
  if (n - start < 2) return null;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = start; i < n; i++) {
    const v = vals[i] as number;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const t0 = ts[start] as number;
  const span = (ts[n - 1] as number) - t0 || 1;
  const vr = hi - lo;
  const out: string[] = [];
  for (let i = start; i < n; i++) {
    const x = (((ts[i] as number) - t0) / span) * w;
    const y = vr === 0 ? h / 2 : h - (((vals[i] as number) - lo) / vr) * h;
    out.push(`${i === start ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return out.join(' ');
}

/**
 * 최신값 REST 호출 판정 — 08_screen/03 요소 표 "진입 · 설비 전환 · 재연결 때 1회".
 * 쿼리 캐시의 isFetched로 판정하면 끊긴 채 설비 A → B → A로 돌아올 때 A 캐시가 gcTime 동안 남아 REST를 부르지 않는데
 * 설비 전환(resetDevice)이 스토어를 비워 표가 빈 채로 남는다. 그래서 "지금 보는 설비에 이번 진입 뒤 호출을 냈는가"를 따로 든다.
 * - enter: 설비 진입 · 전환 — 설비가 바뀌었을 때만 표지를 내린다(같은 설비의 재실행은 새 진입이 아니다)
 * - onSync: 연결 · 구독 완료(syncEpoch) · 태그 메타 신호(metaEpoch) — 열려 있으면 부른다(재연결 동기화는 매번 새 사건)
 * - onStatus: 끊김(재연결하지 않는 종료) 전이 — 이 진입에 아직 호출이 없을 때만 부른다.
 *   열린 뒤 REST 응답 전에 끊겨도 onSync가 이미 냈으므로 다시 부르지 않는다(진행 중 요청을 취소하고 두 번 부르지 않게)
 */
export interface LatestReadGate {
  enter(deviceId: number): void;
  onSync(status: string): boolean;
  onStatus(status: string): boolean;
}

export function createLatestReadGate(): LatestReadGate {
  let device: number | null = null;
  let issued = false;
  return {
    enter(deviceId) {
      if (deviceId === device) return;
      device = deviceId;
      issued = false;
    },
    onSync(status) {
      if (status !== 'open' || device === null) return false;
      issued = true;
      return true;
    },
    onStatus(status) {
      if (status !== 'closed' || device === null || issued) return false;
      issued = true;
      return true;
    },
  };
}

/**
 * 끊김 띠 문구 — 재연결하지 않는 종료(status closed)일 때만. 01_standards §에러 코드별 사용자 표시 ⑤ — 1000(정상 종료)은 표시 없음.
 * "표는 진입 시 읽은 값이다"는 이 진입의 REST가 성공했을 때만 붙인다 — 실패한 끊김에서 그 문구는 읽지 않은 값을 읽었다고 말한다.
 */
export function closedBandText(status: string, closeCode: number | null, restOk: boolean): string | null {
  if (status !== 'closed' || closeCode === WS_CLOSE.normal) return null;
  const head = `WebSocket 끊김${closeCode === null ? '' : `(${closeCode})`} — 재연결하지 않는 종료라 실시간 갱신이 없다`;
  return restOk ? `${head} · 표는 진입 시 읽은 값이다` : head;
}
