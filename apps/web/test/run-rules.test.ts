// 라이브 실행 패널 — 08_screen/08 §실행 패널 — 두 화면 공통 규칙(버튼 상태 · 상태 칩과 종결 표시 · 경과 시간 · 갱신과 응답 처리)
// 표면(07_api/09 #2~#5)은 가짜 응답으로 대신한다 — api 쪽 구현과 무관하게 계약 모양만 본다.
import { environmentManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bffRuns from '../app/bff/runs/[[...path]]/route';
import { RunControlView, type RunControlViewProps } from '../components/runs/run-control';
import { RunProgressView, type RunProgressViewProps } from '../components/runs/run-progress';
import { defaultParams, FLOW_PARAM_DEFS } from '../components/runs/run-spec';
import { nextFailedAt, panelNow, tickOn } from '../components/runs/use-run';
import { ApiError } from '../lib/api';
import {
  currentRunQueryOptions,
  flowProgress,
  formatElapsed,
  headerLastRun,
  justEndedRunId,
  lastRunText,
  lastRunTip,
  liveElapsedMs,
  PANEL_IDLE,
  panelReducer,
  RUN_POLL_MS,
  type RunSnapshot,
  requestStart,
  requestStop,
  runBand,
  runControls,
  runElapsedText,
  runKeys,
  runPollInterval,
  runScopeText,
  SAME_RUN_TEXT,
  stepPlainText,
  stripShowsRun,
  VANISHED_TEXT,
  vanished,
} from '../lib/runs';
import type { RunObjectBody } from '../lib/shared';

// ── 픽스처 — 07_api/09 §응답 예시 모양 ──

const FLOW_ID = 'b0c9e4d1-58a2-4f37-8e0b-6a1d2c3e4f50';

const step = (key: string, status: RunObjectBody['steps'][number]['status'], extra = {}) => ({
  key,
  label: key,
  status,
  startedAt: status === 'pending' ? null : '2026-09-28T05:12:03.004Z',
  endedAt: status === 'done' ? '2026-09-28T05:12:03.412Z' : null,
  elapsedMs: status === 'pending' ? null : 408,
  detail: {},
  ...extra,
});

function flowRun(over: Partial<RunObjectBody> = {}): RunObjectBody {
  return {
    runId: FLOW_ID,
    type: 'flow',
    status: 'running',
    params: { pps: 10000, durationSec: 60, bizPerSec: 1 },
    startedAt: '2026-09-28T01:30:00.000Z',
    endedAt: null,
    elapsedMs: 42_570,
    steps: [
      step('prepare', 'done', { detail: { devices: 50, tags: 10000 } }),
      step('publish', 'running', {
        elapsedMs: 42_000,
        detail: {
          pointsSent: 420000,
          entriesSent: 2100,
          commandsSent: 42,
          backpressurePauses: 0,
          progress: 0.7,
        },
      }),
      step('drain', 'pending'),
    ],
    result: null,
    error: null,
    ...over,
  };
}

/** 다른 실행 시작 시각 — 종결 띠 · 경과 예시가 쓰는 10:20:05 KST */
const EARLY_START = '2026-09-28T01:20:05.000Z';

/** 종결 flow — 3분 12.4초(192,400 ms) · 종료 10:23:17 KST · publish 계수는 띠 툴팁 한 줄 */
const completedFlow = () =>
  flowRun({
    status: 'completed',
    startedAt: EARLY_START,
    endedAt: '2026-09-28T01:23:17.400Z',
    elapsedMs: 192_400,
    steps: [
      step('prepare', 'done'),
      step('publish', 'done', {
        detail: {
          pointsSent: 600000,
          entriesSent: 3000,
          commandsSent: 60,
          readsSent: 0,
          backpressurePauses: 0,
        },
      }),
      step('drain', 'done'),
    ],
  });

const snap = (run: RunObjectBody | null, receivedAt = 1_000): RunSnapshot => ({ run, receivedAt });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** 가짜 fetch — url · method → 응답 목록(순서대로 소비) */
function fakeFetch(routes: Record<string, (() => Response | Promise<Response>)[]>) {
  const calls: string[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const k = `${init?.method ?? 'GET'} ${url}`;
    calls.push(k);
    const q = routes[k];
    const next = q?.shift();
    if (!next) throw new TypeError(`예상하지 못한 요청 ${k}`);
    return next();
  });
  return { f, calls };
}

// ── 경과 시간 형식 ──

describe('경과 시간 형식 — 진행 중 1초 · 종결 0.1초 버림 · 1시간 이상', () => {
  it('진행 중(1초 단위)', () => {
    expect(formatElapsed(0, false)).toBe('0s');
    expect(formatElapsed(42_999, false)).toBe('42s');
    expect(formatElapsed(102_000, false)).toBe('1m 42s');
    expect(formatElapsed(3_792_000, false)).toBe('1h 3m 12s');
    expect(formatElapsed(3_600_000, false)).toBe('1h 0m 0s');
  });
  it('종결(0.1초 단위 · 버림)', () => {
    expect(formatElapsed(192_400, true)).toBe('3m 12.4s');
    expect(formatElapsed(192_499, true)).toBe('3m 12.4s');
    expect(formatElapsed(12_400, true)).toBe('12.4s');
    expect(formatElapsed(65_000, true)).toBe('1m 5.0s');
    expect(formatElapsed(62_410, true)).toBe('1m 2.4s');
    expect(formatElapsed(3_792_400, true)).toBe('1h 3m 12.4s');
  });
  it('음수는 0으로', () => {
    expect(formatElapsed(-5, true)).toBe('0.0s');
  });
  it('진행 중은 서버 elapsedMs + 받은 뒤 흐른 단조 시계 — startedAt을 빼지 않는다', () => {
    expect(liveElapsedMs(41_250, 1_000, 3_000)).toBe(43_250);
    // 틱이 응답보다 먼저 찍혔어도 뒤로 가지 않는다
    expect(liveElapsedMs(41_250, 1_000, 900)).toBe(41_250);
    expect(runElapsedText(flowRun(), 1_000, 61_000)).toBe('1m 42s');
  });
  it('종결은 endedAt − startedAt 고정(틱 무관)', () => {
    expect(runElapsedText(completedFlow(), 0, 999_999)).toBe('3m 12.4s');
  });
});

// ── 종결 띠 문구 ──

describe('경과 기준 시각 — 폴링 실패 중 멈춤(M1) · 진행 중에만 틱(L7)', () => {
  it('처음 실패한 순간에 고정 · 실패가 이어져도(errorUpdatedAt이 바뀌어도) 그대로 · 성공하면 지운다', () => {
    const snap = { run: flowRun(), receivedAt: 10_000 };
    let clock = 12_300;
    const read = () => clock;
    // 정상 — 틱을 따라간다
    let failedAt = nextFailedAt(null, false, read);
    expect(panelNow(snap, failedAt, 11_000)).toBe(11_000);
    // 처음 실패 — 그 순간(12,300)에 멈춘다
    failedAt = nextFailedAt(failedAt, true, read);
    expect(failedAt).toBe(12_300);
    expect(panelNow(snap, failedAt, 12_000)).toBe(12_300);
    // 1초 재시도가 5번 더 실패 — 기준 시각은 그대로
    for (let i = 0; i < 5; i++) {
      clock += 1000;
      failedAt = nextFailedAt(failedAt, true, read);
    }
    expect(panelNow(snap, failedAt, 12_000)).toBe(12_300);
    expect(liveElapsedMs(snap.run.elapsedMs ?? 0, snap.receivedAt, panelNow(snap, failedAt, 12_000))).toBe(
      42_570 + 2_300,
    );
    // 성공 — 새 응답 기준으로 다시 틱
    failedAt = nextFailedAt(failedAt, false, read);
    expect(failedAt).toBeNull();
    const fresh = { run: flowRun({ elapsedMs: 48_000 }), receivedAt: 17_300 };
    expect(panelNow(fresh, failedAt, 17_000)).toBe(17_300);
    expect(panelNow(fresh, failedAt, 18_300)).toBe(18_300);
  });

  it('1초 틱 — 이 화면 종류의 진행 중 실행만 · 폴링 실패 중이면 없다', () => {
    expect(tickOn(flowRun(), 'flow', false)).toBe(true);
    expect(tickOn(flowRun({ status: 'stopping' }), 'flow', false)).toBe(true);
    expect(tickOn(flowRun(), 'flow', true)).toBe(false);
    expect(tickOn(flowRun({ status: 'completed' }), 'flow', false)).toBe(false);
    expect(tickOn(null, 'flow', false)).toBe(false);
  });
});

describe('상태 칩과 종결 띠 — 한 줄 쉬운 말', () => {
  it('완료 — "완료 — 걸린 시간 3분 12.4초" · 툴팁에 종료 KST', () => {
    expect(runBand(completedFlow())).toEqual({
      tone: 'success',
      text: '완료 — 걸린 시간 3m 12.4s',
      tip: '종료 10:23:17 KST',
    });
  });
  it('중단됨 — 걸린 시간 · 정리 실패 문구', () => {
    const r = flowRun({
      status: 'stopped',
      endedAt: '2026-09-28T01:21:10.000Z',
      startedAt: EARLY_START,
      elapsedMs: 65_000,
    });
    expect(runBand(r)?.text).toBe('중단됨 — 걸린 시간 1m 5.0s');
    expect(runBand({ ...r, error: { code: null, message: 'DROP 실패' } })).toEqual({
      tone: 'neutral',
      text: '중단됨 — 걸린 시간 1m 5.0s · 정리하다 실패했어요(DROP 실패)',
      // 띠 안은 한 줄로 잘리므로 오류 전문을 툴팁 첫 줄에
      tip: '정리하다 실패했어요 — DROP 실패\n종료 10:21:10 KST',
    });
  });
  it('실패 — 메시지 · 소요 · 오류 코드는 툴팁에', () => {
    const r = flowRun({
      status: 'failed',
      startedAt: EARLY_START,
      endedAt: '2026-09-28T01:20:17.400Z',
      elapsedMs: 12_400,
      error: { code: 'timeseries.clickhouse_unavailable', message: '저장소 불가' },
    });
    expect(runBand(r)).toEqual({
      tone: 'danger',
      text: '실패했어요 — 저장소 불가 · 걸린 시간 12.4s',
      tip: '실패 원인 — 저장소 불가\n종료 10:20:17 KST\n오류 코드 timeseries.clickhouse_unavailable',
    });
  });
  it('running은 띠 없음 · stopping은 "멈추는 중이에요…"', () => {
    expect(runBand(flowRun())).toBeNull();
    expect(runBand(flowRun({ status: 'stopping' }))?.text).toBe(
      '멈추는 중이에요… — 하던 단계를 멈추고 정리하고 있어요',
    );
  });
});

describe('지난 실행 자리 — 띠는 실행 중 · 방금 끝난 30초만 · 그 뒤 셸 머리 "지난번" 글자(web-ux-polish §2.1)', () => {
  it('방금 끝남 — 같은 실행이 running · stopping → 종결로 바뀐 응답만', () => {
    const done = completedFlow();
    expect(justEndedRunId(snap(flowRun()), snap(done), 'flow')).toBe(FLOW_ID);
    expect(justEndedRunId(snap(flowRun({ status: 'stopping' })), snap(done), 'flow')).toBe(FLOW_ID);
    // 처음 받은 응답이 이미 종결 · 종결 → 종결 · 다른 실행 · 실행 사라짐은 아님
    expect(justEndedRunId(undefined, snap(done), 'flow')).toBeNull();
    expect(justEndedRunId(snap(done), snap(done), 'flow')).toBeNull();
    expect(justEndedRunId(snap(flowRun({ runId: 'old' })), snap(done), 'flow')).toBeNull();
    expect(justEndedRunId(snap(flowRun()), snap(null), 'flow')).toBeNull();
  });

  it('띠와 머리 글자는 같은 실행을 동시에 말하지 않는다', () => {
    const done = completedFlow();
    expect(stripShowsRun(flowRun(), null)).toBe(true);
    expect(stripShowsRun(done, FLOW_ID)).toBe(true);
    expect(stripShowsRun(done, null)).toBe(false);
    expect(stripShowsRun(null, FLOW_ID)).toBe(false);
    expect(headerLastRun(done, null)).toBe(done);
    expect(headerLastRun(done, FLOW_ID)).toBeNull();
    expect(headerLastRun(flowRun(), null)).toBeNull();
    for (const [run, id] of [
      [flowRun(), null],
      [done, FLOW_ID],
      [done, null],
    ] as const)
      expect(stripShowsRun(run, id) && headerLastRun(run, id) !== null).toBe(false);
  });

  it('머리 글자 — 완료는 "완료"(보낸 시간은 범위에 있다) · 중단 · 실패는 상태 낱말', () => {
    const flowDone = flowRun({ status: 'completed', endedAt: '2026-09-28T01:31:05.000Z', elapsedMs: 65_000 });
    expect(lastRunText(flowDone)).toBe('지난번 초당 10,000개 · 60s · 완료');
    expect(lastRunText(flowRun({ status: 'stopped', endedAt: '2026-09-28T01:30:50.000Z' }))).toBe(
      '지난번 초당 10,000개 · 60s · 중단됨',
    );
    expect(lastRunText(flowRun({ status: 'failed', endedAt: '2026-09-28T01:30:17.400Z' }))).toBe(
      '지난번 초당 10,000개 · 60s · 실패',
    );
    // 범위를 모르면 머리 낱말로
    expect(lastRunText({ ...completedFlow(), params: {} })).toBe('지난번 보내 보기 · 완료');
    expect(lastRunTip(flowDone)).toContain('완료 — 걸린 시간 1m 5.0s');
  });
});

describe('지금 단계 쉬운 문장 · 지난 실행 범위', () => {
  it('준비 · 다 끝났는데 아직 진행 중이면 정리 · 종결이면 없음', () => {
    expect(stepPlainText(flowRun({ steps: [step('prepare', 'running')] }))).toBe('준비 중');
    expect(stepPlainText(flowRun({ steps: [step('publish', 'done'), step('drain', 'done')] }))).toBe(
      '정리 중',
    );
    expect(stepPlainText(completedFlow())).toBeNull();
  });
  it('flow — 보내는 중 · 기다리는 중', () => {
    expect(stepPlainText(flowRun())).toBe('보내는 중');
    expect(stepPlainText(flowRun({ steps: [step('publish', 'done'), step('drain', 'running')] }))).toBe(
      '남은 데이터 처리 기다리는 중(최대 30s)',
    );
  });
  it('지난 실행 범위 — flow "초당 N개 · N초" · 매개변수가 없으면 null', () => {
    expect(runScopeText({ type: 'flow', params: { pps: 10_000, durationSec: 60, bizPerSec: 1 } })).toBe(
      '초당 10,000개 · 60s',
    );
    expect(runScopeText({ type: 'flow', params: { pps: 1_000 } })).toBeNull();
  });
});

// ── 버튼 활성 조건 ──

describe('버튼 상태 — 시작 · 중단 · 매개변수', () => {
  const base = { type: 'flow' as const, starting: false, stopRequested: false };
  it('current를 받기 전에는 시작을 켜지 않는다 · 매개변수 잠금', () => {
    const c = runControls({ ...base, snapshot: undefined });
    expect(c.start.enabled).toBe(false);
    expect(c.stop.enabled).toBe(false);
    expect(c.paramsLocked).toBe(true);
  });
  it('실행 없음 · 종결 — 시작만 켜진다', () => {
    for (const s of [snap(null), snap(completedFlow())]) {
      const c = runControls({ ...base, snapshot: s });
      expect(c.start).toMatchObject({ enabled: true, label: '시작', other: null });
      expect(c.stop.enabled).toBe(false);
      expect(c.paramsLocked).toBe(false);
    }
  });
  it('같은 종류 running — 시작 비활성 · 중단만 켜진다 · 그 실행의 params로 잠금', () => {
    const c = runControls({ ...base, snapshot: snap(flowRun()) });
    expect(c.start.enabled).toBe(false);
    expect(c.start.other).toBeNull();
    expect(c.start.note).toBeNull();
    expect(c.stop).toEqual({ enabled: true, label: '중단' });
    expect(c.lockedParams).toEqual({ pps: 10000, durationSec: 60, bizPerSec: 1 });
  });
  it('시작 요청 중 — "시작하는 중이에요…" 비활성(두 번 눌러 409를 부르지 않는다)', () => {
    const c = runControls({ ...base, snapshot: snap(null), starting: true });
    expect(c.start).toMatchObject({ enabled: false, label: '시작하는 중이에요…' });
  });
  it('중단 — 누른 직후 응답 전부터 "멈추는 중이에요…" · stopping이면 비활성', () => {
    expect(runControls({ ...base, snapshot: snap(flowRun()), stopRequested: true }).stop).toEqual({
      enabled: false,
      label: '멈추는 중이에요…',
    });
    expect(runControls({ ...base, snapshot: snap(flowRun({ status: 'stopping' })) }).stop).toEqual({
      enabled: false,
      label: '멈추는 중이에요…',
    });
  });
});

// ── 폴링 ──

describe('폴링 — running · stopping 동안 1초 · 종결되면 멈춘다', () => {
  it('간격 판정', () => {
    expect(runPollInterval(undefined, false)).toBe(false);
    expect(runPollInterval(snap(null), false)).toBe(false);
    expect(runPollInterval(snap(flowRun()), false)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(flowRun({ status: 'stopping' })), false)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(completedFlow()), false)).toBe(false);
    // 폴링 실패 — 마지막 실행 상태와 무관하게 1초 재시도(지금 상태를 모른다 · 08_screen/08 폴링 실패 행)
    expect(runPollInterval(snap(flowRun()), true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(undefined, true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(completedFlow()), true)).toBe(RUN_POLL_MS);
  });

  // Node에는 window가 없어 TanStack이 서버로 보고 간격 타이머를 걸지 않는다 — 이 묶음만 브라우저로 본다
  beforeEach(() => {
    environmentManager.setIsServer(() => false);
  });
  afterEach(() => {
    vi.useRealTimers();
    environmentManager.setIsServer(() => typeof window === 'undefined');
  });

  it('쿼리 관찰자 — running 두 번 뒤 completed를 받으면 더 부르지 않는다', async () => {
    vi.useFakeTimers();
    const { f, calls } = fakeFetch({
      'GET /bff/runs/current': [
        () => json(200, { run: flowRun() }),
        () => json(200, { run: flowRun({ elapsedMs: 43_570 }) }),
        () => json(200, { run: completedFlow() }),
        () => json(200, { run: completedFlow() }),
      ],
    });
    const client = new QueryClient();
    const obs = new QueryObserver(client, currentRunQueryOptions(f));
    const off = obs.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS);
    expect(calls).toHaveLength(3);
    expect(client.getQueryData<RunSnapshot>(runKeys.current)?.run?.status).toBe('completed');
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS * 5);
    expect(calls).toHaveLength(3);
    off();
  });

  it('종결 뒤 시작 202를 캐시에 넣으면 폴링이 다시 돈다', async () => {
    vi.useFakeTimers();
    const { f, calls } = fakeFetch({
      'GET /bff/runs/current': [() => json(200, { run: null }), () => json(200, { run: flowRun() })],
    });
    const client = new QueryClient();
    const obs = new QueryObserver(client, currentRunQueryOptions(f));
    const off = obs.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS * 3);
    expect(calls).toHaveLength(1);
    client.setQueryData<RunSnapshot>(runKeys.current, snap(flowRun()));
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS);
    expect(calls).toHaveLength(2);
    off();
  });

  it('화면을 떠나면(구독 해제) 폴링을 멈춘다 — 중단 요청을 보내지 않는다', async () => {
    vi.useFakeTimers();
    const { f, calls } = fakeFetch({
      'GET /bff/runs/current': Array.from({ length: 10 }, () => () => json(200, { run: flowRun() })),
    });
    const client = new QueryClient();
    const obs = new QueryObserver(client, currentRunQueryOptions(f));
    const off = obs.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS);
    const n = calls.length;
    off();
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS * 5);
    expect(calls).toHaveLength(n);
    expect(calls.every((c) => c === 'GET /bff/runs/current')).toBe(true);
  });

  it('진행 중이던 실행이 current null이 되면 "기록 없음"(api 재기동)', () => {
    expect(vanished(snap(flowRun()), snap(null))).toBe(true);
    expect(vanished(snap(completedFlow()), snap(null))).toBe(false);
    expect(vanished(undefined, snap(null))).toBe(false);
    expect(panelReducer(PANEL_IDLE, { kind: 'vanished' }).notice?.text).toBe(VANISHED_TEXT);
  });
});

// ── 시작 · 중단 요청 ──

const FLOW_PARAMS = { pps: 10000, durationSec: 60, bizPerSec: 1 };

describe('시작 · 중단 요청 — 409 동기화 · 요청 실패 복귀', () => {
  it('202 — 실행 객체', async () => {
    const { f, calls } = fakeFetch({ 'POST /bff/runs': [() => json(202, flowRun())] });
    const o = await requestStart('flow', FLOW_PARAMS, f);
    expect(o).toMatchObject({ kind: 'started', run: { runId: FLOW_ID } });
    expect(calls).toEqual(['POST /bff/runs']);
    expect(JSON.parse(String(f.mock.calls[0]?.[1]?.body))).toEqual({ type: 'flow', params: FLOW_PARAMS });
  });

  it('409 datagen.run_in_progress — details.runId로 단건 1회 조회해 패널을 맞춘다 · 자동 재시도 없음', async () => {
    const { f, calls } = fakeFetch({
      'POST /bff/runs': [
        () =>
          json(409, {
            error: {
              code: 'datagen.run_in_progress',
              message: '진행 중',
              details: { runId: FLOW_ID, type: 'flow' },
            },
          }),
      ],
      [`GET /bff/runs/${FLOW_ID}`]: [() => json(200, flowRun())],
    });
    const o = await requestStart('flow', FLOW_PARAMS, f);
    expect(o).toMatchObject({ kind: 'conflict', type: 'flow', run: { runId: FLOW_ID } });
    expect(calls).toEqual(['POST /bff/runs', `GET /bff/runs/${FLOW_ID}`]);
    const s = panelReducer(
      { ...PANEL_IDLE, starting: true },
      { kind: 'start-done', outcome: o, self: 'flow' },
    );
    expect(s.starting).toBe(false);
    // 같은 종류 409 — 자기 화면을 "그 화면에서 보기"로 가리키지 않는다
    expect(s.notice).toEqual({ tone: 'info', conflict: true, text: SAME_RUN_TEXT });
  });

  it('409 뒤 단건 404 — run null(current 재조회로 맞춘다) · 모르는 종류는 null', async () => {
    const conflict = (type: unknown) => () =>
      json(409, {
        error: { code: 'datagen.run_in_progress', message: '진행 중', details: { runId: FLOW_ID, type } },
      });
    const gone = () => json(404, { error: { code: 'common.not_found', message: '없다' } });
    const { f } = fakeFetch({
      'POST /bff/runs': [conflict('flow'), conflict('unknown')],
      [`GET /bff/runs/${FLOW_ID}`]: [gone, gone],
    });
    expect(await requestStart('flow', FLOW_PARAMS, f)).toEqual({ kind: 'conflict', type: 'flow', run: null });
    // 계약에 없는 종류(지운 옛 실행 등)는 종류를 모르는 것으로 본다
    const o = await requestStart('flow', FLOW_PARAMS, f);
    expect(o).toEqual({ kind: 'conflict', type: null, run: null });
    // 종류를 모르면 앞 절만
    const u = panelReducer(PANEL_IDLE, { kind: 'start-done', outcome: o, self: 'flow' });
    expect(u.notice?.text).toBe('다른 측정이 이미 돌고 있어요');
  });

  it('400 — 매개변수 옆 문구(버튼은 되돌린다)', async () => {
    const { f } = fakeFetch({
      'POST /bff/runs': [
        () => json(400, { error: { code: 'common.validation_failed', message: '허용값 밖' } }),
      ],
    });
    const o = await requestStart('flow', { pps: 7 }, f);
    expect(o.kind).toBe('invalid');
    const s = panelReducer(
      { ...PANEL_IDLE, starting: true },
      { kind: 'start-done', outcome: o, self: 'flow' },
    );
    expect(s.starting).toBe(false);
    expect(s.paramError).toBe('고른 값을 서버가 받지 않았어요 — 화면을 새로고침해 주세요');
  });

  it('시작 요청 실패(네트워크 · 5xx · 403) — "시작하는 중이에요…" 해제 · 띠', async () => {
    const net = fakeFetch({
      'POST /bff/runs': [
        () => {
          throw new TypeError('network');
        },
      ],
    });
    const o = await requestStart('flow', {}, net.f);
    expect(o).toMatchObject({ kind: 'failed', error: { status: 0 } });
    let s = panelReducer(PANEL_IDLE, { kind: 'start-request' });
    expect(
      runControls({ type: 'flow', snapshot: snap(null), starting: s.starting, stopRequested: false }).start
        .label,
    ).toBe('시작하는 중이에요…');
    s = panelReducer(s, { kind: 'start-done', outcome: o, self: 'flow' });
    expect(s.starting).toBe(false);
    expect(s.notice?.text).toBe('요청이 실패했어요 — 다시 눌러 주세요');
    expect(
      runControls({ type: 'flow', snapshot: snap(null), starting: s.starting, stopRequested: false }).start,
    ).toMatchObject({ enabled: true, label: '시작' });

    const bad = fakeFetch({ 'POST /bff/runs': [() => new Response('oops', { status: 502 })] });
    expect(await requestStart('flow', {}, bad.f)).toMatchObject({ kind: 'failed', error: { status: 502 } });

    const forbidden = fakeFetch({
      'POST /bff/runs': [() => json(403, { error: { message: '막힘' } })],
    });
    const fo = await requestStart('flow', {}, forbidden.f);
    expect(panelReducer(PANEL_IDLE, { kind: 'start-done', outcome: fo, self: 'flow' }).notice?.text).toBe(
      '요청이 실패했어요 — 다시 눌러 주세요',
    );
  });

  it('중단 202(stopping) · 200(이미 종결 — 멱등) · 404(사라짐) · 실패 복귀', async () => {
    const ok = fakeFetch({
      [`POST /bff/runs/${FLOW_ID}/stop`]: [() => json(202, flowRun({ status: 'stopping' }))],
    });
    const o202 = await requestStop(FLOW_ID, ok.f);
    expect(o202).toMatchObject({ kind: 'stopped', run: { status: 'stopping' } });
    // 상태를 바꾸는 POST는 JSON 본문 필수 — 중단은 빈 객체
    const stopInit = ok.f.mock.calls[0]?.[1];
    expect(stopInit?.body).toBe('{}');
    expect(new Headers(stopInit?.headers).get('content-type')).toBe('application/json');

    const done = fakeFetch({ [`POST /bff/runs/${FLOW_ID}/stop`]: [() => json(200, completedFlow())] });
    const o200 = await requestStop(FLOW_ID, done.f);
    expect(o200).toMatchObject({ kind: 'stopped', run: { status: 'completed' } });
    expect(runBand((o200 as { run: RunObjectBody }).run)?.text).toContain('완료 — ');

    const gone = fakeFetch({
      [`POST /bff/runs/${FLOW_ID}/stop`]: [
        () => json(404, { error: { code: 'common.not_found', message: '없다' } }),
      ],
    });
    const o404 = await requestStop(FLOW_ID, gone.f);
    expect(o404).toEqual({ kind: 'gone' });
    expect(
      panelReducer({ ...PANEL_IDLE, stopRequested: true }, { kind: 'stop-done', outcome: o404 }),
    ).toMatchObject({
      stopRequested: false,
      notice: { text: VANISHED_TEXT },
    });

    const net = fakeFetch({
      [`POST /bff/runs/${FLOW_ID}/stop`]: [
        () => {
          throw new TypeError('network');
        },
      ],
    });
    const of = await requestStop(FLOW_ID, net.f);
    const s = panelReducer(panelReducer(PANEL_IDLE, { kind: 'stop-request' }), {
      kind: 'stop-done',
      outcome: of,
    });
    expect(s.stopRequested).toBe(false);
    expect(s.notice?.text).toBe('요청이 실패했어요 — 다시 눌러 주세요');
    // 버튼이 요청 전 상태("중단")로 돌아온다
    expect(
      runControls({
        type: 'flow',
        snapshot: snap(flowRun()),
        starting: false,
        stopRequested: s.stopRequested,
      }).stop,
    ).toEqual({ enabled: true, label: '중단' });
  });

  it('형식이 계약과 다른 응답은 조회 실패로 본다', async () => {
    const { f } = fakeFetch({ 'GET /bff/runs/current': [() => json(200, { run: { runId: 'x' } })] });
    const client = new QueryClient();
    await expect(client.fetchQuery(currentRunQueryOptions(f))).rejects.toBeInstanceOf(ApiError);
  });
});

// ── 조작부 · 진행 띠 그리기(배치 — 머리 버튼 · 칩 · 팝오버 / 진행 띠 · 중단 · 띠 문구) ──

const FLOW_INTRO =
  '센서 데이터 · 업무 요청 · 조회 요청을 정한 양만큼 보내 봐요 — 결과는 흐름도가 바로 보여 줘요';

describe('머리 조작부 — 버튼 · 상태 칩 · 팝오버(08_screen/08 §실행 패널 배치 · 버튼 상태)', () => {
  const render = (over: Partial<RunControlViewProps>) =>
    renderToStaticMarkup(
      createElement(RunControlView, {
        type: 'flow',
        params: FLOW_PARAM_DEFS,
        snapshot: snap(null),
        pollFailed: false,
        local: PANEL_IDLE,
        chosen: defaultParams(FLOW_PARAM_DEFS),
        buttonLabel: '직접 보내 보기',
        intro: FLOW_INTRO,
        onChoose: () => {},
        onStart: () => undefined,
        defaultOpen: true,
        ...over,
      }),
    );

  it('로딩 — "▶ 직접 보내 보기" 비활성 · 팝오버를 열지 않는다 · 칩 자리만 · aria-expanded 없음', () => {
    const html = render({ snapshot: undefined });
    expect(html).toContain('data-testid="run-control-flow"');
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>직접 보내 보기<\/button>/,
    );
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain('data-testid="run-status-pending"');
    expect(html).not.toContain('data-testid="run-status"');
    expect(html).not.toContain('aria-expanded');
  });

  it('실행 없음 — 칩 없음 · 팝오버 안에 쉬운 설명 · 매개변수 쉬운 말 · 아직 안 보내 봄 문구 · 시작 활성', () => {
    const html = render({});
    expect(html).not.toContain('data-testid="run-status"');
    expect(html).toContain(FLOW_INTRO);
    for (const t of ['센서 데이터(초당)', '보내는 시간', '업무 요청(초당)', '조회 요청(초당)'])
      expect(html).toContain(`>${t}<`);
    for (const t of ['10,000', '60s', '1/s', '안 보냄']) expect(html).toContain(t);
    expect(html).toContain('아직 보내 보지 않았어요(서버가 다시 켜지면 지난 결과는 사라져요)');
    expect(html).not.toContain('run-large-warning');
    expect(html).toMatch(
      /<button type="button" class="[^"]*"><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>시작<\/button>/,
    );
  });

  it('진행 중 — 칩 "실행 중" · 시작 비활성 · 중단은 머리에 없다(진행 띠 오른쪽)', () => {
    const html = render({ snapshot: snap(flowRun()) });
    expect(html).toContain('실행 중');
    // 칩 점 · 로딩 자리의 깜빡임은 움직임 줄이기 설정이면 멈춘다(R7)
    expect(html).toContain('motion-safe:animate-pulse');
    expect(html).not.toMatch(/(?<![\w:])animate-pulse/);
    expect(render({ snapshot: undefined })).toContain('motion-safe:animate-pulse');
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>시작<\/button>/,
    );
    expect(html).not.toContain('중단');
  });

  it('완료 — 종결 뒤에는 칩을 숨긴다(띠가 같은 말을 한다)', () => {
    const html = render({ snapshot: snap(completedFlow()), recentEndId: FLOW_ID });
    expect(html).not.toContain('data-testid="run-status"');
    expect(html).not.toContain('bg-emerald-100');
    // 방금 끝나 띠가 결말을 그리는 동안은 머리 "지난번" 글자를 쓰지 않는다(같은 말 두 곳 금지)
    expect(html).not.toContain('data-testid="run-last"');
    // 멈추는 중(stopping)은 아직 진행 중이라 칩이 남는다
    expect(render({ snapshot: snap(flowRun({ status: 'stopping' })) })).toContain('>멈추는 중<');
  });

  it('지난 실행(띠가 접힌 뒤 · 이미 끝난 실행을 열었을 때) — 머리 버튼 왼쪽 작은 글자 "지난번 …" · 상세는 툴팁 · 키보드 · 낭독기로도 닿는다(R12)', () => {
    const html = render({ snapshot: snap(completedFlow()), recentEndId: null, defaultOpen: false });
    expect(html).toMatch(
      /data-testid="run-last" title="[^"]*" tabindex="0" aria-describedby="[^"]+" class="[^"]*text-xs tabular-nums text-slate-500">지난번 초당 10,000개 · 60s · 완료<\/span><span id="[^"]+" class="sr-only">[^<]*<\/span><button/,
    );
    const tip = /data-testid="run-last" title="([^"]*)"/.exec(html)?.[1] ?? '';
    const lines = [
      '지난번 보내 보기',
      '완료 — 걸린 시간 3m 12.4s',
      '종료 10:23:17 KST',
      '시작 10:20:05 KST',
      'prepare done 0.4s',
      'publish done 0.4s',
      'drain done 0.4s',
      '보낸 포인트 600,000 · 엔트리 3,000 · 명령 60 · 조회 0 · 백프레셔 정지 0',
      '내 측정(참고용) — 라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님',
    ];
    expect(tip.split('\n')).toEqual(lines);
    // 툴팁과 같은 상세를 sr-only 설명으로 — aria-describedby가 그 id를 가리킨다(키보드 초점 · 낭독기)
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(html).toContain(`<span id="${described}" class="sr-only">${lines.join(' · ')}</span>`);
    // 실패는 빨간 글자 · 진행 중 · 실행 없음이면 글자 없음
    const failed = render({
      snapshot: snap(
        flowRun({
          status: 'failed',
          startedAt: EARLY_START,
          endedAt: '2026-09-28T01:20:17.400Z',
          elapsedMs: 12_400,
        }),
      ),
      defaultOpen: false,
    });
    expect(failed).toMatch(/class="[^"]*text-red-700">지난번 초당 10,000개 · 60s · 실패</);
    for (const r of [flowRun(), null])
      expect(render({ snapshot: snap(r), defaultOpen: false })).not.toContain('data-testid="run-last"');
  });
});

describe('진행 띠 한 줄 — 상태 · 지금 단계 쉬운 문장 · 진행 막대 · 경과 · 중단 · 종결 띠 · 띠 문구', () => {
  const render = (over: Partial<RunProgressViewProps>) =>
    renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'flow',
        snapshot: snap(null),
        pollFailed: false,
        local: PANEL_IDLE,
        now: 1_000,
        onStop: () => {},
        ...over,
      }),
    );

  it('실행 없음 · 띠 문구 없음 — 띠 자체가 없다', () => {
    expect(render({})).toBe('');
    expect(render({ snapshot: undefined })).toBe('');
  });

  it('진행 중 — 실행 중 · 쉬운 단계 문장(flow는 단계 n/m 대신 진행 막대) · 경과 틱 · 오른쪽 중단 활성 · 서랍 연결 없음', () => {
    const html = render({ snapshot: snap(flowRun(), 1_000), now: 3_900 });
    expect(html).toContain('실행 중');
    expect(html).toContain('<span data-testid="run-stage" class="text-slate-800">보내는 중</span>');
    expect(html).not.toContain('단계 ');
    // 단계 key · 시작 시각은 띠 툴팁에만(보이는 글자에는 없다)
    const visible = html.replace(/\stitle="[^"]*"/g, '');
    expect(visible).not.toContain('publish');
    expect(visible).not.toContain('KST');
    expect(html).toMatch(/title="시작 10:30:00 KST\nprepare done[^"]*publish running/);
    expect(html).toContain('경과 <span data-testid="run-elapsed">45s</span>'); // 42,570 + 2,900
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('44s / 60s'); // publish 42,000 + 2,900
    expect(html).not.toContain('aria-expanded');
    expect(html).toMatch(
      /<button type="button" class="ml-auto[^"]*"><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>중단<\/button>/,
    );
    // 이 줄은 overflow-hidden(한 줄 높이) — 중단 버튼 포커스 링은 안쪽으로 그려 잘리지 않게(R6)
    expect(html).toMatch(/<button type="button" class="ml-auto[^"]*focus-visible:-outline-offset-2[^"]*">/);
    // 움직임 줄이기 설정이면 깜빡임을 멈춘다(R7)
    expect(html).toContain('motion-safe:animate-pulse');
    expect(html).not.toMatch(/(?<![\w:])animate-pulse/);
  });

  it('중단을 눌렀다 — "멈추는 중이에요…" 비활성', () => {
    const html = render({ snapshot: snap(flowRun()), local: { ...PANEL_IDLE, stopRequested: true } });
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>멈추는 중이에요…<\/button>/,
    );
  });

  it('완료 직후(이 화면에서 지켜보던 실행 · 30초) — "지난번 보내 보기" · 완료 띠 · 무엇을 보냈나 · 라이브 표지 · 단계 문장 · 중단 버튼 없음', () => {
    const html = render({ snapshot: snap(completedFlow()), recentEndId: FLOW_ID });
    expect(html).toContain('지난번 보내 보기');
    expect(html).toContain('완료 — 걸린 시간 3m 12.4s');
    expect(html).toContain('title="종료 10:23:17 KST"');
    expect(html).toContain('<span data-testid="run-scope">초당 10,000개 · 60s</span>');
    expect(html).toMatch(
      /data-testid="run-live-mark" title="라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님"[^>]*>내 측정\(참고용\)</,
    );
    expect(html).not.toContain('data-testid="run-stage"');
    expect(html).not.toContain('중단</button>');
  });

  it('30초가 지났거나 이미 끝난 실행을 열었다 — 띠 자체가 없다(셸 머리 "지난번" 글자가 같은 말을 한다)', () => {
    expect(render({ snapshot: snap(completedFlow()) })).toBe('');
    expect(render({ snapshot: snap(completedFlow()), recentEndId: 'other-run' })).toBe('');
    // 띠 문구(요청 사건)는 실행 줄과 따로 남는다
    expect(
      render({
        snapshot: snap(completedFlow()),
        local: { ...PANEL_IDLE, notice: { tone: 'neutral', text: VANISHED_TEXT } },
      }),
    ).not.toContain('data-testid="run-band"');
  });

  it('요청 사건 · 폴링 실패 문구는 띠에 · 409 띠도 띠에', () => {
    expect(render({ local: { ...PANEL_IDLE, notice: { tone: 'neutral', text: VANISHED_TEXT } } })).toContain(
      VANISHED_TEXT,
    );
    expect(
      render({ local: { ...PANEL_IDLE, notice: { tone: 'info', conflict: true, text: SAME_RUN_TEXT } } }),
    ).toContain(SAME_RUN_TEXT);
    const html = render({ snapshot: snap(flowRun()), pollFailed: true });
    expect(html).toContain('opacity-70');
    expect(html).toContain('상태를 못 읽었어요 — 다시 읽는 중이에요');
  });
});

// ── 종류별 조각 ──

describe('flow 진행 막대', () => {
  it('publish 경과 ÷ durationSec · 틱 · 넘으면 100%', () => {
    const p = flowProgress(flowRun(), 1_000, 1_000);
    expect(p).toMatchObject({
      ratio: 0.7,
      elapsedSec: 42,
      durationSec: 60,
      draining: false,
      pointsSent: 420000,
    });
    expect(flowProgress(flowRun(), 1_000, 100_000)?.ratio).toBe(1);
  });
  it('드레인 중이면 막대를 채운 채 쉬운 문장', () => {
    const r = flowRun({
      steps: [
        step('prepare', 'done'),
        step('publish', 'done', { elapsedMs: 60_000, detail: { pointsSent: 600000 } }),
        step('drain', 'running'),
      ],
    });
    const html = renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'flow',
        snapshot: snap(r, 0),
        pollFailed: false,
        local: PANEL_IDLE,
        now: 0,
        onStop: () => {},
      }),
    );
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-label="보내는 중"');
    expect(html).toContain('남은 데이터 처리 기다리는 중(최대 30s)');
    expect(html).toContain('60s / 60s');
  });
  it('멈추는 중 + 드레인 — 단계 문장 · 진행 막대를 빼서 한 줄 폭 안에(띠 문장이 지금 일을 말한다)', () => {
    const r = flowRun({
      status: 'stopping',
      steps: [
        step('prepare', 'done'),
        step('publish', 'done', { elapsedMs: 60_000, detail: { pointsSent: 600000 } }),
        step('drain', 'running'),
      ],
    });
    const html = renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'flow',
        snapshot: snap(r, 0),
        pollFailed: false,
        local: { ...PANEL_IDLE, stopRequested: true },
        now: 0,
        onStop: () => {},
      }),
    );
    expect(html).toContain('멈추는 중이에요… — 하던 단계를 멈추고 정리하고 있어요');
    expect(html).not.toContain('data-testid="run-stage"');
    expect(html).not.toContain('role="progressbar"');
    expect(html).toContain('data-testid="run-elapsed"');
    // 보이는 글자 — 약 1,128px 한 줄 안(12px 글자 · 대략 글자당 12px로 어림해도 90자 아래)
    const visible = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(visible.length).toBeLessThan(90);
  });
});

describe('종결 띠 — 오류 전문은 툴팁 · 띠는 한 줄로 자른다', () => {
  it('실패 띠에 truncate · title에 전문', () => {
    const long = '저장소 불가 '.repeat(30).trim();
    const html = renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'flow',
        snapshot: snap(
          flowRun({
            status: 'failed',
            startedAt: EARLY_START,
            endedAt: '2026-09-28T01:20:17.400Z',
            elapsedMs: 12_400,
            error: { code: 'timeseries.clickhouse_unavailable', message: long },
          }),
        ),
        pollFailed: false,
        local: PANEL_IDLE,
        now: 0,
        recentEndId: FLOW_ID,
        onStop: () => {},
      }),
    );
    expect(html).toMatch(new RegExp(`data-testid="run-band" role="status" title="실패 원인 — ${long}\n`));
    expect(html).toMatch(/data-testid="run-band"[^>]*class="[^"]*truncate/);
  });
});

// ── BFF ──

describe('BFF /bff/runs — 허용 경로 4 · no-store · 상태 · 본문 그대로', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const ctx = (path?: string[]) => ({ params: Promise.resolve({ path }) });

  it('시작 · 현재 · 단건 · 중단을 api /api/v1/runs로 중계한다', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        seen.push(`${init?.method} ${url} ${init?.cache} ${init?.body ?? ''}`);
        return json(409, { error: { code: 'datagen.run_in_progress', message: 'x' } });
      }),
    );
    const json1 = { 'content-type': 'application/json' };
    const post = await bffRuns.POST(
      new Request('http://w/bff/runs', { method: 'POST', headers: json1, body: '{"type":"flow"}' }),
      ctx(undefined),
    );
    expect(post.status).toBe(409);
    expect(post.headers.get('cache-control')).toBe('no-store');
    expect(await post.json()).toMatchObject({ error: { code: 'datagen.run_in_progress' } });
    await bffRuns.GET(new Request('http://w/bff/runs/current'), ctx(['current']));
    await bffRuns.GET(new Request(`http://w/bff/runs/${FLOW_ID}`), ctx([FLOW_ID]));
    await bffRuns.POST(
      new Request(`http://w/bff/runs/${FLOW_ID}/stop`, { method: 'POST', headers: json1, body: '{}' }),
      ctx([FLOW_ID, 'stop']),
    );
    expect(seen).toEqual([
      'POST http://127.0.0.1:13000/api/v1/runs no-store {"type":"flow"}',
      'GET http://127.0.0.1:13000/api/v1/runs/current no-store ',
      `GET http://127.0.0.1:13000/api/v1/runs/${FLOW_ID} no-store `,
      `POST http://127.0.0.1:13000/api/v1/runs/${FLOW_ID}/stop no-store {}`,
    ]);
  });

  it('POST는 Content-Type을 그대로 넘기고 · 다른 출처면 api에 닿기 전에 403(본문 없음)', async () => {
    const types: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        types.push(new Headers(init?.headers).get('content-type'));
        return json(202, {});
      }),
    );
    await bffRuns.POST(
      new Request('http://w/bff/runs', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      }),
      ctx(undefined),
    );
    expect(types).toEqual(['text/plain']);
    const cross = await bffRuns.POST(
      new Request(`http://w/bff/runs/${FLOW_ID}/stop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: '{}',
      }),
      ctx([FLOW_ID, 'stop']),
    );
    expect(cross.status).toBe(403);
    expect(await cross.text()).toBe('');
    expect(types).toHaveLength(1);
    // GET(읽기)은 출처를 보지 않는다
    await bffRuns.GET(
      new Request('http://w/bff/runs/current', { headers: { origin: 'https://evil.example' } }),
      ctx(['current']),
    );
    expect(types).toHaveLength(2);
  });

  it('허용 밖 경로는 404 · api에 닿지 못하면 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('down');
      }),
    );
    expect((await bffRuns.GET(new Request('http://w/bff/runs'), ctx(undefined))).status).toBe(404);
    expect(
      (
        await bffRuns.POST(
          new Request('http://w/bff/runs/current', { method: 'POST' }),
          ctx(['current', 'x']),
        )
      ).status,
    ).toBe(404);
    expect((await bffRuns.GET(new Request('http://w/bff/runs/current'), ctx(['current']))).status).toBe(502);
  });
});
