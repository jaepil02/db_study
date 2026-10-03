'use client';
// 실행 패널 훅 — current 1초 폴링(진행 중만) · 시작 · 중단 요청 · 응답을 캐시에 반영 · 경과 틱(단조 시계)
// 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙 §갱신과 응답 처리
// 화면을 떠나면 폴링만 멈춘다 — 이탈은 중단 요청을 보내지 않는다(실행은 api 프로세스가 계속한다).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  currentRunQueryOptions,
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
  type StartOutcome,
  vanished,
} from '../../lib/runs';
import type { RunObjectBody, RunType } from '../../lib/shared';

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
    async (params: Record<string, number>): Promise<StartOutcome> => {
      dispatch({ kind: 'start-request' });
      const outcome = await requestStart(type, params);
      if (outcome.kind === 'started') put(outcome.run);
      else if (outcome.kind === 'conflict') {
        if (outcome.run) put(outcome.run);
        else void refetch();
      } else if (outcome.kind === 'failed') void refetch(); // 요청이 실제로는 닿았을 수 있다
      dispatch({ kind: 'start-done', outcome, self: type });
      return outcome; // 팝오버는 started(202)를 받은 뒤에만 닫는다(§배치 매개변수 팝오버 행)
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
  // 처음 실패한 순간의 단조 시각 — 실패가 이어지는 동안(1초 재시도마다 errorUpdatedAt이 바뀌어도) 고정 · 성공하면 지운다
  const failedAt = useRef<number | null>(null);
  failedAt.current = nextFailedAt(failedAt.current, pollFailed, monoNow);
  // 이 화면 종류의 진행 중 실행만 1초 틱 — 다른 종류는 패널에 경과를 그리지 않는다
  const tick = useMonoTick(tickOn(run, type, pollFailed));
  const now = panelNow(snapshot, failedAt.current, tick);

  return { snapshot, pollFailed, local, start, stop, now };
}

/** 1초 틱을 거는가 — 이 화면 종류의 running · stopping 실행 · 폴링 실패가 아닐 때만 */
export const tickOn = (run: RunObjectBody | null, type: RunType, pollFailed: boolean): boolean =>
  run !== null && run.type === type && isActive(run.status) && !pollFailed;

/** 실패 시작 시각 — 실패가 처음 보인 순간(성공 → 실패)에만 시계를 읽고 · 실패 중 유지 · 성공이면 null */
export function nextFailedAt(prev: number | null, failing: boolean, clock: () => number): number | null {
  if (!failing) return null;
  return prev ?? clock();
}

/**
 * 경과 계산 기준 시각(단조) — 폴링 실패 중이면 처음 실패한 순간에 멈춘다(끝났을지 모르는 실행을 계속 세지 않는다 · 08_screen/08 폴링 실패 행).
 * 그 밖에는 1초 틱 · 응답을 받은 시각 중 늦은 쪽.
 */
export function panelNow(snapshot: RunSnapshot | undefined, failedAt: number | null, tick: number): number {
  if (failedAt !== null && snapshot) return Math.max(snapshot.receivedAt, failedAt);
  return Math.max(tick, snapshot?.receivedAt ?? 0);
}
