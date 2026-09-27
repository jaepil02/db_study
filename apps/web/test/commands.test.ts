// 업무 쓰기 명령 경로 — 정본 docs/08_screen/01_standards.md §업무 쓰기 응답 — 명령 경로 · docs/07_api/01_conventions.md §업무 쓰기 경로 · §명령 조회 표면
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import {
  COMMAND_VALID_MS,
  commandNotice,
  keyAfter,
  keyFor,
  newCommandKey,
  outcomeOfStatus,
  pollDelayMs,
  runBizWrite,
  sendBizWrite,
  settle,
  startWrite,
  submitLabel,
  subscribeWriter,
  type WriteOutcome,
  type WriteRequest,
  writerState,
} from '../lib/commands';
import { WRITE_UNAVAILABLE_TEXT, writeErrorText } from '../lib/error-display';

const CMD = '0b6f5c1e-8d7a-4c2b-9f3e-1a2b3c4d5e6f';
const req: WriteRequest = { method: 'POST', url: '/bff/master/tags', body: { tagCode: 'T-1' } };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const envelope = (code: string, message = 'x', details?: Record<string, unknown>) => ({
  error: { code, message, ...(details ? { details } : {}) },
});

/** 응답을 차례로 내는 가짜 fetch — 부른 url · init을 기록한다 */
function fakeFetch(...responses: (Response | Error)[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error('응답이 더 없다');
    if (r instanceof Error) throw r;
    return r;
  };
  return { f, calls };
}

const noSleep = async () => {};

describe('명령 ID(Idempotency-Key)', () => {
  it('UUID v4 형식', () => {
    expect(newCommandKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('결말 전 같은 요청은 같은 키 · 입력을 고치면 새 키', () => {
    let n = 0;
    const mint = () => `k${++n}`;
    const a = keyFor(null, req, mint);
    expect(keyFor(a, { ...req, body: { tagCode: 'T-1' } }, mint).key).toBe('k1');
    expect(keyFor(a, { ...req, body: { tagCode: 'T-2' } }, mint).key).toBe('k2');
  });

  it('503 · 오래 대기는 키를 쥐고 applied · rejected · expired는 버린다', () => {
    const held = { key: 'k1', fingerprint: 'f' };
    const e503 = new ApiError(503, 'common.postgres_unavailable', 'x');
    expect(keyAfter(held, { kind: 'retryable', error: e503 })).toBe(held);
    expect(keyAfter(held, { kind: 'stale', cmdId: CMD })).toBe(held);
    expect(keyAfter(held, { kind: 'applied', status: 201, body: {}, viaCommand: false })).toBeNull();
    expect(
      keyAfter(held, { kind: 'rejected', error: new ApiError(409, 'common.duplicate_key', 'x') }),
    ).toBeNull();
    expect(keyAfter(held, { kind: 'expired', cmdId: CMD })).toBeNull();
  });
});

describe('전송', () => {
  it('요청 헤더에 키를 싣는다 · 본문 없는 확인은 content-type 없음', async () => {
    const { f, calls } = fakeFetch(json(201, { tagId: 1 }), json(200, { eventId: 3 }));
    await sendBizWrite(req, CMD, f);
    const h = calls[0]?.init?.headers as Record<string, string> | undefined;
    expect(h?.['idempotency-key']).toBe(CMD);
    expect(h?.['content-type']).toBe('application/json');
    await sendBizWrite({ method: 'POST', url: '/bff/alarms/events/3/ack' }, CMD, f);
    const h2 = calls[1]?.init?.headers as Record<string, string> | undefined;
    expect(h2?.['content-type']).toBeUndefined();
    expect(calls[1]?.init?.body).toBeUndefined();
  });

  it('202는 성공이 아니라 accepted', async () => {
    const { f } = fakeFetch(json(202, { cmdId: CMD, status: 'pending' }, { 'idempotency-key': CMD }));
    expect(await sendBizWrite(req, CMD, f)).toEqual({ kind: 'accepted', cmdId: CMD, status: 'pending' });
  });

  it('비 2xx는 에러 봉투의 코드로 던진다', async () => {
    const { f } = fakeFetch(json(409, envelope('common.duplicate_key', 'dup', { field: 'tagCode' })));
    await expect(sendBizWrite(req, CMD, f)).rejects.toMatchObject({
      status: 409,
      code: 'common.duplicate_key',
      details: { field: 'tagCode' },
    });
  });
});

describe('명령 조회 결과 → 결말', () => {
  it('status 5', () => {
    expect(outcomeOfStatus({ cmdId: CMD, status: 'pending' })).toBeNull();
    expect(outcomeOfStatus({ cmdId: CMD, status: 'applied', httpStatus: 201, result: { tagId: 9 } })).toEqual(
      {
        kind: 'applied',
        status: 201,
        body: { tagId: 9 },
        viaCommand: true,
      },
    );
    const rej = outcomeOfStatus({
      cmdId: CMD,
      status: 'rejected',
      httpStatus: 409,
      error: { code: 'master.scale_change_forbidden', message: 'x' },
    });
    expect(rej?.kind).toBe('rejected');
    expect(rej?.kind === 'rejected' && rej.error.code).toBe('master.scale_change_forbidden');
    const failed = outcomeOfStatus({
      cmdId: CMD,
      status: 'failed',
      httpStatus: 503,
      error: { code: 'common.postgres_unavailable', message: 'x' },
    });
    expect(failed?.kind === 'retryable' && failed.error.status).toBe(503);
    expect(outcomeOfStatus({ cmdId: CMD, status: 'expired' })).toEqual({ kind: 'expired', cmdId: CMD });
  });

  it('백오프 1 · 2 · 4초 … 최대 30초', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(pollDelayMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
  });
});

describe('쓰기 한 건을 결말까지', () => {
  it('대기 상한 안 결과는 옛 경로와 같다(viaCommand 거짓)', async () => {
    const { f } = fakeFetch(json(201, { tagId: 5 }));
    expect(await runBizWrite(req, CMD, { fetch: f })).toEqual({
      kind: 'applied',
      status: 201,
      body: { tagId: 5 },
      viaCommand: false,
    });
  });

  it('202 pending → 명령 조회(조회 503은 넘기고) → applied · 조회는 BFF no-store 경로', async () => {
    const { f, calls } = fakeFetch(
      json(202, { cmdId: CMD, status: 'pending' }),
      json(200, { cmdId: CMD, status: 'pending' }),
      json(503, envelope('common.postgres_unavailable')),
      json(200, { cmdId: CMD, status: 'applied', httpStatus: 201, result: { tagId: 7 } }),
    );
    const accepted = vi.fn();
    const sleeps: number[] = [];
    const o = await runBizWrite(req, CMD, {
      fetch: f,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      onAccepted: accepted,
    });
    expect(accepted).toHaveBeenCalledWith(CMD);
    expect(o).toEqual({ kind: 'applied', status: 201, body: { tagId: 7 }, viaCommand: true });
    expect(calls.slice(1).map((c) => c.url)).toEqual([
      `/bff/commands/${CMD}`,
      `/bff/commands/${CMD}`,
      `/bff/commands/${CMD}`,
    ]);
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  it('pending이 유효 창을 넘으면 오래 대기(같은 키 재전송 대상)', async () => {
    let t = 0;
    const responses = [json(202, { cmdId: CMD, status: 'pending' })];
    for (let i = 0; i < 20; i++) responses.push(json(200, { cmdId: CMD, status: 'pending' }));
    const { f } = fakeFetch(...responses);
    const o = await runBizWrite(req, CMD, {
      fetch: f,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
    });
    expect(o).toEqual({ kind: 'stale', cmdId: CMD });
    expect(t).toBeGreaterThanOrEqual(COMMAND_VALID_MS);
  });

  it('조회 404 → 볼 수 없다 · 202 expired → 만료', async () => {
    const a = fakeFetch(
      json(202, { cmdId: CMD, status: 'pending' }),
      json(404, envelope('common.not_found')),
    );
    expect(await runBizWrite(req, CMD, { fetch: a.f, sleep: noSleep })).toEqual({
      kind: 'unseen',
      cmdId: CMD,
    });
    const b = fakeFetch(json(202, { cmdId: CMD, status: 'expired' }));
    expect(await runBizWrite(req, CMD, { fetch: b.f })).toEqual({ kind: 'expired', cmdId: CMD });
  });

  it('쓰기 503 · 네트워크 실패는 재시도 대상 · 도메인 오류는 거절', async () => {
    const a = fakeFetch(json(503, envelope('common.postgres_unavailable')));
    expect((await runBizWrite(req, CMD, { fetch: a.f })).kind).toBe('retryable');
    const b = fakeFetch(new TypeError('fetch failed'));
    const nb = await runBizWrite(req, CMD, { fetch: b.f });
    expect(nb.kind === 'retryable' && nb.error.status).toBe(0);
    const c = fakeFetch(json(400, envelope('common.validation_failed')));
    expect((await runBizWrite(req, CMD, { fetch: c.f })).kind).toBe('rejected');
  });

  it('폴링 중 화면을 떠나면 aborted', async () => {
    const ctl = new AbortController();
    const { f } = fakeFetch(json(202, { cmdId: CMD, status: 'pending' }));
    const o = await runBizWrite(req, CMD, {
      fetch: f,
      signal: ctl.signal,
      sleep: async () => ctl.abort(),
    });
    expect(o).toEqual({ kind: 'aborted' });
  });
});

describe('표시', () => {
  it('업무 쓰기 503 띠 문구 — 조회 503 문구와 다르다', () => {
    const e = new ApiError(503, 'common.postgres_unavailable', 'x');
    expect(WRITE_UNAVAILABLE_TEXT).toBe(
      '업무 쓰기 저장소 응답 불가 — 조회는 된다 · 같은 키로 다시 보내면 안전',
    );
    expect(writeErrorText(e)).toBe(`${WRITE_UNAVAILABLE_TEXT} (common.postgres_unavailable/503)`);
    expect(commandNotice({ phase: 'retryable', error: e })).toEqual({
      tone: 'danger',
      text: `${WRITE_UNAVAILABLE_TEXT} (common.postgres_unavailable/503)`,
      retry: '같은 키로 다시 보내기',
    });
  });

  it('적용 대기 · 오래 대기 · 만료 · 볼 수 없음', () => {
    expect(submitLabel({ phase: 'pending', cmdId: CMD }, '저장')).toBe('적용 대기 — 명령 접수됨');
    expect(submitLabel({ phase: 'sending' }, '저장')).toBe('저장 중…');
    expect(submitLabel({ phase: 'idle' }, '저장')).toBe('저장');
    expect(commandNotice({ phase: 'pending', cmdId: CMD })?.text).toContain('적용 대기 — 명령 접수됨');
    expect(commandNotice({ phase: 'stale', cmdId: CMD })).toMatchObject({
      retry: '같은 명령으로 다시 보내기',
    });
    expect(commandNotice({ phase: 'expired', cmdId: CMD })).toMatchObject({ retry: null });
    expect(commandNotice({ phase: 'expired', cmdId: CMD })?.text).toContain('적용되지 않았다 — 유효 창 초과');
    expect(commandNotice({ phase: 'unseen', cmdId: CMD })?.text).toContain('이 명령을 볼 수 없다');
    expect(commandNotice({ phase: 'idle' })).toBeNull();
  });

  it('settle — applied는 본문으로 · rejected는 오류로 · 본문 해석 실패도 오류로', async () => {
    const ok = vi.fn();
    const bad = vi.fn();
    await settle({ kind: 'applied', status: 200, body: { a: 1 }, viaCommand: true }, ok, bad);
    expect(ok).toHaveBeenCalledWith({ a: 1 }, expect.objectContaining({ viaCommand: true }));
    await settle(
      { kind: 'applied', status: 200, body: null, viaCommand: false },
      () => {
        throw new Error('모양');
      },
      bad,
    );
    expect(bad).toHaveBeenCalledTimes(1);
    await settle({ kind: 'expired', cmdId: CMD }, ok, bad);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(bad).toHaveBeenCalledTimes(1);
  });
});

describe('대기 중 재마운트', () => {
  it('⑥ 신호로 폼이 다시 마운트돼도 폴링 · 결말 처리가 이어지고 새 인스턴스가 잠금을 본다', async () => {
    let answer: (r: Response) => void = () => {};
    const polled = new Promise<Response>((r) => {
      answer = r;
    });
    const responses: (Response | Promise<Response>)[] = [
      json(202, { cmdId: CMD, status: 'pending' }),
      polled,
    ];
    const f = async () =>
      (responses.shift() as Response | Promise<Response>) ?? Promise.reject(new Error('없음'));
    const scope = 'test:remount';
    let alive = true;
    const done: WriteOutcome[] = [];
    const off1 = subscribeWriter(scope, () => {}, 50);
    const run = startWrite(scope, req, (o) => void done.push(o), {
      deps: { fetch: f, sleep: noSleep },
      ownerAlive: () => alive,
    });
    await vi.waitFor(() => expect(writerState(scope)).toEqual({ phase: 'pending', cmdId: CMD }));
    // 재마운트 — 옛 인스턴스가 떨어지고 새 인스턴스가 같은 scope에 붙는다
    alive = false;
    off1();
    const off2 = subscribeWriter(scope, () => {}, 50);
    expect(writerState(scope).phase).toBe('pending');
    await new Promise((r) => setTimeout(r, 80)); // 해제 유예가 지나도 구독자가 있으니 중단되지 않는다
    answer(json(200, { cmdId: CMD, status: 'applied', httpStatus: 201, result: { tagId: 7 } }));
    await run;
    expect(done).toEqual([{ kind: 'applied', status: 201, body: { tagId: 7 }, viaCommand: true }]);
    expect(writerState(scope)).toEqual({ phase: 'idle' });
    off2();
  });

  it('보낸 폼이 떨어진 뒤의 거절은 띠(rejected)로 넘긴다 · 구독자가 모두 떠나면 폴링을 멈춘다', async () => {
    const a = fakeFetch(json(409, envelope('common.duplicate_key')));
    const off = subscribeWriter('test:orphan', () => {}, 10);
    await startWrite('test:orphan', req, () => {}, { deps: { fetch: a.f }, ownerAlive: () => false });
    const st = writerState('test:orphan');
    expect(st.phase === 'rejected' && st.error.code).toBe('common.duplicate_key');
    expect(commandNotice(st)?.text).toContain('이미 있는 값');
    off();

    const b = fakeFetch(json(202, { cmdId: CMD, status: 'pending' }));
    const done = vi.fn();
    const off3 = subscribeWriter('test:leave', () => {}, 10);
    const run = startWrite('test:leave', req, done, {
      deps: {
        fetch: b.f,
        sleep: (_ms, signal) => new Promise((r) => signal?.addEventListener('abort', () => r())),
      },
    });
    await vi.waitFor(() => expect(writerState('test:leave').phase).toBe('pending'));
    off3(); // 화면을 떠났다
    await run;
    expect(done).not.toHaveBeenCalled();
    expect(writerState('test:leave')).toEqual({ phase: 'idle' });
  });
});

// ── BFF 중계 ──
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

describe('BFF 쓰기 중계', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });

  it('마스터 — 키 양방향 · 201은 ⑤ · 202는 ⑤ 없음', async () => {
    const { revalidateTag } = await import('next/cache');
    const route = await import('../app/bff/master/[...path]/route');
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(201, { tagId: 1 }, { 'idempotency-key': CMD }),
    );
    vi.stubGlobal('fetch', upstream);
    const r = await route.POST(
      new Request('http://web/bff/master/tags', {
        method: 'POST',
        headers: { 'idempotency-key': CMD, 'content-type': 'application/json' },
        body: '{}',
      }),
      ctx(['tags']),
    );
    const sent = upstream.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(sent?.['idempotency-key']).toBe(CMD);
    expect(r.headers.get('idempotency-key')).toBe(CMD);
    expect(revalidateTag).toHaveBeenCalledWith('master-tags');

    vi.mocked(revalidateTag).mockClear();
    upstream.mockImplementationOnce(async () =>
      json(202, { cmdId: CMD, status: 'pending' }, { 'idempotency-key': CMD }),
    );
    const r2 = await route.PATCH(
      new Request('http://web/bff/master/tags/1', {
        method: 'PATCH',
        headers: { 'idempotency-key': CMD },
        body: '{}',
      }),
      ctx(['tags', '1']),
    );
    expect(r2.status).toBe(202);
    expect(r2.headers.get('idempotency-key')).toBe(CMD);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('알람 — 확인 요청의 키를 싣고 되싣는다', async () => {
    const route = await import('../app/bff/alarms/[...path]/route');
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(202, { cmdId: CMD, status: 'pending' }, { 'idempotency-key': CMD }),
    );
    vi.stubGlobal('fetch', upstream);
    const r = await route.POST(
      new Request('http://web/bff/alarms/events/3/ack', {
        method: 'POST',
        headers: { 'idempotency-key': CMD },
      }),
      ctx(['events', '3', 'ack']),
    );
    const h = upstream.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(h?.['idempotency-key']).toBe(CMD);
    expect(h?.['content-type']).toBeUndefined();
    expect(r.status).toBe(202);
    expect(r.headers.get('idempotency-key')).toBe(CMD);
  });

  it('명령 조회 — no-store 중계', async () => {
    const route = await import('../app/bff/commands/[cmdId]/route');
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) =>
      json(200, { cmdId: CMD, status: 'pending' }),
    );
    vi.stubGlobal('fetch', upstream);
    const r = await route.GET(new Request(`http://web/bff/commands/${CMD}`), {
      params: Promise.resolve({ cmdId: CMD }),
    });
    expect(upstream.mock.calls[0]?.[0]).toMatch(new RegExp(`/api/v1/commands/${CMD}$`));
    expect(upstream.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ cmdId: CMD, status: 'pending' });
  });
});
