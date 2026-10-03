'use client';
// ② 업무 데이터 열(파랑) — 결론 한 문장 → 상황 카드 4(질문형 제목 · PG 한 줄 · CH 한 줄 · "왜?" 한두 줄).
// 수치는 lib/evidence.ts taskSummary(기록) → situationLines(쉬운 문장) · "왜?"는 SITUATIONS(PRINCIPLES를 비유로 다시 쓴 상수).
// 대비표 · 구조 그리드 · 3회 값 · 측정 조건은 두지 않는다(설계 §2 상황 카드 행). 기록 번호는 카드 툴팁에만.
import { useMemo } from 'react';
import {
  BUSINESS_TASKS,
  type EvidenceResult,
  SITUATIONS,
  type SituationLine,
  situationLines,
  taskSummary,
} from '../../../lib/evidence';
import { cn } from '../../../lib/utils';
import { STORE, STORE_DOT_CLASS } from '../../ui/store';

function Line({ store, line }: { store: 'pg' | 'ch'; line: SituationLine }) {
  return (
    <p className="flex items-baseline gap-1.5 text-sm text-slate-800">
      <span aria-hidden="true" className={STORE_DOT_CLASS} style={{ backgroundColor: STORE[store].color }} />
      <span className="w-6 shrink-0 text-xs text-slate-500">{STORE[store].short}</span>
      {line.ok === null ? null : (
        <span className={cn('font-bold', line.ok ? 'text-emerald-700' : 'text-red-600')}>
          {line.ok ? '✓' : '✕'}
        </span>
      )}
      <span className="min-w-0 truncate tabular-nums">{line.text}</span>
    </p>
  );
}

export function BusinessColumn({ d, failed }: { d: EvidenceResult | undefined; failed: boolean }) {
  const cards = useMemo(
    () =>
      SITUATIONS.map((s) => {
        const task = BUSINESS_TASKS.find((t) => t.id === s.id);
        const summary = d && task ? taskSummary(d, task) : null;
        // 카드 툴팁 — 실험 코드 · 기록 번호 · 3회 값(변형 · 조건별)
        const tip = summary
          ? [
              `${task?.exp ?? ''} · 기록 ${summary.records.join(' · ') || '없음'}`,
              ...summary.postgresql.detail.map((x) => `PG ${x}`),
              ...summary.clickhouse.detail.map((x) => `CH ${x}`),
            ].join('\n')
          : undefined;
        return { ...s, summary, tip, lines: summary ? situationLines(summary) : null };
      }),
    [d],
  );
  // 업무 기록 0(EXP-41~44 행 없음) — 결론 문장 대신 빈 값 문구(§상태 4행 ④)
  const empty = !!d && !d.reverse.some((r) => r.exp !== 'EXP-40');
  return (
    <section
      aria-label="업무 데이터"
      className="flex min-h-0 flex-col gap-2 rounded-lg border-2 bg-white px-4 py-3"
      style={{ borderColor: `${STORE.pg.color}80` }}
    >
      <header>
        <p className="text-sm font-semibold" style={{ color: STORE.pg.color }}>
          ② 업무 데이터 — 정확해야 하고 한 건씩 다뤄요
        </p>
        {failed ? (
          <p className="text-base font-bold text-amber-800">기록을 읽지 못했어요</p>
        ) : empty ? (
          <p className="text-base font-bold text-slate-500" title="EXP-41~44 기록 없음">
            아직 잰 기록이 없어요
          </p>
        ) : (
          <p className="text-base font-bold text-slate-900">
            정확해야 하는 업무 데이터는 PostgreSQL이 맞아요
          </p>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {cards.map((c) => (
          <article
            key={c.id}
            data-testid="situation-card"
            data-task={c.id}
            title={c.tip}
            className="flex min-h-0 flex-1 flex-col justify-center gap-1 rounded-md border border-slate-200 px-3 py-2"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              {c.title} <span className="text-xs font-normal text-slate-500">({c.term})</span>
            </h3>
            {c.lines ? (
              <>
                <Line store="pg" line={c.lines.postgresql} />
                <Line store="ch" line={c.lines.clickhouse} />
              </>
            ) : (
              <span className="h-10 w-full animate-pulse rounded bg-slate-100" />
            )}
            <p className="text-xs leading-4 text-slate-600">
              <span className="font-semibold text-slate-700">왜? </span>
              {c.why}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
