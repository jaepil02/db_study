'use client';
// 설비 가동 스위치(공용 컨트롤 — ⑤ /lab · ⑦ /hmi 머리) — 정본 docs/08_screen/10_lab_screen.md §공용 컨트롤 · 표면 docs/07_api/06_realtime.md #3 · #4
// 자기완결: GET · POST /bff/plant/power(5초마다 다시 읽음) · 켜짐 · 꺼짐 표시 · 바뀌는 중 잠금 · 실패 문구.
// 켜고 끄면 센서 데이터 현황을 다시 읽게 한다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import type { PlantPowerBody } from '../../lib/shared';
import { formatKstIso } from '../../lib/time';
import { cn } from '../../lib/utils';
import {
  POWER_LABEL,
  POWER_READ_FAILED,
  POWER_STATE_TEXT,
  POWER_TIP,
  powerErrorText,
  powerPendingText,
} from './control-text';
import { controlKeys, powerQueryOptions, setPower } from './data';

export function PlantPowerSwitch({ className }: { className?: string }) {
  const qc = useQueryClient();
  const q = useQuery(powerQueryOptions());
  const m = useMutation({
    mutationFn: (on: boolean) => setPower(on),
    onSuccess: (body) => {
      qc.setQueryData<PlantPowerBody>(controlKeys.power, body);
      void qc.invalidateQueries({ queryKey: controlKeys.stats });
    },
  });
  return (
    <PlantPowerSwitchView
      power={q.data ?? null}
      readFailed={q.isError && !q.data}
      pendingTo={m.isPending ? (m.variables ?? null) : null}
      error={
        m.isError ? (m.error instanceof ApiError ? m.error : new ApiError(0, null, String(m.error))) : null
      }
      onToggle={(on) => {
        m.reset();
        m.mutate(on);
      }}
      className={className}
    />
  );
}

export interface PlantPowerSwitchViewProps {
  /** 지금 상태 — 읽기 전이면 null */
  power: PlantPowerBody | null;
  readFailed: boolean;
  /** 바꾸는 중이면 바꿀 값 */
  pendingTo: boolean | null;
  error: ApiError | null;
  onToggle: (on: boolean) => void;
  className?: string;
}

/** 그리기만 — 상태는 모두 props(정적 렌더 시험) */
export function PlantPowerSwitchView(p: PlantPowerSwitchViewProps) {
  const on = p.power?.on ?? false;
  const pending = p.pendingTo !== null;
  const ready = p.power !== null;
  const tip = [
    POWER_TIP,
    p.power?.changedAt ? `마지막으로 바꾼 시각 ${formatKstIso(p.power.changedAt).slice(11)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const state = pending
    ? powerPendingText(p.pendingTo === true)
    : ready
      ? POWER_STATE_TEXT[on ? 'on' : 'off']
      : p.readFailed
        ? POWER_READ_FAILED
        : '읽는 중';
  return (
    <div data-testid="plant-power" className={cn('flex items-center gap-2 text-note', p.className)}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={POWER_LABEL}
        aria-busy={pending}
        title={tip}
        disabled={!ready || pending}
        onClick={() => p.onToggle(!on)}
        data-on={on ? 'true' : 'false'}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border py-0.5 pr-3 pl-1 whitespace-nowrap disabled:cursor-not-allowed',
          on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-white hover:bg-slate-50',
          pending && 'opacity-70',
        )}
      >
        {/* 스위치 모양 — 켜짐은 손잡이가 오른쪽(초록 길) · 꺼짐은 왼쪽(회색 길) · 색만으로 말하지 않게 옆에 글자 */}
        <span
          aria-hidden
          className={cn(
            'relative inline-block h-[1.25em] w-[2.25em] shrink-0 rounded-full transition-colors',
            on ? 'bg-emerald-600' : 'bg-slate-300',
          )}
        >
          <span
            className={cn(
              'absolute top-[0.125em] size-[1em] rounded-full bg-white shadow-sm transition-[left]',
              on ? 'left-[1.125em]' : 'left-[0.125em]',
            )}
          />
        </span>
        <span className="text-slate-700">{POWER_LABEL}</span>
        <b
          data-testid="plant-power-state"
          className={cn('font-semibold', on ? 'text-emerald-800' : 'text-slate-600')}
        >
          {state}
        </b>
      </button>
      {p.error ? (
        <span role="alert" className="text-foot text-red-700">
          {powerErrorText(p.error)}
        </span>
      ) : null}
    </div>
  );
}
