// F-07 실시간 푸시 — /ws/realtime 프로토콜 정본 docs/07_api/11_websocket.md · 기전 06_pipeline/05 §F-07 실시간 푸시 한 사이클
// ① 핸드셰이크 Host 대조(업그레이드 전 400) · Origin 검증(업그레이드 뒤 4403) ③ subscribe · unsubscribe(연결당 설비 상한 · rejected limit)
// ④ ch:rt 수신(SW-06 on) 또는 프로세스 안 버스(SW-06 off) · ch:cacheinv 즉시 중계(RLT-09 · 병합 없음 · 전 연결)
// ⑤ 스로틀(SW-07 FrameThrottlePort) ⑥ JSON ping 30초 · pong 3회 미수신 4408 · 송신 대기량 한도 초과 4413. 인증(②)은 S7 ②.
// alarm(S7 ① · RLT-08) — ch:alarm(SW-06 on) 또는 프로세스 안 버스 'alarm'(SW-06 off)을 병합 없이 즉시 전 연결에 중계한다(구독과 무관).
// flow(EXP-FLOW · 07_api/11 §흐름 이벤트) — subscribe_flow 연결에만 ch:flow 요약을 연결마다 250 ms 창으로 병합해 보낸다(배치 8 · 업무 20 ·
// 넘친 수 dropped · totals는 (source · role)마다 창 안 마지막 값). 인스턴스의 첫 흐름 구독자에서 SUBSCRIBE ch:flow · 표지 갱신 시작,
// 마지막 해지 · 종료에서 UNSUBSCRIBE · 갱신 중단(표지는 TTL로 만료 — 지우지 않는다). 송신 대기량 한도는 rt와 같은 send()를 쓴다.
// Nest 어댑터의 {event, data} 메시지 모양을 쓰지 않는다 — 계약은 type 봉투다(메시지를 연결 단위로 직접 받는다).
import type { IncomingMessage } from 'node:http';
import {
  FLOW_CHANNEL,
  FLOW_MARKER_REFRESH_MS,
  FLOW_MARKER_TTL_S,
  FLOW_MAX_BATCHES,
  FLOW_MAX_BIZ,
  FLOW_WINDOW_MS,
  type FlowBatchSummaryBody,
  type FlowBizSummaryBody,
  FlowChannelMessage,
  type FlowFrameBody,
  type FlowTotalsEntryBody,
  WS_CLOSE,
  WsClientMessage,
  type WsServerMessageBody,
} from '@db-study/shared';
import { Inject, type OnModuleDestroy, Optional } from '@nestjs/common';
import { type OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import type Redis from 'ioredis';
import { Counter, Gauge, Histogram } from 'prom-client';
import type { WebSocket } from 'ws';
import { flowSource } from '../../common/flow/flow-publisher';
import { isAllowedHost, isAllowedOrigin } from '../../common/http/surface-defense';
import { appRegistry } from '../../common/metrics/registry';
import { type AlarmFrame, directBus, takeStamp } from '../../common/ports/realtime-fanout.port';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { RedisConnections } from '../../common/redis/connections';
import type { LatestTuple } from '../../common/redis/durable-key-client';
import { MasterReadService } from '../master/master-read.service';
import {
  FRAME_THROTTLE_PORT,
  type FrameThrottlePort,
  type Pending,
  type RtDevices,
} from './frame-throttle.port';

/**
 * 소켓 송신 대기량 한도 · 연결당 구독 설비 상한 — 07_api/11의 2계층 미정 값에 대한 S4 현행 참고(판정 5):
 * 1 MiB — 느린 브라우저 한 개만 4413으로 끊는다(Redis 출력 버퍼 한도 32 MB보다 먼저 걸린다) · 100 — 티어 M 50 · L 100을 담는다
 */
export const WS_SEND_BUFFER_LIMIT_BYTES = 1024 * 1024;
export const WS_SUBSCRIBE_LIMIT = 100;
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
const merged = new Counter({
  name: 'rlt_throttle_merged_total',
  help: '스로틀 창이 병합해 버린 갱신',
  registers: reg,
});
const delivery = new Histogram({
  name: 'rlt_fanout_delivery_seconds',
  help: '발행 → 게이트웨이 도착(스로틀 창 대기 제외)',
  labelNames: ['channel'],
  buckets: [0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
  registers: reg,
});
const subscriberDisconnects = new Counter({
  name: 'rlt_subscriber_disconnects_total',
  help: 'api 구독 연결이 끊김(4503)',
  registers: reg,
});

/** 연결 하나의 흐름 창 — 창 안 최신 배치 · 업무 요약 · 넘친 수 · (source · role)별 마지막 누적 */
export interface FlowWindow {
  batches: FlowBatchSummaryBody[];
  biz: FlowBizSummaryBody[];
  dropped: { batches: number; biz: number };
  totals: Map<string, FlowTotalsEntryBody>;
}

export function emptyFlowWindow(): FlowWindow {
  return { batches: [], biz: [], dropped: { batches: 0, biz: 0 }, totals: new Map() };
}

/** 요약 1건을 창에 넣는다 — 상한을 넘으면 가장 오래된 것을 버리고 dropped를 센다 · totals는 마지막 값으로 덮는다 */
export function offerFlow(w: FlowWindow, msg: ReturnType<typeof FlowChannelMessage.parse>): void {
  const { startedAt, totals, ...summary } = msg;
  if (summary.event === 'batch') {
    w.batches.push(summary as FlowBatchSummaryBody);
    if (w.batches.length > FLOW_MAX_BATCHES) {
      w.batches.shift();
      w.dropped.batches++;
    }
  } else {
    w.biz.push(summary as FlowBizSummaryBody);
    if (w.biz.length > FLOW_MAX_BIZ) {
      w.biz.shift();
      w.dropped.biz++;
    }
  }
  w.totals.set(`${msg.source}\u0000${msg.role}`, {
    source: msg.source,
    role: msg.role,
    startedAt,
    ...totals,
  } as FlowTotalsEntryBody);
}

/** 창 끝 — 요약이 없으면 null(보내지 않는다) · 배치는 seq 오름차순 · 창을 비운다 */
export function drainFlow(w: FlowWindow, windowEnd: number): FlowFrameBody | null {
  if (w.batches.length === 0 && w.biz.length === 0) return null;
  const frame: FlowFrameBody = {
    type: 'flow',
    windowEnd,
    batches: [...w.batches].sort((a, b) => a.seq - b.seq),
    biz: w.biz,
    dropped: w.dropped,
    totals: [...w.totals.values()],
  };
  Object.assign(w, emptyFlowWindow());
  return frame;
}

interface Conn {
  ws: WebSocket;
  devices: Set<number>;
  /** 창 안 병합 — 설비 → 태그 → ts 최대 튜플(스로틀 포트가 다룬다) */
  pending: Pending;
  missedPongs: number;
  /** 흐름 구독 중이면 창(null이면 구독 안 함) */
  flow: FlowWindow | null;
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
  private readonly flushTimer: NodeJS.Timeout | null;
  private readonly pingTimer: NodeJS.Timeout;
  private readonly onDirect = (deviceId: number, tuples: LatestTuple[]) =>
    this.deliver(deviceId, tuples, 'direct');
  private readonly onDirectAlarm = (frame: AlarmFrame) => this.broadcastAlarm(frame);
  /** 흐름 구독 연결 — 0 → 1에서 채널 구독 · 표지 갱신 · 창 타이머를 열고 1 → 0에서 닫는다 */
  private readonly flowConns = new Set<Conn>();
  private flowTimer: NodeJS.Timeout | null = null;
  private markerTimer: NodeJS.Timeout | null = null;
  private readonly markerOwner = flowSource('gateway');

  constructor(
    redis: RedisConnections,
    private readonly master: MasterReadService,
    @Inject(FRAME_THROTTLE_PORT) private readonly throttle: FrameThrottlePort,
    @Optional() @Inject(CacheKeyClient) private readonly cache: CacheKeyClient | null = null,
  ) {
    this.subscriber = redis.subscriberConnection();
    this.subscriber.on('message', (channel: string, message: string) => this.onChannel(channel, message));
    // 구독 연결이 끊기면 그 인스턴스 전체 푸시가 멈춘다 — 4503으로 알리고 재연결은 클라이언트가 한다(07_api/11 §미확인 등재)
    this.subscriber.on('close', () => {
      if (this.conns.size > 0) subscriberDisconnects.inc();
      for (const c of this.conns) this.close(c, WS_CLOSE.upstream_unavailable, 'upstream_unavailable');
    });
    // 무효화 신호는 구독과 무관하게 연결 전원에게 간다(RLT-09) — SW-06 대상이 아니라 끄지 않는다
    this.subscriber.subscribe('ch:cacheinv').catch(() => undefined);
    // 알람도 구독과 무관하게 연결 전원에게 간다(RLT-08 브로드캐스트) — 발행 구현(SW-06)이 무엇이든 두 입구를 다 연다(발행자는 하나다)
    this.subscriber.subscribe('ch:alarm').catch(() => undefined);
    directBus.on('rt', this.onDirect);
    directBus.on('alarm', this.onDirectAlarm);
    this.flushTimer = throttle.windowMs > 0 ? setInterval(() => this.flushFrames(), throttle.windowMs) : null;
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
  }

  handleConnection(ws: WebSocket, req: IncomingMessage) {
    const conn: Conn = {
      ws,
      devices: new Set(),
      pending: new Map(),
      missedPongs: 0,
      flow: null,
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
    // 구독 연결이 끊긴 동안 온 연결 — subscribe가 Redis 복구까지 멈춰 응답 없는 연결이 된다 · 즉시 4503(검수 L5)
    if (this.subscriber.status !== 'ready') {
      this.close(conn, WS_CLOSE.upstream_unavailable, 'upstream_unavailable');
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
          if (!conn.devices.has(d) && conn.devices.size >= WS_SUBSCRIBE_LIMIT) {
            rejected.push({ deviceId: d, reason: 'limit' }); // 연결을 끊지 않는다
            continue;
          }
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
      case 'subscribe_flow':
        await this.joinFlow(conn);
        // 구독 확인 — 즉시 빈 flow 프레임 1회(배치가 드문 시간에도 구독 성립과 발행 없음을 가른다)
        this.send(
          conn,
          {
            type: 'flow',
            windowEnd: Date.now(),
            batches: [],
            biz: [],
            dropped: { batches: 0, biz: 0 },
            totals: [],
          },
          'flow',
        );
        return;
      case 'unsubscribe_flow':
        await this.leaveFlow(conn);
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

  private async joinFlow(conn: Conn) {
    if (conn.flow || !this.conns.has(conn)) return;
    conn.flow = emptyFlowWindow();
    this.flowConns.add(conn);
    if (this.flowConns.size !== 1) return;
    this.flowTimer = setInterval(() => this.flushFlow(), FLOW_WINDOW_MS);
    this.refreshMarker();
    this.markerTimer = setInterval(() => this.refreshMarker(), FLOW_MARKER_REFRESH_MS);
    await this.subscriber.subscribe(FLOW_CHANNEL).catch(() => undefined);
  }

  private async leaveFlow(conn: Conn) {
    conn.flow = null;
    if (!this.flowConns.delete(conn) || this.flowConns.size > 0) return;
    this.stopFlow();
    await this.subscriber.unsubscribe(FLOW_CHANNEL).catch(() => undefined);
  }

  /** 창 타이머 · 표지 갱신을 멈춘다 — 표지는 지우지 않고 TTL로 만료시킨다(다른 인스턴스의 구독자가 있을 수 있다) */
  private stopFlow() {
    if (this.flowTimer) clearInterval(this.flowTimer);
    if (this.markerTimer) clearInterval(this.markerTimer);
    this.flowTimer = null;
    this.markerTimer = null;
  }

  /** 표지 갱신 — 실패는 삼킨다(TTL 안에 다음 갱신이 다시 쓴다 · 끝내 없으면 발행자가 발행하지 않는다) */
  private refreshMarker() {
    void this.cache?.setFlowSubscribed(this.markerOwner, FLOW_MARKER_TTL_S).catch(() => false);
  }

  private onFlow(message: string) {
    if (this.flowConns.size === 0) return;
    let msg: ReturnType<typeof FlowChannelMessage.parse>;
    try {
      const r = FlowChannelMessage.safeParse(JSON.parse(message));
      if (!r.success) return;
      msg = r.data;
    } catch {
      return;
    }
    for (const c of this.flowConns) if (c.flow) offerFlow(c.flow, msg);
  }

  /** 창 끝(250 ms) — 연결마다 flow 프레임 1회 · 요약이 없는 창은 보내지 않는다 */
  private flushFlow() {
    const now = Date.now();
    for (const c of this.flowConns) {
      const frame = c.flow ? drainFlow(c.flow, now) : null;
      if (frame) this.send(c, frame, 'flow');
    }
  }

  private onChannel(channel: string, message: string) {
    if (channel === FLOW_CHANNEL) {
      this.onFlow(message);
      return;
    }
    if (channel === 'ch:cacheinv') {
      let keys: string[];
      try {
        keys = JSON.parse(message) as string[];
      } catch {
        return;
      }
      for (const c of this.conns) this.send(c, { type: 'cacheinv', keys }, 'cacheinv');
      return;
    }
    if (channel === 'ch:alarm') {
      let frame: AlarmFrame;
      try {
        frame = JSON.parse(message) as AlarmFrame;
      } catch {
        return;
      }
      if (frame?.type === 'alarm') this.broadcastAlarm(frame);
      return;
    }
    if (!channel.startsWith('ch:rt:')) return;
    let tuples: LatestTuple[];
    try {
      tuples = JSON.parse(message) as LatestTuple[];
    } catch {
      return;
    }
    this.deliver(Number(channel.slice('ch:rt:'.length)), tuples, 'pubsub');
  }

  /** 도착(두 팬아웃 구현이 같은 자리로 온다) — 발행 → 도착 지연을 재고 스로틀 포트에 넘긴다 */
  private deliver(deviceId: number, tuples: LatestTuple[], via: 'pubsub' | 'direct') {
    const lag = takeStamp(deviceId, tuples);
    if (lag !== null) delivery.observe({ channel: via }, lag);
    const set = this.byDevice.get(deviceId);
    if (!set || set.size === 0) return;
    for (const c of set) {
      const r = this.throttle.offer(c.pending, deviceId, tuples);
      if (r.merged) merged.inc(r.merged);
      if (r.frame) this.sendRt(c, r.frame);
    }
  }

  /** alarm — 병합 없이 즉시 · 전 연결(07_api/11 §스로틀 병합 — 병합 대상은 ch:rt만) */
  private broadcastAlarm(frame: AlarmFrame) {
    for (const c of this.conns) this.send(c, frame, 'alarm');
  }

  /** 창 끝에 연결마다 rt 프레임 1회 — 한 창에 변화가 없으면 보내지 않는다 */
  private flushFrames() {
    for (const c of this.conns) {
      const devices = this.throttle.drain(c.pending);
      if (devices) this.sendRt(c, devices);
    }
  }

  private sendRt(c: Conn, devices: RtDevices) {
    this.send(c, { type: 'rt', windowEnd: Date.now(), devices }, 'rt');
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

  private send(c: Conn, msg: WsServerMessageBody, channel: 'rt' | 'control' | 'cacheinv' | 'alarm' | 'flow') {
    if (c.ws.readyState !== c.ws.OPEN) return;
    // 느린 브라우저 — 송신 대기량이 한도를 넘으면 그 소켓만 4413(Redis 출력 버퍼 절단 4503과 다른 사건)
    if (c.ws.bufferedAmount > WS_SEND_BUFFER_LIMIT_BYTES) {
      this.close(c, WS_CLOSE.slow_consumer, 'slow_consumer');
      return;
    }
    c.ws.send(JSON.stringify(msg));
    if (channel !== 'control') framesSent.inc({ channel });
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
    if (c.flow) void this.leaveFlow(c);
  }

  onModuleDestroy() {
    directBus.off('rt', this.onDirect);
    directBus.off('alarm', this.onDirectAlarm);
    if (this.flushTimer) clearInterval(this.flushTimer);
    clearInterval(this.pingTimer);
    this.stopFlow();
    for (const c of this.conns) this.close(c, WS_CLOSE.going_away, 'going_away');
  }
}
