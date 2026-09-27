'use client';
// /realtime — 마지막으로 본 설비(브라우저 저장)로 보내고, 없으면 설비 선택기를 연다(08_screen/03 §진입)
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { readLastDevice } from '../../lib/realtime-nav';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { DevicePicker } from './device-picker';

export function RealtimeIndex() {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    const last = readLastDevice();
    if (last !== null) router.replace(`/realtime/${last}`);
    else setPicking(true);
  }, [router]);
  if (!picking) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>실시간 — 설비를 고른다</CardTitle>
      </CardHeader>
      <CardContent>
        <DevicePicker deviceId={null} />
      </CardContent>
    </Card>
  );
}
