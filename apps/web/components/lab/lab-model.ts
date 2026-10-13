// ⑤ 직접 비교 실험(/lab) 판독 — 정본 docs/08_screen/10_lab_screen.md §패널 판독.
// 숫자는 전부 api 직접 비교 결과(GET /bff/runs/latest?type=compare — run_result 부분별 최근)와 센서 데이터 현황(stats)에서 온다.
// 넣기 어림만 계산값 — 기간은 건수 ÷ 카드 라인 명목 초당 점(packages/shared card-line) · 걸리는 시간은 지난 넣기의 실측 초당 행으로만.
// 순수 함수만 둔다(단위 시험 test/lab.test.ts) — 화면은 components/lab/lab-screen.tsx.

import { CARD_LINES, CARD_PROCESSES, nominalPointsPerSec } from '@db-study/shared/src/card-line';
import { bytesText, durText, msText, timesText } from '../../lib/format';
import { isActive, LIVE_MARK, stepPlainText } from '../../lib/runs';
import {
  COMPARE_QUERY_SIZES,
  type CompareLatestBodyType,
  type CompareLatestEntryBody,
  type ComparePart,
  type CompareRunResultBody,
  compareQueryStepKey,
  compareSizeName,
  type RunObjectBody,
  type RunStepBody,
  type SensorDataStatsBody,
} from '../../lib/shared';
import { formatKstIso } from '../../lib/time';
import { rowsText } from '../controls/control-text';

export type ResultOf<P extends ComparePart> = Extract<CompareRunResultBody, { part: P }>;

export const LAB_TITLE = '같은 센서 데이터를 Redis로 두 DB에 넣어 보면?';
export const LAB_LEAD =
  '카드 라인 30대의 지난 데이터를 Redis 대기줄로 보내 ClickHouse와 PostgreSQL(TimescaleDB)에 똑같이 넣고, 넣기 · 조회 · 정합성을 견줘요.';
export const LAB_FOOT = '노트북 한 대에서 세 DB가 CPU를 나눠 쓴 값 · 시간은 참고 · 승패는 3번 모두 같을 때만';
export const NOT_YET = '아직 재지 않았어요 — ▶를 눌러 재 보세요';
export const READ_FAILED = '지난 결과를 못 읽었어요 — 다시 재 보세요';
export const PLANT_ON_MARK = '설비 가동 중에 잰 값';

// ── 부분별 최근 결과 ──

/** 최근 완료 결과보다 뒤에 끝난 중단 · 실패 시도 — 패널 아래 한 줄(결과는 그 전 완료 것을 그대로 보인다) */
export interface AttemptNote {
  status: 'stopped' | 'failed';
  text: string;
  endedAt: string;
}

export type PartState<P extends ComparePart> =
  | { kind: 'loading' }
  | { kind: 'failed' }
  /** 완료 결과가 없다 — 그 전에 멈춘 시도가 있으면 그 한 줄 */
  | { kind: 'none'; attempt: AttemptNote | null }
  | { kind: 'ok'; entry: CompareLatestEntryBody; result: ResultOf<P>; attempt: AttemptNote | null }
  /** 이 부분을 재는 실행이 진행 중 — 지난 결과를 지우고 중간 결과로 새로 그린다(준비 · 비우는 중이면 result null) */
  | { kind: 'live'; run: RunObjectBody; result: ResultOf<P> | null }
  /** 방금 완료 — 보관 결과를 다시 읽기 전까지 실행 객체의 최종 결과 */
  | { kind: 'done'; run: RunObjectBody; result: ResultOf<P> };

export interface LatestRead {
  body: CompareLatestBodyType;
  failed: ComparePart[];
}

/** 멈춘 시도 한 줄 — 넣기는 앞 데이터를 이미 비웠으니 다시 넣어야 한다(조회 대결이 막힌다) */
export function attemptText(part: ComparePart, status: AttemptNote['status']): string {
  const head = status === 'stopped' ? '마지막 시도는 중단됐어요' : '마지막 시도는 실패했어요';
  return part === 'ingest' ? `${head} — 다시 넣어 주세요` : head;
}

/**
 * 한 부분의 상태 — 읽기 중 · 읽기 실패(전체 또는 이 부분만 계약과 다름) · 완료 결과 없음 · 결과.
 * 결과는 부분별 최근 완료 1건 · 그보다 뒤에 끝난 시도(attempts)가 중단 · 실패면 그 한 줄을 함께 단다.
 * 옛 api(부분별 최근 1건 — 상태 무관)가 완료가 아닌 항목을 주면 결과 없는 시도로 읽는다.
 */
export function partState<P extends ComparePart>(
  read: LatestRead | undefined,
  readFailed: boolean,
  part: P,
): PartState<P> {
  if (!read) return readFailed ? { kind: 'failed' } : { kind: 'loading' };
  if (read.failed.includes(part)) return { kind: 'failed' };
  let entry = read.body[part];
  let tried = read.body.attempts[part];
  if (entry && entry.status !== 'completed') {
    tried ??= { runId: entry.runId, status: entry.status, endedAt: entry.endedAt };
    entry = null;
  }
  const attempt: AttemptNote | null =
    tried && tried.status !== 'completed' && (!entry || Date.parse(tried.endedAt) > Date.parse(entry.endedAt))
      ? { status: tried.status, text: attemptText(part, tried.status), endedAt: tried.endedAt }
      : null;
  const result = entry?.result;
  if (!entry || !result || result.part !== part) return { kind: 'none', attempt };
  return { kind: 'ok', entry, result: result as ResultOf<P>, attempt };
}

/**
 * 지금 실행을 그 부분의 패널에 겹친다(사용자 결정 2026-10-11 — 세 패널 실시간 · 시작하면 그 패널만 지난 결과를 지우고 새로 그린다).
 * ① 이 부분의 진행 중 실행(running · stopping) → live(중간 결과 — 발행 · 첫 질문 전이면 null)
 * ② 이 부분의 완료 실행인데 보관 결과가 아직 그 실행이 아니다(다시 읽기 전) → done(실행 객체의 최종 결과) —
 *    끝나는 순간 지난 결과로 한 번 되돌아갔다가 새 결과로 바뀌는 깜빡임을 막는다
 * ③ 그 밖(다른 부분 · 다른 종류 · 중단 · 실패 · 보관 결과가 따라옴 · 첫 읽기 중) → 보관 결과 그대로
 */
export function withRun<P extends ComparePart>(
  base: PartState<P>,
  run: RunObjectBody | null | undefined,
  part: P,
): PartState<P> {
  if (run?.type !== 'compare' || run.params.part !== part) return base;
  const r = run.result;
  const result = r && 'part' in r && r.part === part ? (r as ResultOf<P>) : null;
  if (isActive(run.status)) return { kind: 'live', run, result };
  if (run.status !== 'completed' || !result || !run.endedAt || base.kind === 'loading') return base;
  if (base.kind === 'ok' && base.entry.runId === run.runId) return base;
  return { kind: 'done', run, result };
}

/** 완료 결과(보관 · 방금 끝남)가 있으면 그 결과 — 평소 줄로 그린다 */
export function finalResult<P extends ComparePart>(s: PartState<P>): ResultOf<P> | null {
  return s.kind === 'ok' || s.kind === 'done' ? s.result : null;
}

/** 진행 중 단계 쉬운 말 — "지난 구간 비우는 중이에요"(진행 띠와 같은 단계 문장) */
export function liveStepText(run: Pick<RunObjectBody, 'steps' | 'status' | 'type'>): string {
  return `${stepPlainText(run) ?? '준비 중'}이에요`;
}

export const LIVE_NOW = '지금 재는 중';

/** 잰 시각 — "10/11 18:44에 잼"(KST) */
export function measuredAtText(entry: Pick<CompareLatestEntryBody, 'endedAt'>): string {
  const t = formatKstIso(entry.endedAt); // 2026-10-11 18:44:05 KST
  return `${Number(t.slice(5, 7))}/${Number(t.slice(8, 10))} ${t.slice(11, 16)}에 잼`;
}

/** 패널 툴팁 공통 줄 — 실행 시각 · 커밋 · 설비 가동 · 라이브 표지 */
export function entryTip(entry: CompareLatestEntryBody): string {
  return [
    `실행 ${formatKstIso(entry.startedAt)} → ${formatKstIso(entry.endedAt).slice(11)}`,
    `커밋 ${entry.commitHash ?? '—'} · 동시 적재 스위치(SW-09) ${String(entry.switches['SW-09'] ?? '—')}`,
    `설비 가동 ${entry.plantOn ? '켜짐(그 부하가 함께 섞인 값)' : '꺼짐'}`,
    LIVE_MARK,
  ].join('\n');
}

// ── 머리: 지금 쌓인 비교 데이터 ──

export interface StatsHead {
  /** 비교 구간 안 행 수 — 구간이 없으면 null(아직 넣지 않음 · 지운 뒤) */
  rows: { ch: string; pg: string } | null;
  /** 툴팁 — 비교 구간 · 정확한 행 수 · 원본 전체(가동 데이터 포함) 행 · 디스크 */
  tip: string;
}

/** 머리 "쌓인 비교 데이터" — 비교 구간 행 수(CH · PG) · 원본 전체는 툴팁(ClickHouse 원본에는 가동 · 흐름 시연 데이터도 들어 있다) */
export function statsHead(s: SensorDataStatsBody): StatsHead {
  const ko = (n: number) => n.toLocaleString('ko-KR');
  const range = s.compareRange
    ? `${formatKstIso(s.compareRange.start).slice(0, 16)} ~ ${formatKstIso(s.compareRange.end).slice(5, 16)} KST`
    : null;
  const cr = s.compareRange ? s.compareRows : null;
  return {
    rows: cr ? { ch: rowsText(cr.clickhouse), pg: rowsText(cr.postgres) } : null,
    tip: [
      range && cr
        ? `비교 구간 ${range} — ClickHouse ${ko(cr.clickhouse)}행 · PostgreSQL ${ko(cr.postgres)}행`
        : '비교 구간 없음 — ① 넣기로 채워요',
      `원본 전체 — ClickHouse(tag_raw · 설비 가동 데이터 포함) ${ko(s.clickhouse.rows)}행 · 디스크 ${bytesText(s.clickhouse.bytes)}(압축 뒤)`,
      `원본 전체 — PostgreSQL 비교 사본(plc_tag_raw_control) ${ko(s.postgres.rows)}행 · 디스크 ${bytesText(s.postgres.bytes)}(목차 포함)`,
    ].join('\n'),
  };
}

// ── ① 넣기 ──

/** 데이터 기간 쉬운 말 — 1시간 미만 "N분치" · 하루 미만 "N시간치" · 그 이상 "N일치"(10 미만은 소수 한 자리 · .0은 뺀다) */
export function periodText(sec: number): string {
  const n = (x: number) => (x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}분치`;
  if (sec < 86_400) return `${n(sec / 3600)}시간치`;
  return `${n(sec / 86_400)}일치`;
}

export interface SizeChoice {
  rows: number;
  /** "1억 행" */
  name: string;
  /** 카드 라인 30대가 그만큼 보내는 기간(계산값) — "5일치" */
  period: string;
  /** 걸리는 시간 어림 — 지난 넣기 실측 초당 행이 있을 때만 "약 10m" */
  took: string | null;
}

/** 카드 라인 30대가 가동 중 1초에 보내는 점 수(명목 — 태그 주기 합) */
export function cardPointsPerSec(): number {
  return CARD_LINES.length * CARD_PROCESSES.reduce((a, p) => a + nominalPointsPerSec(p), 0);
}

/** 넣기 건수 선택지 — 기간은 건수 ÷ 카드 라인 명목 초당 점 · 시간은 지난 넣기의 실측 초당 행으로 나눈 값 */
export function sizeChoices(rowsList: readonly number[], lastRowsPerSec: number | null): SizeChoice[] {
  const pps = cardPointsPerSec();
  return rowsList.map((rows) => {
    const sec = lastRowsPerSec && lastRowsPerSec > 0 ? rows / lastRowsPerSec : null;
    return {
      rows,
      name: `${compareSizeName(rows)} 행`,
      period: periodText(rows / pps),
      took:
        sec === null
          ? null
          : `약 ${sec >= 3600 ? `${Math.round((sec / 3600) * 10) / 10}h` : sec >= 60 ? `${Math.round(sec / 60)}m` : `${Math.max(1, Math.round(sec))}s`}`,
    };
  });
}

/**
 * 디스크 크기 글자 — 유효숫자 3자리(157MB · 52.5MB · 2.33GB). 배수는 원시 바이트로 내므로 화면의 두 크기 글자로 나눠 봐도
 * 배수 글자와 맞게 크기 글자를 배수만큼 촘촘히 적는다(사용자 지적 2026-10-12 — 두 자리 표기 2.3GB ÷ 1.2GB와 배수가 어긋났다).
 */
export function diskText(b: number): string {
  const units: [number, string][] = [
    [1e12, 'TB'],
    [1e9, 'GB'],
    [1e6, 'MB'],
    [1e3, 'KB'],
  ];
  for (const [u, name] of units) {
    if (b >= u) {
      const v = b / u;
      return `${v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${name}`;
    }
  }
  return `${Math.round(b)}B`;
}

/** 디스크 배수 글자 — 10배 미만은 소수 두 자리(1.35) · 이상은 정수(44) — 크기 글자(유효숫자 3자리)로 나눈 값과 같은 자리까지 */
export function diskTimesText(x: number): string {
  return x >= 10 ? Math.round(x).toLocaleString('ko-KR') : x.toFixed(2);
}

export interface IngestView {
  same: boolean;
  /** "1,996만 행" */
  rows: string;
  /** 넣는 중 머리 — 보낸 행 "42만 행" · 각 DB에 들어간 행 "40만"(행 낱말 없이) */
  sent: string;
  inCh: string;
  inPg: string;
  rowsExact: string;
  took: string;
  perSec: string;
  /** 넣은 데이터 기간 — "5일치" */
  span: string;
  /** 넣는 도중 PostgreSQL 지난 날 칸을 압축했다(7일치를 넘는 넣기) — 묶음 시간에 압축 부하가 섞인다 */
  inflight: boolean;
  /** 크기 · 배수 — 재는 중에는 2초마다 다시 읽는 지금 크기(막대와 배수가 같은 값) · 끝나면 병합 · 압축 뒤 최종 크기 */
  disk: { ch: number | null; pg: number | null; chText: string; pgText: string; times: string | null };
  batch: {
    count: number;
    ch: { p50: string; p95: string };
    pg: { p50: string; p95: string };
    failures: number;
  };
  timeline: { t: number; ch: number | null; pg: number | null }[];
}

const msNum = (v: number | null) => (v === null ? '—' : msText(v));

export function ingestView(r: ResultOf<'ingest'>): IngestView {
  const { clickhouse: ch, postgres: pg, published } = r.rows;
  const same = ch === pg && pg === published;
  const ko = (n: number) => n.toLocaleString('ko-KR');
  const dc = r.bytes.clickhouse;
  const dp = r.bytes.postgres;
  const big = dc !== null && dp !== null && dc > 0 && dp > 0 ? Math.max(dc, dp) / Math.min(dc, dp) : null;
  const bare = (n: number) => rowsText(n).replace(/ ?행$/, '');
  return {
    same,
    rows: rowsText(ch),
    sent: rowsText(published),
    inCh: bare(ch),
    inPg: bare(pg),
    rowsExact: `보낸 ${ko(published)} · ClickHouse ${ko(ch)} · PostgreSQL ${ko(pg)}행`,
    took: durText(r.elapsedMs),
    perSec: rowsText(Math.round(r.rowsPerSec)).replace(/ 행$/, '행'),
    span: periodText((Date.parse(r.rangeEnd) - Date.parse(r.rangeStart)) / 1000),
    inflight: r.inflightCompress,
    disk: {
      ch: dc,
      pg: dp,
      chText: dc === null ? '—' : diskText(dc),
      pgText: dp === null ? '—' : diskText(dp),
      times: big === null ? null : `${diskTimesText(big)}배`,
    },
    batch: {
      count: r.batches.count,
      ch: { p50: msNum(r.batches.clickhouseMs.p50), p95: msNum(r.batches.clickhouseMs.p95) },
      pg: { p50: msNum(r.batches.postgresMs.p50), p95: msNum(r.batches.postgresMs.p95) },
      failures: r.batches.postgresFailures,
    },
    timeline: r.timeline.map((p) => ({ t: p.tSec, ch: p.clickhouseMs, pg: p.postgresMs })),
  };
}

/** 넣기 한 줄 결론 — 사실대로: 묶음 하나 넣는 시간 · 디스크 크기 */
export function ingestSentence(v: IngestView): string {
  const disk =
    v.disk.ch !== null && v.disk.pg !== null && v.disk.times
      ? v.disk.ch < v.disk.pg
        ? `디스크는 ClickHouse가 ${v.disk.times} 작아요`
        : `디스크는 PostgreSQL이 ${v.disk.times} 작아요`
      : null;
  return [v.same ? '두 DB에 똑같이 들어갔어요' : '두 DB의 행 수가 달라요', disk].filter(Boolean).join(' · ');
}

/** 넣는 중 결론 자리 — 행 수 같음(✓ · ✕)은 끝나기 전에 내지 않는다(중간에는 두 DB가 서로 다른 게 정상) */
export function ingestLiveText(run: Pick<RunObjectBody, 'steps' | 'status'>): string {
  if (run.status === 'stopping') return '멈추는 중이에요';
  if (run.steps.some((s) => s.key === 'verify' && s.status === 'running'))
    return '다 넣었어요 — 행 수 · 크기 맞춰 보는 중이에요';
  return '넣는 중이에요';
}

/**
 * 넣는 중 크기 툴팁 — 끝난 뒤 크기가 늘지 줄지는 정하지 않는다(실측 1시간치: 마지막 조각이 뒤에 들어와 최종 CH가 넣는 중 마지막 값보다 조금 컸다).
 * 배수는 막대와 같은 지금 크기로 2초마다 함께 바뀐다(사용자 지적 2026-10-12 — 넣는 동안 배수가 막대를 따라가지 않았다) ·
 * PostgreSQL(TimescaleDB)은 넣는 동안 압축 전(7일치를 넘으면 지난 날 칸부터 압축하며)이라 끝난 뒤 배수는 크게 달라질 수 있다.
 */
export const INGEST_LIVE_DISK_TIP =
  '넣는 중 크기 — 2s마다 다시 재고 배수도 같은 크기로 함께 바뀌어요 · PostgreSQL은 아직 압축 전이라 끝나면 줄어요 · 끝나면 ClickHouse는 조각을 합치고 PostgreSQL은 압축한 뒤 다시 재요';
export const INGEST_LIVE_DISK_TIP_INFLIGHT =
  '넣는 중 크기 — 2s마다 다시 재고 배수도 같은 크기로 함께 바뀌어요 · PostgreSQL은 다 들어간 지난 날 칸부터 압축하며 넣어요(디스크 여유) · 끝나면 ClickHouse는 조각을 합치고 PostgreSQL은 남은 칸을 압축한 뒤 다시 재요';
/** 넣는 중 PostgreSQL 크기 옆 표지 — 압축 전 · 7일치를 넘으면 압축하며 */
export const PG_UNCOMPRESSED = '압축 전';
export const PG_COMPRESSING = '압축하며 넣는 중';
/** 넣는 도중 압축한 넣기 — 그림 머리 · 결론 툴팁 */
export const INFLIGHT_NOTE =
  '넣는 도중 PostgreSQL 지난 날 칸을 압축했어요 — 묶음 시간에 압축 부하가 섞여 있어요';

// ── ② 조회 대결 — 원천 행 수 단계(넣기 건수와 같은 10만 ~ 10억 · 사용자 결정 2026-10-12) ──
// 단계마다 넣기 구간의 앞에서부터 정확히 N행을 설비 · 태그 · 1시간 칸으로 집계한 시간(3번 잰 가운데 값)을 꺾은선으로 · 축 아래에 이긴 쪽 배수.
// 점에 마우스를 올리면 두 DB의 걸린 시간과 몇 배 차이인지만 보인다(사용자 지시 2026-10-12 — 데이터 비교(원천 행 수 · 칸 대조)는 ③ 데이터 정합성 몫).

type StepLike = Pick<RunStepBody, 'key' | 'status' | 'detail'>;
type SizeEntry = ResultOf<'query'>['sizes'][number];

/** 단계 하나의 진행 — 끝남 · 지금 재는 중 · 아직 안 함 · 넣은 데이터가 모자라 건너뜀 */
export type SizePhase = 'done' | 'running' | 'waiting' | 'skipped';

export interface QueryPoint {
  target: number;
  /** 가로축 글자 — "10만" · "5,000만" */
  name: string;
  phase: SizePhase;
  /** 중간값(ms) — 끝난 단계만 · 그림의 점 */
  ch: number | null;
  pg: number | null;
  /** 걸린 시간 글자(단위 포함) — 끝난 단계만 · 한 점의 두 값은 같은 단위(queryTimes) */
  chText: string | null;
  pgText: string | null;
  /** 더 빠른 쪽 — 3번 모두 같은 쪽이 빨랐고(api 승자) 보이는 배수가 1.0배가 아닐 때만 */
  faster: 'ch' | 'pg' | null;
  /** 빠른 쪽 배수 글자("2.3") — faster가 있을 때만 */
  times: string | null;
  /** 차이 — "CH 2.3배 빠름" · "비슷" · "재는 중…" · "못 잼" · 기다리면 빈 글자 */
  mark: string;
  /**
   * 축 아래 글자 — "CH 2.3배" · "비슷" · "재는 중…" · "못 잼". 바로 앞 칸과 빠른 쪽이 같으면 저장소 이름을 뺀다("CH 4.5배 · 4.3배 · 3.6배").
   * 칸이 좁은 화면(1440 · 내비 펼침)에서 "CH n배"가 아홉 칸 내리 붙지 않게 — 같은 쪽 구간의 첫 칸이 이름을 말하고 색이 이어진다.
   */
  axis: string;
  /** 점에 마우스를 올리면 — 첫 줄 단계 · 끝난 단계는 ClickHouse 시간 · PostgreSQL 시간 · 차이(그 밖은 사유 한 줄) */
  tip: string;
}

export interface QueryView {
  points: QueryPoint[];
  /** 끝난 단계 수(못 잰 단계 제외) */
  measured: number;
  /** 못 잰 단계 한 줄 — 없으면 null */
  skipped: string | null;
  /** 지금 재는 단계 이름("1,000만") — 진행 중만 */
  running: string | null;
}

/** 원천 단계 이름 — "10만 행" */
export const sizeText = (n: number): string => `${compareSizeName(n)} 행`;

/** 조회 대결 칸 이름 옆 글자 — 단계 목록(넣기 건수와 같은 스케일)의 처음 ~ 끝 */
export const QUERY_TERM = `원천 ${compareSizeName(COMPARE_QUERY_SIZES[0])} ~ ${compareSizeName(
  COMPARE_QUERY_SIZES[COMPARE_QUERY_SIZES.length - 1] as number,
)} 행 집계`;

const ko = (n: number) => n.toLocaleString('ko-KR');

/** 유효숫자 3자리 — 100 이상은 정수(천 단위 쉼표) */
function sig3(x: number): string {
  return x >= 100 ? ko(Math.round(x)) : String(Number(x.toPrecision(3)));
}

/**
 * 한 점의 두 시간(ms) — 큰 쪽이 1s 이상이면 둘 다 s · 아니면 둘 다 ms(같은 단위라 눈으로 바로 견준다) · 유효숫자 3자리.
 * 배수는 보이는 두 숫자로 낸다 — 툴팁 숫자를 손으로 나눠도 같은 글자가 나온다. 빠른 쪽은 보이는 숫자가 작은 쪽(같으면 null).
 */
export function queryTimes(
  chMs: number,
  pgMs: number,
): { ch: string; pg: string; faster: 'ch' | 'pg' | null; times: string | null } {
  const sec = Math.max(chMs, pgMs) >= 1000;
  const unit = sec ? 's' : 'ms';
  const c = sig3(sec ? chMs / 1000 : chMs);
  const p = sig3(sec ? pgMs / 1000 : pgMs);
  const cn = Number(c.replace(/,/g, ''));
  const pn = Number(p.replace(/,/g, ''));
  const lo = Math.min(cn, pn);
  const faster = cn === pn || lo <= 0 ? null : cn < pn ? 'ch' : 'pg';
  return {
    ch: `${c}${unit}`,
    pg: `${p}${unit}`,
    faster,
    times: faster ? timesText(Math.max(cn, pn) / lo) : null,
  };
}

const SHORT = { ch: 'CH', pg: 'PG' } as const;

function pointOf(n: number, e: SizeEntry | null, phase: SizePhase, available: number | null): QueryPoint {
  const name = compareSizeName(n);
  const head = `원천 ${sizeText(n)}`;
  const base = {
    target: n,
    name,
    phase,
    ch: null,
    pg: null,
    chText: null,
    pgText: null,
    faster: null,
    times: null,
  };
  if (!e || phase !== 'done' || e.clickhouse.median === null || e.postgres.median === null) {
    const why =
      phase === 'skipped'
        ? `넣은 데이터${available === null ? '' : `(${rowsText(available)})`}보다 많아 못 쟀어요`
        : phase === 'running'
          ? '재는 중이에요'
          : '기다리는 중이에요';
    const mark = phase === 'skipped' ? '못 잼' : phase === 'running' ? PHASE_TEXT.query.running : '';
    return { ...base, mark, axis: mark, tip: `${head}\n${why}` };
  }
  const t = queryTimes(e.clickhouse.median, e.postgres.median);
  const winner = e.winner === 'postgres' ? 'pg' : e.winner === 'clickhouse' ? 'ch' : null;
  // 3번 모두 같은 쪽(api 승자)이 빨랐고 보이는 배수가 1.0배가 아닐 때만 "N배 빠름" — 3번이 엇갈리거나 1.0배면 "비슷"
  const faster = winner !== null && t.faster === winner && t.times !== '1.0' ? winner : null;
  const mark = faster ? `${SHORT[faster]} ${t.times}배 빠름` : '비슷';
  return {
    ...base,
    ch: e.clickhouse.median,
    pg: e.postgres.median,
    chText: t.ch,
    pgText: t.pg,
    faster,
    times: faster ? t.times : null,
    mark,
    axis: faster ? `${SHORT[faster]} ${t.times}배` : '비슷',
    tip: [head, `ClickHouse ${t.ch}`, `PostgreSQL ${t.pg}`, mark].join('\n'),
  };
}

/**
 * 조회 대결 판독 — 단계를 늘 다 낸다(가로축이 흔들리지 않게). 완료 결과는 결과의 단계 그대로 · 진행 중(steps)이면
 * 끝난 단계 · 지금 재는 단계(running 단계 key) · 기다리는 단계. 결과에 cut이 없는 단계는 넣은 데이터가 모자라 건너뛴 단계다.
 */
export function queryView(result: ResultOf<'query'> | null, steps: readonly StepLike[] | null): QueryView {
  const available = queryAvailable(result, steps);
  const points = COMPARE_QUERY_SIZES.map((n) => {
    const e = result?.sizes.find((x) => x.target === n) ?? null;
    const key = compareQueryStepKey(n);
    const phase: SizePhase = e
      ? e.cut
        ? 'done'
        : 'skipped'
      : steps?.some((s) => s.key === key && s.status === 'running')
        ? 'running'
        : steps?.some((s) => s.key === key && s.status === 'skipped')
          ? 'skipped'
          : 'waiting';
    return pointOf(n, e, phase, available);
  }).map((p, i, all) => {
    const prev = all[i - 1];
    const run = p.faster !== null && prev?.faster === p.faster;
    return run ? { ...p, axis: `${p.times}배` } : p;
  });
  const skipped = points.filter((p) => p.phase === 'skipped');
  const lo = skipped[0];
  const hi = skipped[skipped.length - 1];
  return {
    points,
    measured: points.filter((p) => p.phase === 'done').length,
    skipped:
      lo && hi
        ? `${lo.name}${hi !== lo ? `~${hi.name}` : ''} 행은 넣은 데이터${available === null ? '' : `(${rowsText(available)})`}보다 많아 못 쟀어요 — ${sizeText(COMPARE_QUERY_SIZES[COMPARE_QUERY_SIZES.length - 1] as number)} 이상 넣으면 다 재요`
        : null,
    running: points.find((p) => p.phase === 'running')?.name ?? null,
  };
}

/** 넣은 데이터(원천을 자를 수 있는 최대) — 결과(rows) · 첫 단계 전이면 prepare 단계 detail(clickhouse — 구간 안 행 수) */
export function queryAvailable(
  result: ResultOf<'query'> | null,
  steps: readonly StepLike[] | null,
): number | null {
  if (result) return result.rows;
  const v = steps?.find((s) => s.key === 'prepare')?.detail.clickhouse;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ── ③ 데이터 정합성 ──
// 네 기준(사용자 결정 2026-10-13) × 두 저장소를 표 한 장으로 — 기준 · PostgreSQL · ClickHouse · 판정. 처음 보는 사람이 위에서 아래로
// 행 수 → 값 합계 → 묶음 집계 → 행 지문 순(거친 것부터 촘촘한 것)으로 읽는다. 재는 동안에도 같은 표를 그리고 다 잰 저장소 칸부터 채운다.

export type ConsistencyKey = 'rows' | 'sum' | 'groups' | 'fingerprint';

export interface ConsistencyCriterion {
  key: ConsistencyKey;
  name: string;
  /** 괄호 안 전문 용어 */
  term: string;
  /** 이름 아래 한 줄 — 무엇을 견주나 */
  what: string;
  /** 줄 툴팁 — 무엇을 잡나 · 왜 이 모양인가 */
  tip: string;
}

export const CONSISTENCY_CRITERIA: readonly ConsistencyCriterion[] = [
  {
    key: 'rows',
    name: '행 수',
    term: 'count',
    what: '들어간 행 개수',
    tip: '두 DB에 들어간 행 개수예요 — 한쪽에 빠지거나 더 들어간 행이 있으면 달라져요',
  },
  {
    key: 'sum',
    name: '값 합계',
    term: 'sum',
    what: '모든 값의 합(소수 3자리)',
    tip: '모든 값을 소수 셋째 자리까지 반올림해 더한 값이에요 — 값이 바뀌면 달라져요. 소수를 그대로 더하면 같은 데이터라도 두 DB의 끝자리가 갈려서(더하는 순서가 달라요) 정수로 바꿔 더해요',
  },
  {
    key: 'groups',
    name: '묶음 집계',
    term: 'GROUP BY',
    what: '설비·태그·1시간별 집계',
    tip: '설비 · 태그 · 1시간 묶음마다 개수 · 합계 · 최소 · 최대를 낸 결과예요 — 값이 엉뚱한 설비 · 태그 · 시간에 들어가면 그 묶음이 달라져요',
  },
  {
    key: 'fingerprint',
    name: '행 지문',
    term: 'MD5',
    what: '행마다 만든 지문의 합',
    tip: '행마다 6개 열(시각 · 설비 · 태그 · 값 · 품질 · 순번)로 지문(MD5)을 만들어 더한 값이에요 — 행 하나의 열 하나만 달라도 달라져요. 칸의 글자는 지문 합의 끝 8자리예요',
  },
];

/** 저장소 칸 — 다 잼 · 지금 재는 중 · 아직 */
export interface ConsistencyCell {
  phase: 'done' | 'running' | 'waiting';
  text: string;
  tip: string | null;
}

export interface ConsistencyRowView extends ConsistencyCriterion {
  pg: ConsistencyCell;
  ch: ConsistencyCell;
  /** 판정 — 두 저장소를 다 재기 전이면 null */
  same: boolean | null;
  /** 판정 칸 — 맞는지 안 맞는지만("같음" · "다름" · 판정 전이면 빈 글자 — 사용자 지시 2026-10-13) */
  verdict: string;
  /** 다를 때 얼마나 — "PG 99,988행 적음" · "차이 0.004" · "3묶음 다름"(판정 칸 툴팁) · 같거나 판정 전이면 null */
  detail: string | null;
}

export interface ConsistencyView {
  match: boolean | null;
  /** 결론 한 줄 — 재는 중이면 null(화면이 지금 단계를 보인다) */
  headline: string | null;
  rows: ConsistencyRowView[];
  /** 다른 곳 한 줄 — "다른 곳 129묶음 — L1-PRT 인쇄 · 잉크 온도 9/03 18시(PG 780행 적음) 등" · 없으면 null */
  where: string | null;
  /** 잰 구간 · 걸린 시간(패널 맨 아래 잰 시각 줄 뒤) — "잰 구간 8/21 09:00 ~ 9/15 10:15 · 다 훑는 데 PG 125초 · CH 39초" */
  foot: string;
}

const STORE_NAME = { clickhouse: 'ClickHouse', postgres: 'PostgreSQL' } as const;
const STORE_SHORT = { clickhouse: 'CH', postgres: 'PG' } as const;
/** 다른 곳 줄에 글로 적는 묶음 수 — 한 줄에 들어가게 하나만(나머지는 수) */
export const SHOWN_MISMATCHES = 1;

/** KST "10/08 09:00" */
function kstShort(iso: string): string {
  const t = formatKstIso(iso); // 2026-10-08 09:00:00 KST
  return `${Number(t.slice(5, 7))}/${Number(t.slice(8, 10))} ${t.slice(11, 16)}`;
}

/** 값 합계 글자 — round(value × 1000)의 정수 합(10진 문자열) ÷ 1000 · 소수 셋째 자리까지 그대로 */
export function sumText(thousandths: string | bigint): string {
  const x = BigInt(thousandths);
  const neg = x < 0n;
  const abs = neg ? -x : x;
  return `${neg ? '-' : ''}${(abs / 1000n).toLocaleString('ko-KR')}.${(abs % 1000n).toString().padStart(3, '0')}`;
}

/** 지문 칸 글자 — 지문 합의 끝 32비트를 16진 8자리로("3A9F-12C0") · 판정은 합 전체로 한다 */
export function fingerprintCode(sum: string): string {
  const h = BigInt.asUintN(32, BigInt(sum)).toString(16).toUpperCase().padStart(8, '0');
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

type StoreBody = NonNullable<ResultOf<'consistency'>['clickhouse']>;

function cellOf(
  key: ConsistencyKey,
  store: 'clickhouse' | 'postgres',
  body: StoreBody | null,
  steps: readonly StepLike[] | null,
): ConsistencyCell {
  const ko = (n: number) => n.toLocaleString('ko-KR');
  if (!body) {
    const running = steps?.some((s) => s.key === store && s.status === 'running') ?? false;
    return { phase: running ? 'running' : 'waiting', text: running ? '재는 중…' : '기다리는 중', tip: null };
  }
  const name = STORE_NAME[store];
  if (key === 'rows') return { phase: 'done', text: `${ko(body.rows)}행`, tip: `${name} ${ko(body.rows)}행` };
  if (key === 'sum')
    return {
      phase: 'done',
      text: sumText(body.sum),
      tip: `${name} 값 합계 ${sumText(body.sum)}(값 × 1000을 반올림한 정수의 합 ${BigInt(body.sum).toLocaleString('ko-KR')})`,
    };
  if (key === 'groups')
    return {
      phase: 'done',
      text: `${ko(body.groups)}묶음`,
      tip: `${name} 묶음(설비 · 태그 · 1시간) ${ko(body.groups)}개`,
    };
  return {
    phase: 'done',
    text: fingerprintCode(body.fingerprint),
    tip: `${name} 지문 합 ${BigInt(body.fingerprint).toLocaleString('ko-KR')} — 칸의 글자는 끝 8자리(16진)`,
  };
}

function verdictOf(
  key: ConsistencyKey,
  r: ResultOf<'consistency'>,
): Pick<ConsistencyRowView, 'same' | 'verdict' | 'detail'> {
  const { checks, clickhouse: ch, postgres: pg } = r;
  if (!checks || !ch || !pg) return { same: null, verdict: '', detail: null };
  if (checks[key]) return { same: true, verdict: '같음', detail: null };
  const diff = (detail: string) => ({ same: false, verdict: '다름', detail });
  if (key === 'rows') {
    const fewer = pg.rows < ch.rows ? 'postgres' : 'clickhouse';
    return diff(`${STORE_SHORT[fewer]} ${Math.abs(ch.rows - pg.rows).toLocaleString('ko-KR')}행 적음`);
  }
  if (key === 'sum') {
    const d = BigInt(ch.sum) - BigInt(pg.sum);
    return diff(`차이 ${sumText(d < 0n ? -d : d)}`);
  }
  if (key === 'groups') return diff(`${(r.mismatchGroups ?? 0).toLocaleString('ko-KR')}묶음 다름`);
  return diff('행 내용이 달라요');
}

/** 다른 묶음 하나 — "L1-PRT 인쇄 · 잉크 온도 9/03 18시(PG 49,994행 적음)" */
function mismatchText(m: ResultOf<'consistency'>['mismatches'][number]): string {
  const at = kstShort(m.hour);
  const where = `${m.label ?? `설비 ${m.deviceId} · 태그 ${m.tagId}`} ${at.slice(0, at.indexOf(' '))} ${Number(at.slice(-5, -3))}시`;
  const { clickhouse: c, postgres: p } = m;
  const note =
    c === null
      ? 'CH에 없음'
      : p === null
        ? 'PG에 없음'
        : c === p
          ? '내용 다름'
          : `${c < p ? 'CH' : 'PG'} ${Math.abs(c - p).toLocaleString('ko-KR')}행 적음`;
  return `${where}(${note})`;
}

/**
 * 표 판독 — 보관 · 방금 끝난 결과(steps null)와 재는 중(steps = 실행 단계 · 결과가 아직 없으면 r null)이 같은 표다.
 * 판정 · 결론은 두 저장소를 다 잰 뒤에만(checks) — 재는 동안은 다 잰 저장소 칸만 값이 있다.
 */
export function consistencyView(
  r: ResultOf<'consistency'> | null,
  steps: readonly StepLike[] | null,
): ConsistencyView {
  const ko = (n: number) => n.toLocaleString('ko-KR');
  const rows = CONSISTENCY_CRITERIA.map(
    (c): ConsistencyRowView => ({
      ...c,
      pg: cellOf(c.key, 'postgres', r?.postgres ?? null, steps),
      ch: cellOf(c.key, 'clickhouse', r?.clickhouse ?? null, steps),
      ...(r ? verdictOf(c.key, r) : { same: null, verdict: '', detail: null }),
    }),
  );
  const match = r?.checks ? (r.match ?? null) : null;
  let headline: string | null = null;
  if (r?.checks && r.clickhouse && r.postgres) {
    const diff = rows.filter((x) => x.same === false).length;
    const short = r.clickhouse.rows - r.postgres.rows;
    const head = diff === rows.length ? `${rows.length}가지 모두` : `${rows.length}가지 중 ${diff}가지가`;
    headline =
      diff === 0
        ? `${rows.length}가지 기준이 모두 같아요 — 두 DB에 똑같이 들어갔어요`
        : short !== 0
          ? `${head} 달라요 — ${STORE_NAME[short > 0 ? 'postgres' : 'clickhouse']}에 ${ko(Math.abs(short))}행이 적어요`
          : `${head} 달라요 — 행 수는 같은데 내용이 달라요`;
  }
  const shown = (r?.mismatches ?? []).slice(0, SHOWN_MISMATCHES).map(mismatchText);
  const total = Math.max(r?.diffGroups ?? 0, shown.length);
  const where =
    shown.length > 0
      ? `다른 곳 ${ko(total)}묶음 — ${shown.join(' · ')}${total > shown.length ? ' 등' : ''}`
      : null;
  const scans = (['postgres', 'clickhouse'] as const)
    .filter((k) => r?.[k])
    .map((k) => `${STORE_SHORT[k]} ${durText(r?.[k]?.scanMs ?? 0)}`);
  const foot = [
    r ? `잰 구간 ${kstShort(r.rangeStart)} ~ ${kstShort(r.rangeEnd)}` : null,
    scans.length > 0 ? `다 훑는 데 ${scans.join(' · ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { match, headline, rows, where, foot };
}

/** 조회 대결 진행 중 글자 — 지금 재는 단계(축 아래 판정 자리) · 아직 안 한 단계 */
export const PHASE_TEXT = {
  query: { running: '재는 중…', waiting: '기다리는 중' },
} as const;
