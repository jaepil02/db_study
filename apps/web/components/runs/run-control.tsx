'use client';
// 실행 조작부 머리 — "지난번 …" 작은 글자 · "{재생 아이콘} {buttonLabel}" 버튼 · 상태 칩 (셸 머리 동작 자리에 놓는다) → 매개변수 팝오버(쉬운 설명 · 매개변수 · 시작 · 큰 규모 경고 · 다른 실행 링크 · 역할 안내 · 아직 안 재 봄)
// "지난번" 글자는 진행 띠가 종결 실행을 그리지 않을 때만(종결 뒤 30초가 지났거나 이미 끝난 실행을 열었을 때 — .omc/plans/web-ux-polish.md §2.1) · 상세는 툴팁.
// 중단 · 요청 사건 띠(409 · 404 · 요청 실패 · 폴링 실패)는 진행 띠(RunProgress)가 갖는다 — 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙 §배치.
// 상태 · 폴링 · 경과 · 409 · 404 · 권한은 RunProvider(useRunPanel) · 버튼 상태 규칙은 lib/runs.ts(runControls)를 그대로 쓴다.
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import {
  headerLastRun,
  lastRunText,
  lastRunTip,
  NO_RUN_TEXT,
  type PanelLocal,
  panelRun,
  type RunSnapshot,
  runControls,
  STATUS_LABEL,
  type StartOutcome,
} from '../../lib/runs';
import type { RunType } from '../../lib/shared';
import { cn } from '../../lib/utils';
import { UiIcon } from '../ui/icon';
import { useRunContext } from './run-context';
import { buildRunParams, defaultParams, paramWarnings, type RunParamDef } from './run-spec';

/** 주 버튼(머리 · 팝오버 시작) — 같은 모양 하나 */
const PRIMARY =
  'inline-flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

/** 칩은 진행 중(실행 중 · 멈추는 중)에만 그린다 — 종결 색은 진행 띠의 종결 띠가 갖는다 */
const CHIP: Record<'running' | 'stopping', string> = {
  running: 'bg-sky-100 text-sky-800',
  stopping: 'bg-amber-100 text-amber-800',
};

export interface RunControlProps {
  /** 매개변수 정의 — run-spec.ts의 PERF_PARAM_DEFS · FLOW_PARAM_DEFS */
  params: readonly RunParamDef[];
  /** 머리 버튼 글자(재생 아이콘은 조각이 붙인다) — 화면마다 쉬운 말("내 컴퓨터에서 직접 재 보기") */
  buttonLabel: string;
  /** 팝오버 맨 위 쉬운 설명 한 줄 — 무엇을 하고 결과가 어디에 나오는지 */
  intro?: string;
  /** S7 ② 뒤 ENGINEER · ADMIN — 인증 도입 전에는 무인증이라 true */
  canControl?: boolean;
  className?: string;
}

export function RunControl({ params, buttonLabel, intro, canControl = true, className }: RunControlProps) {
  const { type, snapshot, pollFailed, local, start, recentEndId } = useRunContext();
  const [chosen, setChosen] = useState<Record<string, number>>(() => defaultParams(params));
  return (
    <RunControlView
      type={type}
      params={params}
      buttonLabel={buttonLabel}
      intro={intro}
      snapshot={snapshot}
      pollFailed={pollFailed}
      local={local}
      recentEndId={recentEndId}
      canControl={canControl}
      chosen={chosen}
      onChoose={(k, v) => setChosen((p) => ({ ...p, [k]: v }))}
      onStart={() => start(buildRunParams(params, chosen))}
      className={className}
    />
  );
}

export interface RunControlViewProps extends RunControlProps {
  type: RunType;
  snapshot: RunSnapshot | undefined;
  pollFailed: boolean;
  local: PanelLocal;
  /** 이 화면에서 방금 끝난 실행(진행 띠가 결말을 그리는 중) — 그 실행이면 "지난번" 글자를 쓰지 않는다 */
  recentEndId?: string | null;
  chosen: Record<string, number>;
  onChoose: (key: string, v: number) => void;
  /** 시작 요청 — 결과가 started(202)일 때만 팝오버를 닫는다 · 409 · 400 · 요청 실패면 열어 둔다(문구가 팝오버 · 띠에 보인다) */
  onStart: () => Promise<StartOutcome> | undefined;
  /** 정적 렌더 시험용 — 팝오버를 처음부터 연다(current를 받기 전이면 그래도 열지 않는다) */
  defaultOpen?: boolean;
}

/** 시작 응답 뒤 팝오버를 닫는가 — 202(started)만. 409는 다른 실행 링크 · 400은 매개변수 옆 문구를 팝오버에서 보여야 한다 */
export const closesPopover = (o: StartOutcome): boolean => o.kind === 'started';

/** 상태 칩 — current 전이면 자리만 · 이 화면 종류의 실행이 없으면 칩 없음(팝오버 안에 "실행 없음") */
export function RunChip({ snapshot, type }: { snapshot: RunSnapshot | undefined; type: RunType }) {
  if (snapshot === undefined)
    return (
      <span
        data-testid="run-status-pending"
        aria-hidden="true"
        className="inline-block h-5 w-14 rounded bg-slate-100 motion-safe:animate-pulse"
      />
    );
  const run = panelRun(snapshot, type);
  // 종결 뒤에는 칩을 숨긴다 — 진행 띠의 "지난번 … 완료 — 걸린 시간"이 같은 말을 한다(리드 판정 2026-10-03)
  if (run?.status !== 'running' && run?.status !== 'stopping') return null;
  return (
    <span
      data-testid="run-status"
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium', CHIP[run.status])}
    >
      <span
        className="inline-block h-2 w-2 rounded-full bg-current motion-safe:animate-pulse"
        aria-hidden="true"
      />
      {STATUS_LABEL[run.status]}
    </span>
  );
}

/** 그리기만 — 상태는 모두 props(단위 테스트가 정적 렌더로 본다) */
export function RunControlView(p: RunControlViewProps) {
  const { type, snapshot, local } = p;
  const ctl = runControls({
    type,
    snapshot,
    starting: local.starting,
    stopRequested: local.stopRequested,
    canControl: p.canControl ?? true,
  });
  const ready = snapshot !== undefined;
  const run = panelRun(snapshot, type);
  const last = headerLastRun(run, p.recentEndId ?? null);
  const shown = ctl.lockedParams ?? p.chosen;
  const warnings = paramWarnings(p.params, shown);
  const [openState, setOpen] = useState(p.defaultOpen ?? false);
  // current를 받기 전에는 팝오버를 열지 않는다 — 진행 중 실행을 모른 채 매개변수를 고르게 두지 않는다(§버튼 상태)
  const open = openState && ready;
  const root = useRef<HTMLDivElement>(null);
  const lastTipId = useId();

  // 바깥 클릭 · Esc로 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      data-testid={`run-control-${type}`}
      className={cn('relative flex items-center gap-2 text-xs', p.pollFailed && 'opacity-70', p.className)}
    >
      {/* 상세는 마우스 툴팁(title) · 키보드는 탭으로 닿고(tabIndex 0) 낭독기는 sr-only 상세를 설명으로 읽는다(R12) */}
      {last ? (
        <>
          <span
            data-testid="run-last"
            title={lastRunTip(last)}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: 툴팁 상세(지난 실행 결말 · 시각 · 단계)를 키보드로 닿게 하는 자리 — 누르는 동작은 없다
            tabIndex={0}
            aria-describedby={lastTipId}
            className={cn(
              'max-w-[18rem] cursor-help truncate rounded-sm text-xs tabular-nums',
              last.status === 'failed' ? 'text-red-700' : 'text-slate-500',
            )}
          >
            {lastRunText(last)}
          </span>
          <span id={lastTipId} className="sr-only">
            {lastRunTip(last).split('\n').join(' · ')}
          </span>
        </>
      ) : null}
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={!ready}
        title={ready ? undefined : '실행 상태를 읽는 중이에요'}
        onClick={() => setOpen((v) => !v)}
        className={PRIMARY}
      >
        <UiIcon name="play" className="size-3" />
        {p.buttonLabel}
      </button>
      <RunChip snapshot={snapshot} type={type} />

      {open ? (
        <div
          role="dialog"
          aria-label="측정 매개변수"
          className="absolute top-full right-0 z-30 mt-2 flex w-max max-w-[min(30rem,90vw)] flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
        >
          {p.intro ? <p className="max-w-[26rem] text-sm text-slate-700">{p.intro}</p> : null}
          {p.params.map((d) => (
            <ParamGroup
              key={d.key}
              def={d}
              value={shown[d.key] ?? d.defaultValue}
              locked={ctl.paramsLocked}
              onChange={(v) => p.onChoose(d.key, v)}
            />
          ))}
          {local.paramError ? <p className="text-red-600">{local.paramError}</p> : null}
          {warnings.length > 0 && !ctl.lockedParams
            ? warnings.map((w) => (
                <p
                  key={w}
                  data-testid="run-large-warning"
                  className="flex items-start gap-1.5 rounded bg-amber-50 px-2 py-1 text-amber-800"
                >
                  <UiIcon name="warn" className="mt-px size-3.5 shrink-0" />
                  {w}
                </p>
              ))
            : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // 응답 전에는 열어 둔다 — "시작 요청 중…"과 400 문구가 팝오버 안에 보인다
                void p.onStart()?.then((o) => {
                  if (closesPopover(o)) setOpen(false);
                });
              }}
              disabled={!ctl.start.enabled}
              className={PRIMARY}
            >
              <UiIcon name="play" className="size-3" />
              {ctl.start.label}
            </button>
            {ctl.start.other ? (
              <Link href={ctl.start.other.href} className="text-sky-700 underline">
                {ctl.start.note}
              </Link>
            ) : ctl.start.note ? (
              <span className="text-slate-600">{ctl.start.note}</span>
            ) : null}
          </div>
          {run ? null : (
            <p data-testid="run-none" className="text-slate-500">
              {NO_RUN_TEXT[type]}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ParamGroup({
  def,
  value,
  locked,
  onChange,
}: {
  def: RunParamDef;
  value: number;
  locked: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1" disabled={locked}>
      <legend className="sr-only">{def.label}</legend>
      <span className="mr-1 text-slate-500">{def.label}</span>
      {def.values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          title={v === def.defaultValue ? '기본값' : undefined}
          className={cn(
            'rounded border px-2 py-0.5 tabular-nums disabled:cursor-not-allowed disabled:opacity-60',
            v === value
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          {def.text(v)}
          {def.warn?.(v) ? <UiIcon name="warn" className="ml-1 inline size-3 align-[-1px]" /> : null}
        </button>
      ))}
    </fieldset>
  );
}
