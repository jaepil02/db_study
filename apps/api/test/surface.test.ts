// 표면 계약(S2 · S4) — 떠 있는 api에 블랙박스로 붙는다. SURFACE_BASE_URL이 없으면 건너뛴다(pre-commit은 저장소 없이 돈다).
// 실행: task test-surface(스택 기동 뒤 · 티어 S 시드). 정본 07_api/01 · 04 · 05 · 06 · 11 · 12_security/03.
// 마스터 쓰기는 데이터를 바꾸지 않는 거절 갈래(409 · 400 · 404)만 부른다 — 성공 쓰기와 체인은 통합 확인(S4 W5)이 본다.
// Redis 정지 503(realtime.latest_unavailable)은 저장소를 멈춰야 해서 통합 확인(W3)에서 수동으로 본다.
import {
  ErrorEnvelope,
  HealthResponse,
  LatestDeviceResponse,
  LatestTagResponse,
  ModbusConfigObject,
  SiteObject,
  SWITCHES,
  TagObject,
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

  it('health 200 · 스위치 전부 · S4까지 11개 모두 주입', async () => {
    const r = await api().get('/api/v1/health').expect(200);
    const sw = HealthResponse.parse(r.body).switches;
    expect(Object.keys(sw).sort()).toEqual(SWITCHES.map((s) => s.id).sort());
    const injected = Object.entries(sw)
      .filter(([, s]) => s.impl !== null)
      .map(([id]) => id)
      .sort();
    expect(injected).toEqual(SWITCHES.map((s) => s.id).sort());
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
    // S4 — 해상도 지정 · 긴 범위는 거절하지 않고 받는다(상향)
    const iv = await api()
      .post('/api/v1/timeseries/query')
      .send({ ...body, from: isoAgo(3 * 3_600_000), interval: '1m' })
      .expect(200);
    expect(TimeseriesQueryResponse.parse(iv.body).meta.interval).toBe('1m');
    const wide = await api()
      .post('/api/v1/timeseries/query')
      .send({ ...body, from: isoAgo(365 * 86_400_000), interval: 'raw' })
      .expect(200);
    expect(TimeseriesQueryResponse.parse(wide.body).meta.interval).toBe('1d');
    const noOffset = await api()
      .post('/api/v1/timeseries/query')
      .send({ ...body, from: '2026-01-01T00:00:00' })
      .expect(400);
    expect(noOffset.body.error.code).toBe('common.validation_failed');
  });

  it('마스터 조회 — 목록 봉투 · 단건 · 접속 설정 · 필수 필터 · 404', async () => {
    const sites = await api().get('/api/v1/sites').expect(200);
    expect(sites.body.meta.count).toBe(sites.body.items.length);
    SiteObject.parse(sites.body.items[0]);
    await api().get('/api/v1/devices').expect(400); // siteId 필수
    const tags = await api().get('/api/v1/tags?deviceId=1').expect(200);
    TagObject.parse(tags.body.items[0]);
    TagObject.parse((await api().get('/api/v1/tags/1').expect(200)).body);
    ModbusConfigObject.parse((await api().get('/api/v1/devices/1/modbus-config').expect(200)).body);
    const nf = await api().get('/api/v1/tags/999999').expect(404);
    expect(nf.body.error.code).toBe('common.not_found');
    expect((await api().get('/api/v1/tags/1')).headers['cache-control']).toBe('no-store');
  });

  it('마스터 쓰기 거절 갈래 — 스케일 409 · 불변 400 · 없는 태그 발급 404', async () => {
    const cur = TagObject.parse((await api().get('/api/v1/tags/1').expect(200)).body);
    const sc = await api()
      .patch('/api/v1/tags/1')
      .send({ scale: cur.scale + 1 })
      .expect(409);
    expect(sc.body.error.code).toBe('master.scale_change_forbidden');
    const im = await api().patch('/api/v1/tags/1').send({ deviceId: 2 }).expect(400);
    expect(im.body.error.details.fields).toEqual([{ path: 'body.deviceId', reason: 'immutable' }]);
    const nf = await api()
      .post('/api/v1/tags/999999/reissue')
      .send({ newTagCode: 'X', scale: 2 })
      .expect(404);
    expect(nf.body.error.code).toBe('common.not_found');
  });

  it('단일 태그 최신값 200 모양 · 없는 태그 404', async () => {
    const r = await api().get('/api/v1/realtime/tags/1').expect(200);
    expect(LatestTagResponse.parse(r.body).meta.deviceId).toBe(1);
    await api().get('/api/v1/realtime/tags/999999').expect(404);
  });

  it('내보내기 — CSV 머리 줄 · 범위 1일 초과 400', async () => {
    const q = (from: string) =>
      `/api/v1/timeseries/export?tagIds=1&from=${encodeURIComponent(from)}&to=${encodeURIComponent(isoAgo(0))}`;
    const ok = await api()
      .get(q(isoAgo(60_000)))
      .expect(200);
    expect(ok.text.split('\n')[0]).toBe('"ts","device_id","tag_id","value","quality"');
    await api()
      .get(q(isoAgo(2 * 86_400_000)))
      .expect(400);
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
