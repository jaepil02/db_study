// /ws/realtime 메시지 · 종료 코드 — 정본 docs/07_api/11_websocket.md §메시지 봉투와 스키마 · §종료 코드
// type 10 = 클라이언트 5 + 서버 5(D-16 — 인증 · 알람 메시지 삭제). 모든 메시지는 JSON 텍스트 프레임 · type 하나로 종류를 가른다. 측정 시각은 epoch ms.
import { z } from 'zod';
import { FlowFrame } from './flow';

const deviceList = z.array(z.number().int().min(1).max(4_294_967_295)).min(1);

export const WsClientMessage = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('subscribe'), devices: deviceList }),
  z.strictObject({ type: z.literal('unsubscribe'), devices: deviceList }),
  z.strictObject({ type: z.literal('pong'), t: z.number().int() }),
  // 흐름 이벤트 구독(EXP-FLOW) — 필드가 오면 strict라 4400
  z.strictObject({ type: z.literal('subscribe_flow') }),
  z.strictObject({ type: z.literal('unsubscribe_flow') }),
]);
export type WsClientMessageBody = z.infer<typeof WsClientMessage>;

/** rt 프레임의 태그 값 — [tagId, ts, value, quality] */
export const RtTagTuple = z.tuple([z.number().int(), z.number().int(), z.number(), z.number().int()]);

export const WsServerMessage = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('subscribed'),
    devices: z.array(z.number().int()),
    rejected: z.array(z.strictObject({ deviceId: z.number().int(), reason: z.enum(['not_found', 'limit']) })),
  }),
  z.strictObject({
    type: z.literal('rt'),
    windowEnd: z.number().int(),
    devices: z.array(z.strictObject({ deviceId: z.number().int(), tags: z.array(RtTagTuple) })),
  }),
  z.strictObject({ type: z.literal('cacheinv'), keys: z.array(z.string()) }),
  z.strictObject({ type: z.literal('ping'), t: z.number().int() }),
  FlowFrame, // 정의는 ./flow
]);
export type WsServerMessageBody = z.infer<typeof WsServerMessage>;

/** 종료 코드 7 — 4000번대는 뒤 세 자리를 HTTP 상태 뜻에 맞춘다(4401 인증 실패는 D-16에서 삭제) */
export const WS_CLOSE = {
  normal: 1000,
  going_away: 1001,
  invalid_message: 4400,
  forbidden: 4403,
  pong_timeout: 4408,
  slow_consumer: 4413,
  upstream_unavailable: 4503,
} as const;
export type WsCloseReason = keyof typeof WS_CLOSE;

/** 재연결 여부 — 함 4 · 안 함 3 */
export const WS_RECONNECT: Record<WsCloseReason, 'yes' | 'no'> = {
  normal: 'no',
  going_away: 'yes',
  invalid_message: 'no',
  forbidden: 'no',
  pong_timeout: 'yes',
  slow_consumer: 'yes',
  upstream_unavailable: 'yes',
};
