// SW-09 gated — 같은 PostgresControlSink를 Redis 게이트(cache:dual:active)가 있을 때만 부른다(D-16 · 지침서 §D)
// 게이트 읽기 캐시(≤ 500 ms) · 읽기 실패 때 직전 값 유지(상한 10초) · 닫힌 배치는 흐름 요약 controlCopy 없음 · 주입 등록 값 gated.
import { describe, expect, it } from 'vitest';
import type { SwitchRegistry } from '../src/common/ports/switch-registry';
import { loadConfig } from '../src/config/app-config';
import {
  type ControlTableSinkPort,
  DUAL_GATE_CACHE_MS,
  DUAL_GATE_STALE_MS,
  DualGateReader,
  GatedControlSink,
  NoopControlSink,
} from '../src/modules/ingest/control-table-sink.port';
import { controlSinkFactory } from '../src/modules/ingest/ingest.module';

function fakeSource() {
  const src = {
    value: null as string | null,
    failed: false,
    reads: 0,
    async getDualGate() {
      src.reads += 1;
      return { value: src.failed ? null : src.value, failed: src.failed };
    },
  };
  return src;
}

describe('DualGateReader — 게이트 판정 캐시', () => {
  it('처음엔 읽고 · 캐시 창 안에서는 다시 읽지 않는다 · 창이 지나면 다시 읽는다', async () => {
    const src = fakeSource();
    let now = 0;
    const g = new DualGateReader(src, () => now);
    expect(await g.isOpen()).toBe(false);
    src.value = 'run-1';
    now += DUAL_GATE_CACHE_MS - 1;
    expect(await g.isOpen()).toBe(false);
    expect(src.reads).toBe(1);
    now += 2;
    expect(await g.isOpen()).toBe(true);
    expect(src.reads).toBe(2);
  });

  it('동시 호출은 읽기 하나를 나눠 쓴다', async () => {
    const src = fakeSource();
    src.value = 'r';
    const g = new DualGateReader(src, () => 0);
    const all = await Promise.all([g.isOpen(), g.isOpen(), g.isOpen()]);
    expect(all).toEqual([true, true, true]);
    expect(src.reads).toBe(1);
  });

  it('읽기 실패(degrade) — 직전 "열림"을 상한(10초)까지 지키고, 넘으면 닫힘', async () => {
    const src = fakeSource();
    src.value = 'r';
    let now = 0;
    const g = new DualGateReader(src, () => now);
    expect(await g.isOpen()).toBe(true);
    src.failed = true;
    now += DUAL_GATE_CACHE_MS + 1;
    expect(await g.isOpen()).toBe(true);
    now = DUAL_GATE_STALE_MS + 1;
    expect(await g.isOpen()).toBe(false);
  });

  it('원천이 던져도 실패로 다룬다(던지지 않는다)', async () => {
    const g = new DualGateReader(
      {
        getDualGate: async () => {
          throw new Error('x');
        },
      },
      () => 0,
    );
    expect(await g.isOpen()).toBe(false);
  });
});

describe('GatedControlSink — 닫히면 null(싣지 않음) · 열리면 같은 COPY', () => {
  function inner() {
    const calls: number[] = [];
    const sink: ControlTableSinkPort = {
      implName: 'PostgresControlSink',
      copy: async (rows) => {
        calls.push(rows.length);
        return true;
      },
      close: async () => {},
    };
    return { sink, calls };
  }

  it('게이트 닫힘 → copy null · 안쪽 COPY 없음 / 열림 → 안쪽 결과 그대로', async () => {
    const { sink, calls } = inner();
    let open = false;
    const g = new GatedControlSink(sink, { isOpen: async () => open });
    expect(g.implName).toBe('PostgresControlSink');
    expect(await g.copy([[1, 1, 1, 0.5, 9, 1]], { token: null })).toBeNull();
    expect(calls).toEqual([]);
    open = true;
    expect(await g.copy([[1, 1, 1, 0.5, 9, 1]], { token: null })).toBe(true);
    expect(calls).toEqual([1]);
  });

  it('NoopControlSink는 그대로 true(off · 흐름 요약은 implName으로 거른다)', async () => {
    expect(await new NoopControlSink().copy()).toBe(true);
  });
});

describe('controlSinkFactory — SW-09 값 3', () => {
  const src = fakeSource();
  it.each([
    ['off', 'NoopControlSink', false],
    ['on', 'PostgresControlSink', false],
    ['gated', 'PostgresControlSink', true],
  ] as const)('%s → %s(게이트 %s)', async (value, impl, gated) => {
    const cfg = loadConfig({
      WORKER_POOL_SIZE: '1',
      CONTROL_TABLE_ENABLED: value,
      POSTGRES_URL: 'postgres://u:p@127.0.0.1:1/plc',
      CLICKHOUSE_URL: 'http://u:p@127.0.0.1:1/plc',
      REDIS_URL: 'redis://127.0.0.1:1',
    });
    const seen: { id: string; value: unknown; impl: string }[] = [];
    const reg = {
      register: (id: string, v: unknown, i: string) => seen.push({ id, value: v, impl: i }),
    } as unknown as SwitchRegistry;
    const sink = controlSinkFactory(cfg, reg, src);
    expect(sink.implName).toBe(impl);
    expect(sink instanceof GatedControlSink).toBe(gated);
    expect(seen).toEqual([{ id: 'SW-09', value, impl }]);
    await sink.close();
  });
});
