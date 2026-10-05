// S4 실시간 — SW-07 스로틀(Window 대 Passthrough) · SW-06 팬아웃(Direct 역할 제약 #6) · cacheinv 즉시 중계 · 4413 · 구독 상한(07_api/11)
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { realtimeFanoutFactory } from '../src/common/ports/ports.module';
import { DirectGatewayFanout } from '../src/common/ports/realtime-fanout.port';
import type { SwitchRegistry } from '../src/common/ports/switch-registry';
import type { RedisConnections } from '../src/common/redis/connections';
import type { FanoutPublisher } from '../src/common/redis/fanout-publisher';
import type { AppConfig } from '../src/config/app-config';
import type { MasterReadService } from '../src/modules/master/master-read.service';
import {
  type FrameThrottlePort,
  PassthroughThrottle,
  type Pending,
  WindowMergeThrottle,
} from '../src/modules/realtime/frame-throttle.port';
import {
  RealtimeGateway,
  WS_SEND_BUFFER_LIMIT_BYTES,
  WS_SUBSCRIBE_LIMIT,
} from '../src/modules/realtime/realtime.gateway';

describe('SW-07 FrameThrottlePort', () => {
  it('Window — 창 안 같은 태그는 ts 최대 하나 · 도착 순서가 뒤집혀도 뒤로 가지 않는다', () => {
    const t = new WindowMergeThrottle(100);
    const p: Pending = new Map();
    expect(t.offer(p, 1, [[7, 2000, 2, 0]]).frame).toBeNull();
    expect(t.offer(p, 1, [[7, 1000, 1, 0]]).merged).toBe(1);
    t.offer(p, 1, [[8, 1500, 3, 0]]);
    expect(t.drain(p)).toEqual([
      {
        deviceId: 1,
        tags: [
          [7, 2000, 2, 0],
          [8, 1500, 3, 0],
        ],
      },
    ]);
    expect(t.drain(p)).toBeNull();
  });

  it('Passthrough(창 0) — 받은 대로 즉시 프레임 · 병합 없음 · 타이머 주기 0', () => {
    const t = new PassthroughThrottle();
    const p: Pending = new Map();
    expect(t.windowMs).toBe(0);
    expect(t.offer(p, 3, [[1, 1, 1, 0]])).toEqual({
      frame: [{ deviceId: 3, tags: [[1, 1, 1, 0]] }],
      merged: 0,
    });
    expect(p.size).toBe(0);
    expect(() => new WindowMergeThrottle(0)).toThrow();
  });
});

describe('SW-06 팬아웃 — 제약 #6', () => {
  const reg = () => {
    const calls: unknown[][] = [];
    return { reg: { register: (...a: unknown[]) => calls.push(a) } as unknown as SwitchRegistry, calls };
  };
  const cfg = (role: string, sw: 'on' | 'off') =>
    ({ appRole: role, switches: { 'SW-06': sw } }) as unknown as AppConfig;

  it('off + all이면 DirectGatewayFanout · 다른 역할이면 경고와 함께 RedisPubSubFanout', () => {
    const a = reg();
    expect(realtimeFanoutFactory(cfg('all', 'off'), a.reg, {} as FanoutPublisher).implName).toBe(
      'DirectGatewayFanout',
    );
    expect(a.calls[0]).toEqual(['SW-06', 'off', 'DirectGatewayFanout', null]);
    const b = reg();
    expect(realtimeFanoutFactory(cfg('ingest', 'off'), b.reg, {} as FanoutPublisher).implName).toBe(
      'RedisPubSubFanout',
    );
    expect(b.calls[0]).toEqual(['SW-06', 'on', 'RedisPubSubFanout', 'combo_6_role_not_all']);
  });
});

/** 가짜 소켓 · 가짜 구독 연결로 게이트웨이를 띄운다 */
function gateway(throttle: FrameThrottlePort) {
  const sub = Object.assign(new EventEmitter(), {
    status: 'ready',
    subscribe: async () => 1,
    unsubscribe: async () => 1,
  });
  const redis = { subscriberConnection: () => sub } as unknown as RedisConnections;
  const master = { deviceExists: async () => true } as unknown as MasterReadService;
  const gw = new RealtimeGateway(redis, master, throttle);
  const open = () => {
    const ws = Object.assign(new EventEmitter(), {
      OPEN: 1,
      readyState: 1,
      bufferedAmount: 0,
      sent: [] as Record<string, unknown>[],
      closed: null as number | null,
      send(m: string) {
        this.sent.push(JSON.parse(m));
      },
      close(code: number) {
        this.closed = code;
        this.readyState = 3;
      },
      terminate() {},
    });
    gw.handleConnection(
      ws as unknown as WebSocket,
      {
        headers: { origin: 'http://localhost:13001' },
        url: '/ws/realtime',
      } as IncomingMessage,
    );
    const say = async (m: unknown) => {
      ws.emit('message', Buffer.from(JSON.stringify(m)));
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    };
    return { ws, say };
  };
  return { gw, sub, open };
}

describe('게이트웨이 — 중계 · 한도', () => {
  it('Passthrough는 발행마다 rt 프레임 · Direct 버스 경로도 같은 자리로 온다', async () => {
    const g = gateway(new PassthroughThrottle());
    const c = g.open();
    await c.say({ type: 'subscribe', devices: [5] });
    g.sub.emit('message', 'ch:rt:5', JSON.stringify([[1, 10, 1, 0]]));
    await new DirectGatewayFanout().publishRt(5, [[1, 11, 2, 0]]);
    const rt = c.ws.sent.filter((m) => m.type === 'rt');
    expect(rt).toHaveLength(2);
    expect(rt[1]).toMatchObject({ devices: [{ deviceId: 5, tags: [[1, 11, 2, 0]] }] });
    g.gw.onModuleDestroy();
  });

  it('cacheinv는 구독과 무관하게 전 연결에 즉시 · 키 그대로(병합 없음)', async () => {
    const g = gateway(new WindowMergeThrottle(100_000));
    const a = g.open();
    const b = g.open();
    g.sub.emit('message', 'ch:cacheinv', JSON.stringify(['tagmeta:1']));
    g.sub.emit('message', 'ch:cacheinv', JSON.stringify(['tagmeta:1', 'devlist:2']));
    for (const c of [a, b]) {
      expect(c.ws.sent.filter((m) => m.type === 'cacheinv')).toEqual([
        { type: 'cacheinv', keys: ['tagmeta:1'] },
        { type: 'cacheinv', keys: ['tagmeta:1', 'devlist:2'] },
      ]);
    }
    g.gw.onModuleDestroy();
  });

  it('송신 대기량이 한도를 넘은 소켓만 4413', async () => {
    const g = gateway(new PassthroughThrottle());
    const slow = g.open();
    const ok = g.open();
    slow.ws.bufferedAmount = WS_SEND_BUFFER_LIMIT_BYTES + 1;
    g.sub.emit('message', 'ch:cacheinv', '["x"]');
    expect(slow.ws.closed).toBe(4413);
    expect(ok.ws.closed).toBeNull();
    g.gw.onModuleDestroy();
  });

  it('구독 상한을 넘는 설비는 rejected limit · 연결은 유지', async () => {
    const g = gateway(new PassthroughThrottle());
    const c = g.open();
    const devices = Array.from({ length: WS_SUBSCRIBE_LIMIT + 2 }, (_, i) => i + 1);
    await c.say({ type: 'subscribe', devices });
    const r = c.ws.sent.find((m) => m.type === 'subscribed') as {
      devices: number[];
      rejected: { deviceId: number; reason: string }[];
    };
    expect(r.devices).toHaveLength(WS_SUBSCRIBE_LIMIT);
    expect(r.rejected).toEqual([
      { deviceId: WS_SUBSCRIBE_LIMIT + 1, reason: 'limit' },
      { deviceId: WS_SUBSCRIBE_LIMIT + 2, reason: 'limit' },
    ]);
    expect(c.ws.closed).toBeNull();
    g.gw.onModuleDestroy();
  });
});
