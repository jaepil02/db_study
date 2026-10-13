'use client';
// 화면 판정용 시계 — STALE은 푸시가 알려 주지 않으므로(07_api/11 §STALE과 푸시) 주기적으로 다시 판정한다
import { useEffect, useState } from 'react';

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
