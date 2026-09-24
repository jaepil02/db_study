// 표면 계약(S2) — 떠 있는 api에 블랙박스로 붙는다. SURFACE_BASE_URL이 없으면 건너뛴다(pre-commit은 저장소 없이 돈다).
// 실행: task test-surface(스택 기동 뒤). 정본 07_api/01 · 05 · 06 · 11 · 12_security/03.
// Redis 정지 503(realtime.latest_unavailable)은 저장소를 멈춰야 해서 통합 확인(W3)에서 수동으로 본다.
import {
  ErrorEnvelope,
  HealthResponse,
  LatestDeviceResponse,
  SWITCHES,
  TimeseriesQueryResponse,
  WS_CLOSE,
} from '@db-study/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';

const BASE = process.env.SURFACE_BASE_URL;
const ORIGIN = 'http://localhost:3001';

function wsClose(
  headers: Record<string, string>,
  path = '/ws/realtime',
): Promise<{ code?: number; status?: number }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${(BASE ?? '').replace(/^http/, 'ws')}${path}`, { headers });
    ws.on('close', (code) => resolve({ code }));
    ws.on('unexpected-response', (_req, res) => {
      resolve({ status: res.statusCode });
      ws.terminate();
    });
    ws.on('error', () => undefined);
  });
}

function isoAgo(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

describe.skipIf(!BASE)('api 표면 계약', () => {
  const api = () => request(BASE as string);

  it('health 200 · 스위치 전부 · 주입 구현은 도입된 셋만', async () => {
    const r = await api().get('/api/v1/health').expect(200);
    const sw = HealthResponse.parse(r.body).switches;
    expect(Object.keys(sw).sort()).toEqual(SWITCHES.map((s) => s.id).sort());
    const injected = Object.entries(sw)
      .filter(([, s]) => s.impl !== null)
      .map(([id]) => id)
      .sort();
    expect(injected).toEqual(['SW-01', 'SW-02', 'SW-03']);
  });

  it('Host 밖 → 400 validation_failed header.host enum', async () => {
    const r = await api().get('/api/v1/health').set('Host', 'evil.example').expect(400);
    const e = ErrorEnvelope.parse(r.body);
    expect(e.error.code).toBe('common.validation_failed');
    expect(r.body.error.details.fields).toEqual([{ path: 'header.host', reason: 'enum' }]);
  });

  it('CORS — 허용 오리진만 헤더가 붙고 직결 표면 밖에는 붙지 않는다', async () => {
    const ok = await api().get('/api/v1/realtime/devices/1/tags').set('Origin', ORIGIN);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    const other = await api().get('/api/v1/realtime/devices/1/tags').set('Origin', 'http://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    const health = await api().get('/api/v1/health').set('Origin', ORIGIN);
    expect(health.headers['access-control-allow-origin']).toBeUndefined();
    const pre = await api()
      .options('/api/v1/timeseries/query')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(pre.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(pre.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('최신값 200 모양 · 마스터에 없는 설비 404', async () => {
    const r = await api().get('/api/v1/realtime/devices/1/tags').expect(200);
    LatestDeviceResponse.parse(r.body);
    const nf = await api().get('/api/v1/realtime/devices/999999/tags').expect(404);
    expect(ErrorEnvelope.parse(nf.body).error.code).toBe('common.not_found');
    const bad = await api().get('/api/v1/realtime/devices/abc/tags').expect(400);
    expect(bad.body.error.code).toBe('common.validation_failed');
  });

  it('시계열 raw 200 · 태그 상한 · 해상도 · 범위 거절', async () => {
    const body = { tagIds: [1], from: isoAgo(60_000), to: isoAgo(0) };
    const r = await api().post('/api/v1/timeseries/query').send(body).expect(200);
    const q = TimeseriesQueryResponse.parse(r.body);
    expect(q.meta.interval).toBe('raw');
    const many = Array.from({ length: 51 }, (_, i) => i + 1);
    const t = await api()
      .post('/api/v1/timeseries/query')
      .send({ ...body, tagIds: many })
      .expect(400);
    expect(t.body.error.code).toBe('timeseries.too_many_tags');
    const iv = await api()
      .post('/api/v1/timeseries/query')
      .send({ ...body, interval: '1m' })
      .expect(400);
    expect(iv.body.error.details.fields).toEqual([{ path: 'body.interval', reason: 'enum' }]);
    const wide = await api()
      .post('/api/v1/timeseries/query')
      .send({ ...body, from: isoAgo(3_600_000) })
      .expect(400);
    expect(wide.body.error.details.fields).toEqual([{ path: 'body.to', reason: 'range' }]);
    const noOffset = await api()
      .post('/api/v1/timeseries/query')
      .send({ ...body, from: '2026-01-01T00:00:00' })
      .expect(400);
    expect(noOffset.body.error.code).toBe('common.validation_failed');
  });

  it('WS — Host 밖은 업그레이드 전 400 · 다른 Origin 4403 · URL devices 4400', async () => {
    expect(await wsClose({ Host: 'evil.example', Origin: ORIGIN })).toEqual({ status: 400 });
    expect(await wsClose({ Origin: 'http://evil.example' })).toEqual({ code: WS_CLOSE.forbidden });
    expect(await wsClose({ Origin: ORIGIN }, '/ws/realtime?devices=1')).toEqual({
      code: WS_CLOSE.invalid_message,
    });
  });

  it('WS — subscribe → subscribed · rt 프레임', async () => {
    const ws = new WebSocket(`${(BASE as string).replace(/^http/, 'ws')}/ws/realtime`, {
      headers: { Origin: ORIGIN },
    });
    const got: { type: string }[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`rt 프레임 없음 — ${JSON.stringify(got)}`)), 5000);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'subscribe', devices: [1, 999999] })));
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString());
        got.push(m);
        if (m.type === 'rt') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    ws.close();
    const sub = got.find((m) => m.type === 'subscribed') as unknown as {
      devices: number[];
      rejected: { deviceId: number; reason: string }[];
    };
    expect(sub.devices).toEqual([1]);
    expect(sub.rejected).toEqual([{ deviceId: 999999, reason: 'not_found' }]);
  });
});
