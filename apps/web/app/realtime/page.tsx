import { redirect } from 'next/navigation';

// S2 — 설비 선택기가 없어(이후 단계) 수직 슬라이스 설비 1로 보낸다
export default function RealtimeIndex() {
  redirect('/realtime/1');
}
