'use client';
// 알람 쿼리 — 이벤트 · 확인 · 규칙은 BFF 경유(no-store) · 판정 분석은 직결(07_api/07 공통 규약 경로 행)
// 쿼리 키는 lib/alarms의 alarmKeys(신호 무효화 cache:alarmrules → alarm · rules와 같은 접두)
// 쓰기(확인 · 규칙 등록 · 수정)는 명령 경로 — lib/alarms의 요청 생성 + lib/commands의 useBizWrite
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  ALARM_EVENTS_TTL_MS,
  ALARM_RULES_STALE_MS,
  alarmKeys,
  type EvalRangeId,
  type EventListQuery,
  evaluationsSearch,
  eventListSearch,
  parseEvaluations,
  parseEventPage,
  parseRuleList,
} from '../../lib/alarms';
import { directUrl, requestJson, retryOn503 } from '../../lib/api';

export const useEventList = (q: EventListQuery) =>
  useInfiniteQuery({
    queryKey: alarmKeys.eventList(q),
    queryFn: async ({ pageParam }) =>
      parseEventPage((await requestJson(`/bff/alarms/events?${eventListSearch(q, pageParam)}`)).body),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // staleTime = cache:alarmevents TTL 30초(09_tech_stack/01) — 새 값은 ch:alarm 겹침 · 자기 ACK 성공으로 얻는다
    staleTime: ALARM_EVENTS_TTL_MS,
    retry: retryOn503,
  });

export const useRules = (enabled = true) =>
  useQuery({
    queryKey: alarmKeys.rules(),
    queryFn: async () => parseRuleList((await requestJson('/bff/alarms/rules')).body),
    staleTime: ALARM_RULES_STALE_MS,
    retry: retryOn503,
    enabled,
  });

/**
 * 판정 분석 — 직결 · 캐시하지 않는 표면(07_api/07 #6). 규칙을 고른 뒤에만 부른다 —
 * 진입 즉시 부르면 대량 스캔 한도를 열람만으로 쓴다. 창 포커스 재조회도 끈다(같은 이유 · 재조회는 범위 변경 · 수동).
 */
export const useEvaluations = (ruleId: number | null, range: EvalRangeId, nowMs: number) => {
  const r = ruleId === null ? null : evaluationsSearch(ruleId, range, nowMs);
  return useQuery({
    queryKey: alarmKeys.evaluations(ruleId ?? 0, r?.fromMs ?? 0, r?.toMs ?? 0),
    queryFn: async () =>
      parseEvaluations((await requestJson(directUrl(`/api/v1/alarms/evaluations?${r?.search ?? ''}`))).body),
    enabled: r !== null,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: retryOn503,
  });
};

/** 쓴 탭의 로컬 무효화 — 응답을 받은 뒤에만(낙관적 갱신 없음) */
export function useAlarmInvalidate() {
  const qc = useQueryClient();
  // 안정 참조 — 겹침 TTL 타이머 효과가 렌더마다 다시 걸리지 않게
  return useCallback((key: readonly unknown[]) => qc.invalidateQueries({ queryKey: [...key] }), [qc]);
}
