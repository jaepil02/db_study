// 직결 · BFF 요청 공통 — 에러 값(07_api/01 §에러 봉투)과 진입 읽기 옵션. 봉투 해석은 요청하는 쪽(lib/runs.ts errorOf)이 한다.
// 클라이언트는 code로만 분기하고 message로 분기하지 않는다.

export class ApiError extends Error {
  /** HTTP 상태 — 네트워크 실패는 0 */
  readonly status: number;
  /** 에러 코드 — 500 · 네트워크 실패 · 봉투 아님이면 null */
  readonly code: string | null;
  /** 봉투 details — duplicate_key의 field · validation_failed의 fields 등 */
  readonly details: Record<string, unknown> | null;

  constructor(
    status: number,
    code: string | null,
    message: string,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * 진입 읽기 갱신 옵션 — 폴링 없는 읽기(health · 기록 보기)가 "진입 1회 · 새로고침"만 부르게 한다(08_screen/08 §호출 표면 · 갱신).
 * 화면 맨 위(진입 관찰자)만 staleTime 0 — 화면이 붙을 때마다 1회 다시 읽는다. 탭 · 서랍 안의 관찰자는 staleTime 무한 —
 * 탭을 오가며 다시 붙어도 캐시를 그대로 쓴다(데이터가 아직 없으면 그때는 읽는다). 창 포커스 · 네트워크 복귀 재조회는 끈다.
 */
export function entryReadOptions(entry: boolean) {
  return {
    staleTime: entry ? 0 : Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  } as const;
}
