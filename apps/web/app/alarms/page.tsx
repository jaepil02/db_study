import { Suspense } from 'react';
import { AlarmConsole } from '../../components/alarms/alarm-console';

// ALM-CONSOLE — 정본 docs/08_screen/05_alarm_console.md (탭 · 범위 · 심각도는 쿼리 문자열 — useSearchParams는 Suspense 경계 안)
export default function AlarmsPage() {
  return (
    <Suspense>
      <AlarmConsole />
    </Suspense>
  );
}
