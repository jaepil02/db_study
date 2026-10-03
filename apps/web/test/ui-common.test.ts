// 웹 2화면 공통 UI 조각 — 저장소 토큰 · 실행 조작부 순수 로직 · 정적 렌더
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { closesPopover, RunControlView } from '../components/runs/run-control';
import { RunProgressView } from '../components/runs/run-progress';
import {
  buildRunParams,
  defaultParams,
  FLOW_PARAM_DEFS,
  PERF_PARAM_DEFS,
  paramWarnings,
  stageProgress,
} from '../components/runs/run-spec';
import { STORE, STORE_KEYS } from '../components/ui/store';
import { ApiError } from '../lib/api';
import { PANEL_IDLE, POLL_FAILED_TEXT, RUN_POLL_MS, type RunSnapshot, runPollInterval } from '../lib/runs';
import type { RunObjectBody } from '../lib/shared';

const step = (key: string, status: RunObjectBody['steps'][number]['status'], detail = {}) => ({
  key,
  label: `라벨-${key}`,
  status,
  startedAt: status === 'pending' ? null : '2026-09-28T05:12:03.004Z',
  endedAt: null,
  elapsedMs: status === 'pending' ? null : 1000,
  detail,
});

const perf = (over: Partial<RunObjectBody> = {}): RunObjectBody => ({
  runId: 'r1',
  type: 'perf',
  status: 'running',
  params: { maxExponent: 7 },
  startedAt: '2026-09-28T01:20:05.000Z',
  endedAt: null,
  elapsedMs: 5000,
  steps: [step('prepare', 'done'), step('fill-ch@5', 'running'), step('cleanup', 'pending')],
  result: null,
  error: null,
  ...over,
});

const flow = (over: Partial<RunObjectBody> = {}): RunObjectBody => ({
  ...perf(),
  runId: 'r2',
  type: 'flow',
  params: { pps: 10000, durationSec: 60, bizPerSec: 1 },
  steps: [
    step('prepare', 'done'),
    { ...step('publish', 'running', { pointsSent: 5 }), elapsedMs: 30_000 },
    step('drain', 'pending'),
  ],
  ...over,
});

const snap = (run: RunObjectBody | null): RunSnapshot => ({ run, receivedAt: 100 });

describe('저장소 토큰', () => {
  it('색 3 · 라벨 · 짧은 이름', () => {
    expect(STORE_KEYS).toEqual(['ch', 'pg', 'redis']);
    expect(STORE.ch).toMatchObject({ color: '#d97706', label: 'ClickHouse', short: 'CH' });
    expect(STORE.pg).toMatchObject({ color: '#2563eb', label: 'PostgreSQL', short: 'PG' });
    expect(STORE.redis).toMatchObject({ color: '#dc2626', label: 'Redis', short: 'Redis' });
  });
});

describe('매개변수 정의 · 요청 본문', () => {
  it('perf 기본 1천만 행 · 선택지 4(쉬운 말) · 1억 행만 경고', () => {
    const d = PERF_PARAM_DEFS[0];
    expect(d?.label).toBe('어디까지');
    expect(d?.values).toEqual([5, 6, 7, 8]);
    expect(defaultParams(PERF_PARAM_DEFS)).toEqual({ maxExponent: 7 });
    expect(d?.values.map((v) => d.text(v))).toEqual(['10만 행', '100만 행', '1천만 행', '1억 행']);
    expect(d?.warn?.(7)).toBeNull();
    expect(d?.warn?.(8)).toContain('수 분 이상 걸려요');
  });
  it('flow 기본값 4개 · 쉬운 말 라벨(값 글자는 그대로) · 조회 요청 0 · 5 · 20(기본) · 50', () => {
    expect(defaultParams(FLOW_PARAM_DEFS)).toEqual({
      pps: 10000,
      durationSec: 60,
      bizPerSec: 1,
      readsPerSec: 20,
    });
    expect(FLOW_PARAM_DEFS.map((d) => d.label)).toEqual([
      '센서 데이터(초당)',
      '보내는 시간',
      '업무 요청(초당)',
      '조회 요청(초당)',
    ]);
    expect(FLOW_PARAM_DEFS[0]?.text(1000)).toBe('1,000');
    const reads = FLOW_PARAM_DEFS[3];
    expect(reads?.values).toEqual([0, 5, 20, 50]);
    expect(reads?.values.map((v) => reads.text(v))).toEqual(['안 보냄', '5/초', '20/초', '50/초']);
  });
  it('요청 본문 — 모르는 키 버림 · 선택지 밖은 기본값', () => {
    expect(buildRunParams(FLOW_PARAM_DEFS, { pps: 5000, durationSec: 999, extra: 1 })).toEqual({
      pps: 5000,
      durationSec: 60,
      bizPerSec: 1,
      readsPerSec: 20,
    });
  });
  it('경고 모음', () => {
    expect(paramWarnings(PERF_PARAM_DEFS, { maxExponent: 8 })).toHaveLength(1);
    expect(paramWarnings(PERF_PARAM_DEFS, { maxExponent: 6 })).toEqual([]);
  });
});

describe('단계 n/m', () => {
  it('진행 중 단계가 지금', () => {
    expect(stageProgress(perf())).toMatchObject({ n: 2, total: 3, label: '라벨-fill-ch@5' });
    expect(stageProgress(perf()).ratio).toBeCloseTo(1 / 3);
  });
  it('완료는 m/m · 라벨 없음', () => {
    const r = perf({ status: 'completed', steps: [step('prepare', 'done'), step('cleanup', 'done')] });
    expect(stageProgress(r)).toEqual({ n: 2, total: 2, label: null, ratio: 1 });
  });
  it('진행 단계가 없으면 첫 대기 단계', () => {
    const r = perf({ steps: [step('prepare', 'done'), step('cleanup', 'pending')] });
    expect(stageProgress(r).n).toBe(2);
  });
  it('실패 · 중단은 m/m이 아니라 멈춘 단계의 위치(정리 단계가 뒤에서 돌아도)', () => {
    const failed = perf({
      status: 'failed',
      steps: [
        step('prepare', 'done'),
        step('fill-ch@5', 'failed'),
        step('fill-pg@5', 'skipped'),
        step('cleanup', 'done'),
      ],
    });
    expect(stageProgress(failed)).toMatchObject({ n: 2, total: 4, label: '라벨-fill-ch@5' });
    const stopped = perf({
      status: 'stopped',
      steps: [
        step('prepare', 'done'),
        step('fill-ch@5', 'done'),
        step('fill-pg@5', 'stopped'),
        step('query@5', 'skipped'),
        step('cleanup', 'done'),
      ],
    });
    expect(stageProgress(stopped)).toMatchObject({ n: 3, total: 5, label: '라벨-fill-pg@5' });
    // 실패 · 중단 단계가 없으면(정리 중 실패 등) 마지막으로 돈 단계
    const noMark = perf({
      status: 'failed',
      steps: [step('prepare', 'done'), step('cleanup', 'done'), step('report', 'pending')],
    });
    expect(stageProgress(noMark).n).toBe(2);
  });
  it('진행 띠의 단계 n/m — 멈춘 단계 · 진행 중 단계(끝난 수가 아니라 지금 단계)', () => {
    const stopped = perf({
      status: 'stopped',
      endedAt: '2026-09-28T01:21:00.000Z',
      steps: [step('prepare', 'done'), step('fill-ch@5', 'stopped'), step('cleanup', 'done')],
    });
    expect(stageProgress(stopped).n).toBe(2);
    expect(band('perf', perf())).toContain('단계 2/3');
  });
});

describe('진행 띠 — 한 줄 · 폴링 실패', () => {
  const strip = (over: Partial<Parameters<typeof RunProgressView>[0]>) =>
    renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'perf',
        snapshot: snap(perf()),
        pollFailed: false,
        local: PANEL_IDLE,
        now: 100,
        onStop: () => {},
        ...over,
      }),
    );
  it('한 줄 — 시작 시각 · 서랍 연결 · 단계 label(서버 문구) 없음', () => {
    const h = strip({});
    const visible = h.replace(/\stitle="[^"]*"/g, '');
    expect(h).not.toContain('run-started');
    expect(visible).not.toContain('KST');
    expect(h).toContain('title="시작 10:20:05 KST');
    expect(h).not.toContain('aria-expanded');
    expect(h).not.toContain('라벨-');
    expect(h).toContain('ClickHouse에 10만 행 넣는 중 · 단계 2/3');
  });
  it('첫 조회 실패(받은 응답 없음)도 띠 문구로', () => {
    const h = strip({ snapshot: undefined, pollFailed: true });
    expect(h).toContain(POLL_FAILED_TEXT);
    expect(h).toContain('data-testid="run-progress-strip"');
  });
  it('폴링 실패면 실행 상태와 무관하게 1초 재시도 — 종결 · 실행 없음 · 응답 없음 모두', () => {
    const done = snap(perf({ status: 'completed', endedAt: '2026-09-28T01:21:00.000Z' }));
    expect(runPollInterval(done, true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(null), true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(undefined, true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(done, false)).toBe(false);
  });
});

describe('팝오버 — 시작 202를 받은 뒤에만 닫힌다', () => {
  const err = new ApiError(400, 'common.validation_failed', 'bad');
  it('started만 닫고 409 · 400 · 요청 실패는 열어 둔다', () => {
    expect(closesPopover({ kind: 'started', run: perf() })).toBe(true);
    expect(closesPopover({ kind: 'conflict', type: 'flow', run: null })).toBe(false);
    expect(closesPopover({ kind: 'invalid', error: err })).toBe(false);
    expect(closesPopover({ kind: 'failed', error: new ApiError(0, null, 'x') })).toBe(false);
  });
  const open = (local: typeof PANEL_IDLE) =>
    renderToStaticMarkup(
      createElement(RunControlView, {
        type: 'perf',
        params: PERF_PARAM_DEFS,
        snapshot: snap(null),
        pollFailed: false,
        local,
        chosen: { maxExponent: 7 },
        buttonLabel: '내 컴퓨터에서 직접 재 보기',
        onChoose: () => {},
        onStart: () => undefined,
        defaultOpen: true,
      }),
    );
  it('요청 중 — 팝오버 안에 "시작하는 중이에요…" 비활성 · 400 문구도 팝오버 안', () => {
    const h = open({ ...PANEL_IDLE, starting: true });
    expect(h).toContain('role="dialog"');
    expect(h).toMatch(
      /<button[^>]*disabled=""[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>시작하는 중이에요…<\/button>/,
    );
    const bad = open({ ...PANEL_IDLE, paramError: '매개변수가 서버 허용값과 다르다' });
    expect(bad).toMatch(/role="dialog"[\s\S]*매개변수가 서버 허용값과 다르다/);
  });
});

/** 진행 띠 — 종결 실행은 "이 화면에서 방금 끝난" 실행으로 본다(recentEndId — 30초 동안 띠가 결말을 그린다) */
const band = (type: 'perf' | 'flow', run: RunObjectBody | null) =>
  renderToStaticMarkup(
    createElement(RunProgressView, {
      type,
      snapshot: snap(run),
      pollFailed: false,
      local: PANEL_IDLE,
      now: 100,
      recentEndId: run?.runId ?? null,
      onStop: () => {},
    }),
  );

describe('정적 렌더', () => {
  const view = (run: RunObjectBody | null, over = {}) =>
    renderToStaticMarkup(
      createElement(RunControlView, {
        type: 'perf',
        params: PERF_PARAM_DEFS,
        snapshot: snap(run),
        pollFailed: false,
        local: PANEL_IDLE,
        chosen: { maxExponent: 8 },
        buttonLabel: '내 컴퓨터에서 직접 재 보기',
        onChoose: () => {},
        onStart: () => undefined,
        defaultOpen: true,
        ...over,
      }),
    );

  it('조작부 — 팝오버에 대용량 경고 · 시작 켜짐 · 실행 없음', () => {
    const h = view(null);
    expect(h).toContain('내 컴퓨터에서 직접 재 보기');
    expect(h).toContain('run-large-warning');
    expect(h).toContain('아직 재 보지 않았어요');
  });
  it('진행 중 — 잠긴 매개변수 · 중단은 진행 띠 오른쪽', () => {
    const h = view(perf());
    expect(h).toContain('실행 중');
    expect(h).not.toContain('run-large-warning');
    expect(h).not.toContain('중단');
    expect(band('perf', perf())).toMatch(
      /<button[^>]*>(?:<svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>)중단<\/button>/,
    );
  });
  it('진행 띠 — 단계 n/m · flow 진행 막대 · 종결 띠', () => {
    expect(band('perf', perf())).toContain('단계 2/3');
    expect(band('flow', flow())).toContain('aria-valuenow="50"');
    expect(band('flow', flow())).toContain('보내는 중');
    expect(band('flow', flow())).toContain('30초 / 60초');
    const done = band('perf', perf({ status: 'completed', endedAt: '2026-09-28T01:21:00.000Z' }));
    expect(done).toContain('완료 —');
    expect(done).not.toContain('role="progressbar"');
  });
  it('실행이 없으면 그리지 않고 · 다른 종류 진행 중이면 그 화면 링크 한 줄만', () => {
    expect(band('perf', null)).toBe('');
    const h = band('perf', flow());
    expect(h).toContain('다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기');
    expect(h).not.toContain('run-stage');
  });
});
