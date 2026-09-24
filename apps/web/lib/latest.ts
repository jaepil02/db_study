// 최신값 병합 · STALE 판정 — 정본 docs/08_screen/03_realtime_dashboard.md §갱신과 값 병합 · 요소 표 STALE 행
// 같은 태그의 값이 REST 응답 · WS 프레임 · 재연결 동기화 세 경로로 온다. 이 파일의 순수 함수가 하나로 합친다.

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
