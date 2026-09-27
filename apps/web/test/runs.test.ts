// 라이브 실행 패널 — 08_screen/08 §실행 패널 — 두 화면 공통 규칙(버튼 상태 · 상태 칩과 종결 표시 · 경과 시간 · 갱신과 응답 처리)
// 표면(07_api/09 #2~#5)은 가짜 응답으로 대신한다 — api 쪽 구현과 무관하게 계약 모양만 본다.
import { environmentManager, QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bffRuns from '../app/bff/runs/[[...path]]/route';
import { curveOption } from '../components/experiments/perf/options';
import { LiveResultTable } from '../components/experiments/perf/panels';
import { FlowProgressBar, FlowResultTable } from '../components/runs/flow-run';
import { RunPanelView, type RunPanelViewProps } from '../components/runs/run-panel';
import { nextFailedAt, panelNow, tickOn } from '../components/runs/use-run';
import { ApiError } from '../lib/api';
import {
  currentRunQueryOptions,
  currentRunReadOptions,
  expectedDisk,
  flowProgress,
  formatElapsed,
  formatRunClock,
  largeRunWarning,
  liveElapsedMs,
  liveSeries,
  PANEL_IDLE,
  panelReducer,
  ROLE_TEXT,
  RUN_POLL_MS,
  type RunSnapshot,
  requestStart,
  requestStop,
  runBand,
  runControls,
  runElapsedText,
  runKeys,
  runPollInterval,
  stepDetailText,
  VANISHED_TEXT,
  vanished,
} from '../lib/runs';
import type { RunObjectBody } from '../lib/shared';

// ── 픽스처 — 07_api/09 §응답 예시 모양 ──

const PERF_ID = '7d3f0a52-1c2e-4b8e-9a61-3f5e2b9c4d10';
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

function perfRun(over: Partial<RunObjectBody> = {}): RunObjectBody {
  return {
    runId: PERF_ID,
    type: 'perf',
    status: 'running',
    params: { maxExponent: 6 },
    startedAt: '2026-09-28T01:20:05.000Z',
    endedAt: null,
    elapsedMs: 41_250,
    steps: [
      step('prepare', 'done', { detail: { objects: 2 } }),
      step('fill-ch@5', 'done', { detail: { rows: 100000, ms: 578, storageBytes: 1210000 } }),
      step('fill-pg@5', 'running', { elapsedMs: 30_230 }),
      step('query@5', 'pending'),
      step('cleanup', 'pending'),
    ],
    result: null,
    error: null,
    ...over,
  };
}

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

/** 종결 perf — 3분 12.4초(192,400 ms) · 종료 10:23:17 KST */
const completedPerf = () =>
  perfRun({
    status: 'completed',
    startedAt: '2026-09-28T01:20:05.000Z',
    endedAt: '2026-09-28T01:23:17.400Z',
    elapsedMs: 192_400,
    steps: [step('prepare', 'done'), step('cleanup', 'done')],
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
    expect(formatElapsed(0, false)).toBe('0초');
    expect(formatElapsed(42_999, false)).toBe('42초');
    expect(formatElapsed(102_000, false)).toBe('1분 42초');
    expect(formatElapsed(3_792_000, false)).toBe('1시간 3분 12초');
    expect(formatElapsed(3_600_000, false)).toBe('1시간 0분 0초');
  });
  it('종결(0.1초 단위 · 버림)', () => {
    expect(formatElapsed(192_400, true)).toBe('3분 12.4초');
    expect(formatElapsed(192_499, true)).toBe('3분 12.4초');
    expect(formatElapsed(12_400, true)).toBe('12.4초');
    expect(formatElapsed(65_000, true)).toBe('1분 5.0초');
    expect(formatElapsed(62_410, true)).toBe('1분 2.4초');
    expect(formatElapsed(3_792_400, true)).toBe('1시간 3분 12.4초');
  });
  it('음수는 0으로', () => {
    expect(formatElapsed(-5, true)).toBe('0.0초');
  });
  it('진행 중은 서버 elapsedMs + 받은 뒤 흐른 단조 시계 — startedAt을 빼지 않는다', () => {
    expect(liveElapsedMs(41_250, 1_000, 3_000)).toBe(43_250);
    // 틱이 응답보다 먼저 찍혔어도 뒤로 가지 않는다
    expect(liveElapsedMs(41_250, 1_000, 900)).toBe(41_250);
    expect(runElapsedText(perfRun(), 1_000, 61_000)).toBe('1분 41초');
  });
  it('종결은 endedAt − startedAt 고정(틱 무관)', () => {
    expect(runElapsedText(completedPerf(), 0, 999_999)).toBe('3분 12.4초');
  });
  it('시각은 KST 초까지', () => {
    expect(formatRunClock('2026-09-28T01:23:17.400Z')).toBe('10:23:17 KST');
  });
});

// ── 종결 띠 문구 ──

describe('경과 기준 시각 — 폴링 실패 중 멈춤(M1) · 다른 종류 틱 없음(L7)', () => {
  it('처음 실패한 순간에 고정 · 실패가 이어져도(errorUpdatedAt이 바뀌어도) 그대로 · 성공하면 지운다', () => {
    const snap = { run: perfRun(), receivedAt: 10_000 };
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
      41_250 + 2_300,
    );
    // 성공 — 새 응답 기준으로 다시 틱
    failedAt = nextFailedAt(failedAt, false, read);
    expect(failedAt).toBeNull();
    const fresh = { run: perfRun({ elapsedMs: 48_000 }), receivedAt: 17_300 };
    expect(panelNow(fresh, failedAt, 17_000)).toBe(17_300);
    expect(panelNow(fresh, failedAt, 18_300)).toBe(18_300);
  });

  it('1초 틱 — 이 화면 종류의 진행 중 실행만 · 폴링 실패 중이면 없다', () => {
    expect(tickOn(perfRun(), 'perf', false)).toBe(true);
    expect(tickOn(perfRun({ status: 'stopping' }), 'perf', false)).toBe(true);
    expect(tickOn(perfRun(), 'flow', false)).toBe(false);
    expect(tickOn(flowRun(), 'perf', false)).toBe(false);
    expect(tickOn(perfRun(), 'perf', true)).toBe(false);
    expect(tickOn(perfRun({ status: 'completed' }), 'perf', false)).toBe(false);
    expect(tickOn(null, 'perf', false)).toBe(false);
  });
});

describe('상태 칩과 종결 띠', () => {
  it('완료 — 총 소요 · 종료 KST', () => {
    expect(runBand(completedPerf())).toEqual({
      tone: 'success',
      text: '완료 — 총 소요 3분 12.4초 · 종료 10:23:17 KST',
    });
  });
  it('중단됨 — 소요 · 정리 실패 문구', () => {
    const r = perfRun({
      status: 'stopped',
      endedAt: '2026-09-28T01:21:10.000Z',
      startedAt: '2026-09-28T01:20:05.000Z',
      elapsedMs: 65_000,
    });
    expect(runBand(r)?.text).toBe('중단됨 — 소요 1분 5.0초 · 종료 10:21:10 KST');
    expect(runBand({ ...r, error: { code: null, message: 'DROP 실패' } })?.text).toBe(
      '중단됨 — 소요 1분 5.0초 · 종료 10:21:10 KST · 정리 실패 — DROP 실패',
    );
  });
  it('실패 — 메시지 · 코드 병기(null 허용) · 소요', () => {
    const r = perfRun({
      status: 'failed',
      endedAt: '2026-09-28T01:20:17.400Z',
      elapsedMs: 12_400,
      error: { code: 'timeseries.clickhouse_unavailable', message: '저장소 불가' },
    });
    expect(runBand(r)).toEqual({
      tone: 'danger',
      text: '실패 — 저장소 불가 (timeseries.clickhouse_unavailable) · 소요 12.4초 · 종료 10:20:17 KST',
    });
    expect(runBand({ ...r, error: { code: null, message: '디스크 부족' } })?.text).toBe(
      '실패 — 디스크 부족 · 소요 12.4초 · 종료 10:20:17 KST',
    );
  });
  it('running은 띠 없음 · stopping은 "중단 중…"', () => {
    expect(runBand(perfRun())).toBeNull();
    expect(runBand(perfRun({ status: 'stopping' }))?.text).toBe(
      '중단 중… — 진행 중 단계를 취소하고 정리 단계를 돈다',
    );
  });
});

// ── 버튼 활성 조건 ──

describe('버튼 상태 — 시작 · 중단 · 매개변수', () => {
  const base = { type: 'perf' as const, starting: false, stopRequested: false, canControl: true };
  it('current를 받기 전에는 시작을 켜지 않는다 · 매개변수 잠금', () => {
    const c = runControls({ ...base, snapshot: undefined });
    expect(c.start.enabled).toBe(false);
    expect(c.stop.enabled).toBe(false);
    expect(c.paramsLocked).toBe(true);
  });
  it('실행 없음 · 종결 — 시작만 켜진다', () => {
    for (const s of [snap(null), snap(completedPerf())]) {
      const c = runControls({ ...base, snapshot: s });
      expect(c.start).toMatchObject({ enabled: true, label: '시작', other: null });
      expect(c.stop.enabled).toBe(false);
      expect(c.paramsLocked).toBe(false);
    }
  });
  it('같은 종류 running — 시작 비활성 · 중단만 켜진다 · 그 실행의 params로 잠금', () => {
    const c = runControls({ ...base, snapshot: snap(perfRun()) });
    expect(c.start.enabled).toBe(false);
    expect(c.start.other).toBeNull();
    expect(c.stop).toEqual({ enabled: true, label: '중단' });
    expect(c.lockedParams).toEqual({ maxExponent: 6 });
  });
  it('다른 종류 진행 중 — 시작 비활성 · 그 화면 링크 · 중단 비활성', () => {
    const c = runControls({ ...base, snapshot: snap(flowRun()) });
    expect(c.start.enabled).toBe(false);
    expect(c.start.other).toEqual({ code: 'EXP-FLOW', href: '/experiments/flow' });
    expect(c.start.note).toBe('다른 실행 진행 중(EXP-FLOW) — 그 화면으로');
    expect(c.stop.enabled).toBe(false);
    expect(c.lockedParams).toBeNull();
    expect(c.paramsLocked).toBe(true);
    const f = runControls({ ...base, type: 'flow', snapshot: snap(perfRun()) });
    expect(f.start.note).toBe('다른 실행 진행 중(EXP-PERF) — 그 화면으로');
  });
  it('시작 요청 중 — "시작 요청 중…" 비활성(두 번 눌러 409를 부르지 않는다)', () => {
    const c = runControls({ ...base, snapshot: snap(null), starting: true });
    expect(c.start).toMatchObject({ enabled: false, label: '시작 요청 중…' });
  });
  it('중단 — 누른 직후 응답 전부터 "중단 중…" · stopping이면 비활성', () => {
    expect(runControls({ ...base, snapshot: snap(perfRun()), stopRequested: true }).stop).toEqual({
      enabled: false,
      label: '중단 중…',
    });
    expect(runControls({ ...base, snapshot: snap(perfRun({ status: 'stopping' })) }).stop).toEqual({
      enabled: false,
      label: '중단 중…',
    });
  });
  it('역할 없음(S7 뒤) — 두 버튼 비활성 · 문구', () => {
    const c = runControls({ ...base, snapshot: snap(perfRun()), canControl: false });
    expect(c.start.enabled).toBe(false);
    expect(c.stop.enabled).toBe(false);
    expect(c.start.note).toBe(ROLE_TEXT);
  });
});

// ── 폴링 ──

describe('폴링 — running · stopping 동안 1초 · 종결되면 멈춘다', () => {
  it('간격 판정', () => {
    expect(runPollInterval(undefined, false)).toBe(false);
    expect(runPollInterval(snap(null), false)).toBe(false);
    expect(runPollInterval(snap(perfRun()), false)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(perfRun({ status: 'stopping' })), false)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(completedPerf()), false)).toBe(false);
    // 폴링 실패 — 진행 중이던 실행이면 1초 재시도 계속 · 종결이던 실행은 멈춘다
    expect(runPollInterval(snap(perfRun()), true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(undefined, true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(completedPerf()), true)).toBe(false);
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
        () => json(200, { run: perfRun() }),
        () => json(200, { run: perfRun({ elapsedMs: 42_250 }) }),
        () => json(200, { run: completedPerf() }),
        () => json(200, { run: completedPerf() }),
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

  it('읽기 전용 구독이 함께 붙어도 요청은 초당 하나 — 폴링은 패널 관찰자 하나만', async () => {
    vi.useFakeTimers();
    const { f, calls } = fakeFetch({
      'GET /bff/runs/current': Array.from({ length: 20 }, () => () => json(200, { run: perfRun() })),
    });
    const client = new QueryClient();
    const panel = new QueryObserver(client, currentRunQueryOptions(f));
    const offPanel = panel.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS / 2);
    const reader = new QueryObserver(client, currentRunReadOptions(f));
    const offReader = reader.subscribe(() => {});
    const before = calls.length;
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS * 5);
    expect(calls.length - before).toBe(5);
    expect(reader.getCurrentResult().data?.run?.runId).toBe(PERF_ID);
    offReader();
    offPanel();
  });

  it('종결 뒤 시작 202를 캐시에 넣으면 폴링이 다시 돈다', async () => {
    vi.useFakeTimers();
    const { f, calls } = fakeFetch({
      'GET /bff/runs/current': [() => json(200, { run: null }), () => json(200, { run: perfRun() })],
    });
    const client = new QueryClient();
    const obs = new QueryObserver(client, currentRunQueryOptions(f));
    const off = obs.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS * 3);
    expect(calls).toHaveLength(1);
    client.setQueryData<RunSnapshot>(runKeys.current, snap(perfRun()));
    await vi.advanceTimersByTimeAsync(RUN_POLL_MS);
    expect(calls).toHaveLength(2);
    off();
  });

  it('화면을 떠나면(구독 해제) 폴링을 멈춘다 — 중단 요청을 보내지 않는다', async () => {
    vi.useFakeTimers();
    const { f, calls } = fakeFetch({
      'GET /bff/runs/current': Array.from({ length: 10 }, () => () => json(200, { run: perfRun() })),
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
    expect(vanished(snap(perfRun()), snap(null))).toBe(true);
    expect(vanished(snap(completedPerf()), snap(null))).toBe(false);
    expect(vanished(undefined, snap(null))).toBe(false);
    expect(panelReducer(PANEL_IDLE, { kind: 'vanished' }).notice?.text).toBe(VANISHED_TEXT);
  });
});

// ── 시작 · 중단 요청 ──

describe('시작 · 중단 요청 — 409 동기화 · 요청 실패 복귀', () => {
  it('202 — 실행 객체', async () => {
    const { f, calls } = fakeFetch({ 'POST /bff/runs': [() => json(202, perfRun())] });
    const o = await requestStart('perf', { maxExponent: 6 }, f);
    expect(o).toMatchObject({ kind: 'started', run: { runId: PERF_ID } });
    expect(calls).toEqual(['POST /bff/runs']);
    expect(JSON.parse(String(f.mock.calls[0]?.[1]?.body))).toEqual({
      type: 'perf',
      params: { maxExponent: 6 },
    });
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
    const o = await requestStart('perf', { maxExponent: 7 }, f);
    expect(o).toMatchObject({ kind: 'conflict', type: 'flow', run: { runId: FLOW_ID } });
    expect(calls).toEqual(['POST /bff/runs', `GET /bff/runs/${FLOW_ID}`]);
    const s = panelReducer({ ...PANEL_IDLE, starting: true }, { kind: 'start-done', outcome: o });
    expect(s.starting).toBe(false);
    expect(s.notice?.text).toBe('다른 실행이 먼저 시작됐다 — flow');
  });

  it('409 뒤 단건 404 — run null(current 재조회로 맞춘다)', async () => {
    const { f } = fakeFetch({
      'POST /bff/runs': [
        () =>
          json(409, {
            error: {
              code: 'datagen.run_in_progress',
              message: '진행 중',
              details: { runId: PERF_ID, type: 'perf' },
            },
          }),
      ],
      [`GET /bff/runs/${PERF_ID}`]: [
        () => json(404, { error: { code: 'common.not_found', message: '없다' } }),
      ],
    });
    expect(await requestStart('perf', { maxExponent: 7 }, f)).toEqual({
      kind: 'conflict',
      type: 'perf',
      run: null,
    });
  });

  it('400 — 매개변수 옆 문구(버튼은 되돌린다)', async () => {
    const { f } = fakeFetch({
      'POST /bff/runs': [
        () => json(400, { error: { code: 'common.validation_failed', message: '허용값 밖' } }),
      ],
    });
    const o = await requestStart('perf', { maxExponent: 9 }, f);
    expect(o.kind).toBe('invalid');
    const s = panelReducer({ ...PANEL_IDLE, starting: true }, { kind: 'start-done', outcome: o });
    expect(s.starting).toBe(false);
    expect(s.paramError).toContain('화면과 서버의 목록이 어긋났다');
  });

  it('시작 요청 실패(네트워크 · 5xx · 403) — "시작 요청 중…" 해제 · 띠', async () => {
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
      runControls({
        type: 'flow',
        snapshot: snap(null),
        starting: s.starting,
        stopRequested: false,
        canControl: true,
      }).start.label,
    ).toBe('시작 요청 중…');
    s = panelReducer(s, { kind: 'start-done', outcome: o });
    expect(s.starting).toBe(false);
    expect(s.notice?.text).toBe('요청 실패 — 다시 누른다');
    expect(
      runControls({
        type: 'flow',
        snapshot: snap(null),
        starting: s.starting,
        stopRequested: false,
        canControl: true,
      }).start,
    ).toMatchObject({ enabled: true, label: '시작' });

    const bad = fakeFetch({ 'POST /bff/runs': [() => new Response('oops', { status: 502 })] });
    expect(await requestStart('flow', {}, bad.f)).toMatchObject({ kind: 'failed', error: { status: 502 } });

    const forbidden = fakeFetch({
      'POST /bff/runs': [() => json(403, { error: { code: 'auth.forbidden', message: '권한 없음' } })],
    });
    const fo = await requestStart('flow', {}, forbidden.f);
    expect(panelReducer(PANEL_IDLE, { kind: 'start-done', outcome: fo }).notice?.text).toBe(ROLE_TEXT);
  });

  it('중단 202(stopping) · 200(이미 종결 — 멱등) · 404(사라짐) · 실패 복귀', async () => {
    const ok = fakeFetch({
      [`POST /bff/runs/${PERF_ID}/stop`]: [() => json(202, perfRun({ status: 'stopping' }))],
    });
    const o202 = await requestStop(PERF_ID, ok.f);
    expect(o202).toMatchObject({ kind: 'stopped', run: { status: 'stopping' } });

    const done = fakeFetch({ [`POST /bff/runs/${PERF_ID}/stop`]: [() => json(200, completedPerf())] });
    const o200 = await requestStop(PERF_ID, done.f);
    expect(o200).toMatchObject({ kind: 'stopped', run: { status: 'completed' } });
    expect(runBand((o200 as { run: RunObjectBody }).run)?.text).toContain('완료 — 총 소요');

    const gone = fakeFetch({
      [`POST /bff/runs/${PERF_ID}/stop`]: [
        () => json(404, { error: { code: 'common.not_found', message: '없다' } }),
      ],
    });
    const o404 = await requestStop(PERF_ID, gone.f);
    expect(o404).toEqual({ kind: 'gone' });
    expect(
      panelReducer({ ...PANEL_IDLE, stopRequested: true }, { kind: 'stop-done', outcome: o404 }),
    ).toMatchObject({
      stopRequested: false,
      notice: { text: VANISHED_TEXT },
    });

    const net = fakeFetch({
      [`POST /bff/runs/${PERF_ID}/stop`]: [
        () => {
          throw new TypeError('network');
        },
      ],
    });
    const of = await requestStop(PERF_ID, net.f);
    const s = panelReducer(panelReducer(PANEL_IDLE, { kind: 'stop-request' }), {
      kind: 'stop-done',
      outcome: of,
    });
    expect(s.stopRequested).toBe(false);
    expect(s.notice?.text).toBe('요청 실패 — 다시 누른다');
    // 버튼이 요청 전 상태("중단")로 돌아온다
    expect(
      runControls({
        type: 'perf',
        snapshot: snap(perfRun()),
        starting: false,
        stopRequested: s.stopRequested,
        canControl: true,
      }).stop,
    ).toEqual({ enabled: true, label: '중단' });
  });

  it('형식이 계약과 다른 응답은 조회 실패로 본다', async () => {
    const { f } = fakeFetch({ 'GET /bff/runs/current': [() => json(200, { run: { runId: 'x' } })] });
    const client = new QueryClient();
    await expect(client.fetchQuery(currentRunQueryOptions(f))).rejects.toBeInstanceOf(ApiError);
  });
});

// ── 패널 그리기 ──

describe('패널 — 역할 · 이름 · data-testid', () => {
  const render = (over: Partial<RunPanelViewProps>) =>
    renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(RunPanelView, {
          type: 'perf',
          snapshot: snap(null),
          pollFailed: false,
          local: PANEL_IDLE,
          now: 1_000,
          chosen: { maxExponent: 7 },
          onChoose: () => {},
          onStart: () => {},
          onStop: () => {},
          ...over,
        }),
      ),
    );

  it('로딩 — 시작 · 중단 비활성 · 상태 칩 자리만', () => {
    const html = render({ snapshot: undefined });
    expect(html).toContain('data-testid="run-panel-perf"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?시작<\/button>/);
    expect(html).toContain('data-testid="run-status"');
    expect(html).not.toContain('실행 없음');
  });

  it('실행 없음 — 칩 "실행 없음" · 빈 값 문구 · 시작 활성', () => {
    const html = render({});
    expect(html).toContain('>실행 없음<');
    expect(html).toContain('아직 실행하지 않았다(api를 재기동하면 지난 실행은 남지 않는다)');
    expect(html).toMatch(
      /<button type="button" class="[^"]*"><span aria-hidden="true">▶ <\/span>시작<\/button>/,
    );
  });

  it('진행 중 — 칩 "실행 중" · 시작 시각 KST · 경과 틱 · 단계 아이콘', () => {
    const html = render({ snapshot: snap(perfRun(), 1_000), now: 3_900 });
    expect(html).toContain('실행 중');
    expect(html).toContain('10:20:05 KST');
    expect(html).toContain('data-testid="run-elapsed"');
    expect(html).toContain('>44초<'); // 41,250 + 2,900
    expect(html).toContain('◐');
    expect(html).toContain('✓');
    expect(html).toMatch(
      /<button type="button" class="[^"]*"><span aria-hidden="true">■ <\/span>중단<\/button>/,
    );
  });

  it('완료 — 초록 칩 · 완료 띠 · 라이브 표지', () => {
    const html = render({ snapshot: snap(completedPerf()) });
    expect(html).toContain('bg-emerald-100');
    expect(html).toContain('>완료<');
    expect(html).toContain('완료 — 총 소요 3분 12.4초 · 종료 10:23:17 KST');
    expect(html).toContain('라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님');
    expect(html).toContain('>3분 12.4초<');
  });

  it('다른 종류 진행 중 — 그 화면 링크 · 이 화면 칩 "실행 없음"', () => {
    const html = render({ snapshot: snap(flowRun()) });
    expect(html).toContain('href="/experiments/flow"');
    expect(html).toContain('다른 실행 진행 중(EXP-FLOW) — 그 화면으로');
    expect(html).toContain('>실행 없음<');
  });

  it('10^8 — 예상 디스크(추정 상한) · 수 분 이상 경고 · 10^7 이하는 없음', () => {
    expect(render({ chosen: { maxExponent: 8 } })).toContain('data-testid="run-large-warning"');
    expect(render({ chosen: { maxExponent: 7 } })).not.toContain('run-large-warning');
    expect(expectedDisk(7)).toBeNull();
    expect(expectedDisk(8)?.pg).toBeCloseTo(1.082e10, -3);
    expect(expectedDisk(8)?.ch).toBeCloseTo(5.4e8, -3);
    expect(largeRunWarning(8)).toBe(
      '예상 디스크(추정 상한) PostgreSQL 10.8 GB(힙 + btree) · ClickHouse 540 MB — 수 분 이상 걸린다',
    );
  });

  it('폴링 실패 — 흐리게 · "상태를 읽지 못했다"', () => {
    const html = render({ snapshot: snap(perfRun()), pollFailed: true });
    expect(html).toContain('opacity-70');
    expect(html).toContain('상태를 읽지 못했다 — 다시 읽는 중');
  });
});

// ── 종류별 조각 ──

describe('flow 진행 막대 · 결과 표', () => {
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
  it('드레인 중이면 막대를 채운 채 문구', () => {
    const r = flowRun({
      steps: [
        step('prepare', 'done'),
        step('publish', 'done', { elapsedMs: 60_000, detail: { pointsSent: 600000 } }),
        step('drain', 'running'),
      ],
    });
    const html = renderToStaticMarkup(createElement(FlowProgressBar, { run: r, receivedAt: 0, now: 0 }));
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('드레인 — 적체 복귀 대기(상한 30초)');
    expect(html).toContain('(60초 / 60초)');
  });
  it('결과 표 — 수치 8 · 라이브 표지', () => {
    const r = flowRun({
      status: 'completed',
      result: {
        pointsSent: 600000,
        entriesSent: 3000,
        commandsSent: 60,
        commandsOk: 59,
        commandsPending: 1,
        commandsFailed: 0,
        backpressurePauses: 0,
        drainMs: 1840,
      },
    });
    const html = renderToStaticMarkup(createElement(FlowResultTable, { run: r }));
    expect(html).toContain('라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님');
    expect(html).toContain('600,000');
    expect(html).toContain('1,840');
    expect((html.match(/<td/g) ?? []).length).toBe(8);
  });
  it('단계 detail 한 줄', () => {
    expect(
      stepDetailText(step('fill-ch@5', 'done', { detail: { rows: 100000, ms: 578, storageBytes: 1210000 } })),
    ).toBe('행 +100,000 · 578 ms · 누적 1.2 MB');
    expect(stepDetailText(step('query@6', 'running', { detail: { done: 4, total: 10 } }))).toBe('쿼리 4/10');
    expect(stepDetailText(step('drain', 'done', { detail: { drainMs: 30000, timedOut: true } }))).toBe(
      '드레인 30,000 ms · 상한 30초 도달 — 적체가 남았다',
    );
    expect(stepDetailText(step('prepare', 'done', { detail: { devices: 50, tags: 10000 } }))).toBe(
      '설비 50 · 태그 10,000',
    );
    expect(stepDetailText(step('cleanup', 'pending'))).toBe('');
  });
});

describe('perf 라이브 계열 · 결과 표', () => {
  const scales = [
    {
      exponent: 6,
      rows: 1000000,
      fillMs: { ch: 1920, pg: 30230 },
      storageBytes: { ch: 11400000, pg: 98300000 },
      queries: [
        {
          q: 'Q2' as const,
          ch: { values: [5, 4, 6], median: 5, rows: 1 },
          pg: { values: [9, 8, 10], median: 9, rows: 2 },
          winner: 'ch' as const,
          ratio: 1.8,
          resultMatch: false,
        },
      ],
    },
    {
      exponent: 5,
      rows: 100000,
      fillMs: { ch: 578, pg: 1320 },
      storageBytes: { ch: 1210000, pg: 9830000 },
      queries: [
        {
          q: 'Q2' as const,
          ch: { values: [4.1, 3.9, 4.0], median: 4.0, rows: 1 },
          pg: { values: [2.2, 2.1, 2.3], median: 2.2, rows: 1 },
          winner: 'pg' as const,
          ratio: 0.55,
          resultMatch: true,
        },
      ],
    },
  ];
  const run = perfRun({ result: { scales } });

  it('툴바 쿼리의 규모별 중앙값 — 규모 오름차순 · 실행이 채운 규모만', () => {
    const l = liveSeries(run, 'Q2');
    expect(l.ch.map((p) => [p.rows, p.median])).toEqual([
      [100000, 4],
      [1000000, 5],
    ]);
    expect(l.pg.map((p) => p.median)).toEqual([2.2, 9]);
    expect(liveSeries(run, 'Q1')).toEqual({ ch: [], pg: [] });
    expect(liveSeries(flowRun(), 'Q2')).toEqual({ ch: [], pg: [] });
    expect(liveSeries(null, 'Q2')).toEqual({ ch: [], pg: [] });
  });

  it('곡선 — 라이브 계열 2는 마름모(◇ CH · ◆ PG I2) · 실선 · 범례 머리에 정본 라이브 표지 문구', () => {
    const opt = curveOption({
      lines: [],
      i2Range: undefined,
      undetermined: [],
      records: [],
      yLog: true,
      live: liveSeries(run, 'Q2'),
    }) as unknown as {
      series: { id: string; symbol?: string; lineStyle?: { type: string } }[];
      legend: { data: string[] };
      graphic?: { style: { text: string } }[];
    };
    const ch = opt.series.find((s) => s.id === 'live-ch');
    const pg = opt.series.find((s) => s.id === 'live-pg');
    expect(ch?.symbol).toBe('emptyDiamond');
    expect(pg?.symbol).toBe('diamond');
    expect(ch?.lineStyle?.type).toBe('solid');
    expect(opt.legend.data.filter((d) => d.includes('(시연값)'))).toHaveLength(2);
    expect(opt.graphic?.map((g) => g.style.text)).toEqual([
      '라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님',
    ]);
    // 라이브가 없으면 계열도 범례도 없다
    const none = curveOption({
      lines: [],
      i2Range: undefined,
      undetermined: [],
      records: [],
      yLog: true,
    }) as unknown as {
      series: { id: string }[];
      graphic?: unknown;
    };
    expect(none.series.some((s) => s.id.startsWith('live-'))).toBe(false);
    expect(none.graphic).toBeUndefined();
  });

  it('결과 표 — 규모 행 · 배수 소수 1자리 · 결과 불일치 · 적재 · 저장 · 라이브 표지', () => {
    const html = renderToStaticMarkup(createElement(LiveResultTable, { result: scales }));
    expect(html).toContain('라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님');
    expect(html.indexOf('10^5')).toBeLessThan(html.indexOf('10^6'));
    expect(html).toContain('1.8×');
    expect(html).toContain('0.6×');
    expect(html).toContain('결과 불일치');
    expect(html).toContain('1,920 ms · 30,230 ms');
    expect(html).toContain('11.4 MB · 98.3 MB');
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
    const post = await bffRuns.POST(
      new Request('http://w/bff/runs', { method: 'POST', body: '{"type":"perf"}' }),
      ctx(undefined),
    );
    expect(post.status).toBe(409);
    expect(post.headers.get('cache-control')).toBe('no-store');
    expect(await post.json()).toMatchObject({ error: { code: 'datagen.run_in_progress' } });
    await bffRuns.GET(new Request('http://w/bff/runs/current'), ctx(['current']));
    await bffRuns.GET(new Request(`http://w/bff/runs/${PERF_ID}`), ctx([PERF_ID]));
    await bffRuns.POST(
      new Request(`http://w/bff/runs/${PERF_ID}/stop`, { method: 'POST' }),
      ctx([PERF_ID, 'stop']),
    );
    expect(seen).toEqual([
      'POST http://127.0.0.1:3000/api/v1/runs no-store {"type":"perf"}',
      'GET http://127.0.0.1:3000/api/v1/runs/current no-store ',
      `GET http://127.0.0.1:3000/api/v1/runs/${PERF_ID} no-store `,
      `POST http://127.0.0.1:3000/api/v1/runs/${PERF_ID}/stop no-store `,
    ]);
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
