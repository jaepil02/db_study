// BFF — 마스터 표면 중계(08_screen/01 §요청 경로 · 09_tech_stack/01 BFF 역할). 브라우저 /bff/master/{path} → api /api/v1/{path}
// 조회는 서버 fetch 캐시(revalidate 30초 · 태그) · 접속 설정 조회는 no-store · 쓰기 성공 시 revalidateTag(체인 ⑤단 — ADR-12).
// 받은 상태 · 본문을 그대로 넘긴다(에러 봉투 포함). 브라우저로는 no-store — 브라우저 층은 TanStack Query staleTime이 맡는다.
import { revalidateTag } from 'next/cache';
import { NO_STORE, serverApiBase, unreachable } from '../../../../lib/bff';
import { BFF_REVALIDATE_S } from '../../../../lib/config';

/** 중계를 허용하는 첫 경로 조각 — 표면 17의 자원 넷 */
const COLLECTIONS = new Set(['sites', 'lines', 'devices', 'tags']);

/** 캐시 태그 — 자원 종류 단위(쓰기 한 번이 그 종류의 목록 · 단건 사본을 전부 지운다) */
const tagOf = (collection: string) => `master-${collection}`;

type Ctx = { params: Promise<{ path: string[] }> };

async function target(ctx: Ctx, req: Request): Promise<{ url: string; collection: string } | null> {
  const { path } = await ctx.params;
  const collection = path[0] ?? '';
  if (!COLLECTIONS.has(collection) || path.some((p) => !/^[\w-]+$/.test(p))) return null;
  const search = new URL(req.url).search;
  return { url: `${serverApiBase()}/api/v1/${path.join('/')}${search}`, collection };
}

function relay(res: Response, body: string): Response {
  return new Response(body, {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

const notFound = () =>
  Response.json({ error: { code: 'common.not_found', message: 'BFF 중계 대상이 아니다' } }, { status: 404 });

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const t = await target(ctx, req);
  if (!t) return notFound();
  // 접속 설정은 no-store(ADM-MASTER 요청 경로 행) — Collector가 쓰는 값이라 옛 사본을 화면에 두지 않는다
  // x-bff-fresh — 무효화 신호 직후 조회(셸이 단다): ⑤보다 먼저 온 ⑥이 옛 사본을 받지 않게 api를 직접 읽고 사본도 비운다(검수 M5)
  const fresh = req.headers.get('x-bff-fresh') === '1';
  const noStore = fresh || t.url.includes('/modbus-config');
  let res: Response;
  try {
    res = await fetch(
      t.url,
      noStore
        ? { cache: 'no-store' }
        : { next: { revalidate: BFF_REVALIDATE_S, tags: [tagOf(t.collection)] } },
    );
  } catch {
    return unreachable();
  }
  const body = await res.text();
  // 신선 조회는 서버 사본을 비운다 · 5xx가 서버 사본으로 남지 않게 그 종류의 사본을 비운다(드문 경로 — 404는 비우지 않는다)
  if (fresh || (res.status >= 500 && !noStore)) revalidateTag(tagOf(t.collection));
  return relay(res, body);
}

async function write(req: Request, ctx: Ctx): Promise<Response> {
  const t = await target(ctx, req);
  if (!t) return notFound();
  let res: Response;
  try {
    res = await fetch(t.url, {
      method: req.method,
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: await req.text(),
    });
  } catch {
    return unreachable();
  }
  const body = await res.text();
  if (res.ok) revalidateTag(tagOf(t.collection)); // ⑤ — 커밋이 끝난 뒤에만
  return relay(res, body);
}

export const POST = write;
export const PATCH = write;
export const PUT = write;
