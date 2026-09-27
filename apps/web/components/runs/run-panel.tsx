'use client';
// 실행 패널(EXP-PERF GEN-11 · EXP-FLOW GEN-12) — 매개변수 · 시작 · 중단 · 상태 칩 · 시작 시각 · 경과 시간 · 단계 목록 · 종결 띠 · 결과
// 정본 docs/08_screen/08_evidence_screens.md 두 화면 §요소 실행 패널 행 · §실행 패널 — 두 화면 공통 규칙
// 종류별로 다른 것(매개변수 · 진행 막대 · 결과 표)만 갈라 그리고 버튼 · 칩 · 띠 · 경과 규칙은 lib/runs.ts 하나를 따른다.
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import {
  type BandTone,
  formatRunClock,
  LIVE_MARK,
  largeRunWarning,
  NO_RUN_TEXT,
  type PanelLocal,
  POLL_FAILED_TEXT,
  panelRun,
  type RunSnapshot,
  runBand,
  runControls,
  runElapsedText,
  STATUS_LABEL,
  STEP_ICON,
  stepDetailText,
  stepElapsedText,
} from '../../lib/runs';
import {
  FLOW_BIZ_PER_SEC,
  FLOW_DURATION_SEC,
  FLOW_PPS,
  PERF_MAX_EXPONENTS,
  RUN_DEFAULTS,
  type RunObjectBody,
  type RunStatus,
  type RunType,
} from '../../lib/shared';
import { cn } from '../../lib/utils';
import { useRunPanel } from './use-run';

const CHIP: Record<RunStatus, string> = {
  running: 'bg-sky-100 text-sky-800',
  stopping: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  stopped: 'bg-slate-200 text-slate-700',
  failed: 'bg-red-100 text-red-700',
};

const BAND: Record<BandTone, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-slate-50 text-slate-600 border-slate-200',
};

type Params = Record<string, number>;

interface ParamSpec {
  key: string;
  label: string;
  values: readonly number[];
  text: (v: number) => string;
}

const PARAM_SPECS: Record<RunType, ParamSpec[]> = {
  perf: [{ key: 'maxExponent', label: '최대 규모', values: PERF_MAX_EXPONENTS, text: (v) => `10^${v}` }],
  flow: [
    { key: 'pps', label: 'pps', values: FLOW_PPS, text: (v) => v.toLocaleString('ko-KR') },
    { key: 'durationSec', label: '시간', values: FLOW_DURATION_SEC, text: (v) => `${v}초` },
    { key: 'bizPerSec', label: '업무', values: FLOW_BIZ_PER_SEC, text: (v) => `${v}/초` },
  ],
};

function ParamGroup({
  spec,
  value,
  locked,
  onChange,
}: {
  spec: ParamSpec;
  value: number;
  locked: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="flex items-center gap-1" disabled={locked}>
      <legend className="sr-only">{spec.label}</legend>
      <span className="text-slate-500">{spec.label}</span>
      {spec.values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={cn(
            'rounded border px-2 py-0.5 tabular-nums disabled:cursor-not-allowed disabled:opacity-60',
            v === value
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          {spec.text(v)}
        </button>
      ))}
    </fieldset>
  );
}

export interface RunPanelProps {
  type: RunType;
  /** S7 ② 뒤 ENGINEER · ADMIN — 인증 도입 전에는 무인증이라 true */
  canControl?: boolean;
  /** 진행 막대 등 종류별 진행 표시(EXP-FLOW) */
  progress?: (run: RunObjectBody, receivedAt: number, now: number) => ReactNode;
  /** 결과 표(단계 목록 아래 · 접기 가능) */
  result?: (run: RunObjectBody) => ReactNode;
}

export function RunPanel({ type, canControl = true, progress, result }: RunPanelProps) {
  const { snapshot, pollFailed, local, start, stop, now } = useRunPanel(type);
  const [chosen, setChosen] = useState<Params>({ ...RUN_DEFAULTS[type] });
  return (
    <RunPanelView
      type={type}
      snapshot={snapshot}
      pollFailed={pollFailed}
      local={local}
      now={now}
      canControl={canControl}
      chosen={chosen}
      onChoose={(k, v) => setChosen((p) => ({ ...p, [k]: v }))}
      onStart={() => void start(chosen)}
      onStop={() => void stop()}
      progress={progress}
      result={result}
    />
  );
}

export interface RunPanelViewProps extends RunPanelProps {
  snapshot: RunSnapshot | undefined;
  pollFailed: boolean;
  local: PanelLocal;
  now: number;
  chosen: Params;
  onChoose: (key: string, v: number) => void;
  onStart: () => void;
  onStop: () => void;
}

/** 그리기만 — 상태는 모두 props(단위 테스트가 정적 렌더로 본다) */
export function RunPanelView(p: RunPanelViewProps) {
  const { type, snapshot, local, now } = p;
  const ctl = runControls({
    type,
    snapshot,
    starting: local.starting,
    stopRequested: local.stopRequested,
    canControl: p.canControl ?? true,
  });
  const ready = snapshot !== undefined;
  const run = panelRun(snapshot, type);
  const receivedAt = snapshot?.receivedAt ?? 0;
  const shown: Params = ctl.lockedParams ?? p.chosen;
  const band = run ? runBand(run) : null;
  const warning = type === 'perf' ? largeRunWarning(shown.maxExponent ?? 0) : null;

  return (
    <section
      data-testid={`run-panel-${type}`}
      aria-label="실행 패널"
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs',
        p.pollFailed && 'opacity-70',
      )}
    >
      {/* 한 줄 — 매개변수 · 시작 · 중단 · 상태 칩 · 시작 시각 · 경과 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold text-slate-700">실행 패널</span>
        {PARAM_SPECS[type].map((s) => (
          <ParamGroup
            key={s.key}
            spec={s}
            value={shown[s.key] ?? 0}
            locked={ctl.paramsLocked}
            onChange={(v) => p.onChoose(s.key, v)}
          />
        ))}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={p.onStart}
            disabled={!ctl.start.enabled}
            className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <span aria-hidden="true">▶ </span>
            {ctl.start.label}
          </button>
          <button
            type="button"
            onClick={p.onStop}
            disabled={!ctl.stop.enabled}
            className="rounded border border-red-300 bg-white px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <span aria-hidden="true">■ </span>
            {ctl.stop.label}
          </button>
        </div>
        {ready ? (
          <span
            data-testid="run-status"
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium',
              run ? CHIP[run.status] : 'bg-slate-100 text-slate-500',
            )}
          >
            {run && (run.status === 'running' || run.status === 'stopping') ? (
              <span
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"
                aria-hidden="true"
              />
            ) : null}
            {run ? STATUS_LABEL[run.status] : '실행 없음'}
          </span>
        ) : (
          <span
            data-testid="run-status"
            className="inline-block h-5 w-16 animate-pulse rounded bg-slate-100"
          />
        )}
        {run ? (
          <>
            <span className="text-slate-500">
              시작 <span className="tabular-nums text-slate-800">{formatRunClock(run.startedAt)}</span>
            </span>
            <span className="text-slate-500">
              {run.status === 'running' || run.status === 'stopping' ? '경과' : '소요'}{' '}
              <span data-testid="run-elapsed" className="tabular-nums font-medium text-slate-800">
                {runElapsedText(run, receivedAt, now)}
              </span>
            </span>
          </>
        ) : null}
      </div>

      {/* 시작 버튼 곁 문구 — 다른 실행 · 역할 · 대용량 경고 · 매개변수 400 */}
      {ctl.start.other ? (
        <p className="text-slate-600">
          <Link href={ctl.start.other.href} className="text-sky-700 underline">
            {ctl.start.note}
          </Link>
        </p>
      ) : ctl.start.note ? (
        <p className="text-slate-600">{ctl.start.note}</p>
      ) : null}
      {warning && !ctl.lockedParams ? (
        <p data-testid="run-large-warning" className="rounded bg-amber-50 px-2 py-1 text-amber-800">
          ⚠ {warning}
        </p>
      ) : null}
      {local.paramError ? <p className="text-red-600">{local.paramError}</p> : null}

      {/* 띠 — 요청 · 조회 사건(409 · 404 · 요청 실패 · 폴링 실패) */}
      {local.notice ? (
        <p role="status" className={cn('rounded border px-2 py-1', BAND[local.notice.tone])}>
          {local.notice.text}
        </p>
      ) : null}
      {p.pollFailed ? (
        <p role="status" className={cn('rounded border px-2 py-1', BAND.danger)}>
          {POLL_FAILED_TEXT}
        </p>
      ) : null}

      {ready && !run ? <p className="text-slate-500">{NO_RUN_TEXT}</p> : null}

      {run && p.progress ? p.progress(run, receivedAt, now) : null}

      {/* 종결 띠 — 다음 시작 전까지 남는다 · 옆에 라이브 표지 */}
      {band ? (
        <div className="flex flex-wrap items-center gap-2">
          <p
            data-testid="run-band"
            role="status"
            className={cn('rounded border px-2 py-1 text-sm font-medium', BAND[band.tone])}
          >
            {band.text}
          </p>
          {run && run.status !== 'stopping' ? <span className="text-slate-500">{LIVE_MARK}</span> : null}
        </div>
      ) : null}

      {run ? (
        <details open className="rounded border border-slate-100 px-2 py-1">
          <summary className="cursor-pointer text-slate-600">단계 {run.steps.length}</summary>
          <ol className="mt-1 flex flex-col gap-0.5" data-testid="run-steps">
            {run.steps.map((s) => {
              const took = stepElapsedText(s, receivedAt, now);
              const detail = stepDetailText(s);
              return (
                <li
                  key={s.key}
                  className={cn(
                    'flex flex-wrap gap-x-2 tabular-nums',
                    s.status === 'pending' || s.status === 'skipped' ? 'text-slate-400' : 'text-slate-700',
                    s.status === 'failed' && 'text-red-700',
                  )}
                >
                  <span title={s.status} className="w-3 text-center">
                    {STEP_ICON[s.status]}
                  </span>
                  <span className="font-mono text-slate-500">{s.key}</span>
                  <span>{s.label}</span>
                  {took ? <span>{took}</span> : null}
                  {detail ? <span className="text-slate-500">{detail}</span> : null}
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}

      {run?.result && p.result ? (
        <details open className="rounded border border-slate-100 px-2 py-1">
          <summary className="cursor-pointer text-slate-600">결과 표</summary>
          <div className="mt-1">{p.result(run)}</div>
        </details>
      ) : null}
    </section>
  );
}
