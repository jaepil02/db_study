'use client';
// 기록 조건 블록 — 커밋 · 프로파일 · 티어 · 스위치를 health에서 채워 복사한다 · 게이트 칸만 수기
import { useState } from 'react';
import type { HealthBody } from '../../lib/shared';
import { recordConditionBlock } from '../../lib/switches';

export function RecordBlock({ health }: { health: HealthBody }) {
  const text = recordConditionBlock(health);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{text}</pre>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        >
          복사
        </button>
        {copied === 'ok' && <span className="text-xs text-emerald-600">복사했다</span>}
        {copied === 'fail' && <span className="text-xs text-red-600">복사 실패 — 직접 선택해 복사한다</span>}
      </div>
    </div>
  );
}
