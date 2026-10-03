'use client';
// 머리 아래 얇은 진행 띠 한 줄 — 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙 §배치 진행 띠 행
// 진행 중: ● 상태 · 지금 단계 쉬운 문장 · 단계 n/m · 진행 막대(EXP-FLOW) · 경과 · 오른쪽 [■ 중단]
// 종결 뒤: "지난번 직접 재 보기" · 완료 띠(완료 — 걸린 시간 · 중단됨 · 실패 — 오류 전문은 띠 툴팁) · 무엇을 쟀나(10만 행까지) · 라이브 표지 — 다음 시작 전까지 남는다.
// 완료 띠가 진행 띠 자리를 대신하므로 종결 뒤에는 중단 버튼을 그리지 않는다(리드 확인 2026-10-03). 띠 툴팁에 시작 · 종료 시각과 단계 key. 서랍 · 단계 목록은 없다.
// 다른 종류가 진행 중이면 "다른 측정이 이미 돌고 있어요 — … 화면에서 보기" 한 줄(409 띠가 같은 말이면 생략) · 요청 사건(409 · 404 · 요청 실패) · 폴링 실패 문구도 이 띠에 둔다.
// 실행이 없고 종결 실행도 없고 띠 문구도 없으면 띠 자체가 없다(화면 높이를 쓰지 않는다).
import Link from 'next/link';
import {
  flowProgress,
  isActive,
  LAST_RUN_LABEL,
  LIVE_LABEL,
  LIVE_MARK,
  otherRunText,
  type PanelLocal,
  POLL_FAILED_TEXT,
  panelRun,
  RUN_SCREEN,
  type RunSnapshot,
  runBand,
  runControls,
  runElapsedText,
  runScopeText,
  runTip,
  STATUS_LABEL,
  stepPlainText,
} from '../../lib/runs';
import type { RunType } from '../../lib/shared';
import { cn } from '../../lib/utils';
import { useRunContext } from './run-context';
import { stageProgress } from './run-spec';

const BAND: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function RunProgress({ className, canControl = true }: { className?: string; canControl?: boolean }) {
  const { type, snapshot, pollFailed, local, now, stop } = useRunContext();
  return (
    <RunProgressView
      type={type}
      snapshot={snapshot}
      pollFailed={pollFailed}
      local={local}
      now={now}
      canControl={canControl}
      onStop={() => void stop()}
      className={className}
    />
  );
}

export interface RunProgressViewProps {
  type: RunType;
  snapshot: RunSnapshot | undefined;
  pollFailed: boolean;
  local: PanelLocal;
  now: number;
  canControl?: boolean;
  onStop: () => void;
  className?: string;
}

/** 그리기만 — 상태는 모두 props */
export function RunProgressView(p: RunProgressViewProps) {
  const { type, snapshot, local } = p;
  const run = panelRun(snapshot, type);
  const other =
    snapshot?.run && snapshot.run.type !== type && isActive(snapshot.run.status) ? snapshot.run : null;
  // 첫 조회 실패(snapshot 없음)도 띠 문구로 — 조작부가 왜 비활성인지 보인다(§갱신과 응답 처리 폴링 실패 행)
  const pollNote = p.pollFailed ? POLL_FAILED_TEXT : null;
  if (!run && !other && !local.notice && !pollNote) return null;

  const ctl = runControls({
    type,
    snapshot,
    starting: local.starting,
    stopRequested: local.stopRequested,
    canControl: p.canControl ?? true,
  });

  return (
    <div
      data-testid="run-progress-strip"
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs',
        p.pollFailed && 'opacity-70',
        p.className,
      )}
    >
      {run && snapshot ? <RunLine {...p} run={run} snapshot={snapshot} stopCtl={ctl.stop} /> : null}
      {other ? (
        <p data-testid="run-other" className="text-slate-600">
          <Link href={RUN_SCREEN[other.type].href} className="text-sky-700 underline">
            {otherRunText(other.type)}
          </Link>
        </p>
      ) : null}
      {/* 409 띠 — 다른 종류 링크 줄이 이미 같은 말을 하면 생략한다(같은 말 두 줄 금지) */}
      {local.notice && !(local.notice.conflict && other) ? (
        <p role="status" className={cn('rounded border px-2 py-0.5', BAND[local.notice.tone])}>
          {local.notice.text}
        </p>
      ) : null}
      {pollNote ? (
        <p role="status" className="text-amber-800">
          {pollNote}
        </p>
      ) : null}
    </div>
  );
}

function RunLine({
  type,
  run,
  snapshot,
  now,
  onStop,
  stopCtl,
}: RunProgressViewProps & {
  run: NonNullable<ReturnType<typeof panelRun>>;
  snapshot: RunSnapshot;
  stopCtl: { enabled: boolean; label: string };
}) {
  const active = isActive(run.status);
  // 멈추는 중이면 띠 문장이 지금 일을 말한다 — 단계 문장 · 진행 막대를 빼서 한 줄 폭(본문 약 1,128px) 안에 둔다(단계는 띠 툴팁)
  const stopping = run.status === 'stopping';
  const band = runBand(run);
  const stage = stageProgress(run);
  const plain = stepPlainText(run);
  const flow = type === 'flow' ? flowProgress(run, snapshot.receivedAt, now) : null;
  const pct = flow ? Math.round(flow.ratio * 100) : null;

  const scope = runScopeText(run);
  return (
    <div
      title={runTip(run)}
      className="flex h-6 items-center gap-x-3 overflow-hidden whitespace-nowrap tabular-nums text-slate-600"
    >
      {active ? (
        <span className="flex items-center gap-1.5 font-medium text-slate-800">
          <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500" />
          {STATUS_LABEL[run.status]}
        </span>
      ) : (
        <span className="font-medium text-slate-700">{LAST_RUN_LABEL[type]}</span>
      )}
      {band ? (
        <span
          data-testid="run-band"
          role="status"
          title={band.tip ?? undefined}
          className={cn('min-w-0 truncate rounded border px-2 py-0.5 font-medium', BAND[band.tone])}
        >
          {band.text}
        </span>
      ) : null}
      {active && !stopping ? (
        <span data-testid="run-stage" className="text-slate-800">
          {plain}
          {type === 'perf' ? ` · 단계 ${stage.n}/${stage.total}` : ''}
        </span>
      ) : null}
      {flow && pct !== null && active && !stopping ? (
        <span className="flex items-center gap-1.5">
          <span
            role="progressbar"
            aria-label="보내는 중"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="inline-block h-1.5 w-28 overflow-hidden rounded bg-slate-100"
          >
            <span className="block h-full bg-sky-500 transition-[width]" style={{ width: `${pct}%` }} />
          </span>
          {flow.elapsedSec}초 / {flow.durationSec}초
        </span>
      ) : null}
      {active ? (
        <span>
          경과 <span data-testid="run-elapsed">{runElapsedText(run, snapshot.receivedAt, now)}</span>
        </span>
      ) : null}
      {!active && scope ? <span data-testid="run-scope">{scope}</span> : null}
      {!active ? (
        <span data-testid="run-live-mark" title={LIVE_MARK} className="text-slate-500">
          {LIVE_LABEL}
        </span>
      ) : null}
      {active ? (
        <button
          type="button"
          onClick={onStop}
          disabled={!stopCtl.enabled}
          className="ml-auto rounded border border-red-300 bg-white px-2.5 py-0.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <span aria-hidden="true">■ </span>
          {stopCtl.label}
        </button>
      ) : null}
    </div>
  );
}
