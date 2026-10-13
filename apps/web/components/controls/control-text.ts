// 공용 컨트롤 문구 · 판정(순수 함수 — 단위 시험 test/controls.test.ts) — 쉬운 말 먼저 · 용어는 괄호 · 숫자는 api가 준 값만.
import type { ApiError } from '../../lib/api';
import { bytesText, roughText } from '../../lib/format';
import { refusedPath } from '../../lib/runs';
import {
  PURGE_BLOCK_REASONS,
  type PurgeBlockReason,
  type SensorDataStatsBody,
  type SensorPurgeResultBody,
} from '../../lib/shared';

/** 행 수 쉬운 표기 — 1만 미만은 그대로 · 1만 이상 "1,996만 행" · 1억 이상 "2.3억 행"(정확한 값은 툴팁) */
export function rowsText(n: number): string {
  if (n >= 1e8) return `${roughText(n / 1e8)}억 행`;
  if (n >= 1e4) return `${roughText(n / 1e4)}만 행`;
  return `${n.toLocaleString('ko-KR')}행`;
}

/** 걸린 시간 — 1s 미만은 ms 정수 · 이상은 s 소수 1자리 */
export function tookText(ms: number): string {
  return ms >= 1000 ? `${roughText(ms / 1000)}s` : `${Math.round(ms)}ms`;
}

// ── 설비 가동 ──

export const POWER_LABEL = '설비 가동';
export const POWER_STATE_TEXT = { on: '켜짐', off: '꺼짐' } as const;
export const POWER_TIP =
  '켜면 카드 생산 라인 설비 30대(가상 PLC)가 센서 데이터를 보내기 시작해요 · 끄면 멈춰요 · 서버가 다시 켜지면 꺼진 상태로 돌아가요';

/** 바뀌는 중 글자 — 누른 뒤 응답 전 */
export const powerPendingText = (to: boolean): string => (to ? '켜는 중이에요…' : '끄는 중이에요…');

/** 설비 가동 요청 실패 — Redis에 닿지 못함(503) · 그 밖 */
export function powerErrorText(e: Pick<ApiError, 'status' | 'code' | 'details'> | null): string {
  if (e?.code === 'realtime.latest_unavailable') return 'Redis에 닿지 못해 바꾸지 못했어요';
  if (e?.status === 400 && refusedPath(e) === 'purge')
    return '센서 데이터를 지우는 중이에요 — 끝난 뒤 다시 켜 주세요';
  return '바꾸지 못했어요 — 다시 눌러 주세요';
}

export const POWER_READ_FAILED = '설비 가동 상태를 못 읽었어요';

// ── 센서 데이터 지우기 ──

export const PURGE_LABEL = '데이터 지우기';
export const PURGE_TITLE = '쌓인 센서 데이터를 지울까요?';
export const PURGE_KEEP = '남는 것 — 설비 · 태그 · 업무 기록 · 직접 비교 결과';

/** 409 data.purge_blocked 이유 → 쉬운 문구 — 설비 가동은 끈 직후에도 수집기가 멈추는 몇 초 동안 막힌다 */
export const PURGE_BLOCKED_TEXT: Record<PurgeBlockReason, string> = {
  run_in_progress: '측정이 돌고 있어요 — 끝난 뒤 지워 주세요',
  plant_running: '설비 가동이 켜져 있거나 아직 멈추는 중이에요 — 끄고 몇 초 뒤 지워 주세요',
  stream_backlog: 'Redis 대기줄에 아직 넣는 중인 데이터가 있어요 — 잠시 뒤 다시 눌러 주세요',
};

/** 지우기 요청 실패 문구 — 409는 이유별 · 그 밖은 다시 누르기 */
export function purgeErrorText(e: Pick<ApiError, 'status' | 'code' | 'details'>): string {
  if (e.status === 409 && e.code === 'data.purge_blocked') {
    const r = PURGE_BLOCK_REASONS.find((x) => x === e.details?.reason);
    if (r) return PURGE_BLOCKED_TEXT[r];
    return '지금은 지울 수 없어요 — 잠시 뒤 다시 눌러 주세요';
  }
  if (e.status === 0) return '서버에 닿지 못했어요 — 다시 눌러 주세요';
  return '지우지 못했어요 — 다시 눌러 주세요';
}

export interface PurgeLine {
  key: 'ch' | 'pg' | 'redis';
  /** 저장소 이름 + 무엇(쉬운 말 · 용어는 괄호) */
  what: string;
  /** 양 — "1,996만 행 · 52MB" */
  amount: string;
  /** 정확한 값(툴팁) */
  exact: string;
}

/** 확인 창 줄 3 — 지울 양(stats) */
export function purgeLines(s: SensorDataStatsBody): PurgeLine[] {
  const ko = (n: number) => n.toLocaleString('ko-KR');
  return [
    {
      key: 'ch',
      what: '센서 원본 · 요약',
      amount: `${rowsText(s.clickhouse.rows)} · ${bytesText(s.clickhouse.bytes)}`,
      exact: `ClickHouse 원본(tag_raw) ${ko(s.clickhouse.rows)}행 · ${ko(s.clickhouse.bytes)}바이트 · 요약(1분 · 1시간 · 1일)도 함께`,
    },
    {
      key: 'pg',
      what: '비교 사본',
      amount: `${rowsText(s.postgres.rows)} · ${bytesText(s.postgres.bytes)}`,
      exact: `PostgreSQL 비교 사본(plc_tag_raw_control) ${ko(s.postgres.rows)}행 · ${ko(s.postgres.bytes)}바이트`,
    },
    {
      key: 'redis',
      what: '대기줄 · 지금 값',
      amount: `대기줄 ${ko(s.redis.streamLength)}개 · 지금 값 ${ko(s.redis.latestKeys)}개`,
      exact: `Redis 대기줄(stream:plc:raw) ${ko(s.redis.streamLength)}개 · 지금 값(rt:latest) 설비 ${ko(s.redis.latestKeys)}개 · 조회 사본도 함께`,
    },
  ];
}

/** 지운 결과 한 줄 — "지웠어요 — ClickHouse 1,996만 행 · PostgreSQL 1,996만 행 · Redis 20만 개 · 걸린 시간 1.2초" */
export function purgeResultText(r: SensorPurgeResultBody): string {
  const took = r.clickhouse.elapsedMs + r.postgres.elapsedMs + r.redis.elapsedMs;
  const redis = r.redis.streamEntries + r.redis.keys;
  return `지웠어요 — ClickHouse ${rowsText(r.clickhouse.rows)} · PostgreSQL ${rowsText(r.postgres.rows)} · Redis ${redis.toLocaleString('ko-KR')}개 · 걸린 시간 ${tookText(took)}`;
}
