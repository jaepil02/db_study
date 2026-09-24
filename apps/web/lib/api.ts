// 직결 · BFF 요청 공통 — 에러 봉투 해석(07_api/01 §에러 봉투). 클라이언트는 code로만 분기하고 message로 분기하지 않는다.
import { API_BASE_URL } from './config';
import { ErrorEnvelope } from './shared';

export class ApiError extends Error {
  /** HTTP 상태 — 네트워크 실패는 0 */
  readonly status: number;
  /** 에러 코드 — 500 · 네트워크 실패 · 봉투 아님이면 null */
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // 봉투가 아닌 본문 — code 없이 상태만 남긴다
  }
  const env = ErrorEnvelope.safeParse(body);
  if (env.success) return new ApiError(res.status, env.data.error.code ?? null, env.data.error.message);
  return new ApiError(res.status, null, `HTTP ${res.status}`);
}

/** JSON 요청 — 성공 본문과 응답 수신 시각(STALE 오프셋 계산용)을 함께 돌려준다 */
export async function requestJson(
  url: string,
  init?: RequestInit,
): Promise<{ body: unknown; status: number; receivedAt: number }> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new ApiError(0, null, 'api에 닿지 못했다');
  }
  const receivedAt = Date.now();
  if (!res.ok) throw await toApiError(res);
  return { body: await res.json(), status: res.status, receivedAt };
}

export function directUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

/** 503 계열은 백오프 재시도(TanStack 기본 지수 지연) · 나머지 코드는 재시도하지 않는다(08_screen/01 §에러 코드별 사용자 표시) */
export function retryOn503(failureCount: number, error: unknown): boolean {
  return error instanceof ApiError && error.status === 503 && failureCount < 3;
}
