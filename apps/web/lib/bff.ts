// BFF(Route Handler) 공통 — 서버 측 api 주소 · no-store 중계
// health · metrics 화면 호출은 BFF 경유다(07_api/01 §BFF 경유와 직결). BFF 서버 fetch 캐시를 두지 않는다(no-store).

/** 서버 측 api 주소(09_tech_stack/04 §환경변수 — 기본 http://127.0.0.1:13000) */
export function serverApiBase(): string {
  return (process.env.API_BASE_URL ?? 'http://127.0.0.1:13000').replace(/\/$/, '');
}

export const NO_STORE = { 'cache-control': 'no-store' } as const;

/** api에 닿지 못함 — 코드 없는 봉투(설계된 실패가 아니라 BFF 쪽 관찰이다) */
export function unreachable(): Response {
  return Response.json({ error: { message: 'BFF가 api에 닿지 못했다' } }, { status: 502, headers: NO_STORE });
}

/**
 * 상태를 바꾸는 POST 중계(지우기 · 설비 가동 · 실행 시작 · 중단)를 받는 출처 — 웹 자기 자신(13001)만.
 * 인증이 없으므로(D-16) 다른 사이트의 페이지가 이 경로를 부르지 못하게 하는 값싼 출처 확인이다.
 */
export const ALLOWED_ORIGINS: readonly string[] = ['http://localhost:13001', 'http://127.0.0.1:13001'];

/** 다른 출처에서 온 요청이면 403(본문 없음) · Origin이 없으면 같은 출처 요청으로 보고 통과(null) */
export function rejectCrossOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin');
  if (origin === null || ALLOWED_ORIGINS.includes(origin)) return null;
  return new Response(null, { status: 403, headers: NO_STORE });
}

/** POST 본문 중계 — 받은 Content-Type · 본문을 바꾸지 않고 넘긴다(JSON 본문 여부 판정은 api가 한다) */
export async function relayBody(req: Request): Promise<{ headers?: Record<string, string>; body?: string }> {
  const body = await req.text();
  const type = req.headers.get('content-type');
  return { ...(type ? { headers: { 'content-type': type } } : {}), ...(body ? { body } : {}) };
}
