'use client';
// /monitoring 흐름도 바깥 구역 — 숫자 4 · 왜 이렇게 나눌까? 카드 3 · 모아서 vs 하나씩 막대 2
// 설계 .omc/plans/web-junior-redesign.md §3 구역 표 · §5 픽셀 예산 · §9.2(조회 줄이 늘어 숫자 4 84 → 60 · 아래 줄 170 → 124) — 높이는 고정값이다(한 화면 · 스크롤 0).
// 문구는 node-lines.ts의 순수 함수가 만든다(검사 test/flow.test.ts).
import { cn } from '../../../lib/utils';
import { STORE } from '../../ui/store';
import {
  COMPARE_NOTE,
  type CompareBar,
  type Headline,
  msText,
  NO_BIZ_TEXT,
  type WhyCard,
} from './node-lines';

/** 숫자 4 — 이름 한 줄 + 큰 숫자 옆 쉬운 문장(60 높이) · 밀리는 중이면 주황 */
export function HeadlineRow({ items, dim }: { items: Headline[]; dim: boolean }) {
  return (
    <section
      aria-label="지금 상태"
      data-testid="flow-headline"
      className="grid h-[60px] shrink-0 grid-cols-4 gap-3"
    >
      {items.map((it) => (
        <div
          key={it.key}
          data-key={it.key}
          title={it.tip}
          className={cn(
            'flex flex-col justify-center overflow-hidden rounded-lg border bg-white px-4',
            it.warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200',
          )}
        >
          <p className="truncate text-xs leading-4 font-medium text-slate-500">{it.label}</p>
          <div className="flex min-w-0 items-baseline gap-2 leading-8">
            <p className={cn('flex shrink-0 items-baseline gap-1', dim && 'opacity-50')}>
              <span className="text-2xl font-semibold text-slate-900 tabular-nums">{it.value}</span>
              <span className="text-sm text-slate-500">{it.unit}</span>
            </p>
            <p
              className={cn(
                'min-w-0 truncate text-xs',
                it.warn ? 'font-medium text-amber-700' : 'text-slate-600',
              )}
            >
              {it.text}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

/** 왜 이렇게 나눌까? — DB마다 한 줄 이유 + 지금 받는 양 */
export function WhyCards({ cards, dim }: { cards: WhyCard[]; dim: boolean }) {
  return (
    <section
      aria-label="왜 이렇게 나눌까"
      data-testid="flow-why"
      className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-4 py-2"
    >
      <h3 className="text-sm leading-5 font-semibold text-slate-800">왜 이렇게 나눌까?</h3>
      <div className="mt-1.5 grid min-h-0 flex-1 grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.store}
            className="flex min-w-0 flex-col justify-center rounded-md border-l-4 bg-slate-50 px-3"
            style={{ borderLeftColor: STORE[c.store].color }}
          >
            <p className="text-sm leading-5 font-semibold" style={{ color: STORE[c.store].color }}>
              {c.name}
            </p>
            <p className="line-clamp-2 text-[13px] leading-[17px] text-slate-800" title={c.why}>
              {c.why}
            </p>
            <p className={cn('truncate text-xs leading-4 text-slate-500 tabular-nums', dim && 'opacity-50')}>
              {c.now}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 모아서 vs 하나씩 — 센서 1묶음 · 업무 1건의 평균 처리 시간 막대 2 */
export function BatchVsOne({ bars, dim }: { bars: CompareBar[]; dim: boolean }) {
  const biz = bars.find((b) => b.key === 'biz');
  return (
    <section
      aria-label="모아서 vs 하나씩"
      data-testid="flow-compare"
      className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-4 py-2"
    >
      <h3 className="truncate text-sm leading-5 font-semibold text-slate-800">
        모아서 vs 하나씩 — 한 번 처리에 걸린 시간
      </h3>
      <div className={cn('flex min-h-0 flex-1 flex-col justify-center gap-1.5', dim && 'opacity-50')}>
        {bars.map((b) =>
          b.key === 'biz' && biz?.ms === null ? (
            <div key={b.key}>
              <p className="text-xs leading-4 text-slate-600">{b.label}</p>
              <p className="truncate text-xs leading-4 text-slate-500" data-testid="flow-no-biz">
                {NO_BIZ_TEXT}
              </p>
            </div>
          ) : (
            <div key={b.key}>
              <div className="flex items-baseline justify-between text-xs leading-4">
                <span className="text-slate-600">{b.label}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{msText(b.ms)}</span>
              </div>
              <div className="mt-0.5 h-2 w-full rounded-sm bg-slate-100">
                <div
                  className="h-2 rounded-sm"
                  style={{
                    width: `${Math.max(b.frac * 100, b.ms === null ? 0 : 2)}%`,
                    background: b.key === 'batch' ? STORE.ch.color : STORE.pg.color,
                  }}
                />
              </div>
            </div>
          ),
        )}
      </div>
      <p className="truncate text-xs leading-4 text-slate-600">{COMPARE_NOTE}</p>
    </section>
  );
}
