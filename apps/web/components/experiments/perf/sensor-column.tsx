'use client';
// 센서 데이터 구역(주황) — 머리 띠(연한 주황 · 구역 이름 + 결론 16px) + 흰 본문 한 겹. 본문 안 상자 없음 — 묶음은 가는 줄로 가른다.
// 그림 1(주인공 · 가장 큰 규모에서 질문별 누가 몇 배 빠른가 · 줄 전체가 버튼 = 그림 2 질문) → 그림 2(선택 질문의 규모별 걸린 시간 · 역전 음영 · 3번 결과가 엇갈린 점은 속 빈 점 · 내 측정 점) →
// 왜? 두 줄(필요한 칸만 읽어요 · 같은 값끼리 모아 줄여요 — 작은 그림 + 쉬운 문장 · "몫" 숫자는 툴팁).
// 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF 요소 · §표시 계약 · §상태 4행 · 설계 .omc/plans/web-junior-redesign.md §2 · 다듬기 .omc/plans/web-ux-polish.md §2.2.
// 값은 lib/perf.ts 판독기(speedBars · curveLines · findRange · undeterminedExps · readShare · readWhy · rowBytes)에서만 온다 — 웜 · PG(B-tree) 기준.
// 넓고 높은 화면(가로 ≥ 1680 · 세로 ≥ 1000 — roomy.ts · §9 P1)은 글자 한 단계 크게 · 그림 1 막대 · 칸 비례 — 남는 높이는 그대로 그림 2가 받는다. 1440 × 900 · 1280 × 800은 그대로.
import { useMemo } from 'react';
import {
  crossSentence,
  curveLines,
  findRange,
  type PerfView,
  QUERY_NAME,
  type ReadWhy,
  rangeText,
  readShare,
  readWhy,
  roughText,
  rowBytes,
  rowsWords,
  type SpeedBar,
  speedBars,
  speedTip,
  timesText,
  undeterminedExps,
} from '../../../lib/perf';
import { liveSeries, panelRun } from '../../../lib/runs';
import { cn } from '../../../lib/utils';
import { useRunContext } from '../../runs/run-context';
import { STORE } from '../../ui/store';
import { EChart } from '../echart';
import { curveOption } from './options';
import { ROOMY } from './roomy';

export const NO_RECORD = '아직 잰 기록이 없어요';
export const READ_FAILED = '기록을 읽지 못했어요';
export const NO_STAGE = '단계 기록이 없어요';
export const NO_VALUE = '잰 값 없음';
/** 그림 1 안내 — 줄 전체가 버튼이라는 것(아래 그림 = 그림 2) */
export const FIG1_HINT = '줄을 누르면 아래 그림이 그 질문으로 바뀌어요';

const Skeleton = ({ className }: { className: string }) => (
  <div className={cn('motion-safe:animate-pulse rounded bg-slate-100', className)} />
);

/** 막대 길이 — 배수의 로그를 가장 큰 배수의 로그로 나눈 비(최소 6%) · 기준 폭은 모든 줄에서 같다(반쪽 − 배수 라벨 칸) */
export const barWidth = (times: number, maxTimes: number) =>
  `${Math.max(6, (Math.log10(times) / Math.log10(Math.max(maxTimes, 2))) * 100)}%`;

/**
 * 그림 1 한 줄 — [선택 점 · 질문 이름 14px] [PG 쪽 반 | 가운데 축 | CH 쪽 반] · 막대 18px · 막대 끝 배수 16px 굵게(저장소 글자 색).
 * 배수 라벨 칸(5.25rem = 84px)을 모든 줄의 바깥쪽에 똑같이 비워 두고(pl · pr), 막대 %는 그 칸을 뺀 폭 기준이다 — 라벨 길이가 달라도 막대 눈금이 줄마다 같다.
 * 라벨은 막대 끝에 붙고(틈 6px) 막대가 길면 비워 둔 칸으로 들어간다 · 가장 긴 "CH 101배"는 Pretendard 700 16px 고정 폭 숫자로 72px(+ 틈 6 = 78 ≤ 84).
 * 넓고 높은 화면은 질문 이름 16 · 배수 20 · 막대 22 · 줄 36 · 라벨 칸 104 · 이름 칸 10rem(근거 roomy.ts).
 */
function SpeedRow({
  bar,
  maxTimes,
  tip,
  selected,
  onSelect,
}: {
  bar: SpeedBar;
  maxTimes: number;
  tip: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const win = bar.kind === 'win' && bar.winner !== null && bar.ratio !== null;
  const chSide = bar.winner === 'clickhouse';
  const times = win && bar.ratio !== null ? (chSide ? bar.ratio : 1 / bar.ratio) : 1;
  const store = STORE[chSide ? 'ch' : 'pg'];
  const label = win ? `${chSide ? 'CH' : 'PG'} ${bar.times}배` : null;
  const fill = (
    <span
      data-testid="speed-fill"
      className={cn('block h-[18px] shrink-0', chSide ? 'rounded-r-sm' : 'rounded-l-sm', ROOMY.fig1Bar)}
      style={{ width: barWidth(times, maxTimes), backgroundColor: store.color }}
    />
  );
  const text = (t: string) => (
    <span
      className={cn('shrink-0 text-base leading-none font-bold whitespace-nowrap tabular-nums', ROOMY.base)}
      style={{ color: store.ink }}
    >
      {t}
    </span>
  );
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      data-testid="speed-row"
      data-query={bar.query}
      data-kind={bar.kind}
      title={tip}
      className={cn(
        'grid h-7.5 w-full cursor-pointer grid-cols-[9rem_1fr_1fr] items-stretch rounded-md text-left transition-colors',
        selected ? 'bg-slate-100' : 'hover:bg-slate-50',
        ROOMY.fig1Row,
        ROOMY.fig1Cols,
      )}
    >
      <span className="flex min-w-0 items-center gap-2 pl-1.5">
        <span
          aria-hidden="true"
          className={cn('size-1.5 shrink-0 rounded-full', selected ? 'bg-slate-800' : 'bg-transparent')}
        />
        <span
          className={cn(
            'truncate text-sm',
            selected ? 'font-semibold text-slate-900' : 'text-slate-700',
            ROOMY.sm,
          )}
        >
          {QUERY_NAME[bar.query] ?? bar.query}
        </span>
      </span>
      {win ? (
        <>
          <span
            className={cn(
              'flex min-w-0 items-center justify-end gap-1.5 border-r border-slate-300 pl-[5.25rem]',
              ROOMY.fig1PadL,
            )}
          >
            {!chSide && label ? (
              <>
                {text(label)}
                {fill}
              </>
            ) : null}
          </span>
          <span className={cn('flex min-w-0 items-center gap-1.5 pr-[5.25rem]', ROOMY.fig1PadR)}>
            {chSide && label ? (
              <>
                {fill}
                {text(label)}
              </>
            ) : null}
          </span>
        </>
      ) : (
        // 비슷 · 승패 미정 · 판정 없음 — 방향 · 배수 없이 축 위 회색 글자(§표시 계약 승패 막대 · 근거는 줄 툴팁) · 축 선은 글자 위아래로만 잇는다
        <span className="relative col-span-2 flex items-center justify-center">
          <span
            aria-hidden="true"
            className={cn('absolute top-0 left-1/2 h-1.5 w-px -translate-x-px bg-slate-300', ROOMY.fig1Tick)}
          />
          <span
            aria-hidden="true"
            className={cn(
              'absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-px bg-slate-300',
              ROOMY.fig1Tick,
            )}
          />
          {/* 선택 · hover 바탕(slate-100 · 50) 위에서도 4.5:1 이상 — slate-600(R13) */}
          <span className={cn('text-label text-slate-600', ROOMY.label)}>
            {bar.kind === 'even' ? '비슷' : bar.kind === 'undetermined' ? '승패 미정' : '판정 없음'}
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * 왜? ① 그림 — 6줄 × 5칸 표 둘. PG는 줄 전체를 칠하고 CH는 같은 줄의 필요한 칸(열) 하나만 칠한다.
 * 그림 1에서 PG가 이긴 질문(kind pg)이면 PG는 줄 하나만 콕 집고 CH는 그 칸을 위에서 아래까지 훑는다 — 문장과 같은 방향으로만 그린다.
 * viewBox = 실제 픽셀(1:1)이라 글자 12px가 화면에서도 12px다.
 */
function ReadFigure({ kind }: { kind: ReadWhy['kind'] | null }) {
  const pgRows = kind === 'pg' ? [2] : [1, 2, 3];
  const chRows = kind === 'pg' ? [0, 1, 2, 3, 4, 5] : [1, 2, 3];
  const table = (x: number, color: string, on: (r: number, c: number) => boolean) =>
    Array.from({ length: 30 }, (_, i) => {
      const r = Math.floor(i / 5);
      const c = i % 5;
      return (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정 30칸 장식
          key={i}
          x={x + c * 9}
          y={r * 5}
          width={8}
          height={4}
          rx={0.5}
          fill={on(r, c) ? color : '#e2e8f0'}
        />
      );
    });
  return (
    <svg
      role="img"
      aria-label={
        kind === 'pg'
          ? 'PG는 필요한 줄 하나만 읽고 CH는 필요한 칸을 위에서 아래까지 읽는 그림'
          : 'PG는 줄 전체를 읽고 CH는 같은 줄의 필요한 칸만 읽는 그림'
      }
      width={144}
      height={30}
      viewBox="0 0 144 30"
      className="shrink-0"
    >
      <title>
        {kind === 'pg' ? 'PG는 줄 하나만 콕 · CH는 칸 하나를 끝까지' : 'PG는 줄 전체 · CH는 필요한 칸(열)만'}
      </title>
      <text x={0} y={19} fontSize={12} fontWeight={600} fill="#475569">
        PG
      </text>
      {table(20, STORE.pg.color, (r) => pgRows.includes(r))}
      <text x={78} y={19} fontSize={12} fontWeight={600} fill="#475569">
        CH
      </text>
      {table(98, STORE.ch.color, (r, c) => c === 1 && chRows.includes(r))}
    </svg>
  );
}

/** 왜? 한 줄 — [작은 그림 10rem] [제목 14px (용어 12px) / 쉬운 문장 13px · 답 숫자 16px 굵게] · 카드가 아니라 줄 */
function WhyRow({
  title,
  term,
  tip,
  figure,
  children,
}: {
  title: string;
  term: string;
  tip?: string;
  figure: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div title={tip} className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-3 py-1.5">
      <div className="flex min-w-0 items-center">{figure}</div>
      <div className="flex min-w-0 flex-col">
        <h4 className={cn('truncate text-sm font-semibold text-slate-900', ROOMY.sm)}>
          {title} <span className={cn('text-xs font-normal text-slate-500', ROOMY.xs)}>({term})</span>
        </h4>
        <div className={cn('text-label text-slate-700', ROOMY.label)}>{children}</div>
      </div>
    </div>
  );
}

/** 답 숫자 — 문장 안 16px 굵게 · 낱말 가운데서 줄이 바뀌지 않게 · 고정 폭 숫자 */
const Strong = ({ children }: { children: React.ReactNode }) => (
  <b className={cn('text-base leading-none whitespace-nowrap text-slate-900 tabular-nums', ROOMY.base)}>
    {children}
  </b>
);

export function SensorColumn({
  view,
  failed,
  query,
  onQuery,
}: {
  view: PerfView | undefined;
  failed: boolean;
  query: string;
  onQuery: (q: string) => void;
}) {
  const bars = useMemo(() => (view ? speedBars(view) : []), [view]);
  const maxTimes = Math.max(
    2,
    ...bars.flatMap((b) =>
      b.kind === 'win' && b.ratio !== null ? [b.ratio >= 1 ? b.ratio : 1 / b.ratio] : [],
    ),
  );
  const topExp = bars[0]?.exponent ?? null;
  const lines = useMemo(
    () => curveLines(view?.points ?? [], query, 'warm').filter((l) => l.key !== 'I1'),
    [view, query],
  );
  const range = view ? findRange(view.ranges, query, 'warm', 'I2') : undefined;
  const undetermined = useMemo(() => (view ? undeterminedExps(view, query) : []), [view, query]);
  const { snapshot } = useRunContext();
  const liveRun = panelRun(snapshot, 'perf');
  const live = useMemo(() => liveSeries(liveRun, query), [liveRun, query]);
  const option = useMemo(
    () => curveOption({ lines, range, live, undetermined }),
    [lines, range, live, undetermined],
  );
  const read = view ? readShare(view, query) : null;
  const why = readWhy(
    bars.find((b) => b.query === query),
    read,
  );
  const bytes = view ? rowBytes(view) : null;
  const noSource = !!view && !view.source;
  const noStage = !!view && view.scan.length === 0 && view.storage.length === 0;
  const empty = (h: string) => (
    <p
      className={cn('flex items-center justify-center text-sm text-slate-500', ROOMY.sm, h)}
      title="EXP-01~05 구조 판정 기록 없음"
    >
      {NO_RECORD}
    </p>
  );

  return (
    <section
      aria-label="센서 데이터"
      className="flex min-h-0 flex-col rounded-lg border border-line bg-surface"
    >
      <header className="shrink-0 rounded-t-lg border-b border-line bg-store-ch-soft px-4 py-2">
        <p className={cn('text-label font-semibold text-store-ch-ink', ROOMY.label)}>
          센서 데이터 — 많이 쌓이고 크게 훑어봐요
        </p>
        {failed ? (
          <p className={cn('text-base font-bold text-amber-800', ROOMY.base)}>{READ_FAILED}</p>
        ) : noSource ? (
          <p
            className={cn('text-base font-bold text-slate-500', ROOMY.base)}
            title="EXP-01~05 구조 판정 기록 없음"
          >
            {NO_RECORD}
          </p>
        ) : (
          <p className={cn('text-base font-bold text-slate-900', ROOMY.base)}>
            데이터가 많아질수록 ClickHouse가 훨씬 빨라요
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
        <section aria-label="그림 1" className="flex shrink-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className={cn('text-label font-semibold text-slate-700', ROOMY.label)}>
              그림 1 · {topExp !== null ? `${rowsWords(topExp)}일 때` : '가장 큰 규모일 때'}, 질문별로 누가 몇
              배 빠른가
            </h3>
            <p className={cn('text-xs text-slate-500', ROOMY.xs)}>{FIG1_HINT}</p>
          </div>
          <div
            className={cn(
              'grid grid-cols-[9rem_1fr_1fr] text-label font-medium',
              ROOMY.fig1Cols,
              ROOMY.label,
            )}
          >
            <span className="pl-1.5 text-slate-500">질문</span>
            <span className="border-r border-slate-300 pr-2 text-right text-store-pg-ink">
              ← PostgreSQL이 빨라요
            </span>
            <span className="pl-2 text-store-ch-ink">ClickHouse가 빨라요 →</span>
          </div>
          {!view ? (
            <Skeleton className={cn('h-[150px] w-full', ROOMY.fig1Box)} />
          ) : noSource ? (
            empty(cn('h-[150px]', ROOMY.fig1Box))
          ) : (
            <div className="flex flex-col">
              {bars.map((b) => (
                <SpeedRow
                  key={b.query}
                  bar={b}
                  maxTimes={maxTimes}
                  tip={speedTip(b, rangeText(findRange(view.ranges, b.query, 'warm', 'I2')))}
                  selected={b.query === query}
                  onSelect={() => onQuery(b.query)}
                />
              ))}
            </div>
          )}
        </section>

        <section aria-label="그림 2" className="flex min-h-0 flex-1 flex-col gap-1 border-t border-line pt-3">
          <h3 className={cn('text-label font-semibold text-slate-700', ROOMY.label)}>
            그림 2 · {QUERY_NAME[query] ?? query} — 데이터가 많아질수록 걸리는 시간
          </h3>
          <p
            data-testid="cross-sentence"
            className={cn('truncate text-sm font-medium text-slate-900', ROOMY.sm)}
          >
            {view && !noSource ? crossSentence(range) : ' '}
          </p>
          {!view ? (
            <Skeleton className="min-h-0 flex-1" />
          ) : noSource ? (
            empty('min-h-0 flex-1')
          ) : (
            <EChart option={option} className="min-h-48 w-full flex-1 lg:min-h-24" />
          )}
        </section>

        <section aria-label="왜 그런가" className="flex shrink-0 flex-col border-t border-line pt-2">
          <h3 className={cn('text-label font-semibold text-slate-700', ROOMY.label)}>왜 그럴까?</h3>
          <div className="divide-y divide-line">
            <WhyRow
              title="필요한 칸만 읽어요"
              term="열 저장"
              figure={<ReadFigure kind={why?.kind ?? null} />}
              tip={
                read && why
                  ? [
                      why.shares,
                      `결정적 값 · 기록 ${read.record}${read.pg > 1 ? ' · PG 몫이 100%를 넘는 것은 같은 페이지를 여러 번 읽어서예요(방문 횟수)' : ''}`,
                    ].join('\n')
                  : undefined
              }
            >
              {!view ? (
                ' '
              ) : noSource ? (
                NO_RECORD
              ) : view.scan.length === 0 ? (
                NO_STAGE
              ) : why ? (
                <span data-testid="why-read" data-kind={why.kind}>
                  {why.parts.map((x) => (x.strong ? <Strong key={x.text}>{x.text}</Strong> : x.text))}
                </span>
              ) : (
                NO_VALUE
              )}
            </WhyRow>
            <WhyRow
              title="같은 값끼리 모아 줄여요"
              term="압축"
              tip={bytes ? `결정적 값 · 기록 ${bytes.record}` : undefined}
              figure={
                bytes ? (
                  <span className={cn('flex w-full flex-col gap-1 text-xs text-slate-700', ROOMY.xs)}>
                    {(['ch', 'pg'] as const).map((k) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <span className="w-5 shrink-0 font-semibold text-slate-600">{STORE[k].short}</span>
                        <span className="flex min-w-0 flex-1">
                          <span
                            className="block h-2 rounded-sm"
                            style={{
                              width: `${Math.max(3, ((k === 'ch' ? bytes.ch : bytes.pg) / bytes.pg) * 100)}%`,
                              backgroundColor: STORE[k].color,
                            }}
                          />
                        </span>
                        <span className="w-[4.75rem] shrink-0 whitespace-nowrap tabular-nums">
                          약 {roughText(k === 'ch' ? bytes.ch : bytes.pg)}바이트
                        </span>
                      </span>
                    ))}
                  </span>
                ) : null
              }
            >
              {bytes ? (
                <span>
                  1행 저장에 CH가 <Strong>{timesText(bytes.times)}배</Strong> 작아요
                </span>
              ) : !view ? (
                ' '
              ) : noSource ? (
                NO_RECORD
              ) : noStage ? (
                NO_STAGE
              ) : (
                NO_VALUE
              )}
            </WhyRow>
          </div>
        </section>
      </div>
    </section>
  );
}
