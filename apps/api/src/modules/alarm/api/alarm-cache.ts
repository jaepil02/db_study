// 알람 API가 쓰는 캐시 키 두 개 — 모양 정본 docs/05_data_stores/05_redis_keyspace.md §키 패턴 · §TTL 조회 계약
// cache:alarmevents(Hash · 필드 = 정규화 목록 쿼리 SHA-1 · 값 = gzip JSON · 첫 채움 기준 EXPIRE NX 30초) — API 전용
// cache:alarmrules(String · 활성 규칙 JSON) — 쓰기 주체는 판정기 하나 · API는 규칙 쓰기 커밋 뒤 DEL만 한다(.omc/s7a-interfaces.md §규칙 원천)
// 키 문자열은 CacheKeyClient가 만든다(05_redis_keyspace §키 계열별 래퍼 강제) — 이 포트는 알람 서비스가 기대는 용도 메서드만 적는다.
import { mstMetrics } from '../../master/invalidation-chain';

/** cache:alarmevents 만료 — 현행 참고 30초 · 지터 없음(05_redis_keyspace §TTL 조회 계약) */
export const ALARM_EVENTS_TTL_SECONDS = 30;

export interface AlarmCacheOps {
  getAlarmEventsPage(sha1: string): Promise<Buffer | null>;
  setAlarmEventsPage(sha1: string, gz: Buffer, ttlSeconds: number): Promise<void>;
  /** 체인 ② — 키 하나 DEL · degrade면 false */
  delAlarmEvents(): Promise<boolean>;
  /** 체인 ② — 판정기 규칙 사본 DEL · degrade면 false */
  delAlarmRules(): Promise<boolean>;
}

export const ALARM_CACHE = Symbol('ALARM_CACHE');

/** 체인 ② 삭제 실패 계수 — 이름 정본 10_observability/01 mst_cache_delete_failures_total{prefix}(무효화 체인 ② 삭제 실패) */
export function countDeleteFailure(prefix: 'cache:alarmevents' | 'cache:alarmrules'): void {
  mstMetrics.cacheDeleteFailures.inc({ prefix });
}
