import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AlarmRules } from '../../../../components/alarms/alarm-rules';
import { EntityIdParam } from '../../../../lib/shared';

// ALM-RULES 규칙 선택 — 편집 · 판정 분석 패널 · 정본 docs/08_screen/05_alarm_console.md §ALM-RULES
export default async function AlarmRulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const parsed = EntityIdParam.safeParse((await params).ruleId);
  if (!parsed.success) notFound();
  return (
    <Suspense>
      <AlarmRules key={parsed.data} ruleId={parsed.data} />
    </Suspense>
  );
}
