// 라이브 실행 패널 — 08_screen/08 §실행 패널 — 두 화면 공통 규칙(버튼 상태 · 상태 칩과 종결 표시 · 경과 시간 · 갱신과 응답 처리)
// 표면(07_api/09 #2~#5)은 가짜 응답으로 대신한다 — api 쪽 구현과 무관하게 계약 모양만 본다.
import { environmentManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bffRuns from '../app/bff/runs/[[...path]]/route';
import { curveOption } from '../components/experiments/perf/options';
import { RunControlView, type RunControlViewProps } from '../components/runs/run-control';
import { RunProgressView, type RunProgressViewProps } from '../components/runs/run-progress';
import { PERF_PARAM_DEFS } from '../components/runs/run-spec';
import { nextFailedAt, panelNow, tickOn } from '../components/runs/use-run';
import { ApiError } from '../lib/api';
import { rowsWords } from '../lib/perf';
import {
  currentRunQueryOptions,
  expectedDisk,
  flowProgress,
  formatElapsed,
  headerLastRun,
  justEndedRunId,
  largeRunWarning,
  lastRunText,
  lastRunTip,
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
  runScopeText,
  SAME_RUN_TEXT,
  stepPlainText,
  stripShowsRun,
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

describe('상태 칩과 종결 띠 — 한 줄 쉬운 말', () => {
  it('완료 — "완료 — 걸린 시간 3분 12.4초" · 툴팁에 종료 KST', () => {
    expect(runBand(completedPerf())).toEqual({
      tone: 'success',
      text: '완료 — 걸린 시간 3분 12.4초',
      tip: '종료 10:23:17 KST',
    });
  });
  it('중단됨 — 걸린 시간 · 정리 실패 문구', () => {
    const r = perfRun({
      status: 'stopped',
      endedAt: '2026-09-28T01:21:10.000Z',
      startedAt: '2026-09-28T01:20:05.000Z',
      elapsedMs: 65_000,
    });
    expect(runBand(r)?.text).toBe('중단됨 — 걸린 시간 1분 5.0초');
    expect(runBand({ ...r, error: { code: null, message: 'DROP 실패' } })).toEqual({
      tone: 'neutral',
      text: '중단됨 — 걸린 시간 1분 5.0초 · 정리하다 실패했어요(DROP 실패)',
      // 띠 안은 한 줄로 잘리므로 오류 전문을 툴팁 첫 줄에
      tip: '정리하다 실패했어요 — DROP 실패\n종료 10:21:10 KST',
    });
  });
  it('실패 — 메시지 · 소요 · 오류 코드는 툴팁에', () => {
    const r = perfRun({
      status: 'failed',
      endedAt: '2026-09-28T01:20:17.400Z',
      elapsedMs: 12_400,
      error: { code: 'timeseries.clickhouse_unavailable', message: '저장소 불가' },
    });
    expect(runBand(r)).toEqual({
      tone: 'danger',
      text: '실패했어요 — 저장소 불가 · 걸린 시간 12.4초',
      tip: '실패 원인 — 저장소 불가\n종료 10:20:17 KST\n오류 코드 timeseries.clickhouse_unavailable',
    });
  });
  it('running은 띠 없음 · stopping은 "멈추는 중이에요…"', () => {
    expect(runBand(perfRun())).toBeNull();
    expect(runBand(perfRun({ status: 'stopping' }))?.text).toBe(
      '멈추는 중이에요… — 하던 단계를 멈추고 정리하고 있어요',
    );
  });
});

describe('지난 실행 자리 — 띠는 실행 중 · 방금 끝난 30초만 · 그 뒤 셸 머리 "지난번" 글자(web-ux-polish §2.1)', () => {
  it('방금 끝남 — 같은 실행이 running · stopping → 종결로 바뀐 응답만 · 이 화면 종류만', () => {
    const done = completedPerf();
    expect(justEndedRunId(snap(perfRun()), snap(done), 'perf')).toBe(PERF_ID);
    expect(justEndedRunId(snap(perfRun({ status: 'stopping' })), snap(done), 'perf')).toBe(PERF_ID);
    // 처음 받은 응답이 이미 종결 · 종결 → 종결 · 다른 실행 · 다른 종류 · 실행 사라짐은 아님
    expect(justEndedRunId(undefined, snap(done), 'perf')).toBeNull();
    expect(justEndedRunId(snap(done), snap(done), 'perf')).toBeNull();
    expect(justEndedRunId(snap(perfRun({ runId: 'old' })), snap(done), 'perf')).toBeNull();
    expect(justEndedRunId(snap(perfRun()), snap(done), 'flow')).toBeNull();
    expect(justEndedRunId(snap(perfRun()), snap(null), 'perf')).toBeNull();
  });

  it('띠와 머리 글자는 같은 실행을 동시에 말하지 않는다', () => {
    const done = completedPerf();
    expect(stripShowsRun(perfRun(), null)).toBe(true);
    expect(stripShowsRun(done, PERF_ID)).toBe(true);
    expect(stripShowsRun(done, null)).toBe(false);
    expect(stripShowsRun(null, PERF_ID)).toBe(false);
    expect(headerLastRun(done, null)).toBe(done);
    expect(headerLastRun(done, PERF_ID)).toBeNull();
    expect(headerLastRun(perfRun(), null)).toBeNull();
    for (const [run, id] of [
      [perfRun(), null],
      [done, PERF_ID],
      [done, null],
    ] as const)
      expect(stripShowsRun(run, id) && headerLastRun(run, id) !== null).toBe(false);
  });

  it('머리 글자 — perf 완료는 걸린 시간 · flow 완료는 "완료"(보낸 시간은 범위에 있다) · 중단 · 실패는 상태 낱말', () => {
    expect(lastRunText(completedPerf())).toBe('지난번 100만 행까지 · 3분 12.4초');
    const flowDone = flowRun({ status: 'completed', endedAt: '2026-09-28T01:31:05.000Z', elapsedMs: 65_000 });
    expect(lastRunText(flowDone)).toBe('지난번 초당 10,000개 · 60초 · 완료');
    expect(lastRunText(flowRun({ status: 'stopped', endedAt: '2026-09-28T01:30:50.000Z' }))).toBe(
      '지난번 초당 10,000개 · 60초 · 중단됨',
    );
    expect(lastRunText(perfRun({ status: 'failed', endedAt: '2026-09-28T01:20:17.400Z' }))).toBe(
      '지난번 100만 행까지 · 실패',
    );
    // 범위를 모르면 머리 낱말로
    expect(lastRunText({ ...completedPerf(), params: {} })).toBe('지난번 직접 재 보기 · 3분 12.4초');
    expect(lastRunTip(flowDone)).toContain('완료 — 걸린 시간 1분 5.0초');
  });
});

describe('지금 단계 쉬운 문장 · 규모 쉬운 말', () => {
  it('perf — 넣는 중 · 재는 중 · 준비 · 정리 · 종결이면 없음', () => {
    expect(stepPlainText(perfRun())).toBe('PostgreSQL에 10만 행 넣는 중');
    const at = (key: string) =>
      stepPlainText(
        perfRun({ steps: [step('prepare', 'done'), step(key, 'running'), step('cleanup', 'pending')] }),
      );
    expect(at('fill-ch@7')).toBe('ClickHouse에 1천만 행 넣는 중');
    expect(at('query@8')).toBe('1억 행에서 질문 5개를 재는 중');
    expect(stepPlainText(perfRun({ steps: [step('prepare', 'running')] }))).toBe('준비 중');
    expect(stepPlainText(perfRun({ steps: [step('cleanup', 'done')] }))).toBe('정리 중');
    expect(stepPlainText(completedPerf())).toBeNull();
  });
  it('flow — 보내는 중 · 기다리는 중', () => {
    expect(stepPlainText(flowRun())).toBe('보내는 중');
    expect(stepPlainText(flowRun({ steps: [step('publish', 'done'), step('drain', 'running')] }))).toBe(
      '남은 데이터 처리 기다리는 중(최대 30초)',
    );
  });
  it('규모 — 10만 · 100만 · 1천만 · 1억 행(지수 표기 없음 · 성능 비교 그림과 같은 rowsWords)', () => {
    expect([5, 6, 7, 8].map(rowsWords)).toEqual(['10만 행', '100만 행', '1천만 행', '1억 행']);
  });
  it('지난 실행 범위 — perf "N 행까지" · flow "초당 N개 · N초" · 매개변수가 없으면 null', () => {
    expect(runScopeText({ type: 'perf', params: { maxExponent: 6 } })).toBe('100만 행까지');
    expect(runScopeText({ type: 'perf', params: { maxExponent: 8 } })).toBe('1억 행까지');
    expect(runScopeText({ type: 'perf', params: {} })).toBeNull();
    expect(runScopeText({ type: 'flow', params: { pps: 10_000, durationSec: 60, bizPerSec: 1 } })).toBe(
      '초당 10,000개 · 60초',
    );
    expect(runScopeText({ type: 'flow', params: { pps: 1_000 } })).toBeNull();
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
    expect(c.start.other).toEqual({ name: '분산 처리 모니터링', href: '/monitoring' });
    expect(c.start.note).toBe('다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기');
    expect(c.stop.enabled).toBe(false);
    expect(c.lockedParams).toBeNull();
    expect(c.paramsLocked).toBe(true);
    const f = runControls({ ...base, type: 'flow', snapshot: snap(perfRun()) });
    expect(f.start.note).toBe('다른 측정이 이미 돌고 있어요 — 성능 비교 화면에서 보기');
  });
  it('시작 요청 중 — "시작하는 중이에요…" 비활성(두 번 눌러 409를 부르지 않는다)', () => {
    const c = runControls({ ...base, snapshot: snap(null), starting: true });
    expect(c.start).toMatchObject({ enabled: false, label: '시작하는 중이에요…' });
  });
  it('중단 — 누른 직후 응답 전부터 "멈추는 중이에요…" · stopping이면 비활성', () => {
    expect(runControls({ ...base, snapshot: snap(perfRun()), stopRequested: true }).stop).toEqual({
      enabled: false,
      label: '멈추는 중이에요…',
    });
    expect(runControls({ ...base, snapshot: snap(perfRun({ status: 'stopping' })) }).stop).toEqual({
      enabled: false,
      label: '멈추는 중이에요…',
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
    // 폴링 실패 — 마지막 실행 상태와 무관하게 1초 재시도(지금 상태를 모른다 · 08_screen/08 폴링 실패 행)
    expect(runPollInterval(snap(perfRun()), true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(undefined, true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(completedPerf()), true)).toBe(RUN_POLL_MS);
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
    const s = panelReducer(
      { ...PANEL_IDLE, starting: true },
      { kind: 'start-done', outcome: o, self: 'perf' },
    );
    expect(s.starting).toBe(false);
    expect(s.notice?.text).toBe('다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기');
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
    const o = await requestStart('perf', { maxExponent: 7 }, f);
    expect(o).toEqual({ kind: 'conflict', type: 'perf', run: null });
    // 같은 종류 409 — 자기 화면을 "그 화면에서 보기"로 가리키지 않는다
    const s = panelReducer(
      { ...PANEL_IDLE, starting: true },
      { kind: 'start-done', outcome: o, self: 'perf' },
    );
    expect(s.notice).toEqual({ tone: 'info', conflict: true, text: SAME_RUN_TEXT });
    expect(s.notice?.text).not.toContain('성능 비교');
    // 종류를 모르면 앞 절만
    const u = panelReducer(PANEL_IDLE, {
      kind: 'start-done',
      outcome: { kind: 'conflict', type: null, run: null },
      self: 'perf',
    });
    expect(u.notice?.text).toBe('다른 측정이 이미 돌고 있어요');
  });

  it('400 — 매개변수 옆 문구(버튼은 되돌린다)', async () => {
    const { f } = fakeFetch({
      'POST /bff/runs': [
        () => json(400, { error: { code: 'common.validation_failed', message: '허용값 밖' } }),
      ],
    });
    const o = await requestStart('perf', { maxExponent: 9 }, f);
    expect(o.kind).toBe('invalid');
    const s = panelReducer(
      { ...PANEL_IDLE, starting: true },
      { kind: 'start-done', outcome: o, self: 'perf' },
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
      runControls({
        type: 'flow',
        snapshot: snap(null),
        starting: s.starting,
        stopRequested: false,
        canControl: true,
      }).start.label,
    ).toBe('시작하는 중이에요…');
    s = panelReducer(s, { kind: 'start-done', outcome: o, self: 'perf' });
    expect(s.starting).toBe(false);
    expect(s.notice?.text).toBe('요청이 실패했어요 — 다시 눌러 주세요');
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
    expect(panelReducer(PANEL_IDLE, { kind: 'start-done', outcome: fo, self: 'perf' }).notice?.text).toBe(
      ROLE_TEXT,
    );
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
    expect(runBand((o200 as { run: RunObjectBody }).run)?.text).toContain('완료 — ');

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
    expect(s.notice?.text).toBe('요청이 실패했어요 — 다시 눌러 주세요');
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

// ── 조작부 · 진행 띠 그리기(배치 — 머리 버튼 · 칩 · 팝오버 / 진행 띠 · 중단 · 띠 문구) ──

describe('머리 조작부 — 버튼 · 상태 칩 · 팝오버(08_screen/08 §실행 패널 배치 · 버튼 상태)', () => {
  const render = (over: Partial<RunControlViewProps>) =>
    renderToStaticMarkup(
      createElement(RunControlView, {
        type: 'perf',
        params: PERF_PARAM_DEFS,
        snapshot: snap(null),
        pollFailed: false,
        local: PANEL_IDLE,
        chosen: { maxExponent: 7 },
        buttonLabel: '내 컴퓨터에서 직접 재 보기',
        intro: '같은 질문 5개를 두 DB에 3번씩 시켜 봐요.',
        onChoose: () => {},
        onStart: () => undefined,
        defaultOpen: true,
        ...over,
      }),
    );

  it('로딩 — "▶ 내 컴퓨터에서 직접 재 보기" 비활성 · 팝오버를 열지 않는다 · 칩 자리만 · aria-expanded 없음', () => {
    const html = render({ snapshot: undefined });
    expect(html).toContain('data-testid="run-control-perf"');
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>내 컴퓨터에서 직접 재 보기<\/button>/,
    );
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain('data-testid="run-status-pending"');
    expect(html).not.toContain('data-testid="run-status"');
    expect(html).not.toContain('aria-expanded');
  });

  it('실행 없음 — 칩 없음 · 팝오버 안에 쉬운 설명 · 규모 쉬운 말 · 아직 안 재 봄 문구 · 시작 활성', () => {
    const html = render({});
    expect(html).not.toContain('data-testid="run-status"');
    expect(html).toContain('같은 질문 5개를 두 DB에 3번씩 시켜 봐요.');
    for (const t of ['10만 행', '100만 행', '1천만 행', '1억 행']) expect(html).toContain(`${t}`);
    expect(html).toContain('>어디까지<');
    expect(html).not.toContain('10^');
    expect(html).toContain('아직 재 보지 않았어요(서버가 다시 켜지면 지난 결과는 사라져요)');
    expect(html).toMatch(
      /<button type="button" class="[^"]*"><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>시작<\/button>/,
    );
  });

  it('진행 중 — 칩 "실행 중" · 시작 비활성 · 중단은 머리에 없다(진행 띠 오른쪽)', () => {
    const html = render({ snapshot: snap(perfRun()) });
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
    const html = render({ snapshot: snap(completedPerf()), recentEndId: PERF_ID });
    expect(html).not.toContain('data-testid="run-status"');
    expect(html).not.toContain('bg-emerald-100');
    // 방금 끝나 띠가 결말을 그리는 동안은 머리 "지난번" 글자를 쓰지 않는다(같은 말 두 곳 금지)
    expect(html).not.toContain('data-testid="run-last"');
    // 멈추는 중(stopping)은 아직 진행 중이라 칩이 남는다
    expect(render({ snapshot: snap(perfRun({ status: 'stopping' })) })).toContain('>멈추는 중<');
  });

  it('지난 실행(띠가 접힌 뒤 · 이미 끝난 실행을 열었을 때) — 머리 버튼 왼쪽 작은 글자 "지난번 …" · 상세는 툴팁 · 키보드 · 낭독기로도 닿는다(R12)', () => {
    const html = render({ snapshot: snap(completedPerf()), recentEndId: null, defaultOpen: false });
    expect(html).toMatch(
      /data-testid="run-last" title="[^"]*" tabindex="0" aria-describedby="[^"]+" class="[^"]*text-xs tabular-nums text-slate-500">지난번 100만 행까지 · 3분 12\.4초<\/span><span id="[^"]+" class="sr-only">[^<]*<\/span><button/,
    );
    const tip = /data-testid="run-last" title="([^"]*)"/.exec(html)?.[1] ?? '';
    const lines = [
      '지난번 직접 재 보기',
      '완료 — 걸린 시간 3분 12.4초',
      '종료 10:23:17 KST',
      '시작 10:20:05 KST',
      'prepare done 0.4초',
      'cleanup done 0.4초',
      '내 측정(참고용) — 라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님',
    ];
    expect(tip.split('\n')).toEqual(lines);
    // 툴팁과 같은 상세를 sr-only 설명으로 — aria-describedby가 그 id를 가리킨다(키보드 초점 · 낭독기)
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(html).toContain(`<span id="${described}" class="sr-only">${lines.join(' · ')}</span>`);
    // 실패는 빨간 글자 · 진행 중 · 실행 없음 · 다른 종류 실행이면 글자 없음
    const failed = render({
      snapshot: snap(perfRun({ status: 'failed', endedAt: '2026-09-28T01:20:17.400Z', elapsedMs: 12_400 })),
      defaultOpen: false,
    });
    expect(failed).toMatch(/class="[^"]*text-red-700">지난번 100만 행까지 · 실패</);
    for (const r of [perfRun(), null, flowRun({ status: 'completed', endedAt: '2026-09-28T01:31:00.000Z' })])
      expect(render({ snapshot: snap(r), defaultOpen: false })).not.toContain('data-testid="run-last"');
  });

  it('다른 종류 진행 중 — 팝오버에 그 화면 링크(화면 이름) · 이 화면 칩 없음', () => {
    const html = render({ snapshot: snap(flowRun()) });
    expect(html).toContain('href="/monitoring"');
    expect(html).toContain('다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기');
    expect(html).not.toContain('data-testid="run-status"');
  });

  it('1억 행 — 예상 디스크(추정 상한) · "수 분 이상 걸려요" 경고 · 1천만 행 이하는 없음', () => {
    expect(render({ chosen: { maxExponent: 8 } })).toContain('수 분 이상 걸려요');
    expect(render({ chosen: { maxExponent: 7 } })).not.toContain('run-large-warning');
    expect(expectedDisk(7)).toBeNull();
    expect(expectedDisk(8)?.pg).toBeCloseTo(1.082e10, -3);
    expect(expectedDisk(8)?.ch).toBeCloseTo(5.4e8, -3);
    expect(largeRunWarning(7)).toBeNull();
    expect(largeRunWarning(8)).toBe(
      '예상 디스크(추정 상한) PostgreSQL 10.8 GB · ClickHouse 540 MB — 수 분 이상 걸려요',
    );
  });
});

describe('진행 띠 한 줄 — 상태 · 지금 단계 쉬운 문장 · 단계 n/m · 경과 · 중단 · 종결 띠 · 띠 문구', () => {
  const render = (over: Partial<RunProgressViewProps>) =>
    renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'perf',
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

  it('진행 중 — 실행 중 · 쉬운 단계 문장 · 단계 3/5 · 경과 틱 · 오른쪽 중단 활성 · 서랍 연결 없음', () => {
    const html = render({ snapshot: snap(perfRun(), 1_000), now: 3_900 });
    expect(html).toContain('실행 중');
    expect(html).toContain('data-testid="run-stage"');
    expect(html).toContain('PostgreSQL에 10만 행 넣는 중 · 단계 3/5');
    // 단계 key · 시작 시각은 띠 툴팁에만(보이는 글자에는 없다)
    const visible = html.replace(/\stitle="[^"]*"/g, '');
    expect(visible).not.toContain('fill-pg@5');
    expect(visible).not.toContain('KST');
    expect(html).toMatch(/title="시작 10:20:05 KST\nprepare done[^"]*fill-pg@5 running/);
    expect(html).toContain('경과 <span data-testid="run-elapsed">44초</span>'); // 41,250 + 2,900
    expect(html).not.toContain('aria-expanded');
    expect(html).toMatch(
      /<button type="button" class="ml-auto[^"]*"><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>중단<\/button>/,
    );
    // 이 줄은 overflow-hidden(한 줄 높이) — 중단 버튼 포커스 링은 안쪽으로 그려 잘리지 않게(R6)
    expect(html).toMatch(/<button type="button" class="ml-auto[^"]*focus-visible:-outline-offset-2[^"]*">/);
    // 움직임 줄이기 설정이면 깜빡임을 멈춘다(R7)
    expect(html).toContain('motion-safe:animate-pulse');
    expect(html).not.toMatch(/(?<![\w:])animate-pulse/);
    expect(html).not.toContain('role="progressbar"'); // perf는 진행 막대 없음(EXP-FLOW만)
  });

  it('중단을 눌렀다 — "멈추는 중이에요…" 비활성', () => {
    const html = render({ snapshot: snap(perfRun()), local: { ...PANEL_IDLE, stopRequested: true } });
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>멈추는 중이에요…<\/button>/,
    );
  });

  it('완료 직후(이 화면에서 지켜보던 실행 · 30초) — "지난번 직접 재 보기" · 완료 띠 · 무엇을 쟀나 · 라이브 표지 · 단계 문장 · 중단 버튼 없음', () => {
    const html = render({ snapshot: snap(completedPerf()), recentEndId: PERF_ID });
    expect(html).toContain('지난번 직접 재 보기');
    expect(html).toContain('완료 — 걸린 시간 3분 12.4초');
    expect(html).toContain('title="종료 10:23:17 KST"');
    expect(html).toContain('<span data-testid="run-scope">100만 행까지</span>');
    expect(html).toMatch(
      /data-testid="run-live-mark" title="라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님"[^>]*>내 측정\(참고용\)</,
    );
    expect(html).not.toContain('data-testid="run-stage"');
    expect(html).not.toContain('중단</button>');
  });

  it('30초가 지났거나 이미 끝난 실행을 열었다 — 띠 자체가 없다(셸 머리 "지난번" 글자가 같은 말을 한다)', () => {
    expect(render({ snapshot: snap(completedPerf()) })).toBe('');
    expect(render({ snapshot: snap(completedPerf()), recentEndId: 'other-run' })).toBe('');
    // 띠 문구(요청 사건)는 실행 줄과 따로 남는다
    expect(
      render({
        snapshot: snap(completedPerf()),
        local: { ...PANEL_IDLE, notice: { tone: 'neutral', text: VANISHED_TEXT } },
      }),
    ).not.toContain('data-testid="run-band"');
  });

  it('다른 종류 진행 중 — 그 화면 링크 한 줄', () => {
    const html = render({ snapshot: snap(flowRun()) });
    expect(html).toContain('data-testid="run-other"');
    expect(html).toContain('href="/monitoring"');
    expect(html).toContain('다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기');
  });

  it('요청 사건 · 폴링 실패 문구는 띠에', () => {
    expect(render({ local: { ...PANEL_IDLE, notice: { tone: 'neutral', text: VANISHED_TEXT } } })).toContain(
      VANISHED_TEXT,
    );
    const html = render({ snapshot: snap(perfRun()), pollFailed: true });
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
    expect(html).toContain('남은 데이터 처리 기다리는 중(최대 30초)');
    expect(html).toContain('60초 / 60초');
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

describe('409 띠 — 다른 종류 링크 줄과 같은 말이면 한 줄만', () => {
  const notice = {
    tone: 'info' as const,
    conflict: true,
    text: '다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기',
  };
  it('다른 종류 실행 링크 줄이 있으면 409 띠는 생략', () => {
    const html = renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'perf',
        snapshot: snap(flowRun()),
        pollFailed: false,
        local: { ...PANEL_IDLE, notice },
        now: 0,
        onStop: () => {},
      }),
    );
    expect(html.split('다른 측정이 이미 돌고 있어요').length - 1).toBe(1);
    expect(html).toContain('data-testid="run-other"');
  });
  it('링크 줄이 없으면(그 실행이 이미 끝남) 409 띠를 보인다', () => {
    const html = renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'perf',
        snapshot: snap(null),
        pollFailed: false,
        local: { ...PANEL_IDLE, notice },
        now: 0,
        onStop: () => {},
      }),
    );
    expect(html).toContain(notice.text);
  });
});

describe('종결 띠 — 오류 전문은 툴팁 · 띠는 한 줄로 자른다', () => {
  it('실패 띠에 truncate · title에 전문', () => {
    const long = '저장소 불가 '.repeat(30).trim();
    const html = renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'perf',
        snapshot: snap(
          perfRun({
            status: 'failed',
            endedAt: '2026-09-28T01:20:17.400Z',
            elapsedMs: 12_400,
            error: { code: 'timeseries.clickhouse_unavailable', message: long },
          }),
        ),
        pollFailed: false,
        local: PANEL_IDLE,
        now: 0,
        recentEndId: PERF_ID,
        onStop: () => {},
      }),
    );
    expect(html).toMatch(new RegExp(`data-testid="run-band" role="status" title="실패 원인 — ${long}\n`));
    expect(html).toMatch(/data-testid="run-band"[^>]*class="[^"]*truncate/);
  });
});

describe('perf 내 측정 점', () => {
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

  it('그림 2 — 내 측정은 속 찬 마름모 점(CH · PG 모두 · 색이 저장소를 가른다 · 선 없음) · 범례 "내 측정(참고용)" 하나 · 없으면 계열도 범례도 없다', () => {
    // 범례는 배열(색 범례 · 모양 범례) · 내 측정 항목은 { name, itemStyle }(범례 마름모 중립 slate)라 이름만 견준다
    type Legend = { data: (string | { name: string })[] }[];
    const names = (l: Legend) => l.map((x) => x.data.map((d) => (typeof d === 'string' ? d : d.name)));
    const opt = curveOption({ lines: [], range: undefined, live: liveSeries(run, 'Q2') }) as unknown as {
      series: { id: string; name: string; symbol?: string; lineStyle?: { width: number } }[];
      legend: Legend;
    };
    expect(opt.series.map((x) => x.id)).toEqual(['live-pg', 'live-ch']);
    expect(opt.series.map((x) => x.symbol)).toEqual(['diamond', 'diamond']);
    expect(opt.series.every((x) => x.name === '내 측정(참고용)' && x.lineStyle?.width === 0)).toBe(true);
    expect(names(opt.legend)).toEqual([['PostgreSQL', 'ClickHouse', '내 측정(참고용)']]);
    const none = curveOption({ lines: [], range: undefined, live: { ch: [], pg: [] } }) as unknown as {
      series: { id: string }[];
      legend: Legend;
    };
    expect(none.series).toEqual([]);
    expect(names(none.legend)).toEqual([['PostgreSQL', 'ClickHouse']]);
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
      'POST http://127.0.0.1:13000/api/v1/runs no-store {"type":"perf"}',
      'GET http://127.0.0.1:13000/api/v1/runs/current no-store ',
      `GET http://127.0.0.1:13000/api/v1/runs/${PERF_ID} no-store `,
      `POST http://127.0.0.1:13000/api/v1/runs/${PERF_ID}/stop no-store `,
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
