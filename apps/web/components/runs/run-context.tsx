'use client';
// 실행 조작부 한 벌의 상태 — 화면마다 하나(RunProvider)를 두고 머리 조작부(RunControl) · 진행 띠(RunProgress) · 화면(내 측정 점)이 나눠 쓴다.
// 1초 폴링은 이 한 곳(useRunPanel)만 건다 — 조각마다 훅을 부르면 관찰자마다 간격 타이머가 따로 돌고 요청 중 · 중단 중 표지가 조각마다 갈린다.
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { RunType } from '../../lib/shared';
import { useRunPanel } from './use-run';

export type RunPanelState = ReturnType<typeof useRunPanel>;

export interface RunContextValue extends RunPanelState {
  type: RunType;
}

const RunContext = createContext<RunContextValue | null>(null);

export function RunProvider({ type, children }: { type: RunType; children?: ReactNode }) {
  const panel = useRunPanel(type);
  const value = useMemo<RunContextValue>(() => ({ ...panel, type }), [panel, type]);
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRunContext(): RunContextValue {
  const v = useContext(RunContext);
  if (!v) throw new Error('RunProvider 밖에서 실행 조작부를 그렸다');
  return v;
}
