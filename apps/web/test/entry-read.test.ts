// 폴링 없는 읽기의 갱신 — health · 성능 보기 · 업무 보기는 진입 · 새로고침만 읽는다(08_screen/08 §호출 표면 · 갱신)
// 진입 관찰자(화면 맨 위)만 붙을 때 다시 읽고 · 탭 · 서랍 안 관찰자는 탭을 오가도 다시 읽지 않고 · 창 포커스로 다시 읽지 않는다.
import { environmentManager, focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evidenceQueryOptions } from '../components/experiments/evidence';
import { perfViewQueryOptions } from '../components/experiments/perf/perf-data';
import { healthQueryOptions } from '../lib/health';

beforeEach(() => {
  environmentManager.setIsServer(() => false);
});
afterEach(() => {
  focusManager.setFocused(undefined);
  environmentManager.setIsServer(() => typeof window === 'undefined');
});

const flush = () => new Promise((r) => setTimeout(r, 0));

type Opts = { entry?: boolean };
const CASES = [
  ['health', (o: Opts) => healthQueryOptions(o)],
  ['업무 보기', (o: Opts) => evidenceQueryOptions(o)],
] as const;

describe.each(CASES)('%s — 진입 1회 · 탭 재마운트 · 포커스 재조회 없음', (_name, make) => {
  it('진입 관찰자만 붙을 때 다시 읽는다', async () => {
    const client = new QueryClient();
    const fn = vi.fn(async () => ({ ok: true }));
    const observe = (o: Opts) =>
      new QueryObserver(client, { ...make(o), queryFn: fn } as never).subscribe(() => {});

    // 진입 — 화면 관찰자 + 탭 안 관찰자가 함께 붙어도 1회
    const offScreen = observe({ entry: true });
    const offTab = observe({});
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    // 탭을 오간다 — 탭 안 관찰자만 떨어졌다 다시 붙는다
    offTab();
    const offTab2 = observe({});
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    // 창 포커스 복귀 — 다시 읽지 않는다
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    // 화면을 떠났다 다시 들어온다(클라이언트 이동 — 같은 QueryClient) — 진입마다 1회
    offTab2();
    offScreen();
    const offAgain = observe({ entry: true });
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
    offAgain();
  });
});

describe('성능 보기 — 화면 관찰자 하나 · 포커스 재조회 없음', () => {
  it('포커스 복귀에 다시 읽지 않고 재진입에 1회', async () => {
    const client = new QueryClient();
    const fn = vi.fn(async () => ({ ok: true }));
    const observe = () =>
      new QueryObserver(client, { ...perfViewQueryOptions(), queryFn: fn } as never).subscribe(() => {});
    const off = observe();
    await flush();
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    const again = observe();
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
    again();
  });
});
