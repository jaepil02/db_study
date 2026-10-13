// HMI 개요(D-16 결정 3) — 상태 판정(끊김 문턱 · 가동 꺼짐 · 깨어나는 중) · 메타 행 → 라인 · 설비 · 태그 · 초당 점 수(measured · nominal) · 계약 모양
// 계약 packages/shared/src/api/plant.ts PlantOverview · 판정 apps/api/src/modules/plant/plant-overview.ts
import { CARD_LINES, PLANT_OFFLINE_AFTER_MS, PlantOverview, QUALITY } from '@db-study/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Postgres } from '../src/common/postgres/postgres.module';
import type { DurableKeyClient } from '../src/common/redis/durable-key-client';
import { seedLayout } from '../src/db/seed-plan';
import {
  buildOverview,
  EmitRateMeter,
  judgeDeviceState,
  kindOf,
  metaFromRows,
  type PlantMetaRow,
} from '../src/modules/plant/plant-overview';
import { PlantOverviewService } from '../src/modules/plant/plant-overview.service';
import type { PlantPowerService } from '../src/modules/plant/plant-power.service';
import type { PlantRuntime } from '../src/modules/plant/plant-runtime.service';

const NOW = 1_760_000_000_000;

/** 카드 라인 시드 → 개요 메타 행(시드 순서대로 device_id 1~30 · tag_id 1~129) + 시연 설비 · 다른 형식 태그 하나 */
function rows(): PlantMetaRow[] {
  let dev = 0;
  let tag = 0;
  const out: PlantMetaRow[] = [];
  for (const l of seedLayout({ kind: 'card-line' }).lines)
    for (const d of l.devices) {
      dev += 1;
      for (const t of d.tags) {
        tag += 1;
        out.push({
          line_code: l.lineCode,
          line_name: l.lineName,
          device_id: dev,
          device_code: d.deviceCode,
          device_name: d.deviceName,
          tag_id: tag,
          tag_code: t.tagCode,
          tag_name: t.tagName,
          unit: t.unit,
          data_type: t.dataType,
          scan_rate_ms: t.scanRateMs,
          tag_kind: t.tagKind,
        });
      }
    }
  const base = { line_code: 'DEMO-FLOW-L', line_name: '시연', unit: '', scan_rate_ms: 1000, tag_kind: null };
  out.push({
    ...base,
    device_id: 99,
    device_code: 'DEMO-FLOW-DEV',
    device_name: '시연 설비',
    tag_id: 999,
    tag_code: 'DEMO-T1',
    tag_name: '시연',
    data_type: 'FLOAT32',
  });
  out.push({ ...rowsLam(), tag_id: 500, tag_code: 'L1-LAM-EXTRA', tag_name: '추가', data_type: 'INT16' });
  return out;
}
const rowsLam = () => ({
  line_code: 'L1',
  line_name: '라인 1',
  device_id: 3,
  device_code: 'L1-LAM',
  device_name: '라인 1 라미네이팅',
  unit: '',
  scan_rate_ms: 1000,
  tag_kind: null,
});

const meta = metaFromRows(rows());
const device = (code: string) => meta.lines.flatMap((l) => l.devices).find((d) => d.code === code);

/** 설비 하나의 rt:latest Hash — 태그마다 같은 ts · 값 · 품질(STATE만 따로) */
function hash(
  code: string,
  ts: number,
  state: number | null,
  quality = QUALITY.SIMULATED,
): Record<string, string> {
  const d = device(code);
  const h: Record<string, string> = {};
  for (const t of d?.tags ?? []) {
    if (t.kind === 'STATE' && state === null) continue;
    h[String(t.tagId)] = `${ts},${t.kind === 'STATE' ? state : 12.5},${quality}`;
  }
  return h;
}

describe('메타 행 → 라인 · 설비 · 태그', () => {
  it('카드 라인 설비만(시연 설비 제외) · 라인 3 × 공정 순서 10 · 핵심 값 태그 · 계약 밖 형식은 빼고 알린다', () => {
    expect(meta.lines.map((l) => l.code)).toEqual(CARD_LINES.map((l) => l.code));
    expect(meta.lines.every((l) => l.devices.length === 10)).toBe(true);
    expect(meta.lines[0]?.devices.map((d) => d.process.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(meta.lines.flatMap((l) => l.devices).some((d) => d.code === 'DEMO-FLOW-DEV')).toBe(false);
    expect(meta.lines.flatMap((l) => l.devices.flatMap((d) => d.tags))).toHaveLength(129);
    expect(meta.skipped).toEqual(['L1-LAM-EXTRA(INT16)']);
    const lam = device('L1-LAM');
    expect(lam?.tags.find((t) => t.tagId === lam.keyTagId)?.code).toBe('L1-LAM-TOP_TEMP');
    expect(lam?.process.name).toBe('라미네이팅');
  });

  it('종류 — tag_kind가 정본 · 없으면 템플릿 접미 · 그것도 없으면 기타', () => {
    const p = device('L1-LAM')?.process;
    if (!p) throw new Error('공정 없음');
    expect(kindOf('PRESSURE', 'L1-LAM-TOP_TEMP', 'L1-LAM', p)).toBe('PRESSURE');
    expect(kindOf(null, 'L1-LAM-TOP_TEMP', 'L1-LAM', p)).toBe('TEMP');
    expect(kindOf(null, 'L1-LAM-NEW', 'L1-LAM', p)).toBe('OTHER');
  });
});

describe('설비 상태 판정', () => {
  const base = {
    power: true,
    nowMs: NOW,
    lastUpdateMs: NOW - 100,
    stateValue: 2,
    stateQuality: 9,
    powerOnAtMs: null,
  };

  it('STATE 값 2 가동 · 1 대기 · 0 정지', () => {
    expect(judgeDeviceState(base)).toBe('running');
    expect(judgeDeviceState({ ...base, stateValue: 1 })).toBe('idle');
    expect(judgeDeviceState({ ...base, stateValue: 0 })).toBe('stopped');
  });

  it('설비 가동 꺼짐 → 값이 새로워도 정지', () => {
    expect(judgeDeviceState({ ...base, power: false })).toBe('stopped');
  });

  it(`끊김 문턱 ${PLANT_OFFLINE_AFTER_MS} ms — 넘으면 통신 끊김 · 같으면 아직 통신 중 · 값이 없어도 끊김`, () => {
    expect(judgeDeviceState({ ...base, lastUpdateMs: NOW - PLANT_OFFLINE_AFTER_MS })).toBe('running');
    expect(judgeDeviceState({ ...base, lastUpdateMs: NOW - PLANT_OFFLINE_AFTER_MS - 1 })).toBe('offline');
    expect(judgeDeviceState({ ...base, lastUpdateMs: null, stateValue: null })).toBe('offline');
  });

  it('예외 응답(BAD_COMM)이거나 STATE 값이 없으면 통신 끊김', () => {
    expect(judgeDeviceState({ ...base, stateQuality: QUALITY.BAD_COMM })).toBe('offline');
    expect(judgeDeviceState({ ...base, stateValue: null })).toBe('offline');
  });

  it('켠 직후(문턱 안) 아직 첫 값이 없으면 정지 — 켜자마자 끊김으로 깜박이지 않는다', () => {
    const stale = { ...base, lastUpdateMs: NOW - 60_000 };
    expect(judgeDeviceState({ ...stale, powerOnAtMs: NOW - 1000 })).toBe('stopped');
    expect(judgeDeviceState({ ...stale, powerOnAtMs: NOW - PLANT_OFFLINE_AFTER_MS - 1 })).toBe('offline');
  });
});

describe('개요 본문', () => {
  const fresh = NOW - 200;
  const latest = new Map<number, Record<string, string>>();
  for (const l of meta.lines) for (const d of l.devices) latest.set(d.deviceId, hash(d.code, fresh, 2));
  const lam = device('L1-LAM');
  const mil = device('L2-MIL');
  const pac = device('L3-PAC');
  if (!lam || !mil || !pac) throw new Error('설비 없음');
  latest.set(lam.deviceId, hash('L1-LAM', fresh, 1)); // 대기
  latest.set(mil.deviceId, hash('L2-MIL', NOW - 30_000, 2)); // 끊김
  latest.set(pac.deviceId, {}); // 값 없음 → 끊김

  it('계약 PlantOverview 그대로 · 상태 합계 · 지금 값 · nominal = 통신 중 설비의 주기 합', () => {
    const body = buildOverview({
      nowMs: NOW,
      power: true,
      powerOnAtMs: null,
      lines: meta.lines,
      latest,
      rates: null,
    });
    expect(PlantOverview.safeParse(body).success).toBe(true);
    expect(body.totals).toMatchObject({ running: 27, idle: 1, stopped: 0, offline: 2 });
    expect(body.pointsPerSecBasis).toBe('nominal');
    // 통신 중 28대 = 231 − L2-MIL(17) − L3-PAC(3)
    expect(body.totals.pointsPerSec).toBe(211);
    expect(body.pointsPerSecByKind.VIBRATION).toBe(20); // 진동 0.1초 × 3대 중 L2-MIL 빠짐
    const l1lam = body.lines[0]?.devices[2];
    expect(l1lam).toMatchObject({
      code: 'L1-LAM',
      state: 'idle',
      processCode: 'LAM',
      order: 3,
      pointsPerSec: 9,
    });
    expect(l1lam?.tags[0]).toMatchObject({ code: 'L1-LAM-TOP_TEMP', kind: 'TEMP', value: 12.5, quality: 9 });
    expect(l1lam?.lastUpdateAt).toBe(new Date(fresh).toISOString());
    const pacBody = body.lines[2]?.devices[9];
    expect(pacBody).toMatchObject({ state: 'offline', pointsPerSec: 0, lastUpdateAt: null });
    expect(pacBody?.tags.every((t) => t.value === null && t.ts === null)).toBe(true);
  });

  it('설비 가동 꺼짐 — 전부 정지 · nominal 0', () => {
    const body = buildOverview({
      nowMs: NOW,
      power: false,
      powerOnAtMs: null,
      lines: meta.lines,
      latest,
      rates: null,
    });
    expect(body.totals).toEqual({ running: 0, idle: 0, stopped: 30, offline: 0, pointsPerSec: 0 });
    expect(PlantOverview.safeParse(body).success).toBe(true);
  });

  it('measured — 태그별 센 값을 그대로 더한다(설비 · 종류 · 합계)', () => {
    const rates = new Map<number, number>();
    for (const t of lam.tags) rates.set(t.tagId, 2);
    const body = buildOverview({
      nowMs: NOW,
      power: true,
      powerOnAtMs: null,
      lines: meta.lines,
      latest,
      rates,
    });
    expect(body.pointsPerSecBasis).toBe('measured');
    expect(body.totals.pointsPerSec).toBe(lam.tags.length * 2);
    expect(body.lines[0]?.devices[2]?.pointsPerSec).toBe(10);
    expect(body.pointsPerSecByKind.TEMP).toBe(4);
  });

  it('빈 사이트(카드 라인 시드 전) — 라인 0 · 합계 0', () => {
    const body = buildOverview({
      nowMs: NOW,
      power: true,
      powerOnAtMs: null,
      lines: [],
      latest: new Map(),
      rates: null,
    });
    expect(PlantOverview.safeParse(body).success).toBe(true);
    expect(body.lines).toEqual([]);
  });
});

describe('EmitRateMeter — 발행 누계 차분', () => {
  it('첫 표본은 셀 수 없다(null) · 0.9초 뒤부터 초당 값 · 3초 창', () => {
    const m = new EmitRateMeter();
    const tally = new Map([[1, 0]]);
    expect(m.rates(0, tally)).toBeNull();
    tally.set(1, 5);
    expect(m.rates(500, tally)).toBeNull();
    tally.set(1, 10);
    expect(m.rates(1000, tally)?.get(1)).toBe(10);
    tally.set(1, 40);
    // 창 3초 — 0 ms 표본은 3.5초에 빠지고 기준은 창 안 가장 오래된 500 ms 표본(5) → (40 − 5) ÷ 3초
    expect(m.rates(3500, tally)?.get(1)).toBeCloseTo(35 / 3, 6);
  });

  it('배경 표본(sample)이 있으면 띄엄띄엄 부른 첫 요청도 센다', () => {
    const m = new EmitRateMeter();
    const tally = new Map([[1, 0]]);
    for (let t = 0; t <= 10_000; t += EmitRateMeter.SAMPLE_EVERY_MS) {
      tally.set(1, t / 100);
      m.sample(t, tally);
    }
    // 10초 동안 요청이 없었어도 창 안(7초 ~ 10초) 표본이 기준 — 초당 10
    expect(m.rates(10_000, tally)?.get(1)).toBeCloseTo(10, 6);
  });
});

describe('PlantOverviewService — Redis 한 번 · 메타 사본 · 기준', () => {
  function svc(opts: { runtime?: boolean; pgFail?: boolean; redisFail?: boolean } = {}) {
    const calls = { pg: 0, redis: 0 };
    const pg = {
      pool: {
        query: async () => {
          calls.pg += 1;
          if (opts.pgFail) throw new Error('pg down');
          return { rows: rows() };
        },
      },
    } as unknown as Postgres;
    const durable = {
      readLatestMany: async (ids: number[]) => {
        calls.redis += 1;
        if (opts.redisFail) throw new Error('redis down');
        return ids.map(() => ({}));
      },
    } as unknown as DurableKeyClient;
    const power = {
      read: async () => ({ on: true, changedAt: null, changedAtMs: null }),
    } as unknown as PlantPowerService;
    const runtime = opts.runtime ? ({ running: () => true } as unknown as PlantRuntime) : undefined;
    return { s: new PlantOverviewService(pg, durable, power, runtime), calls };
  }

  it('메타는 10초 사본(PostgreSQL 한 번) · 지금 값은 요청마다 파이프라인 한 번 · 수집기 없는 역할은 nominal', async () => {
    const { s, calls } = svc();
    const a = await s.overview(NOW);
    await s.overview(NOW + 1000);
    expect(calls).toEqual({ pg: 1, redis: 2 });
    expect(a.pointsPerSecBasis).toBe('nominal');
    expect(a.lines.flatMap((l) => l.devices)).toHaveLength(30);
    await s.overview(NOW + 10_000);
    expect(calls.pg).toBe(2);
  });

  it('같은 프로세스에 수집기가 있으면 배경 표본 없이도 두 번째 요청부터 measured', async () => {
    const { s } = svc({ runtime: true });
    expect((await s.overview(NOW)).pointsPerSecBasis).toBe('nominal');
    expect((await s.overview(NOW + 1000)).pointsPerSecBasis).toBe('measured');
  });

  it('배경 표본(onModuleInit) — 기동 1초 뒤 첫 요청부터 measured · 수집기 없는 역할은 타이머를 걸지 않는다', async () => {
    vi.useFakeTimers({ now: NOW - 1000 });
    try {
      const { s } = svc({ runtime: true });
      s.onModuleInit();
      vi.advanceTimersByTime(1000);
      expect((await s.overview(NOW)).pointsPerSecBasis).toBe('measured');
      s.onModuleDestroy();
      expect(vi.getTimerCount()).toBe(0);
      const api = svc().s;
      api.onModuleInit();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Redis 불가 → 503 realtime.latest_unavailable · 첫 메타부터 PostgreSQL 불가 → 503 common.postgres_unavailable', async () => {
    await expect(svc({ redisFail: true }).s.overview(NOW)).rejects.toMatchObject({
      code: 'realtime.latest_unavailable',
    });
    await expect(svc({ pgFail: true }).s.overview(NOW)).rejects.toMatchObject({
      code: 'common.postgres_unavailable',
    });
  });
});
