// 설비 가동 상태(D-16) — 키가 없으면 기동 기본값(SENSOR_AUTOGEN) · 같은 상태면 쓰지 않는다(바뀐 시각 유지) · 표면 검증 · Redis 불가 503
// 지우는 동안 켜기 거절(SensorPurgeLock · r5 M4) · JSON 본문 필수(지침서 §5-4)
// 계약 packages/shared/src/api/plant.ts PlantPower · PlantPowerRequest · 키 ctl:plant:power(봉인 계열 · TTL 없음)
import { PlantPower } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import type { DurableKeyClient, PlantPowerRecord } from '../src/common/redis/durable-key-client';
import { loadConfig } from '../src/config/app-config';
import { PlantController } from '../src/modules/plant/plant.controller';
import type { PlantOverviewService } from '../src/modules/plant/plant-overview.service';
import { PlantPowerService } from '../src/modules/plant/plant-power.service';
import { SensorPurgeLock } from '../src/modules/plant/sensor-purge-lock';

/** 가짜 Redis 키 — writePlantPower는 같은 상태면 그대로 두는 스크립트와 같은 규칙 */
function fakeDurable() {
  const s = { rec: null as PlantPowerRecord | null, writes: 0, fail: false };
  const durable = {
    async readPlantPower() {
      if (s.fail) throw new Error('Redis 접속 불가');
      return s.rec;
    },
    async writePlantPower(state: 'on' | 'off', changedAtMs: number) {
      if (s.fail) throw new Error('Redis 접속 불가');
      s.writes += 1;
      if (s.rec?.state !== state) s.rec = { state, changedAtMs };
      return s.rec;
    },
    async clearPlantPower() {
      s.rec = null;
    },
  } as unknown as DurableKeyClient;
  return { s, durable };
}

const svcOf = (autogen: 'on' | 'off') => {
  const f = fakeDurable();
  const lock = new SensorPurgeLock();
  return {
    ...f,
    lock,
    svc: new PlantPowerService(
      f.durable,
      loadConfig({ WORKER_POOL_SIZE: '1', SENSOR_AUTOGEN: autogen }),
      lock,
    ),
  };
};

const JSON_CT = 'application/json';

describe('PlantPowerService', () => {
  it('키가 없으면 기동 기본값 · changedAt null', async () => {
    expect(await svcOf('off').svc.read()).toEqual({ on: false, changedAt: null, changedAtMs: null });
    expect(await svcOf('on').svc.read()).toMatchObject({ on: true, changedAt: null });
    expect(await svcOf('on').svc.isOn()).toBe(true);
  });

  it('켜기 → 바뀐 시각 기록 · 같은 상태로 다시 → 쓰지 않고 시각 유지 · 끄기 → 시각 갱신', async () => {
    const { svc, s } = svcOf('off');
    const on = await svc.set(true, 1_000);
    expect(on).toMatchObject({ on: true, changedAt: new Date(1_000).toISOString(), changedAtMs: 1_000 });
    expect(PlantPower.safeParse({ on: on.on, changedAt: on.changedAt }).success).toBe(true);
    expect(await svc.set(true, 2_000)).toMatchObject({ changedAtMs: 1_000 });
    expect(s.writes).toBe(1);
    expect(await svc.set(false, 3_000)).toMatchObject({ on: false, changedAtMs: 3_000 });
    expect(await svc.isOn()).toBe(false);
  });

  it('키가 없고 기본값과 같은 상태를 요청하면 키를 만들지 않는다', async () => {
    const { svc, s } = svcOf('off');
    expect(await svc.set(false, 1_000)).toEqual({ on: false, changedAt: null, changedAtMs: null });
    expect(s.writes).toBe(0);
  });

  it('기동 초기화 — 키를 지워 기동 기본값으로 돌아간다', async () => {
    const { svc } = svcOf('off');
    await svc.set(true, 1_000);
    await svc.resetToDefault();
    expect(await svc.read()).toMatchObject({ on: false, changedAt: null });
  });

  it('지우는 동안 켜기는 400 · 끄기는 받는다 · 끝나면 다시 켤 수 있다', async () => {
    const { svc, s, lock } = svcOf('off');
    expect(lock.tryBegin()).toBe(true);
    await expect(svc.set(true, 1_000)).rejects.toMatchObject({
      code: 'common.validation_failed',
      details: { fields: [{ path: 'purge', reason: 'enum' }] },
    });
    expect(s.writes).toBe(0);
    expect(await svc.set(false, 1_000)).toMatchObject({ on: false });
    lock.end();
    expect(await svc.set(true, 2_000)).toMatchObject({ on: true });
    expect(lock.plantTurningOn).toBe(false);
  });

  it('읽기 실패는 던진다 — 기본값으로 덮지 않는다', async () => {
    const { svc, s } = svcOf('off');
    s.fail = true;
    await expect(svc.isOn()).rejects.toThrow(/Redis/);
  });
});

describe('PlantController — 설비 가동 표면', () => {
  function ctl(autogen: 'on' | 'off' = 'off') {
    const f = svcOf(autogen);
    return { ...f, c: new PlantController(f.svc, {} as PlantOverviewService) };
  }

  it('GET · POST — 계약 PlantPower 모양(changedAtMs를 싣지 않는다)', async () => {
    const { c } = ctl();
    expect(await c.getPower()).toEqual({ on: false, changedAt: null });
    const r = await c.setPower({ on: true }, JSON_CT);
    expect(PlantPower.safeParse(r).success).toBe(true);
    expect(r.on).toBe(true);
    expect(Object.keys(r).sort()).toEqual(['changedAt', 'on']);
  });

  it('본문 검증 — on 누락 · 타입 · 모르는 필드는 400 common.validation_failed', async () => {
    const { c } = ctl();
    await expect(c.setPower({}, JSON_CT)).rejects.toMatchObject({ code: 'common.validation_failed' });
    await expect(c.setPower({ on: 'yes' }, JSON_CT)).rejects.toMatchObject({
      code: 'common.validation_failed',
    });
    await expect(c.setPower({ on: true, extra: 1 }, JSON_CT)).rejects.toMatchObject({
      code: 'common.validation_failed',
      details: { fields: [{ path: 'body.extra', reason: 'unknown' }] },
    });
    await expect(c.setPower(undefined, JSON_CT)).rejects.toMatchObject({
      code: 'common.validation_failed',
      details: { fields: [{ path: 'body', reason: 'type' }] },
    });
  });

  it('JSON 본문 필수 — Content-Type이 application/json이 아니면(text/plain · 폼 · 없음) 400 · 키를 쓰지 않는다', async () => {
    const { c, s } = ctl();
    for (const ct of [undefined, 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
      await expect(c.setPower({ on: true }, ct)).rejects.toMatchObject({
        code: 'common.validation_failed',
        details: { fields: [{ path: 'header.content-type', reason: 'enum' }] },
      });
      // text/plain 본문은 파서가 문자열로 넘긴다 — JSON처럼 생겨도 받지 않는다
      await expect(c.setPower('{"on":true}', ct)).rejects.toMatchObject({ code: 'common.validation_failed' });
    }
    expect(s.writes).toBe(0);
    expect(await c.setPower({ on: true }, 'Application/JSON; charset=utf-8')).toMatchObject({ on: true });
  });

  it('지우는 동안 켜기 — 설계된 거절(400)을 Redis 불가로 바꾸지 않는다', async () => {
    const { c, lock } = ctl();
    lock.tryBegin();
    await expect(c.setPower({ on: true }, JSON_CT)).rejects.toMatchObject({
      code: 'common.validation_failed',
      status: 400,
    });
  });

  it('Redis 불가 → 503 realtime.latest_unavailable(읽기 · 쓰기)', async () => {
    const { c, s } = ctl();
    s.fail = true;
    await expect(c.getPower()).rejects.toMatchObject({ code: 'realtime.latest_unavailable', status: 503 });
    await expect(c.setPower({ on: true }, JSON_CT)).rejects.toMatchObject({
      code: 'realtime.latest_unavailable',
    });
  });
});
