'use client';
// 실행 패널 훅 — current 1초 폴링(진행 중만) · 시작 · 중단 요청 · 응답을 캐시에 반영 · 경과 틱(단조 시계)
// 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙 §갱신과 응답 처리
// 화면을 떠나면 폴링만 멈춘다 — 이탈은 중단 요청을 보내지 않는다(실행은 api 프로세스가 계속한다).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  currentRunQueryOptions,
  currentRunReadOptions,
  isActive,
  monoNow,
  PANEL_IDLE,
  panelReducer,
  panelRun,
  RUN_POLL_MS,
  type RunSnapshot,
  requestStart,
  requestStop,
  runKeys,
  vanished,
} from '../../lib/runs';
import type { RunObjectBody, RunType } from '../../lib/shared';

/** current 읽기 전용 구독(라이브 계열 · 흐름도 머리) — 폴링은 실행 패널(useRunPanel) 하나만 건다 */
export function useCurrentRun() {
  return useQuery(currentRunReadOptions());
}

/** 경과 틱 — 진행 중에만 1초마다 단조 시계를 읽는다 */
export function useMonoTick(on: boolean): number {
  const [now, setNow] = useState(monoNow);
  useEffect(() => {
    if (!on) return;
    setNow(monoNow());
    const t = setInterval(() => setNow(monoNow()), RUN_POLL_MS);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

export function useRunPanel(type: RunType) {
  const qc = useQueryClient();
  const q = useQuery(currentRunQueryOptions());
  const [local, dispatch] = useReducer(panelReducer, PANEL_IDLE);

  // 진행 중이던 실행이 current null로 바뀌었다 — api 재기동(실패가 아니라 기록 없음)
  const prev = useRef<RunSnapshot | undefined>(q.data);
  useEffect(() => {
    if (vanished(prev.current, q.data)) dispatch({ kind: 'vanished' });
    prev.current = q.data;
  }, [q.data]);

  const put = useCallback(
    (run: RunObjectBody) => qc.setQueryData<RunSnapshot>(runKeys.current, { run, receivedAt: monoNow() }),
    [qc],
  );
  const refetch = useCallback(() => qc.refetchQueries({ queryKey: runKeys.current }), [qc]);

  const start = useCallback(
    async (params: Record<string, number>) => {
      dispatch({ kind: 'start-request' });
      const outcome = await requestStart(type, params);
      if (outcome.kind === 'started') put(outcome.run);
      else if (outcome.kind === 'conflict') {
        if (outcome.run) put(outcome.run);
        else void refetch();
      } else if (outcome.kind === 'failed') void refetch(); // 요청이 실제로는 닿았을 수 있다
      dispatch({ kind: 'start-done', outcome });
    },
    [type, put, refetch],
  );

  const stop = useCallback(async () => {
    const run = panelRun(qc.getQueryData<RunSnapshot>(runKeys.current), type);
    if (!run) return;
    dispatch({ kind: 'stop-request' });
    const outcome = await requestStop(run.runId);
    if (outcome.kind === 'stopped') put(outcome.run);
    else void refetch();
    dispatch({ kind: 'stop-done', outcome });
  }, [qc, type, put, refetch]);

  const snapshot = q.data;
  const run = snapshot?.run ?? null;
  const pollFailed = q.isError;
  const ticking = run !== null && isActive(run.status) && !pollFailed;
  const tick = useMonoTick(ticking);
  // 폴링 실패 — 경과 틱을 실패 순간에 멈춘다(끝났을지 모르는 실행을 계속 세지 않는다)
  const now =
    pollFailed && snapshot
      ? snapshot.receivedAt + Math.max(0, q.errorUpdatedAt - q.dataUpdatedAt)
      : Math.max(tick, snapshot?.receivedAt ?? 0);

  return { snapshot, pollFailed, local, start, stop, now };
}
