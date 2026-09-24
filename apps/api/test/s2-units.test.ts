// S2 순수 함수 단위 — 창 정렬(06_pipeline/03) · 시계열 구간 분류와 키(06_pipeline/06) · 태그 메타 Hash(05_data_stores/05) · 출처 방어(12_security/03)
import { describe, expect, it } from 'vitest';
import { isAllowedHost, isAllowedOrigin } from '../src/common/http/surface-defense';
import { parseLatestValue } from '../src/common/redis/durable-key-client';
import type { DecodedEntry } from '../src/common/workers/tasks';
import {
  type BatchEntry,
  cmpId,
  idMsOf,
  rowsOf,
  WINDOW_GRACE_MS,
  WINDOW_MS,
  WindowBuffer,
} from '../src/modules/ingest/window-buffer';
import { hashToTagMeta, type TagMeta, tagMetaToHash } from '../src/modules/master/tag-meta';
import { cacheKey, classify, RECENT_WINDOW_MS } from '../src/modules/timeseries/timeseries.service';

function entry(id: string, s = 1): BatchEntry {
  const e: DecodedEntry = {
    ok: true,
    d: 1,
    s,
    t0: 1_000_000,
    tg: [1, 2],
    dt: [0, 3],
    va: [1.5, 2.5],
    q: [9, 9],
    negativeDt: 0,
  };
  return { id, idMs: idMsOf(id), decodedAt: 0, entry: e };
}

describe('창 정렬 배치 — 엔트리 ID 시각', () => {
  it('ⓐ 워터마크가 창 끝을 넘으면 닫힌다 · 창 안은 ID 순', () => {
    const b = new WindowBuffer();
    b.add(entry('5500-1'));
    b.add(entry('5100-0'));
    b.add(entry('5500-0'));
    expect(b.takeClosable(0, false)).toEqual([]);
    b.add(entry('6000-0')); // 워터마크 = 창 5의 끝
    const [w, ...rest] = b.takeClosable(0, false);
    expect(rest).toEqual([]);
    expect(w?.k).toBe(5);
    expect(w?.entries.map((e) => e.id)).toEqual(['5100-0', '5500-0', '5500-1']);
    expect(b.size).toBe(1);
  });

  it('ⓑ 따라잡았을 때만 시계 + 유예로 닫힌다', () => {
    const b = new WindowBuffer();
    b.add(entry('7200-0'));
    const end = 8 * WINDOW_MS;
    expect(b.takeClosable(end + WINDOW_GRACE_MS, false)).toEqual([]);
    expect(b.takeClosable(end + WINDOW_GRACE_MS - 1, true)).toEqual([]);
    expect(b.takeClosable(end + WINDOW_GRACE_MS, true).map((w) => w.k)).toEqual([7]);
  });

  it('창은 순서대로만 닫힌다 · advance는 워터마크만 올린다', () => {
    const b = new WindowBuffer();
    b.add(entry('3100-0'));
    b.add(entry('4100-0'));
    b.advance(4000);
    expect(b.takeClosable(0, false).map((w) => w.k)).toEqual([3]);
    expect(b.drainAll().map((w) => w.k)).toEqual([4]);
  });

  it('닫힌 창 뒤에 온 엔트리는 창을 다시 열지 않고 다음 창으로 넘긴다', () => {
    const b = new WindowBuffer();
    b.add(entry('5100-0'));
    expect(b.takeClosable(6 * WINDOW_MS + WINDOW_GRACE_MS, true).map((w) => w.k)).toEqual([5]);
    b.add(entry('5900-0')); // 디코딩 사이 늦게 온 창 5 엔트리
    expect(b.lateEntries).toBe(1);
    const [w] = b.drainAll();
    expect(w?.k).toBe(6);
    expect(w?.entries.map((e) => e.id)).toEqual(['5900-0']);
  });

  it('행 = t0 + dt · 열 순서 ts · device · tag · value · quality · scan_seq', () => {
    const b = new WindowBuffer();
    b.add(entry('100-0', 42));
    const [w] = b.drainAll();
    expect(rowsOf(w as NonNullable<typeof w>)).toEqual([
      [1_000_000, 1, 1, 1.5, 9, 42],
      [1_000_003, 1, 2, 2.5, 9, 42],
    ]);
  });

  it('ID 비교는 밀리초 · 순번 수치 비교', () => {
    expect(cmpId('10-2', '9-5')).toBeGreaterThan(0);
    expect(cmpId('10-10', '10-9')).toBeGreaterThan(0);
    expect(cmpId('10-1', '10-1')).toBe(0);
  });
});

describe('시계열 TTL 구간 · 정규화 키', () => {
  const now = 10_000_000_000;
  it('최근 5분 → recent · 현재 1분 버킷 → current · 그 밖 past', () => {
    expect(classify(now - RECENT_WINDOW_MS + 1, now)).toBe('recent');
    expect(classify(now - RECENT_WINDOW_MS, now)).toBe('past');
  });

  it('raw 버킷 1분은 최근 창 5분 안에 묻힌다 — S2에서 current는 나오지 않는다(롤업 해상도가 생기는 S4부터)', () => {
    for (let to = now - 10 * 60_000; to <= now; to += 7_000) expect(classify(to, now)).not.toBe('current');
  });

  it('태그 순서 · 기본 maxPoints는 키를 바꾸지 않는다', () => {
    const a = cacheKey({ tagIds: [3, 1, 2], fromMs: 1, toMs: 2, maxPoints: 2000 });
    const b = cacheKey({ tagIds: [1, 2, 3], fromMs: 1, toMs: 2, maxPoints: 2000 });
    const c = cacheKey({ tagIds: [1, 2, 3], fromMs: 1, toMs: 2, maxPoints: 500 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^cache:q:[0-9a-f]{40}$/);
  });
});

describe('태그 메타 Hash 왕복', () => {
  const m: TagMeta = {
    tagId: 7,
    deviceId: 1,
    tagCode: 'DEV-001-T007',
    tagName: '태그 7',
    functionCode: 3,
    address: 12,
    dataType: 'FLOAT32',
    wordOrder: 'ABCD',
    scale: 1,
    offsetValue: 0,
    unit: '',
    deadband: 0,
    scanRateMs: 1000,
    rangeMin: null,
    rangeMax: null,
    isActive: true,
  };
  it('NULL은 필드로 싣지 않고 왕복이 같다', () => {
    const h = tagMetaToHash(m);
    expect(h).not.toHaveProperty('range_min');
    expect(hashToTagMeta(7, h)).toEqual(m);
  });
});

describe('최신값 필드 · 출처 방어', () => {
  it('ts,value,quality 해석 · 깨진 값은 null', () => {
    expect(parseLatestValue('1790000000000,1.25,9')).toEqual({ ts: 1790000000000, value: 1.25, quality: 9 });
    expect(parseLatestValue('x,1,9')).toBeNull();
    expect(parseLatestValue('1,1,9.5')).toBeNull();
  });

  it('Host는 localhost · 127.0.0.1 · api(포트 무관)만', () => {
    for (const h of ['localhost', 'localhost:3000', '127.0.0.1:3000', 'api:3000', 'API'])
      expect(isAllowedHost(h)).toBe(true);
    for (const h of [undefined, '', 'evil.com', 'localhost.evil.com', 'api.evil.com:3000', '10.0.0.1'])
      expect(isAllowedHost(h)).toBe(false);
  });

  it('Origin은 http://localhost:3001 하나', () => {
    expect(isAllowedOrigin('http://localhost:3001')).toBe(true);
    for (const o of [undefined, 'http://127.0.0.1:3001', 'https://localhost:3001', 'http://localhost:3000'])
      expect(isAllowedOrigin(o)).toBe(false);
  });
});
