// 네이티브 WebSocket 래퍼 — 계약 docs/07_api/11_websocket.md · docs/09_tech_stack/01_frontend.md §실시간 스토어와 WebSocket 래퍼
// 공통 셸이 연결을 하나만 연다(08_screen/01 §요청 경로와 공통 셸). 화면은 subscribe · unsubscribe만 바꾼다.
// 재연결 직후 순서: 연결 → 구독(보유 설비 전부) → syncEpoch 증가 → 화면이 REST 최신값 1회(REQ-RLT-13).
import { create } from 'zustand';
import type { AlarmFrame } from './alarms';
import { WS_PING_INTERVAL_MS, WS_PING_MISS_LIMIT, wsUrl } from './config';
import { useRealtimeStore } from './realtime-store';
import type { FlowFrameBody } from './shared';
import { WsServerMessage } from './shared';
import { backoffMs, shouldReconnect } from './ws-policy';

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
/** 흐름 구독(EXP-FLOW) — off · 요청 중(subscribe_flow 보냄 · 확인 프레임 대기) · 구독 중(첫 flow 프레임 수신) */
export type FlowSubState = 'off' | 'requesting' | 'subscribed';

export interface ConnectionState {
  status: ConnStatus;
  /** 다음 재연결 시도 시각(브라우저 epoch ms) */
  nextRetryAt: number | null;
  lastCloseCode: number | null;
  /** 수신 프레임/초 — 화면 쪽 관찰 보조(기록에 올리지 않는다 — 08_screen/03 §스위치 영향) */
  framesPerSec: number;
  /** 연결 · 구독 완료 횟수 — 바뀔 때마다 화면이 REST 동기화 1회 */
  syncEpoch: number;
  /** 보고 있는 설비의 태그 메타 신호(cache:tagmeta) 수 — 바뀔 때마다 대시보드가 최신값(메타 포함) 1회 재조회 */
  metaEpoch: number;
  /** 흐름 구독 상태 — 서버는 흐름 구독을 기억하지 않아 재연결마다 다시 요청 중이 된다(07_api/11 §flow 프레임 재연결) */
  flow: FlowSubState;
}

export const useConnectionStore = create<ConnectionState>()(() => ({
  status: 'idle',
  nextRetryAt: null,
  lastCloseCode: null,
  framesPerSec: 0,
  syncEpoch: 0,
  metaEpoch: 0,
  flow: 'off',
}));

/** 셸이 듣는 사건 — cacheinv 신호(받은 키 그대로) · alarm 통지(열림 · 닫힘) · 재연결(첫 연결이 아닌 open) */
export type SocketEvent =
  | { type: 'cacheinv'; keys: string[] }
  | { type: 'alarm'; frame: AlarmFrame }
  | { type: 'reconnected' };

/** 클라이언트가 스스로 닫는 코드 — ping 미수신(애플리케이션 대역 · 서버 계약 코드와 겹치지 않는다) */
const CLIENT_PING_TIMEOUT = 4000;

class RealtimeSocket {
  private ws: WebSocket | null = null;
  private readonly desired = new Set<number>();
  private attempt = 0;
  private started = false;
  private pingWatch: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private fpsTimer: ReturnType<typeof setInterval> | null = null;
  private frames = 0;
  private opened = false;
  private readonly listeners = new Set<(e: SocketEvent) => void>();
  /** 흐름 구독 희망 — 연결마다 subscribe_flow를 다시 보낸다 */
  private flowWanted = false;
  /** flow 프레임은 셸 사건과 따로 듣는다 — 흐름 구독 화면만 받는다 */
  private readonly flowListeners = new Set<(frame: FlowFrameBody, receivedAt: number) => void>();

  /** 사건 구독 — 해지 함수를 돌려준다 */
  on(fn: (e: SocketEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: SocketEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.fpsTimer = setInterval(() => {
      useConnectionStore.setState({ framesPerSec: this.frames });
      this.frames = 0;
    }, 1000);
    this.connect();
  }

  stop(): void {
    this.started = false;
    if (this.fpsTimer) clearInterval(this.fpsTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.clearPingWatch();
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000);
    useConnectionStore.setState({ status: 'idle', nextRetryAt: null });
  }

  subscribe(deviceId: number): void {
    this.desired.add(deviceId);
    this.send({ type: 'subscribe', devices: [deviceId] });
  }

  unsubscribe(deviceId: number): void {
    this.desired.delete(deviceId);
    this.send({ type: 'unsubscribe', devices: [deviceId] });
  }

  /** flow 프레임 구독 — 해지 함수를 돌려준다 */
  onFlow(fn: (frame: FlowFrameBody, receivedAt: number) => void): () => void {
    this.flowListeners.add(fn);
    return () => this.flowListeners.delete(fn);
  }

  /** EXP-FLOW 진입 — subscribe_flow(필드 없음 · 필드가 있으면 서버가 4400) */
  subscribeFlow(): void {
    if (this.flowWanted) return;
    this.flowWanted = true;
    useConnectionStore.setState({ flow: 'requesting' });
    this.send({ type: 'subscribe_flow' });
  }

  /** EXP-FLOW 이탈 — unsubscribe_flow */
  unsubscribeFlow(): void {
    if (!this.flowWanted) return;
    this.flowWanted = false;
    useConnectionStore.setState({ flow: 'off' });
    this.send({ type: 'unsubscribe_flow' });
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private connect(): void {
    useConnectionStore.setState({
      status: this.attempt === 0 ? 'connecting' : 'reconnecting',
      nextRetryAt: null,
    });
    const ws = new WebSocket(wsUrl());
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.attempt = 0;
      this.armPingWatch();
      // 구독을 먼저 — 동기화(REST)를 먼저 하면 그 사이의 변화가 두 경로 어디에도 없다
      if (this.desired.size > 0) this.send({ type: 'subscribe', devices: [...this.desired] });
      // 흐름 구독 재전송 — 서버는 흐름 구독을 기억하지 않는다 · 끊긴 동안의 요약은 오지 않는다(07_api/11 §flow 프레임)
      if (this.flowWanted) {
        this.send({ type: 'subscribe_flow' });
        useConnectionStore.setState({ flow: 'requesting' });
      }
      useConnectionStore.setState((s) => ({
        status: 'open',
        lastCloseCode: null,
        syncEpoch: s.syncEpoch + 1,
      }));
      if (this.opened) this.emit({ type: 'reconnected' });
      this.opened = true;
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws || typeof ev.data !== 'string') return;
      let raw: unknown;
      try {
        raw = JSON.parse(ev.data);
      } catch {
        return;
      }
      const parsed = WsServerMessage.safeParse(raw);
      if (!parsed.success) return; // 모르는 모양은 버린다 — 계약은 packages/shared 스키마 하나다
      const msg = parsed.data;
      if (msg.type === 'ping') {
        this.send({ type: 'pong', t: msg.t });
        this.armPingWatch();
      } else if (msg.type === 'rt') {
        this.frames += 1;
        useRealtimeStore.getState().applyFrame(msg);
      } else if (msg.type === 'cacheinv') {
        // 무효화 신호 — 스로틀 · 병합 없이 받은 대로 셸에 넘긴다(08_screen/01 §무효화 신호 수신)
        this.emit({ type: 'cacheinv', keys: msg.keys });
      } else if (msg.type === 'alarm') {
        // 알람 열림 · 닫힘 통지 — 구독과 무관하게 전 연결에 온다 · 병합 없이 받은 대로 셸에 넘긴다(07_api/11 · RLT-08)
        const { type: _t, ...frame } = msg;
        this.emit({ type: 'alarm', frame });
      } else if (msg.type === 'flow') {
        // 흐름 이벤트 — 해지 뒤 늦게 온 프레임은 버린다 · 첫 프레임(구독 확인 빈 프레임)이 구독 성립이다 · 수신 프레임/초에 세지 않는다
        if (!this.flowWanted) return;
        if (useConnectionStore.getState().flow !== 'subscribed')
          useConnectionStore.setState({ flow: 'subscribed' });
        const receivedAt = Date.now();
        for (const fn of this.flowListeners) fn(msg, receivedAt);
      }
      // subscribed · auth_ok — 화면이 쓰지 않는다
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearPingWatch();
      if (this.flowWanted) useConnectionStore.setState({ flow: 'requesting' });
      const reconnect = ev.code === CLIENT_PING_TIMEOUT || shouldReconnect(ev.code);
      if (!this.started || !reconnect) {
        useConnectionStore.setState({ status: 'closed', lastCloseCode: ev.code, nextRetryAt: null });
        return;
      }
      const delay = backoffMs(this.attempt);
      this.attempt += 1;
      useConnectionStore.setState({
        status: 'reconnecting',
        lastCloseCode: ev.code,
        nextRetryAt: Date.now() + delay,
      });
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  /** 서버 JSON ping이 주기 × 한도 동안 없으면 반쪽 연결로 보고 닫는다 — 닫힘 처리가 재연결을 건다 */
  private armPingWatch(): void {
    this.clearPingWatch();
    this.pingWatch = setTimeout(() => {
      this.ws?.close(CLIENT_PING_TIMEOUT, 'ping_timeout');
    }, WS_PING_INTERVAL_MS * WS_PING_MISS_LIMIT);
  }

  private clearPingWatch(): void {
    if (this.pingWatch) clearTimeout(this.pingWatch);
    this.pingWatch = null;
  }
}

export const realtimeSocket = new RealtimeSocket();
