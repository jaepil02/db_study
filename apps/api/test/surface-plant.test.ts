// 설비 가동 · HMI 개요 표면 계약(D-16) — 떠 있는 api에 블랙박스로 붙는다. SURFACE_BASE_URL이 없으면 건너뛴다(pre-commit은 저장소 없이 돈다).
// 실행: SURFACE_BASE_URL=http://127.0.0.1:13000 pnpm --filter @db-study/api exec vitest run test/surface-plant.test.ts(카드 라인 시드 · APP_ROLE all).
// 켜고 끄기 시험은 설비 가동을 몇 초 켠다 — 그동안의 센서 데이터(초당 약 231점)가 스트림 → ClickHouse에 남는다. 끝나면 처음 상태로 되돌린다.
import { ErrorEnvelope, HealthResponse, PlantOverview, PlantPower } from '@db-study/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const BASE = process.env.SURFACE_BASE_URL;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!BASE)('설비 가동 · HMI 개요 표면', () => {
  const api = () => request(BASE as string);

  it('GET /api/v1/plant/power 200 — 계약 PlantPower · no-store', async () => {
    const r = await api().get('/api/v1/plant/power').expect(200);
    expect(PlantPower.safeParse(r.body).success).toBe(true);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('POST /api/v1/plant/power 본문 위반 → 400 common.validation_failed(누락 · 타입 · 모르는 필드)', async () => {
    for (const body of [{}, { on: 'yes' }, { on: true, extra: 1 }]) {
      const r = await api().post('/api/v1/plant/power').send(body).expect(400);
      expect(ErrorEnvelope.parse(r.body).error.code).toBe('common.validation_failed');
    }
  });

  it('GET /api/v1/plant/overview 200 — 계약 PlantOverview · 카드 라인이면 라인 3 × 설비 10 · 태그 129', async () => {
    const r = await api().get('/api/v1/plant/overview').expect(200);
    const body = PlantOverview.parse(r.body);
    if (body.lines.length > 0) {
      expect(body.lines.map((l) => l.code)).toEqual(['L1', 'L2', 'L3']);
      expect(body.lines.every((l) => l.devices.length === 10)).toBe(true);
      expect(body.lines.flatMap((l) => l.devices.flatMap((d) => d.tags))).toHaveLength(129);
    }
    const t = body.totals;
    expect(t.running + t.idle + t.stopped + t.offline).toBe(
      body.lines.reduce((n, l) => n + l.devices.length, 0),
    );
  });

  it('켜기 → 개요가 통신 중 설비를 보이고 health run.sensorAutogen on → 끄기 → 전부 정지 · off(처음 상태로 되돌림)', async () => {
    const first = PlantPower.parse((await api().get('/api/v1/plant/power').expect(200)).body);
    const overview = async () =>
      PlantOverview.parse((await api().get('/api/v1/plant/overview').expect(200)).body);
    if ((await overview()).lines.length === 0) return; // 카드 라인 시드가 아니면 켜고 끄기를 보지 않는다
    try {
      const on = PlantPower.parse(
        (await api().post('/api/v1/plant/power').send({ on: true }).expect(200)).body,
      );
      expect(on.on).toBe(true);
      let live = 0;
      for (let i = 0; i < 20 && live === 0; i++) {
        await sleep(1000);
        const o = await overview();
        live = o.totals.running + o.totals.idle;
        if (live > 0) {
          expect(o.power).toBe(true);
          expect(o.totals.pointsPerSec).toBeGreaterThan(0);
        }
      }
      expect(live).toBeGreaterThan(0);
      const h = HealthResponse.parse((await api().get('/api/v1/health')).body);
      expect(h.run.sensorAutogen).toBe('on');
      await api().post('/api/v1/plant/power').send({ on: false }).expect(200);
      const off = await overview();
      expect(off.power).toBe(false);
      expect(off.totals.stopped).toBe(30);
      await sleep(2000);
      expect(HealthResponse.parse((await api().get('/api/v1/health')).body).run.sensorAutogen).toBe('off');
    } finally {
      await api().post('/api/v1/plant/power').send({ on: first.on });
    }
  }, 60_000);
});
