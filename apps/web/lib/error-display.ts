// 에러 코드별 사용자 표시 — 정본 docs/08_screen/01_standards.md §에러 코드별 사용자 표시(이 화면들에 닿는 것만)
import { ApiError } from './api';

const TEXT: Record<string, string> = {
  'realtime.latest_unavailable': '실시간 저장소 응답 불가',
  'timeseries.clickhouse_unavailable': '시계열 저장소 응답 불가',
  'common.not_found': '대상이 없다',
  'common.rate_limited': '요청 한도 초과',
  'common.postgres_unavailable': '업무 저장소 응답 불가',
  'common.validation_failed': '요청 형식이 계약과 다르다',
  'timeseries.too_many_tags': '태그를 상한 이하 묶음으로 나눈다',
  'common.duplicate_key': '이미 있는 값',
  'master.scale_change_forbidden': '스케일 변경은 새 태그 발급으로만 한다',
  'master.reissue_source_inactive': '이미 비활성인 태그에서는 새 태그를 발급할 수 없다',
};

/** 띠 문구 — 코드가 있으면 코드와 함께 보인다. 코드 없는 실패(네트워크 · 500)는 상태로 가른다 */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code) return `${TEXT[error.code] ?? error.message} (${error.code}/${error.status})`;
    if (error.status === 0) return 'api에 닿지 못했다 (네트워크)';
    return `api 오류 (HTTP ${error.status})`;
  }
  return '응답을 해석하지 못했다';
}

export function errorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}
