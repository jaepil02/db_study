// DSH-REALTIME 머리 숫자 · 추세 열 · 설비 선택기 순서 · 구성 배지 — 정본 docs/08_screen/03_realtime_dashboard.md
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bandState, pushBandItem } from '../lib/alarm-band';
import type { AlarmFrame } from '../lib/alarms';
import { closedBandText, createLatestReadGate, headerCounts, SPARK_POINTS, sparkPath } from '../lib/latest';
import { orderDevices, readLastDevice, writeLastDevice } from '../lib/realtime-nav';
import type { DeviceObjectBody, HealthBody } from '../lib/shared';
import { dashboardConfigBadges } from '../lib/switches';

describe('머리 숫자 — STALE n/N · 통신 이상', () => {
  const now = 10_000;
  it('STALE은 서버 판정과 화면 판정의 합집합 · 메타 없음은 세지 않는다', () => {
    const c = headerCounts(
      [
        { tag: { ts: 9_900, serverStale: false, quality: 0 }, staleAfterMs: 1_000 }, // 신선
        { tag: { ts: 9_900, serverStale: true, quality: 5 }, staleAfterMs: 1_000 }, // 서버 STALE
        { tag: { ts: 5_000, serverStale: false, quality: 0 }, staleAfterMs: 1_000 }, // 화면 STALE
        { tag: { ts: 1, serverStale: false, quality: 0 }, staleAfterMs: null }, // 메타 없음 — 판정 안 함
      ],
      now,
      0,
    );
    expect(c).toEqual({ total: 4, stale: 2, bad: 0 });
  });

  it('서버 시계 오프셋을 표와 같이 쓴다 — 브라우저가 늦으면 추정 서버 현재로 판정', () => {
    const tags = [{ tag: { ts: 9_000, serverStale: false, quality: 0 }, staleAfterMs: 1_500 }];
    expect(headerCounts(tags, now, 0).stale).toBe(0);
    expect(headerCounts(tags, now, 1_000).stale).toBe(1);
  });

  it('통신 이상은 품질 2 · 4(값 대신 표지) — 9 SIMULATED · 1 UNCERTAIN은 세지 않는다', () => {
    const q = (quality: number) => ({ tag: { ts: now, serverStale: false, quality }, staleAfterMs: 1_000 });
    expect(headerCounts([q(2), q(4), q(9), q(1), q(0)], now, 0).bad).toBe(2);
  });

  it('3 BAD_TIMEOUT은 저장하지 않아 오지 않지만 계약 밖으로 오면 같은 통신 이상 표지로 센다', () => {
    const q = (quality: number) => ({ tag: { ts: now, serverStale: false, quality }, staleAfterMs: 1_000 });
    expect(headerCounts([q(3)], now, 0).bad).toBe(1);
  });
});

describe('추세 열 스파크라인 — 링 버퍼 마지막 구간', () => {
  it('점이 2개 미만이면 그리지 않는다', () => {
    expect(sparkPath([1], [1], 64, 16)).toBeNull();
    expect(sparkPath([], [], 64, 16)).toBeNull();
  });

  it('상자에 맞춘다 — 최솟값이 바닥 · 최댓값이 천장 · 시각 비례 가로', () => {
    expect(sparkPath([0, 10, 20], [0, 5, 10], 64, 16)).toBe('M0.0,16.0 L32.0,8.0 L64.0,0.0');
  });

  it('값이 모두 같으면 가운데 수평선', () => {
    expect(sparkPath([0, 1], [3, 3], 10, 16)).toBe('M0.0,8.0 L10.0,8.0');
  });

  it('마지막 SPARK_POINTS점만 쓴다', () => {
    const n = SPARK_POINTS + 40;
    const ts = Array.from({ length: n }, (_, i) => i);
    const d = sparkPath(ts, ts, 64, 16) as string;
    expect(d.split(' ')).toHaveLength(SPARK_POINTS);
    expect(d.startsWith('M0.0,16.0')).toBe(true);
  });
});

describe('설비 선택기 순서', () => {
  const dev = (
    deviceId: number,
    lineId: number,
    deviceName: string,
    isActive: boolean,
  ): DeviceObjectBody => ({
    deviceId,
    lineId,
    deviceCode: `D${deviceId}`,
    deviceName,
    vendor: null,
    model: null,
    isActive,
  });
  const list = [dev(1, 1, '나', false), dev(2, 1, '가', true), dev(3, 2, '다', true), dev(4, 1, '가', true)];

  it('비활성 설비는 목록 끝 · 활성끼리는 이름 · id 순', () => {
    expect(orderDevices(list, null).map((d) => d.deviceId)).toEqual([2, 4, 3, 1]);
  });

  it('라인으로 거른다', () => {
    expect(orderDevices(list, 2).map((d) => d.deviceId)).toEqual([3]);
  });
});

describe('마지막으로 본 설비', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('저장 · 읽기 · 잘못된 값은 null', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    expect(readLastDevice()).toBeNull();
    writeLastDevice(7);
    expect(readLastDevice()).toBe(7);
    store.set('db_study.realtime.lastDevice', 'x');
    expect(readLastDevice()).toBeNull();
  });

  it('저장소가 막혀도 던지지 않는다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readLastDevice()).toBeNull();
    expect(() => writeLastDevice(1)).not.toThrow();
  });
});

describe('DSH 구성 배지', () => {
  const sw = (name: string, value: string | number, impl: string | null) => ({
    name,
    value,
    impl,
    warning: null,
  });

  it('표시 스위치 5 중 기본값이 아닌 것만 · 문구는 08_screen/03 §스위치 영향', () => {
    const switches: HealthBody['switches'] = {
      'SW-02': sw('REDIS_LATEST_CACHE', 'off', 'ClickHouseLatestValueReader'),
      'SW-03': sw('REDIS_QUERY_CACHE', 'off', 'NoopTimeseriesCache'), // 이 화면 표시 스위치가 아니다
      'SW-07': sw('WS_THROTTLE_MS', 0, 'PassthroughThrottle'),
      'SW-11': sw('LATEST_VALUE_WRITER', 'ingest', 'IngestLatestValueWriter'),
    };
    expect(dashboardConfigBadges(switches)).toEqual([
      { id: 'SW-02', text: '최신값을 ClickHouse에서 읽는 실험 구성' },
      { id: 'SW-07', text: '스로틀 없음 — 프레임 폭증 실험' },
    ]);
  });

  it('도입 전(impl null)은 띄우지 않는다', () => {
    expect(dashboardConfigBadges({ 'SW-06': sw('REDIS_PUBSUB_FANOUT', 'off', null) })).toEqual([]);
  });
});

describe('최신값 REST 호출 — 진입 · 설비 전환 · 재연결 때 1회', () => {
  it('끊긴 채 설비 A → B → A 전환마다 1회씩 부른다(쿼리 캐시가 남아도 표가 비지 않게)', () => {
    const g = createLatestReadGate();
    const calls: number[] = [];
    const visit = (d: number) => {
      g.enter(d);
      if (g.onSync('closed')) calls.push(d);
      if (g.onStatus('closed')) calls.push(d);
    };
    visit(1);
    visit(2);
    visit(1);
    expect(calls).toEqual([1, 2, 1]);
  });

  it('같은 설비에서 끊김 상태가 다시 그려져도 추가 호출이 없다', () => {
    const g = createLatestReadGate();
    g.enter(1);
    expect(g.onStatus('closed')).toBe(true);
    expect(g.onStatus('closed')).toBe(false);
    g.enter(1); // 같은 설비 재실행은 새 진입이 아니다
    expect(g.onStatus('closed')).toBe(false);
  });

  it('열린 뒤 REST 응답 전에 끊겨도 두 번 부르지 않는다', () => {
    const g = createLatestReadGate();
    g.enter(1);
    expect(g.onStatus('connecting')).toBe(false);
    expect(g.onSync('open')).toBe(true);
    expect(g.onStatus('closed')).toBe(false);
  });

  it('재연결 · 메타 신호는 열려 있을 때마다 부른다 · 백오프 중에는 부르지 않는다', () => {
    const g = createLatestReadGate();
    g.enter(1);
    expect(g.onSync('open')).toBe(true);
    expect(g.onSync('reconnecting')).toBe(false);
    expect(g.onStatus('reconnecting')).toBe(false);
    expect(g.onSync('open')).toBe(true);
  });
});

describe('끊김 띠 문구 — 재연결하지 않는 종료', () => {
  it('1000(정상 종료)은 표시 없음 · 열림 · 재연결 중도 없음', () => {
    expect(closedBandText('closed', 1000, true)).toBeNull();
    expect(closedBandText('open', null, true)).toBeNull();
    expect(closedBandText('reconnecting', 4503, true)).toBeNull();
  });

  it('REST가 성공한 끊김만 "표는 진입 시 읽은 값이다"를 붙인다', () => {
    expect(closedBandText('closed', 4403, true)).toBe(
      'WebSocket 끊김(4403) — 재연결하지 않는 종료라 실시간 갱신이 없다 · 표는 진입 시 읽은 값이다',
    );
    const failed = closedBandText('closed', 4400, false) as string;
    expect(failed).toContain('WebSocket 끊김(4400)');
    expect(failed).not.toContain('진입 시 읽은 값');
  });
});

describe('활성 알람 띠 — 이 세션에서 받은 통지', () => {
  const frame = (
    eventId: number,
    tagId: number,
    transition: 'OPENED' | 'CLEARED',
    ts = 1_000,
  ): AlarmFrame => ({
    eventId,
    ruleId: 1,
    tagId,
    transition,
    ts,
    severity: 3,
  });

  it('같은 eventId의 열림 · 닫힘은 한 행 · 상한을 넘으면 오래 받은 것부터 버린다', () => {
    let items = pushBandItem({}, frame(1, 10, 'OPENED', 100), 1);
    items = pushBandItem(items, frame(1, 10, 'CLEARED', 200), 2);
    expect(Object.values(items)).toEqual([
      expect.objectContaining({ eventId: 1, openedTs: 100, clearedTs: 200 }),
    ]);
    items = pushBandItem(items, frame(2, 10, 'OPENED'), 3, 2);
    items = pushBandItem(items, frame(3, 10, 'OPENED'), 4, 2);
    expect(Object.keys(items).map(Number).sort()).toEqual([2, 3]);
  });

  it('이 설비의 태그만 · 최근 받은 것이 위', () => {
    let items = pushBandItem({}, frame(1, 10, 'OPENED'), 1);
    items = pushBandItem(items, frame(2, 99, 'OPENED'), 2); // 다른 설비의 태그
    items = pushBandItem(items, frame(3, 11, 'OPENED'), 3);
    const st = bandState(items, new Set([10, 11]), false);
    expect(st.kind).toBe('items');
    expect(st.kind === 'items' && st.items.map((i) => i.eventId)).toEqual([3, 1]);
    expect(bandState(items, new Set([12]), false)).toEqual({ kind: 'none' });
  });

  it('태그 목록을 모르면(Redis 503으로 메타가 빔) "없음"이 아니라 가를 수 없다고 말한다', () => {
    const items = pushBandItem({}, frame(1, 10, 'OPENED'), 1);
    expect(bandState(items, null, false)).toEqual({ kind: 'unknown', received: 1 });
  });

  it('통지 경로가 끊기면 끊김 — 받은 통지는 남긴다', () => {
    const items = pushBandItem({}, frame(1, 10, 'OPENED'), 1);
    const st = bandState(items, new Set([10]), true);
    expect(st).toMatchObject({ kind: 'down', tagsKnown: true });
    expect(st.kind === 'down' && st.items.map((i) => i.eventId)).toEqual([1]);
    expect(bandState(items, null, true)).toMatchObject({ kind: 'down', items: [], tagsKnown: false });
  });

  it('콘솔 겹침 층의 목록 반영(drop) · 재연결(clear)이 띠 세션 목록을 비우지 않는다', async () => {
    const { useAlarmOverlay } = await import('../lib/alarms-store');
    const { useAlarmBandStore } = await import('../lib/alarm-band');
    const f = frame(7, 10, 'OPENED');
    useAlarmOverlay.getState().push(f, 1);
    useAlarmBandStore.getState().push(f, 1);
    useAlarmOverlay.getState().drop([7]);
    useAlarmOverlay.getState().clear();
    expect(useAlarmOverlay.getState().items).toEqual({});
    expect(Object.keys(useAlarmBandStore.getState().items)).toEqual(['7']);
  });
});
