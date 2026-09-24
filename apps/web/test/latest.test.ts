import { describe, expect, it } from 'vitest';
import { clockOffsetMs, judgeFreshness, mergeLatest, type TagLatest } from '../lib/latest';

const base: TagLatest = { tagId: 1, ts: 1000, value: 1, quality: 9, serverStale: false };

describe('mergeLatest — ts 최대값 우선', () => {
  it('저장된 ts보다 작은 값은 버린다(늦은 REST가 WS 값을 덮지 않는다)', () => {
    const r = mergeLatest(base, { tagId: 1, ts: 999, value: 2, quality: 9 }, 'rest');
    expect(r).toBe(base);
  });

  it('같은 ts는 받아들인다(이상)', () => {
    const r = mergeLatest(base, { tagId: 1, ts: 1000, value: 2, quality: 9 }, 'ws');
    expect(r?.value).toBe(2);
  });

  it('REST quality 5는 서버 STALE을 켠다', () => {
    const r = mergeLatest(base, { tagId: 1, ts: 1000, value: 1, quality: 5 }, 'rest');
    expect(r?.serverStale).toBe(true);
  });

  it('더 큰 ts의 WS 프레임이 STALE을 끈다 · 같은 ts 프레임은 끄지 않는다', () => {
    const stale = { ...base, quality: 5, serverStale: true };
    expect(mergeLatest(stale, { tagId: 1, ts: 1000, value: 1, quality: 9 }, 'ws')?.serverStale).toBe(true);
    expect(mergeLatest(stale, { tagId: 1, ts: 1001, value: 1, quality: 9 }, 'ws')?.serverStale).toBe(false);
  });

  it('처음 보는 태그는 받아들인다', () => {
    expect(mergeLatest(undefined, { tagId: 7, ts: 1, value: 3, quality: 0 }, 'ws')?.tagId).toBe(7);
  });
});

describe('STALE 판정', () => {
  it('오프셋 = servedAt − 수신 시각', () => {
    expect(clockOffsetMs('2026-09-24T01:00:00.000Z', Date.parse('2026-09-24T00:59:58.000Z'))).toBe(2000);
  });

  it('추정 서버 현재 − ts > staleAfterMs면 화면 STALE', () => {
    // 브라우저 현재 10,000 · 오프셋 +500 → 서버 현재 10,500 · ts 7,000 → 나이 3,500 > 3,000
    expect(judgeFreshness({ ts: 7000, serverStale: false }, 3000, 10_000, 500)).toEqual({
      kind: 'stale',
      ageMs: 3500,
      by: 'screen',
    });
    expect(judgeFreshness({ ts: 7600, serverStale: false }, 3000, 10_000, 500).kind).toBe('fresh');
  });

  it('브라우저 시계가 빨라도 오프셋이 보정한다', () => {
    // 브라우저가 서버보다 5초 빠름 → 오프셋 −5,000
    expect(judgeFreshness({ ts: 100_000, serverStale: false }, 3000, 106_000, -5000).kind).toBe('fresh');
  });

  it('서버 STALE은 나이와 무관하게 STALE', () => {
    expect(judgeFreshness({ ts: 10_000, serverStale: true }, 3000, 10_000, 0)).toMatchObject({
      kind: 'stale',
      by: 'server',
    });
  });

  it('staleAfterMs null이면 판정하지 않고 값의 나이만', () => {
    expect(judgeFreshness({ ts: 1000, serverStale: false }, null, 60_000, 0)).toEqual({
      kind: 'unjudged',
      ageMs: 59_000,
    });
  });
});
