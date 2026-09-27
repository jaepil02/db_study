// 회귀 — /realtime 첫 로드에서 사이트를 아직 모를 때 GET /bff/master/lines?siteId=0(400)을 부르던 결함.
// useLines는 null을 받고 enabled: siteId !== null로 막는다(useDevices와 같은 방식).
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { linesQuery } from '../components/master/queries';

afterEach(() => vi.unstubAllGlobals());

function observe(siteId: number | null) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ items: [], meta: { count: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient();
  const obs = new QueryObserver(client, linesQuery(siteId));
  const unsubscribe = obs.subscribe(() => {});
  return { fetchMock, obs, unsubscribe };
}

describe('linesQuery', () => {
  it('siteId null이면 부르지 않는다 — siteId=0 요청이 나가지 않는다', async () => {
    const { fetchMock, obs, unsubscribe } = observe(null);
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(obs.getCurrentResult().fetchStatus).toBe('idle');
    unsubscribe();
  });

  it('siteId가 있으면 그 사이트로 부른다', async () => {
    const { fetchMock, obs, unsubscribe } = observe(3);
    await vi.waitFor(() => expect(obs.getCurrentResult().isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/bff/master/lines?siteId=3');
    unsubscribe();
  });
});
