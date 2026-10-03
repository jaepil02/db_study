// /monitoring 화면 문구 — 흐름도 노드 줄 · 숫자 4 · 왜 나눌까 카드 3 · 모아서 vs 하나씩 · 각주의 꺼진 길(그리기는 각 컴포넌트 · 좌표는 diagram-layout.ts)
// 설계 .omc/plans/web-junior-redesign.md §3 · §4 용어표 — 쉬운 말 먼저 · 숫자는 적게 · 크게("8,838만 행" · "950MB") · 스위치 코드 · 키 이름은 화면에 쓰지 않는다.
// 순수 함수라 test/flow-layout.test.ts가 최악의 값(6자리 초당 값 · 10억 행 누적)으로 노드 폭 안에 드는지 보고, test/flow.test.ts가 문구를 본다.
import type {
  BatchStageKey,
  BizStageKey,
  FlowMetricRates,
  FlowMetrics,
  FlowRates,
  FlowSwitchFlags,
  ReadRates,
  StageAvg,
  TimelineEntry,
} from '../../../lib/flow';
import { readShare } from '../../../lib/flow';
import type { StoreKey } from '../../ui/store';

/** 초당 값 — 100 이상 정수 · 미만 소수 1자리 · 0보다 크지만 0.1로 반올림되지 않는 작은 값은 "0.1 미만"(값이 있는데 없다고 읽히지 않게) */
export function perSecText(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '0';
  if (v > 0 && v < 0.05) return '0.1 미만';
  return v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1);
}

/**
 * 큰 수 — 1만 미만은 그대로 · 1억 미만은 "8,838만" · 그 위는 "12.3억"(소수 0이면 뗀다).
 * 반올림한 뒤의 값으로 단위를 다시 고른다 — 99,995,000을 "10,000만"이 아니라 "1억"으로 · 99.96억을 "100억"으로(timesText와 같은 규칙).
 */
export function koCount(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = Math.round(v);
  if (n < 10_000) return n.toLocaleString('ko-KR');
  const man = Math.round(n / 10_000);
  if (man < 10_000) return `${man.toLocaleString('ko-KR')}만`;
  const eok = n / 100_000_000;
  const r1 = Math.round(eok * 10) / 10;
  const t = r1 >= 100 ? Math.round(eok).toLocaleString('ko-KR') : r1.toFixed(1).replace(/\.0$/, '');
  return `${t}억`;
}

const BYTE_UNITS: readonly [number, string][] = [
  [1, 'B'],
  [1e3, 'KB'],
  [1e6, 'MB'],
  [1e9, 'GB'],
  [1e12, 'TB'],
];

/**
 * 크기 — 10진 단위(B · KB · MB · GB · TB) · 10 미만은 소수 1자리(B는 정수).
 * 반올림한 뒤의 값으로 자릿수 · 단위를 다시 고른다 — 9.96MB는 "10MB" · 999.6MB는 "1,000MB"가 아니라 "1.0GB".
 */
export function koBytes(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  let i = 0;
  while (i < BYTE_UNITS.length - 1 && v >= (BYTE_UNITS[i + 1] as [number, string])[0]) i++;
  for (;;) {
    const [base, unit] = BYTE_UNITS[i] as [number, string];
    const x = v / base;
    const r1 = Math.round(x * 10) / 10;
    const r = i === 0 || r1 >= 10 ? Math.round(x) : r1;
    if (r >= 1000 && i < BYTE_UNITS.length - 1) {
      i++;
      continue;
    }
    return `${i === 0 || r >= 10 ? r.toLocaleString('ko-KR') : r.toFixed(1)}${unit}`;
  }
}

/** 간선 라벨 초당 값 — "9,681개/초" · 없으면 null(라벨을 그리지 않는다) */
export function edgeRate(v: number | null | undefined, unit: string): string | null {
  if (v === null || v === undefined) return null;
  return `${perSecText(v)}${unit}/초`;
}

export function sumOrNull(vals: readonly (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x !== null);
  return v.length === 0 ? null : v.reduce((a, b) => a + b, 0);
}

// ── 흐름도 노드 줄 ──

/**
 * 발생원 노드 — 공장 센서 · 초당 몇 개(흐름 요약 최근 10초 — 대기줄 · 저장 노드 · 숫자 4와 같은 원천 · 같은 창).
 * 메트릭의 보낸 쪽 계수(5초 차분)는 창 · 원천이 달라 같은 줄에 두면 "보낸 수 ≠ 저장 수"로 읽힌다 — 노드 툴팁(sourceTip)에만 둔다(리드 확인 2026-10-03).
 */
export function sourceLines(rows: number | null): string[] {
  return ['공장 센서', `초당 ${perSecText(rows)}개 보냄`];
}

/** 발생원 노드 툴팁 — 보낸 쪽 계수(메트릭) · 직접 보내 보기 몫 · 숫자 기준 */
export function sourceTip(pps: number | null, mr: FlowMetricRates | null): string {
  const run = mr?.genPpsByMode.run ?? null;
  return [
    '화면의 초당 숫자는 모두 최근 10초 흐름 요약 기준이에요',
    `보낸 쪽 계수(메트릭 5초 차분) 초당 ${perSecText(pps)}개`,
    run !== null && run > 0 ? `그중 직접 보내 보기 몫 초당 ${perSecText(run)}개` : null,
  ]
    .filter((x): x is string => x !== null)
    .join('\n');
}

// ── Redis 기둥 칸 4(설계 §8 — 서버와 DB 사이 중간층) ──

/** 기둥 머리 한 줄 · 툴팁 전문 */
export const PILLAR_HEAD = '줄 세우고 · 지금 값을 들고 · 결과를 전해요';
export const PILLAR_TIP = 'Redis — 서버와 DB 사이에서 줄 세우고 · 지금 값을 들고 · 결과를 전해요';

/** 기둥 바닥 — Redis 메모리 크기(OBS-03 · 흐름 보기 폴링) */
export function pillarFootText(m: FlowMetrics | null): string {
  return `Redis 메모리 ${koBytes(m?.redis.usedMemoryBytes ?? null)}`;
}

/** ① 센서 대기줄 — 꺼짐(SW-01 대안 · 대기줄을 거치지 않음)이면 그 사실 한 줄 */
export function streamLines(lag: number | null, off: boolean): string[] {
  if (off) return ['① 센서 대기줄(Stream)', '지금은 거치지 않아요'];
  return ['① 센서 대기줄(Stream)', '들어온 순서대로 줄 서기', `밀린 데이터 ${koCount(lag)}개`];
}

/**
 * ② 지금 값 · 알람 상태 — 모아서 저장이 초당 고치는 개수(흐름 요약 latestWrites) · 수집기 모드면 그 사실.
 * 한 묶음 안에 같은 태그 값이 여러 번 와도 태그마다 가장 최신 값 1개만 고친다(writeLatestIfNewer) — 그래서 센서 초당 행 수보다 작을 수 있다.
 */
export function latestLines(r: FlowRates | null, f: Pick<FlowSwitchFlags, 'collectorLatest'>): string[] {
  return [
    '② 지금 값 · 알람 상태',
    '태그마다 가장 최신 값 1개만',
    f.collectorLatest ? '센서 수집기가 직접 고쳐요' : `초당 ${perSecText(r?.latestWrites)}개 고침`,
  ];
}

/**
 * ④ 옛 사본 지움 · 결과 알림 — 저장(PostgreSQL 커밋)이 끝난 뒤에만(06_pipeline/07 §적용 단계 ⑥ → ⑦).
 * 결과 알림 초당은 업무 요청 초당과 같은 원천(flowRates commands — 명령 1건에 결과 1건)이다.
 * 대기줄 없이 바로 저장(비교 실험)이면 결과 알림 없이 서버가 바로 답한다 — 옛 사본 지움만 남는다.
 */
export function replyLines(r: FlowRates | null, direct: boolean): string[] {
  if (direct) return ['④ 옛 사본 지움 · 결과 알림', '지금은 옛 사본만 지워요', '결과는 서버가 바로 답해요'];
  return [
    '④ 옛 사본 지움 · 결과 알림',
    '다음 조회가 새 값을 보게',
    `결과 알림 초당 ${perSecText(r?.commands)}건`,
  ];
}

// ── 조회 줄(설계 §9.2 — 조회 요청 → ⑤ 조회 사본 → 있으면 바로 · 없으면 DB에서 읽어 와 사본 담기) ──
// 숫자는 모두 /metrics 5초 차분(lib/flow readRates). 조회는 점이 없다 — 선 굵기 · 숫자로만.

/** 비율 — 정수 %(0보다 크지만 1 미만은 "1% 미만") · 모르면 "—%" */
export function pctText(v: number | null): string {
  if (v === null) return '—%';
  if (v > 0 && v < 0.5) return '1% 미만';
  return `${Math.round(v)}%`;
}

export const NO_READ_TEXT = '조회 요청이 없어요 — 직접 보내 보기로 보내 보세요';

/** 조회가 0인가(원천은 있는데 이 5초 동안 한 건도 없음) — 모르면(null) 아니다 */
export const noReads = (rr: ReadRates): boolean => rr.requests === 0;

/** 조회 요청 노드 — 조회 건/초(센서 시계열 + 센서 지금 값 + 업무 목록) */
export function readSrcLines(rr: ReadRates | null): string[] {
  return ['사람의 조회 요청(api)', `초당 ${perSecText(rr?.requests)}건`, 'Redis부터 먼저 봐요'];
}

/** 조회 요청 노드 툴팁 — 숫자의 뜻 · 단위 · 지금 값이 돌려준 점 수(요청 수와 헷갈리지 않게 여기만) */
export function readSrcTip(rr: ReadRates | null): string {
  return [
    '초당 건수 = 센서 시계열 + 센서 지금 값 + 업무 목록(설비 목록) 조회 요청 — 숫자는 메트릭 5초 차분',
    '조회는 처리기(워커)를 거치지 않아요 — api가 직접 Redis를 먼저 봐요',
    rr && rr.latestPoints !== null && rr.latestPoints > 0
      ? `지금 값 조회가 돌려준 점 초당 ${perSecText(rr.latestPoints)}개(요청 수가 아니에요)`
      : null,
  ]
    .filter((x): x is string => x !== null)
    .join('\n');
}

/** ⑤ 조회 사본(캐시) — 있으면 바로 응답 % · 없으면 DB까지 % */
export function readCacheLines(rr: ReadRates | null): string[] {
  const miss =
    rr === null
      ? null
      : rr.chMiss === null && rr.pgMiss === null
        ? null
        : (rr.chMiss ?? 0) + (rr.pgMiss ?? 0);
  return [
    '⑤ 조회 사본(캐시)',
    `있으면 바로 응답 ${pctText(rr ? readShare(rr.hit, rr) : null)}`,
    `없으면 DB까지 ${pctText(rr ? readShare(miss, rr) : null)}`,
  ];
}

/** ⑤ ↔ DB 줄기 라벨 — 어느 DB로 몇 %(ClickHouse = 센서 시계열 · 지금 값 복원 · PostgreSQL = 업무 목록) · 조회가 없으면 보내 보라는 한 줄 */
export function readMissLabel(rr: ReadRates | null): string {
  if (rr && noReads(rr)) return NO_READ_TEXT;
  const ch = pctText(rr ? readShare(rr.chMiss, rr) : null);
  const pg = pctText(rr ? readShare(rr.pgMiss, rr) : null);
  return `없으면 읽어 와 사본 담기 — ClickHouse(센서) ${ch} · PostgreSQL(업무 목록) ${pg}`;
}

/** ⑤ 툴팁 — 스위치로 Redis를 건너뛴 몫(ClickHouse 쪽에 셌다) · Redis 읽기 실패(error) 몫은 0이 아닐 때만 */
export function readCacheTip(rr: ReadRates | null): string {
  return [
    '조회 결과 · 센서 지금 값을 들고 있어요 — 있으면 DB까지 가지 않아요',
    '업무 기록이 바뀌면 ④가 옛 사본을 지워 다음 조회가 새 값을 봐요',
    rr && rr.bypass !== null && rr.bypass > 0
      ? `Redis를 건너뜀(스위치) ${pctText(readShare(rr.bypass, rr))} — ClickHouse까지에 셌어요`
      : null,
    rr && rr.error !== null && rr.error > 0 ? `Redis 읽기 실패 ${pctText(readShare(rr.error, rr))}` : null,
  ]
    .filter((x): x is string => x !== null)
    .join('\n');
}

/** 모아서 저장 노드 — 1초에 몇 번 · 한 번에 약 몇 개(초당 행 ÷ 초당 묶음) */
export function workerLines(r: FlowRates | null): string[] {
  const per = r && r.rows !== null && r.batches !== null && r.batches > 0 ? r.rows / r.batches : null;
  return ['모아서 한 번에 저장(배치)', `1초에 ${perSecText(r?.batches)}번`, `한 번에 약 ${koCount(per)}개`];
}

export function bizSrcLines(r: FlowRates | null): string[] {
  return ['사람의 업무 요청(api)', `초당 ${perSecText(r?.commands)}건`, '결과를 받을 때까지 기다림'];
}

/** ③ 업무 대기줄 */
export function bizStreamLines(lag: number | null, off: boolean): string[] {
  if (off) return ['③ 업무 대기줄(Stream)', '지금은 거치지 않아요'];
  return ['③ 업무 대기줄(Stream)', '요청을 순서대로 줄 세우기', `밀린 요청 ${koCount(lag)}건`];
}

export const BIZ_WORKER_LINES = ['하나씩 순서대로 처리', '전부 되거나 전부 안 되거나', '(트랜잭션)'] as const;

/** "지금까지 N행" — 값이 없으면 "약" · "행" 없이 "—"(PG는 통계 추정치라 "약") */
function rowsSoFar(v: number | null, approx: boolean): string {
  if (v === null) return '—';
  return `${approx ? '약 ' : ''}${koCount(v)}행`;
}

/** DB 노드 2의 줄 — 무엇을 · 초당 몇 개 · 지금까지 몇 행 · 크기(설계 §3 흐름도) · Redis는 기둥(§8 — latestLines · pillarFootText) */
export function storeLines(r: FlowRates | null, m: FlowMetrics | null): Record<'ch' | 'pg', string[]> {
  const chT = Object.values(m?.clickhouse.tables ?? {});
  const pgT = Object.values(m?.postgres.tables ?? {});
  const pgSize = sumOrNull(pgT.flatMap((t) => [t.heapBytes, t.indexBytes]));
  return {
    ch: [
      'ClickHouse',
      '센서 원본을 전부 쌓아요',
      `초당 ${perSecText(r?.chRows)}개 · 지금까지 ${rowsSoFar(sumOrNull(chT.map((t) => t.rows)), false)}`,
      `크기 ${koBytes(sumOrNull(chT.map((t) => t.bytesOnDisk)))}`,
    ],
    pg: [
      'PostgreSQL',
      '알람 기록 · 업무 기록',
      `초당 알람 ${perSecText(r?.transitions)}건 · 업무 ${perSecText(r?.applied)}건`,
      `지금까지 ${rowsSoFar(sumOrNull(pgT.map((t) => t.liveTuples)), true)} · ${koBytes(pgSize)}`,
    ],
  };
}

// ── 숫자 4 ──

export interface Headline {
  key: 'sensor' | 'backlog' | 'latency' | 'biz';
  label: string;
  value: string;
  unit: string;
  /** 쉬운 문장 한 줄 */
  text: string;
  /** 밀리는 중 — 주황 */
  warn?: boolean;
  /** 마우스 올림 — 보조 숫자(업무 거절 · 저장 못 함 · 시간 초과 초당 등) */
  tip?: string;
}

/** e2e 지연(초) — 10초 미만은 소수 1자리 · 그 위는 정수(반올림 뒤 자릿수 — 9.96초는 "10") */
function secText(v: number): string {
  const r1 = Math.round(v * 10) / 10;
  return r1 >= 10 ? Math.round(v).toLocaleString('ko-KR') : r1.toFixed(1);
}

/**
 * 숫자 4 — 명세 08 §EXP-FLOW 숫자 4 대응 표.
 * 밀린 데이터: 센서 대기줄 밀린 개수 · 0이면 "잘 처리 중" · 0보다 크면 "N개 밀려 있어요" · 백프레셔면 주황 "처리가 밀리는 중" · 업무 대기줄이 밀리면 "업무 N건"을 덧붙인다(더하지 않는다).
 * 측정 → 저장까지: e2e_latency_rows가 0이면 게이지가 빈 것이라 "—"(가짜 0.0초 금지).
 * 업무 요청: 0이면 "업무 요청이 없어요" · 거절 · 저장 못 함 · 시간 초과 초당은 0이 아닐 때 툴팁에.
 */
export function headlines(p: {
  rates: FlowRates | null;
  /** 센서 대기줄에 밀린 데이터(plc:raw 랙) */
  lag: number | null;
  /** 업무 대기줄에 밀린 요청(biz_stream_lag) */
  bizLag: number | null;
  /** 처리 속도 조절이 걸렸는가(백프레셔 단계 > 0) */
  slowing: boolean;
  /** e2e_latency 중간값(초) */
  e2eP50: number | null;
  /** e2e_latency_rows — 0이면 최근 창에 저장된 행이 없어 중간값이 비었다 */
  e2eRows: number | null;
}): Headline[] {
  const { rates: r, lag, bizLag, slowing, e2eP50, e2eRows } = p;
  const backlog =
    lag === null
      ? '아직 읽지 못했어요'
      : slowing
        ? '처리가 밀리는 중이에요'
        : lag > 0
          ? `${koCount(lag)}개 밀려 있어요`
          : '잘 처리하고 있어요';
  const bizBacklog = bizLag !== null && bizLag > 0 ? ` · 업무 ${koCount(bizLag)}건` : '';
  const noE2e = e2eP50 === null || e2eRows === 0;
  const bizTip = [
    ['거절', r?.rejected],
    ['저장 못 함', r?.failed],
    ['시간 초과', r?.expired],
  ]
    .filter((x): x is [string, number] => typeof x[1] === 'number' && x[1] > 0)
    .map(([k, v]) => `${k} 초당 ${perSecText(v)}건`)
    .join(' · ');
  return [
    {
      key: 'sensor',
      label: '센서 데이터',
      value: perSecText(r?.rows),
      unit: '개/초',
      text: '1초마다 이만큼 들어와요',
    },
    {
      key: 'backlog',
      label: 'Redis에 밀린 데이터',
      value: koCount(lag),
      unit: '개',
      text: `${backlog}${bizBacklog}`,
      warn: slowing,
    },
    {
      key: 'latency',
      label: '측정 → 저장까지',
      value: noE2e ? '—' : secText(e2eP50),
      unit: '초',
      text: noE2e ? '아직 잰 값이 없어요' : '센서가 잰 값이 DB에 들어가기까지 보통',
      tip: noE2e ? undefined : '측정 시각에서 저장 시각까지의 중간값이에요',
    },
    {
      key: 'biz',
      label: '업무 요청',
      value: perSecText(r?.commands),
      unit: '건/초',
      text: r?.commands === 0 ? '업무 요청이 없어요' : '사람이 보낸 요청을 하나씩 처리해요',
      tip: bizTip || undefined,
    },
  ];
}

// ── 왜 이렇게 나눌까? 카드 3 ──

export interface WhyCard {
  store: StoreKey;
  name: string;
  /** 한 줄 이유 */
  why: string;
  /** 지금 받는 양 */
  now: string;
}

export function whyCards(r: FlowRates | null, f: Pick<FlowSwitchFlags, 'collectorLatest'>): WhyCard[] {
  return [
    {
      store: 'ch',
      name: 'ClickHouse',
      why: '엄청 많이 쌓아 두고 크게 훑어 분석하기 좋아요',
      now: `지금 초당 ${perSecText(r?.chRows)}개 받는 중`,
    },
    {
      store: 'redis',
      name: 'Redis',
      why: '줄을 세우고 지금 값을 들고 있어요 · 조회도 먼저 여기서 찾아봐요',
      now: f.collectorLatest
        ? '지금 센서 수집기가 직접 고치는 중'
        : `지금 초당 ${perSecText(r?.latestWrites)}개 고치는 중`,
    },
    {
      store: 'pg',
      name: 'PostgreSQL',
      why: '틀리면 안 되는 기록을 전부 되거나 전부 안 되게 지켜요',
      now: `지금 초당 알람 ${perSecText(r?.transitions)}건 · 업무 ${perSecText(r?.applied)}건`,
    },
  ];
}

// ── 모아서 vs 하나씩 ──

export interface CompareBar {
  key: 'batch' | 'biz';
  label: string;
  /** 평균 처리 시간(ms) · 표본 없으면 null */
  ms: number | null;
  /** 막대 길이 0~1(둘 중 긴 쪽 = 1) */
  frac: number;
}

export const COMPARE_NOTE = '센서는 묶어서 많이 · 업무는 하나씩 정확히';
export const NO_BIZ_TEXT = '업무 요청이 없어요 — 오른쪽 위 버튼으로 보내 보세요';

/** 막대 2 — 센서 1묶음(최근 20묶음 평균 · 묶음당 평균 개수) · 업무 1건(최근 20건 평균) · 단계 합만 쓴다 */
export function compareBars(
  batch: { stages: StageAvg<BatchStageKey>[]; total: number | null; n: number },
  biz: { stages: StageAvg<BizStageKey>[]; total: number | null; n: number },
  timeline: readonly TimelineEntry[],
): CompareBar[] {
  const rows = timeline.flatMap((e) => (e.kind === 'batch' ? [e.batch.rows] : []));
  const avgRows = rows.length === 0 ? null : rows.reduce((a, b) => a + b, 0) / rows.length;
  const bMs = batch.n === 0 ? null : batch.total;
  const zMs = biz.n === 0 ? null : biz.total;
  const max = Math.max(bMs ?? 0, zMs ?? 0);
  const frac = (v: number | null) => (v === null || max <= 0 ? 0 : v / max);
  return [
    {
      key: 'batch',
      label: avgRows === null ? '센서 1묶음' : `센서 1묶음(약 ${koCount(avgRows)}개)`,
      ms: bMs,
      frac: frac(bMs),
    },
    { key: 'biz', label: '업무 1건', ms: zMs, frac: frac(zMs) },
  ];
}

export function msText(v: number | null): string {
  if (v === null) return '—';
  return v >= 10 ? `${Math.round(v).toLocaleString('ko-KR')}ms` : `${v.toFixed(1)}ms`;
}

// ── 각주 — 지금 꺼진 길(흐름도에는 그리지 않는다) ──

export function offPaths(f: FlowSwitchFlags): string[] {
  return [
    f.streamOff ? '센서 대기줄' : null,
    f.controlCopyOff ? 'PostgreSQL 비교용 사본' : null,
    f.collectorLatest ? '처리기 → Redis 지금 값(수집기가 대신 씀)' : null,
    f.bizDirect ? '업무 대기줄' : null,
  ].filter((x): x is string => x !== null);
}

/** 각주 한 줄 — 점 속도 · 숫자의 뜻 · 지금 꺼진 길(흐름도에는 그리지 않는다) */
export function footnoteText(off: readonly string[]): string {
  return [
    '점은 보기 좋게 느리게 움직여요(조회는 점 없이 숫자로만) · 숫자는 실제 값(최근 10초 평균 · 조회는 5초 · 지연은 중간값)',
    off.length > 0 ? `지금 꺼진 길: ${off.join(' · ')}` : null,
    '관찰용 화면이에요(기록 아님)',
  ]
    .filter((x): x is string => x !== null)
    .join(' · ');
}

/** 업무 결과 표지 — 기호 + 쉬운 말(오류 코드는 툴팁에만) */
const MARK_TEXT: Record<string, string> = {
  '↺': '↺ 이미 처리됨',
  '✕': '✕ 거절됨',
  '⚠': '⚠ 저장 못 함',
  '⌛': '⌛ 시간 초과',
};
export const markText = (m: { symbol: string }): string => MARK_TEXT[m.symbol] ?? m.symbol;
