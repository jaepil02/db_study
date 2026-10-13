'use client';
// 센서 데이터 지우기 버튼(공용 컨트롤 — ⑤ /lab · ⑦ /hmi 머리) — 정본 docs/08_screen/10_lab_screen.md §공용 컨트롤 · 표면 docs/07_api/09_datagen.md #7 · #8
// 누르면 확인 창: 지울 양(/bff/data/sensor/stats — 창을 열 때마다 새로 읽음) · 남는 것 → [지우기] POST /bff/data/sensor/purge
// → 결과(저장소별 지운 행 · 걸린 시간) 또는 409 이유별 쉬운 문구(측정 중 · 설비 가동 중 · 대기줄 적체). 설비 가동이 켜져 있으면 미리 막고 이유를 보인다.
// 키보드 — 열면 [닫기]로 포커스(되돌릴 수 없는 일이라 덜 위험한 쪽 먼저 — WAI-ARIA APG alertdialog) · Tab은 창 안에서 돈다 · Esc로 닫고 닫으면 [데이터 지우기] 버튼으로 돌아간다.
// 지우는 것은 쌓인 센서 데이터뿐 — 설비 · 태그 · 업무 기록 · 직접 비교 결과(run_result)는 남는다(api가 정한다).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import type { SensorDataStatsBody, SensorPurgeResultBody } from '../../lib/shared';
import { cn } from '../../lib/utils';
import { STORE, STORE_DOT_CLASS } from '../ui/store';
import {
  PURGE_BLOCKED_TEXT,
  PURGE_KEEP,
  PURGE_LABEL,
  PURGE_TITLE,
  purgeErrorText,
  purgeLines,
  purgeResultText,
} from './control-text';
import { controlKeys, powerQueryOptions, purgeSensorData, statsQueryOptions } from './data';

const DANGER_OUTLINE =
  'inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 py-0.5 whitespace-nowrap text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50';

export function PurgeButton({ className }: { className?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // 창을 열 때만 지울 양을 읽는다(열 때마다 새로) · 설비 가동은 공용 키(스위치와 같은 값)
  const stats = useQuery({ ...statsQueryOptions(), enabled: open });
  const power = useQuery(powerQueryOptions());
  const m = useMutation({
    mutationFn: () => purgeSensorData(),
    onSettled: () => void qc.invalidateQueries({ queryKey: controlKeys.stats }),
  });
  return (
    <PurgeButtonView
      open={open}
      onOpen={() => {
        m.reset();
        setOpen(true);
        void stats.refetch();
      }}
      onClose={() => setOpen(false)}
      stats={stats.data ?? null}
      statsFailed={stats.isError}
      plantOn={power.data?.on ?? null}
      purging={m.isPending}
      result={m.data ?? null}
      error={
        m.isError ? (m.error instanceof ApiError ? m.error : new ApiError(0, null, String(m.error))) : null
      }
      onPurge={() => m.mutate()}
      className={className}
    />
  );
}

export interface PurgeButtonViewProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  stats: SensorDataStatsBody | null;
  statsFailed: boolean;
  /** 설비 가동 — 모르면 null(서버가 409로 막는다) */
  plantOn: boolean | null;
  purging: boolean;
  result: SensorPurgeResultBody | null;
  error: ApiError | null;
  onPurge: () => void;
  className?: string;
}

/** 그리기만 — 상태는 모두 props(정적 렌더 시험) */
export function PurgeButtonView(p: PurgeButtonViewProps) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { open, onClose } = p;

  // 바깥 클릭 · Esc로 닫는다 — 지우는 중에는 닫지 않는다(결과를 놓치지 않게) · Tab은 창 안 버튼끼리 돈다
  const busy = useRef(p.purging);
  busy.current = p.purging;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!busy.current && root.current && !root.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy.current) onClose();
      if (e.key === 'Tab' && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        const at = document.activeElement;
        if (!dialog.current.contains(at) || (e.shiftKey && at === first) || (!e.shiftKey && at === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const blocked = p.plantOn === true && !p.result;
  const canPurge = !p.purging && !p.result && !blocked;

  // 포커스 — 열면 [닫기](data-autofocus · 되돌릴 수 없는 [지우기]는 Tab으로 가서 누른다) · 지우는 동안 · 결과 · 오류로 버튼이 바뀌어 포커스를 잃어도 다시 [닫기]로
  useEffect(() => {
    if (!open || p.purging || !dialog.current) return;
    const at = document.activeElement;
    if (dialog.current.contains(at) && !(at as HTMLButtonElement | null)?.disabled) return;
    dialog.current.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus();
  }, [open, p.purging]);

  // 닫으면 포커스를 [데이터 지우기] 버튼으로 돌린다 — 바깥의 다른 곳을 눌러 닫았으면 그곳에 둔다
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) {
      const at = document.activeElement;
      if (!at || at === document.body || root.current?.contains(at)) trigger.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const lines = p.stats ? purgeLines(p.stats) : null;

  return (
    <div ref={root} data-testid="purge" className={cn('relative text-note', p.className)}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? onClose() : p.onOpen())}
        className={DANGER_OUTLINE}
      >
        <TrashGlyph />
        {PURGE_LABEL}
      </button>
      {open ? (
        <div
          ref={dialog}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="purge-dialog"
          className="absolute top-full right-0 z-40 mt-2 flex w-[min(26rem,90vw)] flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg"
        >
          <p id={titleId} className="text-body font-semibold text-slate-900">
            {PURGE_TITLE}
          </p>
          {p.result ? null : lines ? (
            <ul data-testid="purge-lines" className="flex flex-col gap-1">
              {lines.map((l) => (
                <li key={l.key} title={l.exact} className="flex items-baseline gap-2">
                  <span
                    aria-hidden
                    className={cn(STORE_DOT_CLASS, 'self-center')}
                    style={{ backgroundColor: STORE[l.key].color }}
                  />
                  <span className="shrink-0 font-medium text-slate-800">{STORE[l.key].label}</span>
                  <span className="text-slate-500">{l.what}</span>
                  <span className="ml-auto text-right text-slate-800 tabular-nums">{l.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">
              {p.statsFailed ? '지울 양을 못 읽었어요' : '지울 양을 읽는 중이에요…'}
            </p>
          )}
          {p.result ? null : <p className="text-foot text-slate-500">{PURGE_KEEP}</p>}
          {blocked ? (
            <p role="status" className="rounded bg-amber-50 px-2 py-1 text-amber-800">
              {PURGE_BLOCKED_TEXT.plant_running}
            </p>
          ) : null}
          {p.error ? (
            <p role="alert" data-testid="purge-error" className="rounded bg-red-50 px-2 py-1 text-red-700">
              {purgeErrorText(p.error)}
            </p>
          ) : null}
          {p.result ? (
            <p
              role="status"
              data-testid="purge-result"
              className="rounded bg-emerald-50 px-2 py-1 text-emerald-800"
            >
              {purgeResultText(p.result)}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              disabled={p.purging}
              className="rounded-full border border-slate-300 bg-white px-3 py-0.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              닫기
            </button>
            {p.result ? null : (
              <button
                type="button"
                data-testid="purge-confirm"
                onClick={p.onPurge}
                disabled={!canPurge}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-700 px-3 py-0.5 text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {p.purging ? '지우는 중이에요…' : '지우기'}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 휴지통 — 24 격자 · 선 2(components/ui/icon.tsx와 같은 모양 규칙) */
function TrashGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.05em] shrink-0"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}
