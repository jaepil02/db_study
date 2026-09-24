'use client';
// WS 표지 — 연결 · 재연결 중(다음 시도까지 초) · 끊김 3상태 + 수신 프레임/초(08_screen/01 · 03 연결 표지 행)
import { useEffect, useState } from 'react';
import { useConnectionStore } from '../../lib/realtime-socket';
import { cn } from '../../lib/utils';

export function WsIndicator() {
  const { status, nextRetryAt, lastCloseCode, framesPerSec } = useConnectionStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'reconnecting') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [status]);

  let dot = 'bg-slate-300';
  let label = '연결 전';
  if (status === 'open') {
    dot = 'bg-emerald-500';
    label = '연결';
  } else if (status === 'connecting') {
    dot = 'bg-amber-400';
    label = '연결 중';
  } else if (status === 'reconnecting') {
    dot = 'bg-amber-400';
    const sec = nextRetryAt === null ? null : Math.max(0, Math.ceil((nextRetryAt - now) / 1000));
    label = sec === null || sec === 0 ? '재연결 중' : `재연결 중(${sec}초 뒤)`;
  } else if (status === 'closed') {
    dot = 'bg-red-500';
    label = `끊김${lastCloseCode === null ? '' : ` · ${lastCloseCode}`}`;
  }
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600" title="WebSocket /ws/realtime">
      <span className={cn('inline-block h-2 w-2 rounded-full', dot)} />
      <span>WS {label}</span>
      {status === 'open' && <span className="tabular-nums text-slate-400">{framesPerSec} 프레임/초</span>}
    </div>
  );
}
