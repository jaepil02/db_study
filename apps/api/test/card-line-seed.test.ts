// 카드 라인 시드 계획(D-16 결정 3) — 라인 3 × 공정 10 = 설비 30 · 태그 129 · 포트 5020~5049 · 설비 안 주소 겹침 0
// 정의 정본 packages/shared/src/card-line.ts · 시드 모양 docs/05_data_stores/09_migrations_seed.md §시드
import {
  CARD_PROCESSES,
  cardDeviceCode,
  nominalPointsPerSec,
  parseCardDeviceCode,
  TAG_KINDS,
} from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import {
  assertSeedOptionsFor,
  describeScanRates,
  parseSeedOptions,
  parseSeedTarget,
  SIM_BASE_PORT,
  seedLayout,
} from '../src/db/seed-plan';
import { DATA_TYPE_WORDS } from '../src/modules/collector/decode';

const card = seedLayout({ kind: 'card-line' });
const devices = card.lines.flatMap((l) => l.devices);
const tags = devices.flatMap((d) => d.tags);

describe('카드 라인 시드 계획', () => {
  it('사이트 CARD-FAB · 라인 L1~L3 · 설비 30(라인 순 → 공정 순) · 태그 129', () => {
    expect(card.site).toEqual({ code: 'CARD-FAB', name: '카드 공장' });
    expect(card.lines.map((l) => [l.lineCode, l.lineName])).toEqual([
      ['L1', '라인 1'],
      ['L2', '라인 2'],
      ['L3', '라인 3'],
    ]);
    expect(devices).toHaveLength(30);
    expect(tags).toHaveLength(129);
    expect(card.lines.map((l) => l.devices.reduce((n, d) => n + d.tags.length, 0))).toEqual([43, 43, 43]);
    expect(card.lines[0]?.devices.map((d) => d.deviceCode)).toEqual(
      [...CARD_PROCESSES].sort((a, b) => a.order - b.order).map((p) => cardDeviceCode('L1', p.code)),
    );
  });

  it('설비 코드 · 이름 · vendor · model · 포트(5020 + 순번 · 겹침 0)', () => {
    const lam = devices.find((d) => d.deviceCode === 'L2-LAM');
    expect(lam).toMatchObject({ deviceName: '라인 2 라미네이팅', vendor: 'SIM', model: 'LAM' });
    expect(devices.map((d) => d.port)).toEqual(Array.from({ length: 30 }, (_, i) => SIM_BASE_PORT + i));
    for (const d of devices) expect(parseCardDeviceCode(d.deviceCode)).not.toBeNull();
    expect(new Set(devices.map((d) => d.deviceCode)).size).toBe(30);
  });

  it('태그 — 코드 유일 · 설비 안 주소는 형식 워드 수만큼 연속(겹침 · 갭 0) · word_order는 2워드만 ABCD', () => {
    expect(new Set(tags.map((t) => t.tagCode)).size).toBe(129);
    for (const d of devices) {
      let next = 0;
      for (const t of d.tags) {
        expect(t.address).toBe(next);
        next += DATA_TYPE_WORDS[t.dataType];
        expect(t.wordOrder).toBe(DATA_TYPE_WORDS[t.dataType] > 1 ? 'ABCD' : null);
      }
      expect(next).toBeLessThanOrEqual(125); // 한 요청 상한 안
    }
    expect(tags.find((t) => t.tagCode === 'L1-LAM-TOP_TEMP')).toMatchObject({
      tagName: '상판 온도',
      dataType: 'FLOAT32',
      unit: '°C',
      scanRateMs: 1000,
      rangeMin: 120,
      rangeMax: 170,
      tagKind: 'TEMP',
    });
    expect(tags.find((t) => t.tagCode === 'L3-MIL-VIB')).toMatchObject({
      scanRateMs: 100,
      tagKind: 'VIBRATION',
    });
    expect(tags.find((t) => t.tagCode === 'L1-PRT-STATE')).toMatchObject({
      dataType: 'UINT16',
      wordOrder: null,
      rangeMin: 0,
      rangeMax: 2,
      tagKind: 'STATE',
    });
  });

  it('종류 · 형식 · 주기 — 종류는 TAG_KINDS 안 · 설비마다 STATE 1 · 주기 100/200/1000 ms · 명목 초당 231점', () => {
    for (const t of tags) expect(TAG_KINDS).toContain(t.tagKind);
    for (const d of devices) expect(d.tags.filter((t) => t.tagKind === 'STATE')).toHaveLength(1);
    expect(new Set(tags.map((t) => t.scanRateMs))).toEqual(new Set([100, 200, 1000]));
    expect(describeScanRates(card)).toBe('100 ms 6 · 200 ms 12 · 1000 ms 111');
    const pps = tags.reduce((a, t) => a + 1000 / t.scanRateMs, 0);
    expect(pps).toBe(231);
    expect(CARD_PROCESSES.reduce((a, p) => a + nominalPointsPerSec(p), 0) * 3).toBe(pps);
  });

  it('S2 슬라이스는 그대로 — 설비 1 · 태그 8 · FLOAT32 ABCD · 1초 · 종류 없음', () => {
    const s = seedLayout({ kind: 'slice' });
    const d = s.lines[0]?.devices[0];
    expect(s.site.code).toBe('SITE-001');
    expect(d?.deviceCode).toBe('DEV-001');
    expect(d?.port).toBe(5020);
    expect(d?.tags.map((t) => t.address)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(
      d?.tags.every((t) => t.dataType === 'FLOAT32' && t.tagKind === null && t.scanRateMs === 1000),
    ).toBe(true);
  });
});

describe('seed 대상 인자', () => {
  it('없으면 카드 라인(로컬 기본) · --card-line · --slice s2', () => {
    expect(parseSeedTarget([])).toEqual({ kind: 'card-line' });
    expect(parseSeedTarget(['--card-line'])).toEqual({ kind: 'card-line' });
    expect(parseSeedTarget(['--slice', 's2', '--deadband', '1'])).toEqual({ kind: 'slice' });
  });

  it('둘 다 · 모르는 슬라이스는 거부 · 카드 라인에 --range는 거부(템플릿 범위가 정본)', () => {
    expect(() => parseSeedTarget(['--card-line', '--slice', 's2'])).toThrow(/함께/);
    expect(() => parseSeedTarget(['--slice', 's9'])).toThrow(/사용/);
    expect(() => assertSeedOptionsFor({ kind: 'card-line' }, parseSeedOptions(['--range', '0,1']))).toThrow(
      /슬라이스 전용/,
    );
    expect(() => assertSeedOptionsFor({ kind: 'slice' }, parseSeedOptions(['--range', '0,1']))).not.toThrow();
    expect(() =>
      assertSeedOptionsFor({ kind: 'card-line' }, parseSeedOptions(['--deadband', '0.5'])),
    ).not.toThrow();
  });
});
