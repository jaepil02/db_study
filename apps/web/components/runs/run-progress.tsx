'use client';
// 머리 아래 얇은 진행 띠 한 줄 — 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙 §배치 진행 띠 행
// 진행 중: ● 상태 · 지금 단계 쉬운 문장 · 단계 n/m · 진행 막대(직접 비교 넣기) · 경과 · 오른쪽 [■ 중단]
// 방금 끝남(이 화면에서 지켜보던 실행 · 종결 뒤 30초): "지난번 보내 보기" · 완료 띠(완료 — 걸린 시간 · 중단됨 · 실패 — 오류 전문은 띠 툴팁) · 무엇을 보냈나(초당 1,000개 · 30초) · 라이브 표지.
// 30초가 지나면(또는 이미 끝난 실행을 열면) 띠는 사라진다(docs/08_screen/08_evidence_screens.md §실행 패널 §상태 칩과 종결 표시).
// 완료 띠가 진행 띠 자리를 대신하므로 종결 뒤에는 중단 버튼을 그리지 않는다(리드 확인 2026-10-03). 띠 툴팁에 시작 · 종료 시각과 단계 key. 서랍 · 단계 목록은 없다.
// 다른 종류가 진행 중이면 "다른 측정이 이미 돌고 있어요" 한 줄(보는 화면이 있으면 그 화면 링크 · 409 띠가 같은 말이면 생략) · 요청 사건(409 · 404 · 요청 실패) · 폴링 실패 문구도 이 띠에 둔다.
// 그릴 실행 줄도 띠 문구도 없으면 띠 자체가 없다(화면 높이를 쓰지 않는다).
import Link from 'next/link';
import {
  compareLive,
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
  stripShowsRun,
} from '../../lib/runs';
import type { RunType } from '../../lib/shared';
import { cn } from '../../lib/utils';
import { UiIcon } from '../ui/icon';
import { useRunContext } from './run-context';
import { stageProgress } from './run-spec';

const BAND: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function RunProgress({ className }: { className?: string }) {
  const { type, snapshot, pollFailed, local, now, stop, recentEndId } = useRunContext();
  return (
    <RunProgressView
      type={type}
      snapshot={snapshot}
      pollFailed={pollFailed}
      local={local}
      now={now}
      recentEndId={recentEndId}
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
  /** 이 화면에서 방금 끝난 실행(종결 뒤 30초 · useRunPanel) — 그 실행만 종결 띠를 그린다 · 없으면 종결 실행은 셸 머리 글자로 */
  recentEndId?: string | null;
  onStop: () => void;
  className?: string;
}

/** 그리기만 — 상태는 모두 props */
export function RunProgressView(p: RunProgressViewProps) {
  const { type, snapshot, local } = p;
  const mine = panelRun(snapshot, type);
  const run = stripShowsRun(mine, p.recentEndId ?? null) ? mine : null;
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
  });

  return (
    <div
      data-testid="run-progress-strip"
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-1 text-foot',
        p.pollFailed && 'opacity-70',
        p.className,
      )}
    >
      {run && snapshot ? <RunLine {...p} run={run} snapshot={snapshot} stopCtl={ctl.stop} /> : null}
      {other ? <OtherRunLine type={other.type} /> : null}
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

/** 다른 종류 실행 한 줄 — 보는 화면이 있으면 그 화면 링크 · 없으면(flow) 글자만 */
function OtherRunLine({ type }: { type: RunType }) {
  const screen = RUN_SCREEN[type];
  return (
    <p data-testid="run-other" className="text-slate-600">
      {screen ? (
        <Link href={screen.href} className="text-sky-700 underline">
          {otherRunText(type)}
        </Link>
      ) : (
        otherRunText(type)
      )}
    </p>
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
  // 직접 비교 넣기 — 발행 진행(보낸 행 ÷ 구간 행)을 같은 막대로(조회 · 무결성은 단계 n/m만)
  const live = type === 'compare' ? compareLive(run) : null;
  const comparePct =
    live?.ratio !== null &&
    live?.ratio !== undefined &&
    run.steps.find((s) => s.key === 'publish')?.status === 'running'
      ? Math.round(live.ratio * 100)
      : null;

  const scope = runScopeText(run);
  return (
    <div
      title={runTip(run)}
      className="flex h-[clamp(24px,calc(24px+6*var(--fs)),30px)] items-center gap-x-3 overflow-hidden whitespace-nowrap tabular-nums text-slate-600"
    >
      {active ? (
        <span className="flex items-center gap-1.5 font-medium text-slate-800">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-sky-500 motion-safe:animate-pulse"
          />
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
          {` · 단계 ${stage.n}/${stage.total}`}
        </span>
      ) : null}
      {comparePct !== null && active && !stopping ? (
        <span className="flex items-center gap-1.5">
          <span
            role="progressbar"
            aria-label="Redis로 보내는 중"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={comparePct}
            className="inline-block h-1.5 w-28 overflow-hidden rounded bg-slate-100"
          >
            <span
              className="block h-full bg-sky-500 transition-[width]"
              style={{ width: `${comparePct}%` }}
            />
          </span>
          {comparePct}%
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
      {/* 포커스 링은 안쪽으로(-2px) — 이 줄은 한 줄 높이(24 → 30 — 글자 토큰 비율)를 지키려 overflow-hidden이라 바깥 링(전역 offset 2px)이 잘린다(R6) */}
      {active ? (
        <button
          type="button"
          onClick={onStop}
          disabled={!stopCtl.enabled}
          className="ml-auto inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2.5 py-0.5 text-red-700 hover:bg-red-50 focus-visible:-outline-offset-2 disabled:opacity-50"
        >
          <UiIcon name="stop" className="size-3" />
          {stopCtl.label}
        </button>
      ) : null}
    </div>
  );
}
