'use client';
// ① 센서 데이터 열(주황) — 결론 한 문장 → 그림 1(가장 큰 규모에서 질문별 누가 몇 배 빠른가 · 행 클릭 = 그림 2 질문) →
// 그림 2(선택 질문의 규모별 걸린 시간 · 역전 음영 · ? 미정 · 내 측정 점) → 왜? 카드 2(열 저장 · 압축).
// 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF 요소 · §표시 계약 · §상태 4행 · 설계 .omc/plans/web-junior-redesign.md §2.
// 값은 lib/perf.ts 판독기(speedBars · curveLines · findRange · undeterminedExps · readShare · rowBytes)에서만 온다 — 웜 · PG(B-tree) 기준.
import { useMemo } from 'react';
import {
  crossSentence,
  curveLines,
  findRange,
  type PerfView,
  QUERY_NAME,
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

export const NO_RECORD = '아직 잰 기록이 없어요';
export const READ_FAILED = '기록을 읽지 못했어요';
export const NO_STAGE = '단계 기록이 없어요';
export const NO_VALUE = '잰 값 없음';

const Skeleton = ({ className }: { className: string }) => (
  <div className={cn('animate-pulse rounded bg-slate-100', className)} />
);

/** 막대 길이 — 배수의 로그를 가장 큰 배수의 로그로 나눈 비(최소 6%) */
const barWidth = (times: number, maxTimes: number) =>
  `${Math.max(6, (Math.log10(times) / Math.log10(Math.max(maxTimes, 2))) * 100)}%`;

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
  const color = bar.winner ? STORE[bar.winner === 'clickhouse' ? 'ch' : 'pg'].color : '#94a3b8';
  const label = win ? `${chSide ? 'CH' : 'PG'} ${bar.times}배` : null;
  const fill = (
    <span
      className={cn('block h-3.5', chSide ? 'rounded-r' : 'ml-auto rounded-l')}
      style={{ width: barWidth(times, maxTimes), backgroundColor: color }}
    />
  );
  const text = (t: string) => (
    <span className="shrink-0 text-xs font-semibold whitespace-nowrap tabular-nums" style={{ color }}>
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
        'grid h-7 w-full grid-cols-[10rem_1fr_1fr] items-center rounded px-1 text-left text-sm',
        selected ? 'bg-slate-100 ring-1 ring-slate-400' : 'hover:bg-slate-50',
      )}
    >
      <span className={cn('truncate', selected ? 'font-semibold text-slate-900' : 'text-slate-700')}>
        {QUERY_NAME[bar.query] ?? bar.query}
      </span>
      {win ? (
        <>
          <span className="flex items-center justify-end gap-1.5 border-r border-slate-400">
            {!chSide && label ? (
              <>
                {text(label)}
                <span className="flex min-w-0 flex-1 justify-end">{fill}</span>
              </>
            ) : null}
          </span>
          <span className="flex items-center gap-1.5">
            {chSide && label ? (
              <>
                <span className="flex min-w-0 flex-1">{fill}</span>
                {text(label)}
              </>
            ) : null}
          </span>
        </>
      ) : (
        // 비슷 · 승패 미정 · 판정 없음 — 방향 · 배수 없이 가운데 회색 글자(§표시 계약 승패 막대 · 근거는 행 툴팁)
        <span className="col-span-2 text-center text-xs text-slate-500">
          {bar.kind === 'even' ? '비슷' : bar.kind === 'undetermined' ? '승패 미정' : '판정 없음'}
        </span>
      )}
    </button>
  );
}

/** 왜? 카드 그림 ① — 4 × 4 표에서 PG는 행 하나 전체 · CH는 열 하나만 칠한다 */
function TinyTable({ mode }: { mode: 'row' | 'col' }) {
  const color = mode === 'row' ? STORE.pg.color : STORE.ch.color;
  return (
    <span aria-hidden="true" className="grid shrink-0 grid-cols-4 gap-px">
      {Array.from({ length: 16 }, (_, i) => {
        const on = mode === 'row' ? Math.floor(i / 4) === 1 : i % 4 === 1;
        // biome-ignore lint/suspicious/noArrayIndexKey: 고정 16칸 장식
        return <span key={i} className="h-1 w-2" style={{ backgroundColor: on ? color : '#e2e8f0' }} />;
      })}
    </span>
  );
}

function WhyCard({
  title,
  term,
  tip,
  children,
}: {
  title: string;
  term: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      title={tip}
      className="flex min-w-0 flex-col gap-1 rounded-md border border-slate-200 bg-white px-3 py-2"
    >
      <h4 className="truncate text-sm font-semibold text-slate-900">
        {title} <span className="text-xs font-normal text-slate-500">({term})</span>
      </h4>
      {children}
    </div>
  );
}

/** 숫자 · 단위 한 덩어리 — 낱말 가운데서 줄이 바뀌지 않게 */
const Num = ({ children }: { children: React.ReactNode }) => (
  <span className="whitespace-nowrap">{children}</span>
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
      className={cn('flex items-center justify-center text-sm text-slate-500', h)}
      title="EXP-01~05 구조 판정 기록 없음"
    >
      {NO_RECORD}
    </p>
  );

  return (
    <section
      aria-label="센서 데이터"
      className="flex min-h-0 flex-col gap-2 rounded-lg border-2 bg-white px-4 py-3"
      style={{ borderColor: `${STORE.ch.color}80` }}
    >
      <header>
        <p className="text-sm font-semibold" style={{ color: STORE.ch.color }}>
          ① 센서 데이터 — 많이 쌓이고 크게 훑어봐요
        </p>
        {failed ? (
          <p className="text-base font-bold text-amber-800">{READ_FAILED}</p>
        ) : noSource ? (
          <p className="text-base font-bold text-slate-500" title="EXP-01~05 구조 판정 기록 없음">
            {NO_RECORD}
          </p>
        ) : (
          <p className="text-base font-bold text-slate-900">데이터가 많아질수록 ClickHouse가 훨씬 빨라요</p>
        )}
      </header>

      <section aria-label="그림 1" className="flex flex-col gap-0.5">
        <h3 className="text-xs font-semibold text-slate-600">
          그림 1 · {topExp !== null ? `${rowsWords(topExp)}일 때` : '가장 큰 규모일 때'}, 질문별로 누가 몇 배
          빠른가
        </h3>
        <div className="grid grid-cols-[10rem_1fr_1fr] px-1 text-[11px] text-slate-500">
          <span>질문</span>
          <span className="pr-2 text-right" style={{ color: STORE.pg.color }}>
            ◀ PostgreSQL이 빠름
          </span>
          <span className="pl-2" style={{ color: STORE.ch.color }}>
            ClickHouse가 빠름 ▶
          </span>
        </div>
        {!view ? (
          <Skeleton className="h-36 w-full" />
        ) : noSource ? (
          empty('h-36')
        ) : (
          bars.map((b) => (
            <SpeedRow
              key={b.query}
              bar={b}
              maxTimes={maxTimes}
              tip={speedTip(b, rangeText(findRange(view.ranges, b.query, 'warm', 'I2')))}
              selected={b.query === query}
              onSelect={() => onQuery(b.query)}
            />
          ))
        )}
        <p className="text-[11px] text-slate-500">행을 누르면 그림 2가 그 질문으로 바뀌어요</p>
      </section>

      <section aria-label="그림 2" className="flex min-h-0 flex-1 flex-col gap-0.5">
        <h3 className="text-xs font-semibold text-slate-600">
          그림 2 · {QUERY_NAME[query] ?? query} — 데이터가 많아질수록 걸리는 시간
        </h3>
        <p data-testid="cross-sentence" className="truncate text-sm font-medium text-slate-800">
          {view && !noSource ? crossSentence(range) : ' '}
        </p>
        {!view ? (
          <Skeleton className="min-h-0 flex-1" />
        ) : noSource ? (
          empty('min-h-0 flex-1')
        ) : (
          <EChart option={option} className="min-h-[9rem] w-full flex-1" />
        )}
      </section>

      <section aria-label="왜 그런가" className="flex flex-col gap-0.5">
        <h3 className="text-xs font-semibold text-slate-600">왜 그럴까?</h3>
        <div className="grid grid-cols-2 gap-2">
          <WhyCard
            title="① 필요한 칸만 읽어요"
            term="열 저장"
            tip={
              read && why
                ? [
                    why.kind === 'ch' ? null : why.shares,
                    `결정적 값 · 기록 ${read.record}${read.pg > 1 ? ' · PG 몫이 100%를 넘는 것은 같은 페이지를 여러 번 읽어서예요(방문 횟수)' : ''}`,
                  ]
                    .filter(Boolean)
                    .join('\n')
                : undefined
            }
          >
            <div className="flex items-start gap-2">
              <span
                className="flex flex-col gap-1 pt-0.5"
                title="위: PG는 행 전체를 읽어요 · 아래: CH는 필요한 열만 읽어요"
              >
                <TinyTable mode="row" />
                <TinyTable mode="col" />
              </span>
              <p className="min-w-0 text-xs leading-4 text-slate-700">
                {!view ? (
                  ' '
                ) : noSource ? (
                  NO_RECORD
                ) : view.scan.length === 0 ? (
                  NO_STAGE
                ) : why ? (
                  <span data-testid="why-read" data-kind={why.kind}>
                    {why.parts.map((x) =>
                      x.strong ? (
                        <Num key={x.text}>
                          <b>{x.text}</b>
                        </Num>
                      ) : (
                        x.text
                      ),
                    )}
                    {why.kind === 'ch' ? (
                      <span className="block text-[11px] text-slate-500">{why.shares}</span>
                    ) : null}
                  </span>
                ) : (
                  NO_VALUE
                )}
              </p>
            </div>
          </WhyCard>
          <WhyCard
            title="② 같은 값끼리 모아 줄여요"
            term="압축"
            tip={bytes ? `결정적 값 · 기록 ${bytes.record}` : undefined}
          >
            {bytes ? (
              <div className="flex flex-col gap-0.5 text-xs leading-4 text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-slate-500">CH</span>
                  <span
                    className="h-2 shrink-0 rounded"
                    style={{
                      width: `${Math.max(2, (bytes.ch / bytes.pg) * 100) * 0.45}%`,
                      backgroundColor: STORE.ch.color,
                    }}
                  />
                  <Num>약 {roughText(bytes.ch)}바이트</Num>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-slate-500">PG</span>
                  <span
                    className="h-2 shrink-0 rounded"
                    style={{ width: '45%', backgroundColor: STORE.pg.color }}
                  />
                  <Num>약 {roughText(bytes.pg)}바이트</Num>
                </span>
                <span>
                  1행 저장에 CH가{' '}
                  <Num>
                    <b>{timesText(bytes.times)}배</b>
                  </Num>{' '}
                  작아요
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-700">
                {!view ? ' ' : noSource ? NO_RECORD : noStage ? NO_STAGE : NO_VALUE}
              </p>
            )}
          </WhyCard>
        </div>
      </section>
    </section>
  );
}
