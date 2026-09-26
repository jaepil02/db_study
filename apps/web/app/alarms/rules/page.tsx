import { Suspense } from 'react';
import { AlarmRules } from '../../../components/alarms/alarm-rules';

// ALM-RULES — 정본 docs/08_screen/05_alarm_console.md §ALM-RULES (규칙 미선택 — 목록 · 규칙 추가)
export default function AlarmRulesPage() {
  return (
    <Suspense>
      <AlarmRules ruleId={null} />
    </Suspense>
  );
}
