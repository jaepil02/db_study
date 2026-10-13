// 웹 공통 UI 조각 — 저장소 토큰 · 실행 조작부 순수 로직 · 정적 렌더
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { closesPopover, RunControlView } from '../components/runs/run-control';
import { RunProgressView } from '../components/runs/run-progress';
import {
  buildRunParams,
  defaultParams,
  FLOW_PARAM_DEFS,
  paramWarnings,
  type RunParamDef,
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

const flow = (over: Partial<RunObjectBody> = {}): RunObjectBody => ({
  runId: 'r2',
  type: 'flow',
  status: 'running',
  params: { pps: 10000, durationSec: 60, bizPerSec: 1 },
  startedAt: '2026-09-28T01:20:05.000Z',
  endedAt: null,
  elapsedMs: 5000,
  steps: [
    step('prepare', 'done'),
    { ...step('publish', 'running', { pointsSent: 5 }), elapsedMs: 30_000 },
    step('drain', 'pending'),
  ],
  result: null,
  error: null,
  ...over,
});

const snap = (run: RunObjectBody | null): RunSnapshot => ({ run, receivedAt: 100 });

/** 선택지 경고 틀 — 지금 실행 종류에는 경고가 없어 시험용 정의 하나로 본다(run-spec RunParamDef.warn) */
const WARN_DEFS: readonly RunParamDef[] = [
  {
    key: 'size',
    label: '크기',
    values: [1, 2],
    defaultValue: 1,
    text: (v) => `${v}`,
    warn: (v) => (v === 2 ? '수 분 이상 걸려요' : null),
  },
];

describe('저장소 토큰', () => {
  it('색 3 · 라벨 · 짧은 이름', () => {
    expect(STORE_KEYS).toEqual(['ch', 'pg', 'redis']);
    expect(STORE.ch).toMatchObject({ color: '#d97706', label: 'ClickHouse', short: 'CH' });
    expect(STORE.pg).toMatchObject({ color: '#2563eb', label: 'PostgreSQL', short: 'PG' });
    expect(STORE.redis).toMatchObject({ color: '#dc2626', label: 'Redis', short: 'Redis' });
  });
});

describe('매개변수 정의 · 요청 본문', () => {
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
    expect(reads?.values.map((v) => reads.text(v))).toEqual(['안 보냄', '5/s', '20/s', '50/s']);
  });
  it('요청 본문 — 모르는 키 버림 · 선택지 밖은 기본값', () => {
    expect(buildRunParams(FLOW_PARAM_DEFS, { pps: 5000, durationSec: 999, extra: 1 })).toEqual({
      pps: 5000,
      durationSec: 60,
      bizPerSec: 1,
      readsPerSec: 20,
    });
  });
  it('경고 모음 — 경고가 걸린 선택지만 · flow 선택지는 경고 없음', () => {
    expect(paramWarnings(WARN_DEFS, { size: 2 })).toEqual(['수 분 이상 걸려요']);
    expect(paramWarnings(WARN_DEFS, { size: 1 })).toEqual([]);
    expect(paramWarnings(FLOW_PARAM_DEFS, defaultParams(FLOW_PARAM_DEFS))).toEqual([]);
  });
});

describe('단계 n/m', () => {
  it('진행 중 단계가 지금', () => {
    expect(stageProgress(flow())).toMatchObject({ n: 2, total: 3, label: '라벨-publish' });
    expect(stageProgress(flow()).ratio).toBeCloseTo(1 / 3);
  });
  it('완료는 m/m · 라벨 없음', () => {
    const r = flow({ status: 'completed', steps: [step('prepare', 'done'), step('drain', 'done')] });
    expect(stageProgress(r)).toEqual({ n: 2, total: 2, label: null, ratio: 1 });
  });
  it('진행 단계가 없으면 첫 대기 단계', () => {
    const r = flow({ steps: [step('prepare', 'done'), step('drain', 'pending')] });
    expect(stageProgress(r).n).toBe(2);
  });
  it('실패 · 중단은 m/m이 아니라 멈춘 단계의 위치(정리 단계가 뒤에서 돌아도)', () => {
    const failed = flow({
      status: 'failed',
      steps: [
        step('prepare', 'done'),
        step('ingest', 'failed'),
        step('query', 'skipped'),
        step('cleanup', 'done'),
      ],
    });
    expect(stageProgress(failed)).toMatchObject({ n: 2, total: 4, label: '라벨-ingest' });
    const stopped = flow({
      status: 'stopped',
      steps: [
        step('prepare', 'done'),
        step('ingest', 'done'),
        step('query', 'stopped'),
        step('integrity', 'skipped'),
        step('cleanup', 'done'),
      ],
    });
    expect(stageProgress(stopped)).toMatchObject({ n: 3, total: 5, label: '라벨-query' });
    // 실패 · 중단 단계가 없으면(정리 중 실패 등) 마지막으로 돈 단계
    const noMark = flow({
      status: 'failed',
      steps: [step('prepare', 'done'), step('cleanup', 'done'), step('report', 'pending')],
    });
    expect(stageProgress(noMark).n).toBe(2);
  });
  it('멈춘 단계 · 진행 중 단계(끝난 수가 아니라 지금 단계)', () => {
    const stopped = flow({
      status: 'stopped',
      endedAt: '2026-09-28T01:21:00.000Z',
      steps: [step('prepare', 'done'), step('publish', 'stopped'), step('drain', 'done')],
    });
    expect(stageProgress(stopped).n).toBe(2);
  });
});

describe('진행 띠 — 한 줄 · 폴링 실패', () => {
  const strip = (over: Partial<Parameters<typeof RunProgressView>[0]>) =>
    renderToStaticMarkup(
      createElement(RunProgressView, {
        type: 'flow',
        snapshot: snap(flow()),
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
    expect(h).toContain('>보내는 중</span>');
  });
  it('첫 조회 실패(받은 응답 없음)도 띠 문구로', () => {
    const h = strip({ snapshot: undefined, pollFailed: true });
    expect(h).toContain(POLL_FAILED_TEXT);
    expect(h).toContain('data-testid="run-progress-strip"');
  });
  it('폴링 실패면 실행 상태와 무관하게 1초 재시도 — 종결 · 실행 없음 · 응답 없음 모두', () => {
    const done = snap(flow({ status: 'completed', endedAt: '2026-09-28T01:21:00.000Z' }));
    expect(runPollInterval(done, true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(snap(null), true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(undefined, true)).toBe(RUN_POLL_MS);
    expect(runPollInterval(done, false)).toBe(false);
  });
});

describe('팝오버 — 시작 202를 받은 뒤에만 닫힌다', () => {
  const err = new ApiError(400, 'common.validation_failed', 'bad');
  it('started만 닫고 409 · 400 · 요청 실패는 열어 둔다', () => {
    expect(closesPopover({ kind: 'started', run: flow() })).toBe(true);
    expect(closesPopover({ kind: 'conflict', type: 'flow', run: null })).toBe(false);
    expect(closesPopover({ kind: 'invalid', error: err })).toBe(false);
    expect(closesPopover({ kind: 'failed', error: new ApiError(0, null, 'x') })).toBe(false);
  });
  const open = (local: typeof PANEL_IDLE) =>
    renderToStaticMarkup(
      createElement(RunControlView, {
        type: 'flow',
        params: FLOW_PARAM_DEFS,
        snapshot: snap(null),
        pollFailed: false,
        local,
        chosen: defaultParams(FLOW_PARAM_DEFS),
        buttonLabel: '직접 보내 보기',
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
const band = (run: RunObjectBody | null) =>
  renderToStaticMarkup(
    createElement(RunProgressView, {
      type: 'flow',
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
        type: 'flow',
        params: FLOW_PARAM_DEFS,
        snapshot: snap(run),
        pollFailed: false,
        local: PANEL_IDLE,
        chosen: defaultParams(FLOW_PARAM_DEFS),
        buttonLabel: '직접 보내 보기',
        onChoose: () => {},
        onStart: () => undefined,
        defaultOpen: true,
        ...over,
      }),
    );

  it('조작부 — 시작 켜짐 · 실행 없음 · 경고가 걸린 선택지면 팝오버에 경고', () => {
    const h = view(null);
    expect(h).toContain('직접 보내 보기');
    expect(h).not.toContain('run-large-warning');
    expect(h).toContain('아직 보내 보지 않았어요');
    const warned = view(null, { params: WARN_DEFS, chosen: { size: 2 } });
    expect(warned).toContain('run-large-warning');
    expect(warned).toContain('수 분 이상 걸려요');
  });
  it('진행 중 — 잠긴 매개변수 · 경고는 고를 때만 · 중단은 진행 띠 오른쪽', () => {
    const h = view(flow());
    expect(h).toContain('실행 중');
    expect(view(flow(), { params: WARN_DEFS, chosen: { size: 2 } })).not.toContain('run-large-warning');
    expect(h).not.toContain('중단');
    expect(band(flow())).toMatch(/<button[^>]*>(?:<svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>)중단<\/button>/);
  });
  it('진행 띠 — flow 진행 막대 · 종결 띠', () => {
    expect(band(flow())).toContain('aria-valuenow="50"');
    expect(band(flow())).toContain('보내는 중');
    expect(band(flow())).toContain('30s / 60s');
    const done = band(flow({ status: 'completed', endedAt: '2026-09-28T01:21:00.000Z' }));
    expect(done).toContain('완료 —');
    expect(done).not.toContain('role="progressbar"');
  });
  it('실행이 없으면 그리지 않는다', () => {
    expect(band(null)).toBe('');
  });
});
