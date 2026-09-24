// BFF(Route Handler) 공통 — 서버 측 api 주소 · no-store 중계
// health · metrics 화면 호출은 BFF 경유다(07_api/01 §BFF 경유와 직결). BFF 서버 fetch 캐시를 두지 않는다(no-store).

/** 서버 측 api 주소(09_tech_stack/04 §환경변수 — 기본 http://127.0.0.1:3000) */
export function serverApiBase(): string {
  return (process.env.API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
}

export const NO_STORE = { 'cache-control': 'no-store' } as const;

/** api에 닿지 못함 — 코드 없는 봉투(설계된 실패가 아니라 BFF 쪽 관찰이다) */
export function unreachable(): Response {
  return Response.json({ error: { message: 'BFF가 api에 닿지 못했다' } }, { status: 502, headers: NO_STORE });
}
