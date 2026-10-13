// ⑦ HMI 설비 현황판 — 판독(lib/hmi.ts) · 정적 렌더(components/hmi/hmi-screen.tsx). 정본 docs/08_screen/11_hmi_screen.md §HMI-PLANT.
// 개요 가짜는 카드 라인 정본(card-line CARD_LINES × CARD_PROCESSES)으로 짓고 계약(PlantOverview)으로 검사한다 — 계약이 바뀌면 여기서 먼저 깨진다.
import {
  CARD_LINES,
  CARD_PROCESSES,
  cardDeviceCode,
  cardTagCode,
  nominalPointsPerSec,
  TAG_KINDS,
} from '@db-study/shared/src/card-line';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { hmiKeys } from '../components/hmi/data';
import { HMI_SOURCES, HMI_TITLE, HmiScreen } from '../components/hmi/hmi-screen';
import {
  allDevices,
  deviceKinds,
  gapLimitMs,
  keyTagOf,
  kindMix,
  nearestPoint,
  numText,
  POWER_OFF_TEXT,
  periodText,
  ppsText,
  processColumns,
  readTrend,
  STATE_VIEW,
  shareText,
  sparkGeom,
  staleNote,
  stateCodeText,
  TREND_MAX_POINTS,
  TREND_WINDOW_MS,
  tagSlots,
  tagsByKind,
  trendRequest,
  valueText,
} from '../lib/hmi';
import {
  PLANT_DEVICE_STATES,
  type PlantDeviceState,
  PlantOverview,
  type PlantOverviewBody,
  TimeseriesQueryRequest,
} from '../lib/shared';

const AT = '2026-10-11T10:00:00.000Z';

/** 카드 라인 30대 가짜 개요 — states로 설비별 상태를 덮어쓴다(기본 가동) · power false면 전부 정지 · 초당 0 */
function overview(o: { power?: boolean; states?: Record<string, PlantDeviceState> } = {}): PlantOverviewBody {
  const power = o.power ?? true;
  let tagId = 0;
  let deviceId = 0;
  const lines = CARD_LINES.map((l) => ({
    code: l.code,
    name: l.name,
    devices: CARD_PROCESSES.map((p) => {
      deviceId += 1;
      const code = cardDeviceCode(l.code, p.code);
      const state: PlantDeviceState = power ? (o.states?.[code] ?? 'running') : 'stopped';
      const tags = p.tags.map((t) => {
        tagId += 1;
        return {
          tagId,
          code: cardTagCode(code, t.suffix),
          name: t.name,
          kind: t.kind,
          unit: t.unit,
          dataType: t.dataType,
          scanRateMs: t.scanRateMs,
          value: t.kind === 'STATE' ? 2 : t.kind === 'COUNT' ? 48_335 : (t.rangeMax ?? 10) * 0.6,
          ts: AT,
          quality: 9,
        };
      });
      const key = p.tags.findIndex((t) => t.key);
      return {
        deviceId,
        code,
        name: `${l.name} ${p.name}`,
        lineCode: l.code,
        processCode: p.code,
        processName: p.name,
        order: p.order,
        state,
        lastUpdateAt: AT,
        pointsPerSec: power && state !== 'offline' ? nominalPointsPerSec(p) : 0,
        keyTagId: key >= 0 ? (tags[key]?.tagId ?? null) : null,
        tags,
      };
    }),
  }));
  const devices = lines.flatMap((l) => l.devices);
  const totals = { running: 0, idle: 0, stopped: 0, offline: 0, pointsPerSec: 0 };
  const byKind = Object.fromEntries(TAG_KINDS.map((k) => [k, 0])) as PlantOverviewBody['pointsPerSecByKind'];
  for (const d of devices) {
    totals[d.state] += 1;
    totals.pointsPerSec += d.pointsPerSec;
    if (d.pointsPerSec > 0) for (const t of d.tags) byKind[t.kind] += 1000 / t.scanRateMs;
  }
  return PlantOverview.parse({
    at: AT,
    power,
    totals,
    pointsPerSecByKind: byKind,
    pointsPerSecBasis: 'nominal',
    lines,
  });
}

describe('상태 4 — 색 · 글자 · 모양', () => {
  it('상태마다 쉬운 말 이름과 색 띠 · 기호 색 · 글자 색이 있다(색만으로 가르지 않게 이름이 따로 있다)', () => {
    expect(PLANT_DEVICE_STATES.map((s) => STATE_VIEW[s].label)).toEqual([
      '가동',
      '대기',
      '정지',
      '통신 끊김',
    ]);
    const bands = PLANT_DEVICE_STATES.map((s) => STATE_VIEW[s].band);
    expect(new Set(bands).size).toBe(4);
  });

  it('상태 색은 저장소 색(Redis 빨강 · PG 파랑 · CH 주황)을 쓰지 않는다', () => {
    const store = ['#dc2626', '#2563eb', '#d97706'];
    for (const s of PLANT_DEVICE_STATES) {
      expect(store).not.toContain(STATE_VIEW[s].band);
      expect(store).not.toContain(STATE_VIEW[s].mark);
    }
  });

  it('상태 코드(STATE 태그) → 쉬운 말 · 모르는 코드는 숫자 그대로', () => {
    expect([0, 1, 2, 7].map(stateCodeText)).toEqual(['정지', '대기', '가동', '코드 7']);
  });
});

describe('형식 — 값 · 주기 · 초당 개수 · 비율', () => {
  it('실수는 크기에 따라 자릿수 · 0은 0 · 반올림 −0도 0', () => {
    expect(numText(25_345.6)).toBe('25,346');
    expect(numText(158.25)).toBe('158.3');
    expect(numText(0.034)).toBe('0.03');
    expect(numText(0)).toBe('0');
    expect(numText(-0.001)).toBe('0.00');
  });

  it('지금 값 — 상태는 쉬운 말 · 누적 · 상태 코드는 정수 · 값 없음은 —', () => {
    expect(valueText({ value: 2, dataType: 'UINT16', kind: 'STATE' })).toBe('가동');
    expect(valueText({ value: 48_335, dataType: 'UINT32', kind: 'COUNT' })).toBe('48,335');
    expect(valueText({ value: 81.97, dataType: 'FLOAT32', kind: 'SPEED' })).toBe('82.0');
    expect(valueText({ value: null, dataType: 'FLOAT32', kind: 'TEMP' })).toBe('—');
  });

  it('주기 0.1초 · 0.2초 · 1초 · 초당 개수 10 이상 정수 · 미만 소수 1자리', () => {
    expect([100, 200, 1000].map(periodText)).toEqual(['0.1s', '0.2s', '1s']);
    expect(ppsText(231.6)).toBe('232');
    expect(ppsText(4.26)).toBe('4.3');
    expect(ppsText(0)).toBe('0');
  });

  it('비율 — 0% · 1% 미만 · 정수 %', () => {
    expect([0, 0.004, 0.195].map(shareText)).toEqual(['0%', '1% 미만', '20%']);
  });
});

describe('설비 · 태그 판독', () => {
  const ov = overview();
  const lam = allDevices(ov).find((d) => d.code === 'L1-LAM');

  it('설비 30대 · 라인 순 · 공정 순 · 공정 열 머리 10(첫 열 인쇄 · 끝 열 포장)', () => {
    expect(allDevices(ov)).toHaveLength(30);
    expect(allDevices(ov)[0]?.code).toBe('L1-PRT');
    const cols = processColumns(ov);
    expect(cols).toHaveLength(10);
    expect([cols[0]?.name, cols[9]?.name]).toEqual(['인쇄', '포장']);
  });

  it('라미네이팅 — 보내는 종류(TAG_KINDS 순서) · 핵심 값은 상판 온도 · 목록은 종류별로 모인다', () => {
    expect(lam).toBeDefined();
    if (!lam) return;
    expect(deviceKinds(lam)).toEqual(['TEMP', 'PRESSURE', 'COUNT', 'STATE']);
    expect(keyTagOf(lam)?.name).toBe('상판 온도');
    expect(tagsByKind(lam.tags).map((t) => t.name)).toEqual([
      '상판 온도',
      '하판 온도',
      '프레스 압력',
      '사이클 수',
      '운전 상태',
    ]);
  });

  it('핵심 값 태그가 목록에 없으면 null', () => {
    expect(keyTagOf({ keyTagId: 999_999, tags: lam?.tags ?? [] })).toBeNull();
    expect(keyTagOf({ keyTagId: null, tags: lam?.tags ?? [] })).toBeNull();
  });

  it('목록 자리 수 — 가장 태그가 많은 설비의 태그 수(카드 라인 5 · 정본 공정 템플릿과 같다) · 설비 없으면 0', () => {
    expect(tagSlots(allDevices(ov))).toBe(Math.max(...CARD_PROCESSES.map((p) => p.tags.length)));
    expect(tagSlots(allDevices(ov))).toBe(5);
    expect(tagSlots([])).toBe(0);
  });
});

describe('종류 비율', () => {
  it('켜짐 — api 종류별 초당 개수 그대로(합 = 카드 라인 명목 231) · 8종 전부 TAG_KINDS 순서', () => {
    const mix = kindMix(overview());
    expect(mix.basis).toBe('live');
    expect(mix.rows.map((r) => r.kind)).toEqual([...TAG_KINDS]);
    expect(mix.total).toBeCloseTo(231, 6);
    expect(mix.rows.find((r) => r.kind === 'PRESSURE')?.pps).toBeCloseTo(45, 6);
    expect(mix.rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1, 9);
  });

  it('꺼짐(초당 0) — 태그 주기로 센 "켜면 보낼 몫"(period)으로 바꾸고 비율은 켜짐과 같다', () => {
    const on = kindMix(overview());
    const off = kindMix(overview({ power: false }));
    expect(off.basis).toBe('period');
    expect(off.total).toBeCloseTo(231, 6);
    for (const k of TAG_KINDS)
      expect(off.rows.find((r) => r.kind === k)?.share).toBeCloseTo(
        on.rows.find((r) => r.kind === k)?.share ?? -1,
        9,
      );
  });

  it('통신 끊긴 설비는 초당 개수에서 빠진다', () => {
    const mix = kindMix(overview({ states: { 'L1-MIL': 'offline' } }));
    // 밀링 = 속도 5 + 진동 10 + 수량 1 + 상태 1
    expect(mix.total).toBeCloseTo(231 - 17, 6);
    expect(mix.rows.find((r) => r.kind === 'VIBRATION')?.pps).toBeCloseTo(20, 6);
  });
});

describe('멈춘 값 표지', () => {
  it('설비 가동 꺼짐 · 통신 끊김이면 한 줄 · 켜진 가동 · 대기 · 정지는 없음', () => {
    expect(staleNote(false, 'stopped')).toContain('멈추기 전 마지막 값');
    expect(staleNote(true, 'offline')).toContain('5s 넘게');
    for (const s of ['running', 'idle', 'stopped'] as const) expect(staleNote(true, s)).toBeNull();
  });
});

describe('최근 10분 작은 선', () => {
  const now = Date.parse(AT);

  it('요청 — 원시(raw) · 10분 · 끝은 다음 분 경계(서버 1분 내림에 진행 중인 1분이 빠지지 않게) · 660점 · 계약 통과', () => {
    const req = trendRequest([9, 11], now);
    expect(req.interval).toBe('raw');
    expect(req.maxPoints).toBe(TREND_MAX_POINTS);
    expect(TREND_MAX_POINTS).toBe(660);
    // 분 경계에 딱 맞으면 그대로 10분
    expect(Date.parse(req.to) - Date.parse(req.from)).toBe(TREND_WINDOW_MS);
    expect(req.from.endsWith('+09:00')).toBe(true);
    expect(TimeseriesQueryRequest.safeParse(req).success).toBe(true);
    // 분 중간이면 끝을 다음 분 경계로 올린다 — 서버 예상 점 수(1초 주기)가 maxPoints를 넘지 않아 raw로 남는다
    const mid = trendRequest([9], now + 59_999);
    expect(Date.parse(mid.to)).toBe(now + 60_000);
    expect(Date.parse(mid.from)).toBe(now + 59_999 - TREND_WINDOW_MS);
    expect(Math.ceil((Date.parse(mid.to) - Date.parse(mid.from)) / 1000)).toBeLessThanOrEqual(
      TREND_MAX_POINTS,
    );
  });

  it('응답 — 창(끝 전 10분)보다 앞선 점은 뺀다(서버가 앞 끝을 1분 경계로 내려 더 준 점)', () => {
    const r = readTrend(
      {
        meta: {
          interval: 'raw',
          from: AT,
          to: AT,
          pointCount: 2,
          downsampled: false,
          cached: false,
          columns: ['ts', 'value', 'quality'],
        },
        series: [
          {
            tagId: 9,
            tagName: null,
            unit: null,
            points: [
              [now - TREND_WINDOW_MS - 1, 1, 9],
              [now - TREND_WINDOW_MS, 2, 9],
            ],
          },
        ],
      },
      now,
    );
    expect(r.byTag.get(9)).toEqual([[now - TREND_WINDOW_MS, 2]]);
  });

  it('응답 — raw 열(ts · value · quality)과 롤업 열(ts · avg) 모두 값 열을 찾는다 · 숫자 아닌 점은 뺀다', () => {
    const meta = {
      interval: 'raw' as const,
      from: AT,
      to: AT,
      pointCount: 3,
      downsampled: false,
      cached: false,
    };
    const raw = readTrend(
      {
        meta: { ...meta, columns: ['ts', 'value', 'quality'] },
        series: [
          {
            tagId: 9,
            tagName: null,
            unit: null,
            points: [
              [now - 1000, 1, 9],
              [now - 2000, null, 9],
              [now - 3000, 3, 9],
            ],
          },
        ],
      },
      now,
    );
    expect(raw.byTag.get(9)).toEqual([
      [now - 3000, 3],
      [now - 1000, 1],
    ]);
    const avg = readTrend(
      {
        meta: { ...meta, interval: '1m', columns: ['ts', 'avg'] },
        series: [{ tagId: 1, tagName: null, unit: null, points: [[now, 5]] }],
      },
      now,
    );
    expect(avg.byTag.get(1)).toEqual([[now, 5]]);
  });

  it('모양 — 창 끝 = 오른쪽 끝 · 끊긴 시간(주기 3배와 5초 중 큰 쪽 초과)은 선을 새로 시작 · 같은 값만 있으면 가운데', () => {
    const o = {
      width: 100,
      height: 20,
      fromMs: now - 10_000,
      toMs: now,
      step: false,
      gapMs: gapLimitMs(1000),
      pad: 0,
    };
    const g = sparkGeom(
      [
        [now - 10_000, 0],
        [now - 9_000, 10],
        [now - 1_000, 5],
        [now, 10],
      ],
      o,
    );
    expect(g.d.match(/M/g)).toHaveLength(2);
    expect(g.end).toEqual({ x: 100, y: 0 });
    expect([g.min, g.max]).toEqual([0, 10]);
    const flat = sparkGeom(
      [
        [now - 2000, 4],
        [now, 4],
      ],
      o,
    );
    expect(flat.end?.y).toBe(10);
    expect(sparkGeom([], o).d).toBe('');
  });

  it('상태 태그는 계단(H · V)으로 그린다', () => {
    const o = { width: 100, height: 20, fromMs: now - 2000, toMs: now, step: true, gapMs: 5000, pad: 0 };
    expect(
      sparkGeom(
        [
          [now - 2000, 1],
          [now, 2],
        ],
        o,
      ).d,
    ).toBe('M0 20H100V0');
  });

  it('가리킨 위치에 가장 가까운 점', () => {
    const pts: [number, number][] = [
      [now - 10_000, 1],
      [now - 5_000, 2],
      [now, 3],
    ];
    const o = { width: 100, fromMs: now - 10_000, toMs: now };
    expect(nearestPoint(pts, 0, o)?.[1]).toBe(1);
    expect(nearestPoint(pts, 60, o)?.[1]).toBe(2);
    expect(nearestPoint(pts, 99, o)?.[1]).toBe(3);
    expect(nearestPoint([], 10, o)).toBeNull();
  });
});

describe('화면 정적 렌더', () => {
  const render = (ov: PlantOverviewBody) => {
    const client = new QueryClient();
    client.setQueryData(hmiKeys.overview, ov);
    return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(HmiScreen)));
  };
  const count = (html: string, needle: string) => html.split(needle).length - 1;

  it('켜짐 — 칸 30 · 공정 머리 10 · 라인 3 · 상태 개수 4 · 종류 8 · 출처 3 · 첫 설비 상세 · 꺼짐 안내 없음', () => {
    const html = render(overview({ states: { 'L2-PUN': 'idle', 'L3-INS': 'offline' } }));
    expect(html).toContain(HMI_TITLE);
    expect(count(html, 'data-testid="device-tile"')).toBe(30);
    expect(count(html, 'data-testid="process-head"')).toBe(10);
    expect(count(html, 'data-testid="line-label"')).toBe(3);
    expect(count(html, 'data-testid="state-count"')).toBe(4);
    expect(count(html, 'data-kind=')).toBeGreaterThanOrEqual(8);
    for (const s of HMI_SOURCES) expect(html).toContain(`data-store="${s.store}"`);
    expect(html).toContain('data-testid="device-detail" data-device="L1-PRT"');
    expect(count(html, 'data-testid="tag-row"')).toBe(4);
    expect(html).toMatch(/data-device="L2-PUN" data-state="idle"/);
    expect(html).toMatch(/data-device="L3-INS" data-state="offline"/);
    expect(html).not.toContain(POWER_OFF_TEXT);
    // 머리 오른쪽 공용 컨트롤 — 설비 가동 스위치 · 데이터 지우기
    expect(html).toContain('data-testid="plant-power"');
    expect(html).toContain('data-testid="purge"');
    // 첫 설비(인쇄 — 태그 4)는 자리 5 중 1줄이 빈 자리 — 칸 높이가 설비마다 같다
    expect(html).toContain('calc(var(--tag-row) * 1)');
    // 알람 · 원격 조작은 없다
    expect(html).not.toMatch(/알람|원격/);
  });

  it('꺼짐 — 안내 띠 · 30칸 모두 정지 · 상세에 "멈추기 전 마지막 값" · 종류 비율은 주기 기준', () => {
    const html = render(overview({ power: false }));
    expect(html).toContain(POWER_OFF_TEXT);
    expect(count(html, 'data-state="stopped"')).toBeGreaterThanOrEqual(30);
    expect(html).toContain('data-testid="stale-note"');
    expect(html).toContain('data-basis="period"');
    expect(html).toContain('켜면 이 비율로 보내요');
  });
});
