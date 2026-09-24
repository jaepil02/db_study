import { describe, expect, it } from 'vitest';
import {
  ERROR_HTTP_STATUS,
  HealthResponse,
  implFor,
  LatestDeviceResponse,
  SWITCHES,
  TimeseriesQueryRequest,
  WS_CLOSE,
  WsClientMessage,
  WsServerMessage,
} from '../src/api';
import { docSectionRows, docTable } from './doc-table';

describe('API 계약 — 정본 문서와 같다', () => {
  it('에러 코드 22 · HTTP 상태(11_glossary/02 §에러 코드 전수)', () => {
    const rows = docSectionRows('11_glossary/02_error_codes.md', '에러 코드 전수').filter((r) =>
      /^[a-z_]+\.[a-z_]+$/.test(r[0] ?? ''),
    );
    const fromDoc = Object.fromEntries(rows.map((r) => [r[0], Number(r[1])]));
    expect(fromDoc).toEqual(ERROR_HTTP_STATUS);
    expect(Object.keys(fromDoc)).toHaveLength(22);
  });

  it('스위치 11 — 포트 · 구현 이름(04_architecture/02 확정 표)', () => {
    const rows = docTable('04_architecture/02_module_boundaries.md', '포트 · 구현 이름 확정 표', 3).filter(
      (r) => (r[0] ?? '').startsWith('SW-'),
    );
    const clean = (c: string) => c.replace(/\(.*\)$/, '').trim();
    const fromDoc = rows.map((r) => ({
      id: r[0],
      port: r[1],
      onImpl: clean(r[2] ?? ''),
      offImpl: clean(r[3] ?? ''),
    }));
    expect(SWITCHES.map((s) => ({ id: s.id, port: s.port, onImpl: s.onImpl, offImpl: s.offImpl }))).toEqual(
      fromDoc,
    );
  });

  it('스위치 11 — 환경변수 · 기본값(02_features/13 정본 표)', () => {
    const rows = docTable('02_features/13_switch_matrix.md', '스위치 정본 표');
    const def = (c: string) => {
      const m = c.match(/on\((\d+) ms\)/);
      return m ? Number(m[1]) : c.trim();
    };
    expect(rows.map((r) => [r[0], r[1], def(r[3] ?? '')])).toEqual(
      SWITCHES.map((s) => [s.id, s.env, s.defaultValue]),
    );
  });

  it('주입 구현 — SW-07 0은 통과 구현 · SW-11 ingest는 onImpl', () => {
    const sw07 = SWITCHES.find((s) => s.id === 'SW-07');
    const sw11 = SWITCHES.find((s) => s.id === 'SW-11');
    expect(sw07 && implFor(sw07, 0)).toBe('PassthroughThrottle');
    expect(sw07 && implFor(sw07, 100)).toBe('WindowMergeThrottle');
    expect(sw11 && implFor(sw11, 'collector')).toBe('CollectorLatestValueWriter');
  });

  it('WebSocket 종료 코드 8(07_api/11 §종료 코드)', () => {
    const rows = docTable('07_api/11_websocket.md', '종료 코드');
    const fromDoc = Object.fromEntries(rows.map((r) => [r[1], Number(r[0])]));
    expect(fromDoc).toEqual(WS_CLOSE);
  });

  it('시계열 요청 — 오프셋 없는 시각 · 모르는 필드 · from ≥ to 거절', () => {
    const ok = {
      tagIds: [1, 2],
      from: '2026-09-24T10:00:00+09:00',
      to: '2026-09-24T10:05:00+09:00',
    };
    expect(TimeseriesQueryRequest.safeParse(ok).success).toBe(true);
    expect(TimeseriesQueryRequest.safeParse({ ...ok, from: '2026-09-24T10:00:00' }).success).toBe(false);
    expect(TimeseriesQueryRequest.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(TimeseriesQueryRequest.safeParse({ ...ok, to: ok.from }).success).toBe(false);
    expect(TimeseriesQueryRequest.safeParse({ ...ok, interval: '5m' }).success).toBe(false);
  });

  it('WebSocket 메시지 — 모르는 type · 빈 구독 거절', () => {
    expect(WsClientMessage.safeParse({ type: 'subscribe', devices: [1] }).success).toBe(true);
    expect(WsClientMessage.safeParse({ type: 'subscribe', devices: [] }).success).toBe(false);
    expect(WsClientMessage.safeParse({ type: 'hello' }).success).toBe(false);
    expect(
      WsServerMessage.safeParse({
        type: 'rt',
        windowEnd: 1,
        devices: [{ deviceId: 1, tags: [[3401, 1758675600050, 72.5, 9]] }],
      }).success,
    ).toBe(true);
  });

  it('최신값 · health 예시 본문(07_api/06 · 10 json 펜스)이 스키마를 통과한다', () => {
    const latest = {
      meta: {
        deviceId: 12,
        servedAt: '2026-09-24T01:00:00.120Z',
        source: 'redis',
        restored: false,
        metaMissing: 1,
      },
      items: [
        {
          tagId: 3401,
          tagCode: 'D12-TEMP-01',
          tagName: '반응기 온도',
          unit: '°C',
          ts: 1758675599870,
          value: 72.4,
          quality: 9,
          staleAfterMs: 3000,
        },
        {
          tagId: 3402,
          tagCode: null,
          tagName: null,
          unit: null,
          ts: 1758675590010,
          value: 101.3,
          quality: 9,
          staleAfterMs: null,
        },
      ],
    };
    expect(LatestDeviceResponse.safeParse(latest).success).toBe(true);
    const health = {
      status: 'degraded',
      checkedAt: '2026-09-24T01:00:00.000Z',
      stores: {
        postgres: { status: 'up', latencyMs: 2, error: null },
        clickhouse: { status: 'up', latencyMs: 5, error: null },
        redis: { status: 'down', latencyMs: null, error: 'refused' },
      },
      switches: {
        'SW-07': { name: 'WS_THROTTLE_MS', value: 100, impl: 'WindowMergeThrottle', warning: null },
      },
      run: { commitHash: 'a1b2c3d', memoryProfile: 'load', memoryLimitMb: 4096, capacityTier: 'M' },
    };
    expect(HealthResponse.safeParse(health).success).toBe(true);
  });
});
