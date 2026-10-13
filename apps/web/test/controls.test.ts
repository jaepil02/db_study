// 공용 컨트롤 2(설비 가동 스위치 · 센서 데이터 지우기) · BFF 3 — 정본 docs/08_screen/10_lab_screen.md §공용 컨트롤
// 표면은 가짜 응답으로 대신한다 — 계약(packages/shared/src/api/plant.ts · data.ts) 모양만 본다.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as bffPurge from '../app/bff/data/sensor/purge/route';
import * as bffStats from '../app/bff/data/sensor/stats/route';
import * as bffPower from '../app/bff/plant/power/route';
import {
  PURGE_BLOCKED_TEXT,
  powerErrorText,
  purgeErrorText,
  purgeLines,
  purgeResultText,
  rowsText,
  tookText,
} from '../components/controls/control-text';
import {
  bffJson,
  fetchPower,
  fetchSensorStats,
  purgeSensorData,
  setPower,
} from '../components/controls/data';
import { PlantPowerSwitchView } from '../components/controls/plant-power';
import { PurgeButtonView, type PurgeButtonViewProps } from '../components/controls/purge-button';
import { ApiError } from '../lib/api';
import type { SensorDataStatsBody, SensorPurgeResultBody } from '../lib/shared';

/** 통합 실측(2026-10-11 · 하루치 넣기 뒤) 그대로의 현황 */
const STATS: SensorDataStatsBody = {
  at: '2026-10-11T10:23:10.203Z',
  clickhouse: { rows: 19_963_467, bytes: 52_502_356 },
  postgres: { rows: 19_958_400, bytes: 2_358_509_568 },
  redis: { streamLength: 200_022, latestKeys: 30 },
  compareRange: { start: '2026-10-06T15:00:00.000Z', end: '2026-10-07T15:00:00.000Z' },
  compareRows: { clickhouse: 19_958_400, postgres: 19_958_400 },
};

const PURGED: SensorPurgeResultBody = {
  at: '2026-10-11T10:30:00.000Z',
  clickhouse: { rows: 19_963_467, elapsedMs: 412.5 },
  postgres: { rows: 19_958_400, elapsedMs: 820.1 },
  redis: { streamEntries: 200_022, keys: 31, elapsedMs: 12.4 },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const blocked = (reason: string) =>
  json(409, { error: { code: 'data.purge_blocked', message: '막힘', details: { reason } } });

describe('문구', () => {
  it('행 수 · 걸린 시간 쉬운 표기', () => {
    expect(rowsText(19_963_467)).toBe('1,996만 행');
    expect(rowsText(831_600)).toBe('83만 행');
    expect(rowsText(9_999)).toBe('9,999행');
    expect(rowsText(230_000_000)).toBe('2.3억 행');
    expect(tookText(412.5)).toBe('413ms');
    expect(tookText(1_245)).toBe('1.2s');
  });

  it('지울 양 3줄 — 저장소별 행 · 크기 · 정확한 값은 툴팁', () => {
    const lines = purgeLines(STATS);
    expect(lines.map((l) => l.key)).toEqual(['ch', 'pg', 'redis']);
    expect(lines[0]?.amount).toBe('1,996만 행 · 53MB');
    expect(lines[1]?.amount).toBe('1,996만 행 · 2.4GB');
    expect(lines[2]?.amount).toBe('대기줄 200,022개 · 지금 값 30개');
    expect(lines[0]?.exact).toContain('19,963,467행');
  });

  it('지운 결과 한 줄 · 409 이유별 · 그 밖 실패', () => {
    expect(purgeResultText(PURGED)).toBe(
      '지웠어요 — ClickHouse 1,996만 행 · PostgreSQL 1,996만 행 · Redis 200,053개 · 걸린 시간 1.2s',
    );
    const e409 = (reason: string) =>
      new ApiError(409, 'data.purge_blocked', '막힘', { reason }) as Pick<
        ApiError,
        'status' | 'code' | 'details'
      >;
    expect(purgeErrorText(e409('plant_running'))).toBe(PURGE_BLOCKED_TEXT.plant_running);
    expect(purgeErrorText(e409('run_in_progress'))).toBe(PURGE_BLOCKED_TEXT.run_in_progress);
    expect(purgeErrorText(e409('stream_backlog'))).toBe(PURGE_BLOCKED_TEXT.stream_backlog);
    expect(PURGE_BLOCKED_TEXT.stream_backlog).toContain('대기줄');
    expect(PURGE_BLOCKED_TEXT.plant_running).toContain('멈추는 중');
    expect(purgeErrorText(e409('other'))).toContain('지금은 지울 수 없어요');
    expect(purgeErrorText(new ApiError(0, null, 'x'))).toContain('서버에 닿지 못했어요');
    expect(purgeErrorText(new ApiError(500, null, 'x'))).toContain('지우지 못했어요');
    expect(powerErrorText(new ApiError(503, 'realtime.latest_unavailable', 'x'))).toContain('Redis');
    expect(powerErrorText(null)).toContain('다시 눌러');
  });
});

describe('요청(가짜 fetch)', () => {
  it('설비 가동 읽기 · 켜기 — POST 본문 {on}', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return json(200, { on: init?.method === 'POST', changedAt: null });
    };
    expect(await fetchPower(f)).toEqual({ on: false, changedAt: null });
    expect(await setPower(true, f)).toEqual({ on: true, changedAt: null });
    expect(calls[1]?.url).toBe('/bff/plant/power');
    expect(calls[1]?.init?.body).toBe('{"on":true}');
  });

  it('계약과 다른 응답은 던진다 · 봉투는 code · details를 싣는다 · 닿지 못하면 status 0', async () => {
    await expect(fetchSensorStats(async () => json(200, { nope: 1 }))).rejects.toMatchObject({ status: 200 });
    await expect(purgeSensorData(async () => blocked('plant_running'))).rejects.toMatchObject({
      status: 409,
      code: 'data.purge_blocked',
      details: { reason: 'plant_running' },
    });
    await expect(
      bffJson('/x', undefined, async () => {
        throw new Error('down');
      }),
    ).rejects.toMatchObject({ status: 0 });
    expect(await purgeSensorData(async () => json(200, PURGED))).toEqual(PURGED);
  });

  it('지우기 POST — JSON 본문 {}(api는 상태를 바꾸는 POST에 JSON 본문을 요구한다)', async () => {
    let seen: RequestInit | undefined;
    await purgeSensorData(async (_url, init) => {
      seen = init;
      return json(200, PURGED);
    });
    expect(seen?.method).toBe('POST');
    expect(seen?.body).toBe('{}');
    expect(new Headers(seen?.headers).get('content-type')).toBe('application/json');
  });
});

describe('BFF 3 — 받은 상태 · 본문을 그대로 · no-store · api에 닿지 못하면 502 · 다른 출처 POST는 403', () => {
  afterEach(() => vi.unstubAllGlobals());

  const post = (url: string, body: string | null, headers: Record<string, string> = {}) =>
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === null ? {} : { body }),
    });

  it('설비 가동 GET · POST — Content-Type · 본문을 바꾸지 않고 넘긴다', async () => {
    const seen: { url: string; method: string; body: unknown; type: string | null }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      seen.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body,
        type: new Headers(init?.headers).get('content-type'),
      });
      return json(200, { on: true, changedAt: '2026-10-11T10:00:00.000Z' });
    });
    const got = await bffPower.GET(new Request('http://x/bff/plant/power'));
    expect(got.status).toBe(200);
    expect(got.headers.get('cache-control')).toBe('no-store');
    const ok = await bffPower.POST(
      post('http://x/bff/plant/power', '{"on":true}', { origin: 'http://localhost:13001' }),
    );
    expect(ok.status).toBe(200);
    expect(seen[1]).toMatchObject({ method: 'POST', body: '{"on":true}', type: 'application/json' });
    expect(seen[0]?.url).toMatch(/\/api\/v1\/plant\/power$/);
    // text/plain을 JSON으로 고쳐 넘기지 않는다 — 판정은 api(415 · 400)
    await bffPower.POST(post('http://x/bff/plant/power', '{"on":true}', { 'content-type': 'text/plain' }));
    expect(seen[2]?.type).toBe('text/plain');
  });

  it('다른 출처 POST는 api에 닿기 전에 403(본문 없음) · 허용 출처 2 · Origin 없음은 통과', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      return json(200, PURGED);
    });
    const evil = { origin: 'http://evil.example' };
    const denied = await bffPurge.POST(post('http://x/bff/data/sensor/purge', '{}', evil));
    expect(denied.status).toBe(403);
    expect(await denied.text()).toBe('');
    expect((await bffPower.POST(post('http://x/bff/plant/power', '{"on":true}', evil))).status).toBe(403);
    expect(
      (await bffPurge.POST(post('http://x/bff/data/sensor/purge', '{}', { origin: 'null' }))).status,
    ).toBe(403);
    expect(calls).toEqual([]);
    for (const origin of ['http://localhost:13001', 'http://127.0.0.1:13001'])
      expect((await bffPurge.POST(post('http://x/bff/data/sensor/purge', '{}', { origin }))).status).toBe(
        200,
      );
    expect((await bffPurge.POST(post('http://x/bff/data/sensor/purge', '{}'))).status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it('현황 GET · 지우기 POST 409 그대로(본문 {} 중계) · 닿지 못하면 502', async () => {
    vi.stubGlobal('fetch', async () => json(200, STATS));
    expect(await (await bffStats.GET()).json()).toEqual(STATS);
    let body: unknown;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      body = init?.body;
      return blocked('run_in_progress');
    });
    const r = await bffPurge.POST(post('http://x/bff/data/sensor/purge', '{}'));
    expect(r.status).toBe(409);
    expect(body).toBe('{}');
    expect(await r.json()).toMatchObject({ error: { details: { reason: 'run_in_progress' } } });
    vi.stubGlobal('fetch', async () => {
      throw new Error('refused');
    });
    expect((await bffPurge.POST(post('http://x/bff/data/sensor/purge', '{}'))).status).toBe(502);
  });
});

describe('화면(정적 렌더)', () => {
  it('설비 가동 — 스위치 역할 · 켜짐/꺼짐 글자 · 바뀌는 중 잠금 · 실패 문구', () => {
    const view = (p: Partial<Parameters<typeof PlantPowerSwitchView>[0]>) =>
      renderToStaticMarkup(
        createElement(PlantPowerSwitchView, {
          power: { on: false, changedAt: null },
          readFailed: false,
          pendingTo: null,
          error: null,
          onToggle: () => undefined,
          ...p,
        }),
      );
    expect(view({})).toContain('role="switch"');
    expect(view({})).toContain('aria-checked="false"');
    expect(view({})).toContain('꺼짐');
    expect(view({ power: { on: true, changedAt: '2026-10-11T09:44:20.762Z' } })).toContain('켜짐');
    expect(view({ power: { on: true, changedAt: '2026-10-11T09:44:20.762Z' } })).toContain('18:44:20 KST');
    const pending = view({ pendingTo: true });
    expect(pending).toContain('켜는 중이에요');
    expect(pending).toMatch(/<button[^>]*disabled=""/);
    expect(view({ power: null })).toMatch(/<button[^>]*disabled=""/);
    expect(view({ error: new ApiError(500, null, 'x') })).toContain('바꾸지 못했어요');
  });

  const purge = (p: Partial<PurgeButtonViewProps>) =>
    renderToStaticMarkup(
      createElement(PurgeButtonView, {
        open: true,
        onOpen: () => undefined,
        onClose: () => undefined,
        stats: STATS,
        statsFailed: false,
        plantOn: false,
        purging: false,
        result: null,
        error: null,
        onPurge: () => undefined,
        ...p,
      }),
    );

  it('지우기 확인 창 — 지울 양 · 남는 것 · 지우기 버튼(설비 가동 중이면 미리 막고 이유)', () => {
    const html = purge({});
    expect(html).toContain('쌓인 센서 데이터를 지울까요?');
    expect(html).toContain('1,996만 행 · 53MB');
    expect(html).toContain('남는 것');
    expect(html).not.toMatch(/data-testid="purge-confirm"[^>]*disabled=""/);
    const on = purge({ plantOn: true });
    expect(on).toContain(PURGE_BLOCKED_TEXT.plant_running);
    expect(on).toMatch(/data-testid="purge-confirm"[^>]*disabled=""/);
    expect(purge({ open: false })).not.toContain('purge-dialog');
  });

  it('지우기 확인 창 — 경고 대화 상자(alertdialog · aria-modal) · 제목으로 이름', () => {
    const html = purge({});
    expect(html).toMatch(/role="alertdialog"[^>]*aria-modal="true"/);
    // 열 때 포커스는 [닫기] — 되돌릴 수 없는 [지우기]가 아니라 덜 위험한 쪽 먼저(APG)
    expect([...html.matchAll(/data-autofocus="true"/g)]).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*data-autofocus="true"[^>]*>닫기<\/button>/);
    expect(html).not.toMatch(/data-autofocus="true"[^>]*data-testid="purge-confirm"/);
    expect(html).not.toMatch(/data-testid="purge-confirm"[^>]*data-autofocus/);
    expect(html).toMatch(/aria-labelledby="([^"]+)"[\s\S]*id="\1"/);
  });

  it('지우는 중 · 결과 · 409 문구', () => {
    expect(purge({ purging: true })).toContain('지우는 중이에요');
    const done = purge({ result: PURGED });
    expect(done).toContain('지웠어요 — ClickHouse 1,996만 행');
    expect(done).not.toContain('purge-confirm');
    expect(
      purge({ error: new ApiError(409, 'data.purge_blocked', 'x', { reason: 'run_in_progress' }) }),
    ).toContain(PURGE_BLOCKED_TEXT.run_in_progress);
  });
});
