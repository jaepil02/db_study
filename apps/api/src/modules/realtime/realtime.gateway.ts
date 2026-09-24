// F-07 실시간 푸시 — /ws/realtime 프로토콜 정본 docs/07_api/11_websocket.md · 기전 06_pipeline/05 §F-07 실시간 푸시 한 사이클
// S2 범위: ① 핸드셰이크 Host 대조(업그레이드 전 400) · Origin 검증(업그레이드 뒤 4403) ③ subscribe · unsubscribe ④ ch:rt 수신
// ⑤ 스로틀 병합(창 100 ms · 같은 태그는 ts 최대값 하나) ⑥ JSON ping 30초 · pong 3회 미수신 4408. 인증(②) · 알람 · 무효화 중계는 S4 · S7.
// Nest 어댑터의 {event, data} 메시지 모양을 쓰지 않는다 — 계약은 type 봉투다(메시지를 연결 단위로 직접 받는다).
import type { IncomingMessage } from 'node:http';
import { WS_CLOSE, WsClientMessage, type WsServerMessageBody } from '@db-study/shared';
import type { OnModuleDestroy } from '@nestjs/common';
import { type OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type Redis from 'ioredis';
import { Counter, Gauge } from 'prom-client';
import type { WebSocket } from 'ws';
import { isAllowedHost, isAllowedOrigin } from '../../common/http/surface-defense';
import { appRegistry } from '../../common/metrics/registry';
import { RedisConnections } from '../../common/redis/connections';
import type { LatestTuple } from '../../common/redis/durable-key-client';
import { MasterReadService } from '../master/master-read.service';

/** 스로틀 창 — SW-07 현행 참고 100 ms. S2는 WindowMergeThrottle 고정 구현(FrameThrottlePort · SW-07 스위치는 S4) */
export const THROTTLE_WINDOW_MS = 100;
/** ping 주기 · pong 미수신 한도 — 현행 참고 30초 · 3회(소유 06_pipeline/05 §푸시 조정값) */
export const PING_INTERVAL_MS = 30_000;
export const PONG_MISS_LIMIT = 3;

const reg = [appRegistry];
const connections = new Gauge({ name: 'ws_connections', help: 'WebSocket 동시 연결', registers: reg });
const framesSent = new Counter({
  name: 'ws_frames_sent_total',
  help: '송신 프레임 — 연결당 초당 프레임의 분자',
  labelNames: ['channel'],
  registers: reg,
});
const closes = new Counter({
  name: 'ws_closes_total',
  help: '종료 코드별 절단',
  labelNames: ['close_code'],
  registers: reg,
});

interface Conn {
  ws: WebSocket;
  devices: Set<number>;
  /** 창 안 병합 — 설비 → 태그 → ts 최대 튜플 */
  pending: Map<number, Map<number, LatestTuple>>;
  missedPongs: number;
  /** 메시지 직렬 처리 — subscribe가 존재 확인을 기다리는 사이 온 unsubscribe가 먼저 끝나 구독이 되살아나지 않게 */
  chain: Promise<void>;
}

/** 핸드셰이크 Host 대조 — 업그레이드 전 400(07_api/01 Host 헤더 행) */
function verifyClient(
  info: { req: IncomingMessage },
  cb: (ok: boolean, code?: number, msg?: string) => void,
) {
  if (isAllowedHost(info.req.headers.host)) cb(true);
  else cb(false, 400, 'common.validation_failed header.host');
}

@WebSocketGateway({ path: '/ws/realtime', verifyClient })
export class RealtimeGateway implements OnGatewayConnection, OnModuleDestroy {
  private readonly conns = new Set<Conn>();
  private readonly byDevice = new Map<number, Set<Conn>>();
  private readonly subscriber: Redis;
  private readonly flushTimer: NodeJS.Timeout;
  private readonly pingTimer: NodeJS.Timeout;

  constructor(
    redis: RedisConnections,
    private readonly master: MasterReadService,
  ) {
    this.subscriber = redis.subscriberConnection();
    this.subscriber.on('message', (channel: string, message: string) => this.onChannel(channel, message));
    // 구독 연결이 끊기면 그 인스턴스 전체 푸시가 멈춘다 — 4503으로 알리고 재연결은 클라이언트가 한다(07_api/11 §미확인 등재)
    this.subscriber.on('close', () => {
      for (const c of this.conns) this.close(c, WS_CLOSE.upstream_unavailable, 'upstream_unavailable');
    });
    this.flushTimer = setInterval(() => this.flushFrames(), THROTTLE_WINDOW_MS);
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
  }

  handleConnection(ws: WebSocket, req: IncomingMessage) {
    const conn: Conn = {
      ws,
      devices: new Set(),
      pending: new Map(),
      missedPongs: 0,
      chain: Promise.resolve(),
    };
    // Origin 검증 — 브라우저 WebSocket API는 핸드셰이크 HTTP 상태를 스크립트에 주지 않아 업그레이드 뒤 4403으로 닫는다
    if (!isAllowedOrigin(req.headers.origin)) {
      this.close(conn, WS_CLOSE.forbidden, 'forbidden');
      return;
    }
    // URL 쿼리 구독은 받지 않는다 — 무시하면 원본 표를 따른 클라이언트가 원인을 찾지 못한다(§구독 방식 판정)
    if (new URL(req.url ?? '/', 'ws://x').searchParams.has('devices')) {
      this.close(conn, WS_CLOSE.invalid_message, 'invalid_message');
      return;
    }
    this.conns.add(conn);
    connections.set(this.conns.size);
    ws.on('message', (data) => {
      const raw = data.toString();
      conn.chain = conn.chain.then(() => this.onMessage(conn, raw)).catch(() => undefined);
    });
    ws.on('close', () => this.drop(conn));
  }

  private async onMessage(conn: Conn, raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.close(conn, WS_CLOSE.invalid_message, 'invalid_message');
      return;
    }
    const r = WsClientMessage.safeParse(parsed);
    if (!r.success) {
      this.close(conn, WS_CLOSE.invalid_message, 'invalid_message');
      return;
    }
    const msg = r.data;
    switch (msg.type) {
      case 'subscribe': {
        const accepted: number[] = [];
        const rejected: { deviceId: number; reason: 'not_found' | 'limit' }[] = [];
        for (const d of msg.devices) {
          const exists = await this.master.deviceExists(d).catch(() => true); // PostgreSQL 불가면 거절하지 않는다(값은 Redis가 준다)
          if (!exists) rejected.push({ deviceId: d, reason: 'not_found' });
          else {
            accepted.push(d);
            await this.join(conn, d);
          }
        }
        this.send(conn, { type: 'subscribed', devices: accepted, rejected }, 'control');
        return;
      }
      case 'unsubscribe':
        for (const d of msg.devices) await this.leave(conn, d);
        return;
      case 'pong':
        conn.missedPongs = 0;
        return;
      case 'auth':
        // 인증은 S7 — 그 전에는 받지 않는 메시지다
        this.close(conn, WS_CLOSE.invalid_message, 'invalid_message');
        return;
    }
  }

  private async join(conn: Conn, deviceId: number) {
    // 존재 확인을 기다리는 사이 끊긴 연결은 다시 등록하지 않는다
    if (conn.devices.has(deviceId) || !this.conns.has(conn)) return;
    conn.devices.add(deviceId);
    let set = this.byDevice.get(deviceId);
    if (!set) {
      set = new Set();
      this.byDevice.set(deviceId, set);
      await this.subscriber.subscribe(`ch:rt:${deviceId}`);
    }
    set.add(conn);
  }

  private async leave(conn: Conn, deviceId: number) {
    conn.devices.delete(deviceId);
    conn.pending.delete(deviceId);
    const set = this.byDevice.get(deviceId);
    if (!set) return;
    set.delete(conn);
    if (set.size === 0) {
      // 구독자 0 채널은 해지한다
      this.byDevice.delete(deviceId);
      await this.subscriber.unsubscribe(`ch:rt:${deviceId}`).catch(() => undefined);
    }
  }

  private onChannel(channel: string, message: string) {
    if (!channel.startsWith('ch:rt:')) return;
    const deviceId = Number(channel.slice('ch:rt:'.length));
    const set = this.byDevice.get(deviceId);
    if (!set || set.size === 0) return;
    let tuples: LatestTuple[];
    try {
      tuples = JSON.parse(message) as LatestTuple[];
    } catch {
      return;
    }
    for (const c of set) {
      let tags = c.pending.get(deviceId);
      if (!tags) {
        tags = new Map();
        c.pending.set(deviceId, tags);
      }
      for (const t of tuples) {
        const prev = tags.get(t[0]);
        // 창 안 병합 기준은 도착 순이 아니라 ts 최대값 — 조건부 쓰기와 같은 기준이라 화면이 뒤로 가지 않는다
        if (!prev || t[1] >= prev[1]) tags.set(t[0], t);
      }
    }
  }

  /** 창 끝에 연결마다 rt 프레임 1회 — 한 창에 변화가 없으면 보내지 않는다 */
  private flushFrames() {
    const windowEnd = Date.now();
    for (const c of this.conns) {
      if (c.pending.size === 0) continue;
      const devices = [...c.pending].map(([deviceId, tags]) => ({ deviceId, tags: [...tags.values()] }));
      c.pending.clear();
      this.send(c, { type: 'rt', windowEnd, devices }, 'rt');
    }
  }

  private ping() {
    for (const c of this.conns) {
      if (c.missedPongs >= PONG_MISS_LIMIT) {
        this.close(c, WS_CLOSE.pong_timeout, 'pong_timeout');
        continue;
      }
      c.missedPongs++;
      this.send(c, { type: 'ping', t: Date.now() }, 'control');
    }
  }

  private send(c: Conn, msg: WsServerMessageBody, channel: 'rt' | 'control') {
    if (c.ws.readyState !== c.ws.OPEN) return;
    c.ws.send(JSON.stringify(msg));
    if (channel === 'rt') framesSent.inc({ channel: 'rt' });
  }

  private close(c: Conn, code: number, reason: string) {
    closes.inc({ close_code: String(code) });
    try {
      c.ws.close(code, reason);
    } catch {
      c.ws.terminate();
    }
    this.drop(c);
  }

  private drop(c: Conn) {
    if (!this.conns.delete(c)) return;
    connections.set(this.conns.size);
    for (const d of [...c.devices]) void this.leave(c, d);
  }

  onModuleDestroy() {
    clearInterval(this.flushTimer);
    clearInterval(this.pingTimer);
    for (const c of this.conns) this.close(c, WS_CLOSE.going_away, 'going_away');
  }
}
