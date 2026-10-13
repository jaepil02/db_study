'use client';
// ⑤ 직접 비교 실험(/lab) — 정본 docs/08_screen/10_lab_screen.md §EXP-LAB · 계약 packages/shared/src/api/runs.ts(compare)
// 머리: 지금 쌓인 비교 데이터(CH · PG 행 · 크기) + 데이터 지우기. 본문 패널 3: ① 넣기(왼쪽 크게) · ② 조회 대결 · ③ 데이터 정합성(오른쪽 위아래).
// ② 조회 대결은 원천 행 수 단계(넣기 건수와 같은 10만 ~ 10억 · 사용자 결정 2026-10-12) — 단계마다 정확히 N행을 집계한 시간을 꺾은선으로 · 원천 · 정합성은 그림 아래 한 줄.
// 업무 방해는 D-16 뒤 사용자 결정으로 삭제(강도마다 실측이 흔들려 판정 불가 — 지침 4-0).
// 패널마다 ▶(실행 하나 = 부분 하나 · 종류를 합쳐 동시 1 — 409) · 진행은 기존 진행 띠(RunProgress — 단계 · 경과 · 중단) ·
// 각 패널은 서버에 보관된 마지막 결과(GET /bff/runs/latest?type=compare)를 계속 보여 준다 — 결과가 예상과 달라도 그대로.
// 실행이 이 화면에서 끝나면 마지막 결과 · 쌓인 데이터를 다시 읽는다.
// 실시간(사용자 결정 2026-10-11): 재는 중인 패널만 지난 결과를 지우고 1초 폴링의 중간 결과(run.result)로 새로 그린다 — 넣기 선 그림 · 행 수 · 디스크 막대가 자라고
// 질문 · 시험이 하나씩 채워진다. 행 수 같음(✓ · ✕)은 끝난 뒤에만. 끝난 순간부터 보관 결과를 다시 읽을 때까지는 실행 객체의 최종 결과를 그대로 보인다(깜빡임 없음).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { isActive, LIVE_MARK, panelRun, type RunParamsInput, runControls } from '../../lib/runs';
import {
  COMPARE_INGEST_ROWS,
  type ComparePart,
  RUN_DEFAULTS,
  type RunObjectBody,
  type SensorDataStatsBody,
} from '../../lib/shared';
import { cn } from '../../lib/utils';
import { rowsText } from '../controls/control-text';
import { controlKeys, statsQueryOptions } from '../controls/data';
import { PurgeButton } from '../controls/purge-button';
import { EChart } from '../experiments/echart';
import { RunProvider, useRunContext } from '../runs/run-context';
import { RunProgress } from '../runs/run-progress';
import { Footnote, Panel, Screen } from '../shell/screen';
import { UiIcon } from '../ui/icon';
import { STORE, STORE_DOT_CLASS } from '../ui/store';
import { useCompareLatest } from './compare-latest';
import { Glyph } from './glyph';
import { ingestOption } from './ingest-option';
import {
  type AttemptNote,
  type ConsistencyCell,
  type ConsistencyView,
  consistencyView,
  entryTip,
  finalResult,
  INFLIGHT_NOTE,
  INGEST_LIVE_DISK_TIP,
  INGEST_LIVE_DISK_TIP_INFLIGHT,
  type IngestView,
  ingestLiveText,
  ingestSentence,
  ingestView,
  LAB_FOOT,
  LAB_LEAD,
  LAB_TITLE,
  LIVE_NOW,
  liveStepText,
  measuredAtText,
  NOT_YET,
  type PartState,
  PG_COMPRESSING,
  PG_UNCOMPRESSED,
  PLANT_ON_MARK,
  partState,
  QUERY_TERM,
  type QueryView,
  queryAvailable,
  queryView,
  READ_FAILED,
  sizeChoices,
  sizeText,
  statsHead,
  withRun,
} from './lab-model';
import { queryOption } from './query-option';

export function LabScreen() {
  return (
    <RunProvider type="compare">
      <LabBody />
    </RunProvider>
  );
}

function LabBody() {
  const qc = useQueryClient();
  const latest = useCompareLatest();
  const stats = useQuery(statsQueryOptions());
  const { recentEndId, snapshot } = useRunContext();

  // 이 화면에서 지켜보던 실행이 끝났다 — 마지막 결과 · 쌓인 데이터를 다시 읽는다
  useEffect(() => {
    if (recentEndId === null) return;
    void qc.invalidateQueries({ queryKey: ['runs', 'latest', 'compare'] });
    void qc.invalidateQueries({ queryKey: controlKeys.stats });
  }, [recentEndId, qc]);

  const read = latest.data;
  const failed = latest.isError;
  // 지금 실행(1초 폴링)을 그 부분의 패널에만 겹친다 — 나머지 두 패널은 보관 결과 그대로
  const run = panelRun(snapshot, 'compare');
  const ingestKept = partState(read, failed, 'ingest');
  const ingest = withRun(ingestKept, run, 'ingest');
  const query = withRun(partState(read, failed, 'query'), run, 'query');
  const consistency = withRun(partState(read, failed, 'consistency'), run, 'consistency');

  return (
    <Screen
      id="lab"
      title={LAB_TITLE}
      lead={LAB_LEAD}
      aside={
        <>
          <StatsAside stats={stats.data ?? null} failed={stats.isError} />
          <PurgeButton />
        </>
      }
      foot={<Footnote testId="lab-foot">{LAB_FOOT}</Footnote>}
    >
      <RunProgress className="shrink-0" />
      {/* 넣기는 왼쪽 두 줄 높이(그림이 주인공) · 조회 대결(꺾은선 — 넣기 건수와 같은 단계)은 오른쪽 위 · 데이터 정합성(기준 4줄 표)은 오른쪽 아래 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-[var(--gap)] fit:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] fit:grid-rows-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <IngestPanel
          state={ingest}
          lastRate={ingestKept.kind === 'ok' ? ingestKept.result.rowsPerSec : null}
          className="fit:row-span-2"
        />
        <QueryPanel state={query} />
        <ConsistencyPanel state={consistency} />
      </div>
    </Screen>
  );
}

// ── 머리: 지금 쌓인 비교 데이터 ──

function StatsAside({ stats, failed }: { stats: SensorDataStatsBody | null; failed: boolean }) {
  const h = stats ? statsHead(stats) : null;
  return (
    <div
      data-testid="lab-stats"
      title={h?.tip}
      className="flex items-center gap-x-3 text-note whitespace-nowrap text-slate-600"
    >
      <span className="text-slate-500">쌓인 비교 데이터</span>
      {h?.rows ? (
        (['ch', 'pg'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={STORE_DOT_CLASS} style={{ backgroundColor: STORE[k].color }} />
            <span className="font-medium text-slate-800">{STORE[k].short}</span>
            <span className="tabular-nums">{h.rows?.[k]}</span>
          </span>
        ))
      ) : (
        <span>{h ? '아직 없어요' : failed ? '못 읽었어요' : '읽는 중'}</span>
      )}
    </div>
  );
}

// ── 패널 공통: ▶ 버튼 · 선택지 · 상태 ──

function useCompareButton(part: ComparePart) {
  const { snapshot, local, start } = useRunContext();
  const ctl = runControls({
    type: 'compare',
    snapshot,
    starting: local.starting,
    stopRequested: local.stopRequested,
  });
  const run = panelRun(snapshot, 'compare');
  const mine = run !== null && isActive(run.status) && run.params.part === part;
  const anyActive = snapshot?.run ? isActive(snapshot.run.status) : false;
  return { ctl, mine, anyActive, start };
}

function PlayButton({
  part,
  label,
  params,
  starting,
  onStart,
}: {
  part: ComparePart;
  label: string;
  params: RunParamsInput;
  starting: boolean;
  onStart: (part: ComparePart) => void;
}) {
  const { ctl, mine, start } = useCompareButton(part);
  const text = mine ? '재는 중이에요…' : starting ? '시작하는 중이에요…' : label;
  const why = mine ? null : !ctl.start.enabled ? (ctl.start.note ?? '다른 측정이 끝나면 눌러 주세요') : null;
  return (
    <button
      type="button"
      data-testid={`lab-run-${part}`}
      disabled={!ctl.start.enabled}
      title={why ?? undefined}
      onClick={() => {
        onStart(part);
        void start({ part, ...params });
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-0.5 text-note whitespace-nowrap text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <UiIcon name="play" className="size-[0.8em]" />
      {text}
    </button>
  );
}

/** 넣을 건수 고르기 — 9단계(10만 ~ 10억)라 단추 줄 대신 고르기 상자(넣기 칸 머리 한 줄에 들어가게) · 재는 중이면 잠긴다 */
function SizeSelect({
  values,
  value,
  text,
  locked,
  onChange,
}: {
  values: readonly number[];
  value: number;
  text: (v: number) => string;
  locked: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">넣을 건수</span>
      <select
        data-testid="ingest-rows"
        value={value}
        disabled={locked}
        onChange={(e) => onChange(Number(e.target.value))}
        className="text-note rounded-full border border-slate-300 bg-white py-px pr-1 pl-2 font-medium text-slate-800 tabular-nums hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {text(v)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 진행 중 표지 점 — 진행 띠와 같은 하늘색 깜빡임(움직임 줄이기면 멈춘 채) */
function LiveDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-sky-500 motion-safe:animate-pulse"
    />
  );
}

/**
 * 칸 아래 작은 줄 — 잰 시각 · 설비 가동 중 표지 · 그 뒤 멈춘 시도 · 재는 중이면 "지금 재는 중".
 * extra는 같은 줄 뒤에 회색으로(줄을 늘리지 않고 남는 너비에서 잘린다 — 데이터 정합성의 잰 구간 · 걸린 시간)
 */
function MeasuredLine({ state, extra }: { state: PartState<ComparePart>; extra?: string | null }) {
  const tail = extra ? (
    <span data-testid="lab-measured-extra" className="min-w-0 flex-1 truncate text-slate-500" title={extra}>
      · {extra}
    </span>
  ) : null;
  if (state.kind === 'live')
    return (
      <p
        data-testid="lab-live-now"
        className="flex shrink-0 items-center gap-1.5 text-foot font-medium text-slate-700"
      >
        <LiveDot />
        {LIVE_NOW}
        {tail}
      </p>
    );
  if (state.kind === 'done')
    return (
      <p className="flex shrink-0 items-center gap-x-2 text-foot text-slate-500">
        <span title={LIVE_MARK}>{measuredAtText({ endedAt: state.run.endedAt ?? state.run.startedAt })}</span>
        {tail}
      </p>
    );
  if (state.kind !== 'ok') return null;
  return (
    <p className="flex shrink-0 flex-wrap items-center gap-x-2 text-foot text-slate-500">
      <span title={entryTip(state.entry)}>{measuredAtText(state.entry)}</span>
      {state.entry.plantOn ? (
        <span className="rounded border border-amber-300 bg-amber-50 px-1.5 text-amber-800">
          {PLANT_ON_MARK}
        </span>
      ) : null}
      {state.attempt ? <AttemptLine note={state.attempt} /> : null}
      {tail}
    </p>
  );
}

/** 멈춘 시도 한 줄 — 언제 멈췄는지는 툴팁 */
function AttemptLine({ note }: { note: AttemptNote }) {
  return (
    <span
      data-testid="lab-attempt"
      title={`${measuredAtText(note).replace(/에 잼$/, '')}에 ${note.status === 'stopped' ? '중단' : '실패'}`}
      className="text-amber-800"
    >
      {note.text}
    </span>
  );
}

/** 결과가 아직 없거나 못 읽을 때 칸 가운데 한 줄 — 멈춘 시도만 있으면 그 한 줄 */
function Empty({ state }: { state: PartState<ComparePart> }) {
  const tried = state.kind === 'none' ? state.attempt : null;
  const text = state.kind === 'loading' ? '읽는 중이에요…' : state.kind === 'failed' ? READ_FAILED : NOT_YET;
  return (
    <p
      data-testid="lab-empty"
      className={cn(
        'text-body flex min-h-16 flex-1 items-center justify-center',
        state.kind === 'failed' ? 'text-amber-800' : 'text-slate-500',
      )}
    >
      {tried ? <AttemptLine note={tried} /> : text}
    </p>
  );
}

function LabPanel({
  part,
  num,
  title,
  term,
  aside,
  state,
  children,
  className,
  measuredExtra,
}: {
  part: ComparePart;
  num: string;
  title: string;
  term: string;
  aside: ReactNode;
  state: PartState<ComparePart>;
  children: ReactNode;
  className?: string;
  /** 잰 시각 줄 뒤에 붙일 회색 글 */
  measuredExtra?: string | null;
}) {
  return (
    <Panel
      title={
        <span className="inline-flex items-baseline gap-1.5">
          <span className="inline-grid size-[1.3em] place-items-center self-center rounded-md bg-slate-800 text-note text-white">
            {num}
          </span>
          {title}
        </span>
      }
      label={title}
      term={term}
      aside={<div className="flex flex-wrap items-center justify-end gap-2">{aside}</div>}
      className={cn('min-h-64 fit:min-h-0', className)}
      bodyClassName="gap-[calc(var(--gap)*0.5)]"
    >
      <div
        data-testid={`lab-panel-${part}`}
        data-state={state.kind}
        data-attempt={state.kind === 'ok' || state.kind === 'none' ? (state.attempt?.status ?? '') : ''}
        className="flex min-h-0 flex-1 flex-col gap-[calc(var(--gap)*0.5)]"
      >
        {state.kind === 'ok' || state.kind === 'live' || state.kind === 'done' ? (
          children
        ) : (
          <Empty state={state} />
        )}
      </div>
      <MeasuredLine state={state} extra={measuredExtra} />
    </Panel>
  );
}

// ── ① 넣기 ──

function IngestPanel({
  state,
  lastRate,
  className,
}: {
  state: PartState<'ingest'>;
  /** 지난 넣기(보관 결과)의 실측 초당 행 — 걸리는 시간 어림 */
  lastRate: number | null;
  className?: string;
}) {
  const [rows, setRows] = useState<number>(RUN_DEFAULTS.compare.rows);
  const [starting, setStarting] = useState(false);
  const { ctl } = useCompareButton('ingest');
  const { local } = useRunContext();
  useEffect(() => {
    if (!local.starting) setStarting(false);
  }, [local.starting]);
  // 재는 중이면 중간 결과 · 아니면 완료 결과(보관 · 방금 끝남)
  const live = state.kind === 'live' ? state.run : null;
  const shownResult = state.kind === 'live' ? state.result : finalResult(state);
  const view = useMemo(() => (shownResult ? ingestView(shownResult) : null), [shownResult]);
  const choices = useMemo(() => sizeChoices(COMPARE_INGEST_ROWS, lastRate), [lastRate]);
  // 재는 중이면 그 실행의 건수를 보인다(다른 창에서 시작한 실행도 같은 건수로)
  const runRows = state.kind === 'live' ? state.run.params.rows : null;
  const shown = choices.some((c) => c.rows === runRows) ? (runRows as number) : rows;
  const chosen = choices.find((c) => c.rows === shown) ?? choices[0];
  return (
    <LabPanel
      part="ingest"
      num="①"
      title="넣기"
      term="Redis → 두 DB 동시에"
      state={state}
      className={className}
      aside={
        <>
          <SizeSelect
            values={COMPARE_INGEST_ROWS}
            value={shown}
            text={(n) => choices.find((c) => c.rows === n)?.name ?? `${n}`}
            locked={ctl.paramsLocked}
            onChange={setRows}
          />
          {chosen ? (
            <span
              data-testid="ingest-estimate"
              className="text-foot whitespace-nowrap text-slate-500 tabular-nums"
              title="기간 = 카드 라인 30대가 그만큼 보내는 데 걸리는 시간(계산값 · 지난 날짜로 넣어요) · 시간 = 지난 넣기 실측 속도로 어림"
            >
              {chosen.period}
              {chosen.took ? ` · ${chosen.took}` : ''}
            </span>
          ) : null}
          <PlayButton
            part="ingest"
            label="넣기"
            params={{ rows }}
            starting={starting && local.starting}
            onStart={() => setStarting(true)}
          />
        </>
      }
    >
      {live || view ? <IngestBody v={view} live={live} /> : null}
    </LabPanel>
  );
}

const NO_POINTS: IngestView['timeline'] = [];
const NO_DISK: IngestView['disk'] = { ch: null, pg: null, chText: '—', pgText: '—', times: null };

/**
 * 넣기 본문 — 재는 중(live)과 끝난 결과가 같은 틀(머리 줄 → 그림 → 디스크 막대 → 결론 줄)이라 그림(ECharts 인스턴스)이
 * 재는 중 → 방금 끝남 → 보관 결과로 넘어가는 동안 다시 만들어지지 않는다(끝나는 순간 빈 캔버스로 깜빡이지 않는다).
 * 재는 중 — 지난 결과 없이 1초마다 중간값으로 새로 그린다 · 큰 숫자 = 보낸 행 · 옆에 각 DB에 들어간 행 · 경과 · 초당 행.
 *   행 수 같음(✓ · ✕)은 끝나기 전에 내지 않는다(중간에는 두 DB가 서로 다른 게 정상 — 빨강 ✕가 뜨면 고장처럼 보인다).
 *   준비 · 비우는 중(결과 null)이면 빈 축 + 지금 단계 한 줄.
 */
function IngestBody({ v, live }: { v: IngestView | null; live: RunObjectBody | null }) {
  const timeline = v?.timeline ?? NO_POINTS;
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-[calc(var(--gap)*1.5)] gap-y-1">
        {live ? <LiveHead v={v} /> : v ? <DoneHead v={v} /> : null}
      </div>
      {/* 그림(묶음 하나 넣는 시간)이 남는 높이를 다 갖고 디스크 막대는 그 아래 한 덩어리 — 넣기 칸이 두 줄 높이라 위아래로 쌓는다 */}
      <IngestChart
        timeline={timeline}
        p50={{ ch: v?.batch.ch.p50 ?? '—', pg: v?.batch.pg.p50 ?? '—' }}
        overlay={live && timeline.length === 0 ? liveStepText(live) : null}
        inflight={v?.inflight ?? false}
      />
      <DiskBars disk={v?.disk ?? NO_DISK} live={live !== null} inflight={v?.inflight ?? false} />
      {live ? (
        <p data-testid="ingest-live-status" className="shrink-0 text-body font-semibold text-slate-700">
          {ingestLiveText(live)}
        </p>
      ) : v ? (
        <p
          data-testid="ingest-sentence"
          className="shrink-0 text-body font-semibold text-slate-900"
          title={[
            `묶음 ${v.batch.count.toLocaleString('ko-KR')}개 · 느린 쪽(95%) CH ${v.batch.ch.p95} · PG ${v.batch.pg.p95}ms · PostgreSQL 넣기 실패 ${v.batch.failures}개`,
            v.inflight ? INFLIGHT_NOTE : null,
          ]
            .filter(Boolean)
            .join('\n')}
        >
          {ingestSentence(v)}
        </p>
      ) : null}
    </>
  );
}

/** 끝난 결과 머리 — ✓ · ✕ 행 수 CH = PG + 행 수 · 구간 · 걸린 시간 · 초당 행 */
function DoneHead({ v }: { v: IngestView }) {
  return (
    <>
      <span
        data-testid="ingest-same"
        data-same={v.same}
        title={v.rowsExact}
        className="inline-flex items-baseline gap-1.5"
      >
        <span className="self-center text-head">
          <Glyph name={v.same ? 'check' : 'cross'} className={v.same ? 'text-emerald-700' : 'text-red-700'} />
        </span>
        <span className="text-note text-slate-600">행 수 CH {v.same ? '=' : '≠'} PG</span>
        <b className="text-big font-bold text-slate-900">{v.rows}</b>
      </span>
      <span className="text-body text-slate-700">
        {v.span} · <b className="font-semibold text-slate-900">{v.took}</b> · 초당 {v.perSec}
      </span>
    </>
  );
}

/** 재는 중 머리 — 보낸 행(큰 숫자) · CH n · PG n 들어감 · 경과 · 초당 행(발행 전이면 "—"만) */
function LiveHead({ v }: { v: IngestView | null }) {
  return (
    <>
      <span
        data-testid="ingest-live-sent"
        title={v?.rowsExact}
        className="inline-flex items-baseline gap-1.5"
      >
        <span className="text-note text-slate-600">보낸 행</span>
        <b className="text-big font-bold text-slate-900 tabular-nums">{v ? v.sent : '—'}</b>
      </span>
      {v ? (
        <span
          data-testid="ingest-live-rows"
          className="inline-flex flex-wrap items-center gap-x-1.5 text-body text-slate-700 tabular-nums"
        >
          {(['ch', 'pg'] as const).map((k, i) => (
            <span key={k} className="inline-flex items-center gap-1 whitespace-nowrap">
              {i > 0 ? <span className="text-slate-400">·</span> : null}
              <span aria-hidden className={STORE_DOT_CLASS} style={{ backgroundColor: STORE[k].color }} />
              {STORE[k].short} {k === 'ch' ? v.inCh : v.inPg}
            </span>
          ))}
          <span className="whitespace-nowrap">
            들어감 · <b className="font-semibold text-slate-900">{v.took}</b> · 초당 {v.perSec}
          </span>
        </span>
      ) : null}
    </>
  );
}

/** 묶음 하나 넣는 시간 그림 — 넣는 중에는 점이 늘 때마다 다시 짓는다(애니메이션 없음 · 같은 캔버스에 곧바로 그려 깜빡이지 않는다) */
function IngestChart({
  timeline,
  p50,
  overlay = null,
  inflight = false,
}: {
  timeline: IngestView['timeline'];
  p50: { ch: string; pg: string };
  /** 점이 없을 때 빈 축 가운데 한 줄 — 지금 단계 */
  overlay?: string | null;
  /** 넣는 도중 PostgreSQL 압축(7일치를 넘는 넣기) — 묶음 시간에 압축 부하가 섞인다는 표지 */
  inflight?: boolean;
}) {
  const option = useMemo(
    () => (env: Parameters<typeof ingestOption>[1]) => ingestOption({ timeline }, env),
    [timeline],
  );
  return (
    <figure
      data-testid="ingest-chart"
      data-points={timeline.length}
      className="flex min-h-36 min-w-0 flex-1 flex-col fit:min-h-0"
    >
      <figcaption className="flex shrink-0 flex-wrap items-center gap-x-3 text-foot text-slate-600">
        <span>묶음 하나 넣는 시간(ms)</span>
        {(['ch', 'pg'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1 whitespace-nowrap">
            <span
              aria-hidden
              className="inline-block h-0.5 w-3 rounded"
              style={{ backgroundColor: STORE[k].color }}
            />
            {STORE[k].short} 보통 {p50[k]}
          </span>
        ))}
        {inflight ? (
          <span
            data-testid="ingest-inflight"
            title={INFLIGHT_NOTE}
            className="whitespace-nowrap text-amber-800"
          >
            PG는 압축하며 넣음
          </span>
        ) : null}
      </figcaption>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <EChart
          option={option}
          label={`묶음 하나 넣는 시간 — ClickHouse 보통 ${p50.ch}ms · PostgreSQL 보통 ${p50.pg}ms`}
          className="min-h-0 w-full flex-1 text-foot"
        />
        {overlay ? (
          <p
            data-testid="ingest-chart-step"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-body text-slate-600"
          >
            <LiveDot />
            {overlay}
          </p>
        ) : null}
      </div>
    </figure>
  );
}

/**
 * 디스크 막대 2 + 배수 — 막대 · 크기 글자 · 배수가 늘 같은 값(넣는 중에는 2초마다 다시 읽는 지금 크기 · 끝나면 최종 크기)에서 나온다.
 * 넣는 중에도 배수를 막대 옆에 함께 바꿔 보인다(사용자 지적 2026-10-12 — 배수가 막대를 따라가지 않아 계산이 안 맞아 보였다).
 */
function DiskBars({
  disk,
  live = false,
  inflight = false,
}: {
  disk: IngestView['disk'];
  live?: boolean;
  inflight?: boolean;
}) {
  const max = Math.max(disk.ch ?? 0, disk.pg ?? 0);
  return (
    <figure
      data-testid="ingest-disk"
      data-live={live}
      title={live ? (inflight ? INGEST_LIVE_DISK_TIP_INFLIGHT : INGEST_LIVE_DISK_TIP) : undefined}
      className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[var(--gap)] gap-y-1 border-t border-slate-100 pt-[calc(var(--gap)*0.5)]"
    >
      <figcaption className="col-span-2 text-foot text-slate-600">
        {live ? '디스크 크기(넣는 중)' : '디스크 크기(같은 행 수)'}
      </figcaption>
      <div className="flex min-w-0 flex-col gap-1">
        {(['ch', 'pg'] as const).map((k) => {
          const val = disk[k];
          return (
            <div key={k} className="grid grid-cols-[2.2em_minmax(0,1fr)] items-center gap-2 text-note">
              <span className="font-medium text-slate-700">{STORE[k].short}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  data-testid={`ingest-disk-${k}`}
                  className="block h-[clamp(10px,calc(10px+8*var(--fs)),18px)] min-w-[3px] shrink-0 rounded-r motion-safe:transition-[width] motion-safe:duration-500"
                  style={{
                    // 막대 뒤 글자 자리 — 넣는 중에는 PG 크기 옆 표지("압축하며 넣는 중")까지 들어가야 오른쪽 배수와 겹치지 않는다
                    width: `calc(${max > 0 && val !== null ? val / max : 0} * (100% - ${live ? 13 : 5}em))`,
                    backgroundColor: STORE[k].color,
                  }}
                />
                <span className="whitespace-nowrap text-slate-800 tabular-nums">
                  {k === 'ch' ? disk.chText : disk.pgText}
                  {live && k === 'pg' ? (
                    <span data-testid="ingest-disk-uncompressed" className="ml-1 text-foot text-slate-500">
                      ({inflight ? PG_COMPRESSING : PG_UNCOMPRESSED})
                    </span>
                  ) : null}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {disk.times ? (
        <p data-testid="ingest-disk-times" className="flex flex-col items-end text-note text-slate-700">
          <b className="text-big font-bold text-slate-900 tabular-nums">{disk.times}</b>
          {live ? '지금 차이' : '차이'}
        </p>
      ) : null}
    </figure>
  );
}

// ── ② 조회 대결 ──

function QueryPanel({ state }: { state: PartState<'query'> }) {
  const [starting, setStarting] = useState(false);
  const { local } = useRunContext();
  useEffect(() => {
    if (!local.starting) setStarting(false);
  }, [local.starting]);
  // 재는 중이면 단계 칸을 늘 다 그린다 — 끝난 단계 · 재는 중 · 기다리는 중(단계가 끝날 때마다 점이 하나씩 는다)
  const view = useMemo(() => {
    if (state.kind === 'live') return queryView(state.result, state.run.steps);
    const r = finalResult(state);
    return r ? queryView(r, null) : null;
  }, [state]);
  const available =
    state.kind === 'live'
      ? queryAvailable(state.result, state.run.steps)
      : (finalResult(state)?.rows ?? null);
  return (
    <LabPanel
      part="query"
      num="②"
      title="조회 대결"
      term={QUERY_TERM}
      state={state}
      aside={
        <>
          {available !== null ? (
            <span
              className="text-foot whitespace-nowrap text-slate-500"
              title={`넣은 구간의 원천 ${available.toLocaleString('ko-KR')}행 — 이보다 큰 단계는 재지 않아요`}
            >
              넣은 데이터 {rowsText(available)}
            </span>
          ) : null}
          <PlayButton
            part="query"
            label="조회"
            params={{}}
            starting={starting && local.starting}
            onStart={() => setStarting(true)}
          />
        </>
      }
    >
      {view ? <QueryBody view={view} live={state.kind === 'live' ? state.run : null} /> : null}
    </LabPanel>
  );
}

/**
 * 조회 대결 본문 — 꺾은선이 기본이고 점에 마우스를 올리면 그 단계의 두 시간 · 몇 배 빠른지(사용자 지시 2026-10-12).
 * 데이터 비교(원천 행 수 · 칸 대조) 줄은 두지 않는다 — ③ 데이터 정합성 몫. 재는 중 · 방금 끝남 · 보관 결과가 같은 틀(그림 → 못 잰 단계 줄)이라
 * 그림(ECharts 인스턴스)이 끝나는 순간 다시 만들어지지 않는다. 첫 단계 전(점 0)이면 빈 축 + 지금 단계 한 줄.
 */
function QueryBody({ view, live }: { view: QueryView; live: RunObjectBody | null }) {
  const option = useMemo(() => (env: Parameters<typeof queryOption>[1]) => queryOption(view, env), [view]);
  const label = view.points
    .filter((p) => p.phase === 'done')
    .map(
      (p) =>
        `${sizeText(p.target)} ClickHouse ${p.chText ?? '—'} · PostgreSQL ${p.pgText ?? '—'} · ${p.mark}`,
    )
    .join(', ');
  return (
    <>
      <figure
        data-testid="query-chart"
        data-points={view.measured}
        data-phases={view.points.map((p) => p.phase).join(',')}
        data-winners={view.points.map((p) => p.faster ?? '').join(',')}
        className="flex min-h-36 min-w-0 flex-1 flex-col fit:min-h-0"
      >
        <figcaption className="flex shrink-0 flex-wrap items-center gap-x-3 text-foot text-slate-600">
          <span>걸린 시간(ms · 10배마다 한 칸) · 점을 가리키면 두 시간 · 차이</span>
          {(['ch', 'pg'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded"
                style={{ backgroundColor: STORE[k].color }}
              />
              {STORE[k].short}
            </span>
          ))}
          {view.running ? (
            <span data-testid="query-running">
              <PhaseChip phase="running" text={`${view.running} 행 재는 중…`} />
            </span>
          ) : null}
        </figcaption>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <EChart
            option={option}
            label={`원천 행 수별 집계 시간 — ${label || '아직 잰 단계가 없어요'}`}
            className="min-h-0 w-full flex-1 text-foot"
          />
          {live && view.measured === 0 && !view.running ? (
            <p
              data-testid="query-chart-step"
              className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-body text-slate-600"
            >
              <LiveDot />
              {liveStepText(live)}
            </p>
          ) : null}
        </div>
      </figure>
      {view.skipped ? (
        <p
          data-testid="query-skipped"
          className="shrink-0 truncate text-foot text-slate-500"
          title={view.skipped}
        >
          {view.skipped}
        </p>
      ) : null}
    </>
  );
}

/** 진행 중 줄의 가운데 표지 — 지금 하는 줄(하늘색 점 · 진한 글자) · 아직 안 한 줄(회색) */
function PhaseChip({ phase, text }: { phase: 'running' | 'waiting'; text: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded bg-white px-2 text-note whitespace-nowrap',
        phase === 'running' ? 'font-medium text-slate-800' : 'text-slate-500',
      )}
    >
      {phase === 'running' ? <LiveDot /> : null}
      {text}
    </span>
  );
}

// ── ③ 데이터 정합성 ──

/**
 * 표 한 장 — 기준 · PostgreSQL · ClickHouse · 판정(사용자 지시 2026-10-13 — 처음 보는 사람도 한 눈에).
 * 열은 표 전체가 나눠 쓴다(subgrid) — 네 칸 모두 보이는 글자 너비 이상(잘리지 않는다) · 남는 너비는 기준 칸이 받는다.
 * 줄은 패널 높이를 넷으로 나눠 채우고, 높이가 넉넉하면(세로 800px 이상) 기준 이름 아래 "무엇을 견주나" 한 줄을 더 보인다.
 * 값 글자는 표가 좁으면(42rem 미만 — 1440 화면에서 메뉴를 펼친 때 등) 한 단계 작게 — 23자리 값 합계 두 칸과 기준 이름 · 용어가 한 줄에 들어간다.
 * 글을 말줄임으로 자르지 않는다(맞춤 보기 — 목록 밖 잘린 상자 0) — 표가 34rem보다 좁으면(1280 화면에서 메뉴를 펼친 때) 용어 · 설명 줄을 숨기고 줄 툴팁에만 둔다.
 */
const C_GRID =
  'grid grid-cols-[minmax(max-content,1fr)_max-content_max-content_max-content] content-start gap-x-[clamp(12px,calc(12px+16*var(--fs)),28px)] fit:grid-rows-[auto_repeat(4,minmax(0,1fr))] fit:content-stretch';
const C_LINE = 'col-span-4 grid grid-cols-subgrid items-center';

function ConsistencyPanel({ state }: { state: PartState<'consistency'> }) {
  const [starting, setStarting] = useState(false);
  const { local } = useRunContext();
  useEffect(() => {
    if (!local.starting) setStarting(false);
  }, [local.starting]);
  // 재는 중이면 결과가 아직 없어도(구간 확인 중) 표를 다 그린다 — 다 잰 저장소 칸부터 값이 들어온다
  const view = useMemo(() => {
    if (state.kind === 'live') return consistencyView(state.result, state.run.steps);
    const r = finalResult(state);
    return r ? consistencyView(r, null) : null;
  }, [state]);
  return (
    <LabPanel
      part="consistency"
      num="③"
      title="데이터 정합성"
      term="두 DB에 같은 데이터가 있나"
      state={state}
      measuredExtra={view?.foot || null}
      aside={
        <PlayButton
          part="consistency"
          label="대조"
          params={{}}
          starting={starting && local.starting}
          onStart={() => setStarting(true)}
        />
      }
    >
      {view ? <ConsistencyBody view={view} live={state.kind === 'live' ? state.run : null} /> : null}
    </LabPanel>
  );
}

function ConsistencyBody({ view, live }: { view: ConsistencyView; live: RunObjectBody | null }) {
  return (
    <div
      data-testid="consistency"
      data-match={view.match === null ? '' : String(view.match)}
      className="flex min-h-0 flex-1 flex-col gap-0.5"
    >
      <p
        data-testid="consistency-headline"
        className={cn(
          'text-body flex shrink-0 items-center gap-1.5 font-semibold',
          view.match === null ? 'text-slate-700' : view.match ? 'text-emerald-800' : 'text-red-700',
        )}
      >
        {view.headline === null ? (
          <>
            <LiveDot />
            {live ? liveStepText(live) : '재는 중이에요'}
          </>
        ) : (
          <>
            <Glyph
              name={view.match ? 'check' : 'cross'}
              className={view.match ? 'text-emerald-700' : 'text-red-600'}
            />
            <span className="truncate">{view.headline}</span>
          </>
        )}
      </p>
      <div data-testid="consistency-grid" className={cn(C_GRID, '@container min-h-0 flex-1')}>
        <div className={cn(C_LINE, 'pb-0.5 text-foot font-semibold text-slate-600')}>
          <span className="font-normal text-slate-500">기준</span>
          {(['pg', 'ch'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className={STORE_DOT_CLASS} style={{ backgroundColor: STORE[k].color }} />
              {STORE[k].label}
            </span>
          ))}
          <span className="font-normal text-slate-500">판정</span>
        </div>
        {view.rows.map((row) => (
          <div
            key={row.key}
            data-testid="consistency-row"
            data-key={row.key}
            data-same={row.same === null ? '' : String(row.same)}
            title={row.tip}
            className={cn(
              C_LINE,
              'rounded-md border-t border-slate-100',
              row.same === false && 'border-red-100 bg-red-50/70',
            )}
          >
            <span className="flex min-w-0 flex-col justify-center pl-1">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <b className="text-body whitespace-nowrap font-semibold text-slate-900">{row.name}</b>
                <span className="hidden whitespace-nowrap text-foot text-slate-500 @[34rem]:inline">
                  ({row.term})
                </span>
              </span>
              <span className="hidden whitespace-nowrap text-foot text-slate-500 @[34rem]:[@media(min-height:50rem)]:block">
                {row.what}
              </span>
            </span>
            <ConsistencyValue cell={row.pg} testId="consistency-pg" />
            <ConsistencyValue cell={row.ch} testId="consistency-ch" />
            <span data-testid="consistency-verdict" title={row.detail ?? undefined}>
              {row.same === null ? (
                <span className="text-note text-slate-400">—</span>
              ) : (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-note font-semibold whitespace-nowrap',
                    row.same ? 'bg-emerald-50 text-emerald-800' : 'bg-red-100 text-red-800',
                  )}
                >
                  <Glyph
                    name={row.same ? 'check' : 'cross'}
                    className={row.same ? 'text-emerald-700' : 'text-red-700'}
                  />
                  {row.verdict}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {view.where ? (
        <p data-testid="consistency-where" className="shrink-0 text-foot text-red-700" title={view.where}>
          {view.where}
        </p>
      ) : null}
    </div>
  );
}

/** 저장소 칸 — 값(숫자가 잘리지 않게 한 줄) · 지금 재는 중(하늘색 점) · 기다리는 중(회색) */
function ConsistencyValue({ cell, testId }: { cell: ConsistencyCell; testId: string }) {
  return (
    <span data-testid={testId} data-phase={cell.phase} title={cell.tip ?? undefined}>
      {cell.phase === 'done' ? (
        <span className="text-note font-semibold whitespace-nowrap text-slate-900 tabular-nums @[42rem]:text-body">
          {cell.text}
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-note whitespace-nowrap',
            cell.phase === 'running' ? 'font-medium text-slate-700' : 'text-slate-400',
          )}
        >
          {cell.phase === 'running' ? <LiveDot /> : null}
          {cell.text}
        </span>
      )}
    </span>
  );
}
