// 네이티브 WebSocket 래퍼 — 계약 docs/07_api/11_websocket.md · docs/09_tech_stack/01_frontend.md §실시간 스토어와 WebSocket 래퍼
// 공통 셸이 연결을 하나만 연다(08_screen/01 §요청 경로와 공통 셸). 화면은 subscribe · unsubscribe만 바꾼다.
// 재연결 직후 순서: 연결 → 구독(보유 설비 전부) → syncEpoch 증가 → 화면이 REST 최신값 1회(REQ-RLT-13).
import { create } from 'zustand';
import type { AlarmFrame } from './alarms';
import { WS_PING_INTERVAL_MS, WS_PING_MISS_LIMIT, wsUrl } from './config';
import { useRealtimeStore } from './realtime-store';
import { WsServerMessage } from './shared';
import { backoffMs, shouldReconnect } from './ws-policy';

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

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
}

export const useConnectionStore = create<ConnectionState>()(() => ({
  status: 'idle',
  nextRetryAt: null,
  lastCloseCode: null,
  framesPerSec: 0,
  syncEpoch: 0,
  metaEpoch: 0,
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
      }
      // subscribed · auth_ok — 화면이 쓰지 않는다
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearPingWatch();
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
