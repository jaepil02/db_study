'use client';
// 실시간 연결 표지 — 셸이 /monitoring에서만 그린다(08_screen/01 §요청 경로와 공통 셸 WS 표지 행).
// 연결 · 흐름 구독 상태를 쉬운 말 한 점 · 한 문구로 보인다(설계 .omc/plans/web-junior-redesign.md §4 — "● 실시간 연결됨 · 마지막 데이터 0.4초 전").
// 화면은 statusSlot에 덧붙일 문구(마지막 데이터 나이)를 넣는다. 종료 코드 · 프로토콜 이름은 툴팁(tip)에만 둔다.
import { type Ref, useEffect, useState } from 'react';
import { type ConnStatus, type FlowSubState, useConnectionStore } from '../../lib/realtime-socket';
import { cn } from '../../lib/utils';

export interface WsLabel {
  dot: string;
  label: string;
  /** 마우스 올림 — 종료 코드 등 세부 */
  tip: string;
}

const BASE_TIP = '브라우저 ↔ 서버 실시간 연결(WebSocket /ws/realtime) 하나로 흐름 데이터를 받는다';

/** 표지 한 줄 — 연결이 열려 있으면 흐름 구독 상태 · 아니면 연결 상태(다시 연결까지 초 · 끊긴 사유) */
export function wsLabel(
  status: ConnStatus,
  flow: FlowSubState,
  nextRetryAt: number | null,
  lastCloseCode: number | null,
  now: number,
): WsLabel {
  switch (status) {
    case 'open':
      if (flow === 'requesting') return { dot: 'bg-amber-400', label: '실시간 연결 확인 중', tip: BASE_TIP };
      return { dot: 'bg-emerald-500', label: '실시간 연결됨', tip: BASE_TIP };
    case 'reconnecting': {
      const sec = nextRetryAt === null ? null : Math.max(0, Math.ceil((nextRetryAt - now) / 1000));
      return {
        dot: 'bg-amber-400',
        label:
          sec === null || sec === 0
            ? '연결이 끊겨 다시 연결하는 중'
            : `연결이 끊겨 ${sec}초 뒤 다시 연결해요`,
        tip: `${BASE_TIP}${lastCloseCode === null ? '' : ` · 종료 코드 ${lastCloseCode}`}`,
      };
    }
    case 'closed':
      return {
        dot: 'bg-red-500',
        label: closedLabel(lastCloseCode),
        tip: `${BASE_TIP}${lastCloseCode === null ? '' : ` · 종료 코드 ${lastCloseCode}`}`,
      };
    default:
      // idle · connecting — 셸이 아직 연결을 열기 전(첫 렌더)이거나 여는 중 · 끊김이 아니라 연결 중으로 보인다
      return { dot: 'bg-amber-400', label: '실시간 연결하는 중', tip: BASE_TIP };
  }
}

/** 다시 연결하지 않는 종료 코드의 사유(쉬운 말) — 08_screen/01 §에러 코드별 사용자 표시 WebSocket 종료 코드 행 ② · 07_api/11 §종료 코드 */
const CLOSE_REASON: Record<number, string> = {
  4403: '허용되지 않은 주소에서 접속했어요',
  4400: '서버가 받을 수 없는 메시지였어요',
  4401: '로그인이 필요해요',
};

/** 끊김 문구 — "연결이 끊겼어요 — 허용되지 않은 주소에서 접속했어요" · 사유를 모르면 "연결이 끊겼어요" */
export function closedLabel(code: number | null): string {
  const reason = code === null ? undefined : CLOSE_REASON[code];
  return reason ? `연결이 끊겼어요 — ${reason}` : '연결이 끊겼어요';
}

export function WsIndicator({ statusSlot }: { statusSlot?: Ref<HTMLSpanElement> }) {
  const { status, flow, nextRetryAt, lastCloseCode } = useConnectionStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'reconnecting') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [status]);
  const { dot, label, tip } = wsLabel(status, flow, nextRetryAt, lastCloseCode, now);
  return (
    <div
      data-testid="ws-indicator"
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
      title={tip}
    >
      <span aria-hidden="true" className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', dot)} />
      <span className="font-medium text-slate-800">{label}</span>
      <span ref={statusSlot} className="empty:hidden" />
    </div>
  );
}
