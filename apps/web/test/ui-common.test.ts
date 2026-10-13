// 웹 공통 UI 조각 — 저장소 토큰 · 진행 띠 순수 로직 · 정적 렌더
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunProgressView } from '../components/runs/run-progress';
import { stageProgress } from '../components/runs/run-spec';
import { STORE, STORE_KEYS } from '../components/ui/store';
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

describe('저장소 토큰', () => {
  it('색 3 · 라벨 · 짧은 이름', () => {
    expect(STORE_KEYS).toEqual(['ch', 'pg', 'redis']);
    expect(STORE.ch).toMatchObject({ color: '#d97706', label: 'ClickHouse', short: 'CH' });
    expect(STORE.pg).toMatchObject({ color: '#2563eb', label: 'PostgreSQL', short: 'PG' });
    expect(STORE.redis).toMatchObject({ color: '#dc2626', label: 'Redis', short: 'Redis' });
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
    expect(h).toContain('>보내는 중 · 단계 2/3</span>');
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
  it('진행 중 — 중단은 진행 띠 오른쪽', () => {
    expect(band(flow())).toMatch(/<button[^>]*>(?:<svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg>)중단<\/button>/);
  });
  it('진행 띠 — 종결 띠', () => {
    const done = band(flow({ status: 'completed', endedAt: '2026-09-28T01:21:00.000Z' }));
    expect(done).toContain('완료 —');
    expect(done).not.toContain('role="progressbar"');
  });
  it('실행이 없으면 그리지 않는다', () => {
    expect(band(null)).toBe('');
  });
});
