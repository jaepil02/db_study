// 표면 계약(D-16 직접 비교 · 센서 데이터) — 떠 있는 api에 블랙박스로 붙는다. SURFACE_BASE_URL이 없으면 건너뛴다(surface.test.ts와 같은 방식).
// 데이터를 바꾸지 않는 갈래만 부른다: 결과 조회 · 현황 · 검증 400(JSON 본문 필수 포함) · 지우기의 막힘(409 — 설비 가동이 켜져 있거나 실행이 진행 중일 때만).
// 실제 지우기 · 직접 비교 실행(넣기)은 저장소를 바꾸므로 여기서 부르지 않는다 — 리드의 실기동 확인 순서가 본다.
import {
  CompareLatestBody,
  ErrorEnvelope,
  HealthResponse,
  PlantPower,
  RUN_TERMINAL,
  RunCurrentBody,
  SensorDataStats,
} from '@db-study/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const BASE = process.env.SURFACE_BASE_URL;

describe.skipIf(!BASE)('직접 비교 · 센서 데이터 표면', () => {
  const api = () => request(BASE as string);

  it('GET /api/v1/runs/latest?type=compare — 200 CompareLatestBody · no-store', async () => {
    const r = await api().get('/api/v1/runs/latest?type=compare').expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    CompareLatestBody.parse(r.body);
  });

  it('GET /api/v1/runs/latest — type 없음 · 다른 값은 400 validation_failed', async () => {
    for (const url of ['/api/v1/runs/latest', '/api/v1/runs/latest?type=flow']) {
      const r = await api().get(url).expect(400);
      expect(ErrorEnvelope.parse(r.body).error.code).toBe('common.validation_failed');
    }
  });

  it('POST /api/v1/runs compare — part 없음 · 건수 값 밖 · 옛 시간 구간 키는 400(실행을 만들지 않는다)', async () => {
    for (const body of [
      { type: 'compare' },
      { type: 'compare', params: { part: 'ingest', rows: 5 } },
      { type: 'compare', params: { part: 'ingest', spanHours: 1 } },
    ]) {
      const r = await api().post('/api/v1/runs').send(body).expect(400);
      expect(ErrorEnvelope.parse(r.body).error.code).toBe('common.validation_failed');
    }
  });

  it('GET /api/v1/data/sensor/stats — 200 SensorDataStats · no-store', async () => {
    const r = await api().get('/api/v1/data/sensor/stats').expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    SensorDataStats.parse(r.body);
  });

  it('health SW-09 — 값 off · on · gated 중 하나 · gated · on이면 PostgresControlSink', async () => {
    const sw = HealthResponse.parse((await api().get('/api/v1/health').expect(200)).body).switches['SW-09'];
    expect(['off', 'on', 'gated']).toContain(sw?.value);
    expect(sw?.impl).toBe(sw?.value === 'off' ? 'NoopControlSink' : 'PostgresControlSink');
  });

  it('POST /api/v1/data/sensor/purge — 설비 가동 중 · 실행 중이면 409 purge_blocked(아니면 지우지 않으려고 부르지 않는다)', async () => {
    const power = PlantPower.parse((await api().get('/api/v1/plant/power').expect(200)).body);
    const { run } = RunCurrentBody.parse((await api().get('/api/v1/runs/current').expect(200)).body);
    const running = run !== null && !RUN_TERMINAL.has(run.status);
    if (!power.on && !running) return;
    const r = await api().post('/api/v1/data/sensor/purge').send({}).expect(409);
    const e = ErrorEnvelope.parse(r.body).error;
    expect(e.code).toBe('data.purge_blocked');
    expect(e.details).toEqual({ reason: running ? 'run_in_progress' : 'plant_running' });
  });

  it('상태를 바꾸는 POST — JSON 본문이 아니면 400(지우기 · 설비 가동 · 실행 시작 · 중단 — 아무것도 바꾸지 않는다)', async () => {
    const cases: [string, string | undefined, string | undefined][] = [
      ['/api/v1/data/sensor/purge', undefined, undefined],
      ['/api/v1/data/sensor/purge', '{}', 'text/plain'],
      ['/api/v1/plant/power', '{"on":true}', 'text/plain'],
      ['/api/v1/runs', '{"type":"flow"}', 'text/plain'],
      ['/api/v1/runs/00000000-0000-4000-8000-000000000000/stop', undefined, undefined],
    ];
    for (const [url, body, type] of cases) {
      let req = api().post(url);
      if (type) req = req.set('Content-Type', type);
      const r = await (body === undefined ? req : req.send(body)).expect(400);
      expect(ErrorEnvelope.parse(r.body).error, url).toMatchObject({
        code: 'common.validation_failed',
        details: { fields: [{ path: 'header.content-type', reason: 'enum' }] },
      });
    }
    // 지우기 본문은 빈 객체만
    const extra = await api().post('/api/v1/data/sensor/purge').send({ x: 1 }).expect(400);
    expect(ErrorEnvelope.parse(extra.body).error.code).toBe('common.validation_failed');
  });
});
