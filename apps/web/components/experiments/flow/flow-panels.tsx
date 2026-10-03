'use client';
// /monitoring 흐름도 바깥 구역 — 숫자 4 · 왜 이렇게 나눌까? 한 구역 세 칸 · 모아서 vs 하나씩 막대 2
// 설계 .omc/plans/web-junior-redesign.md §3 구역 표 · §5 픽셀 예산 · 다듬기 .omc/plans/web-ux-polish.md §2.3 — 높이는 고정값이다(한 화면 · 스크롤 0).
//   숫자 4 64(이름 12 · 큰 숫자 28(text-answer) tabular · 짧은 문장 13(text-label)은 큰 숫자 옆 두 줄까지 — 잘림 없음) · 아래 줄 124.
//   왜 나눌까는 카드 셋이 아니라 한 구역 세 칸(세로 hairline) — 카드 안 카드 · 굵은 색 테두리 없이 저장소 이름 앞 색 점 · 세 칸은 위 맞춤(이름 줄 높이가 같다).
//   모아서 vs 하나씩은 막대 두 줄(이름 · 막대 · 처리 시간 — 이름 칸 폭이 같아 두 막대가 같은 자리에서 시작) + 대기줄에서 기다린 시간 한 줄 + 결론 한 줄.
// 문구는 node-lines.ts의 순수 함수가 만든다(검사 test/flow.test.ts · 두 줄 안에 드는지는 test/flow-layout.test.ts가 Pretendard 실측으로).
import { Fragment } from 'react';
import { durationText } from '../../../lib/flow';
import { cn } from '../../../lib/utils';
import { STORE, STORE_DOT_CLASS } from '../../ui/store';
import {
  COMPARE_NOTE,
  type CompareBar,
  type Headline,
  NO_BIZ_TEXT,
  type WhyCard,
  waitLine,
} from './node-lines';

/** 숫자 4 — 이름 한 줄 + 큰 숫자 옆 짧은 문장(64 높이) · 밀리는 중이면 주황 */
export function HeadlineRow({ items, dim }: { items: Headline[]; dim: boolean }) {
  return (
    <section
      aria-label="지금 상태"
      data-testid="flow-headline"
      className="grid h-16 shrink-0 grid-cols-4 gap-3"
    >
      {items.map((it) => (
        <div
          key={it.key}
          data-key={it.key}
          title={it.tip}
          className={cn(
            'flex min-w-0 flex-col justify-center rounded-lg border px-4',
            it.warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white',
          )}
        >
          <p className="truncate text-xs leading-4 font-medium text-slate-500">{it.label}</p>
          <div className="flex h-8 min-w-0 items-center gap-2.5">
            <p className={cn('flex shrink-0 items-baseline gap-1', dim && 'opacity-50')}>
              <span
                data-value
                className="text-answer font-semibold tracking-tight text-slate-900 tabular-nums"
              >
                {it.value}
              </span>
              {/* 60초 이상 "46분 28초"는 단위가 숫자 안에 있어 단위 칸이 없다(§9 P3) */}
              {it.unit ? <span className="text-sm text-slate-500">{it.unit}</span> : null}
            </p>
            <p
              data-text
              className={cn(
                'line-clamp-2 min-w-0 text-label leading-4',
                it.warn ? 'font-medium text-amber-800' : 'text-slate-600',
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

/** 왜 이렇게 나눌까? — 한 구역 세 칸(세로 hairline) · 저장소 이름 앞 색 점 · 한 줄 이유 + 지금 받는 양 */
export function WhyCards({ cards, dim }: { cards: WhyCard[]; dim: boolean }) {
  return (
    <section
      aria-label="왜 이렇게 나눌까"
      data-testid="flow-why"
      className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-4 py-2"
    >
      <h3 className="text-sm leading-5 font-semibold text-slate-800">왜 이렇게 나눌까?</h3>
      <div className="mt-1 grid min-h-0 flex-1 grid-cols-3 divide-x divide-slate-200">
        {cards.map((c) => (
          <div key={c.store} className="flex min-w-0 flex-col justify-start px-4 first:pl-0 last:pr-0">
            <p className="flex items-center gap-1.5 text-sm leading-5 font-semibold">
              <span
                aria-hidden="true"
                className={STORE_DOT_CLASS}
                style={{ background: STORE[c.store].color }}
              />
              <span style={{ color: STORE[c.store].ink }}>{c.name}</span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-label text-slate-800" title={c.why}>
              {c.why}
            </p>
            <p
              className={cn('truncate text-xs leading-4 text-slate-500 tabular-nums', dim && 'opacity-50')}
              title={c.now}
            >
              {c.now}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * 모아서 vs 하나씩 — 센서 1묶음 · 업무 1건의 평균 처리 시간(대기줄 대기 빼고) 막대 2(두께 10 · 숫자 16 굵게) + 대기줄에서 기다린 시간 한 줄.
 * 높이 124 안(테두리 2 · 세로 여백 8 · 제목 20 · 결론 16 → 가운데 78): 막대 두 줄 20 + 4 + 20 · 대기 한 줄 4 + 16 = 64 ·
 * 업무가 없으면 안내 문구가 두 줄(32)까지 — 20 + 4 + 32 + 4 + 16 = 76.
 */
export function BatchVsOne({ bars, dim }: { bars: CompareBar[]; dim: boolean }) {
  const wait = waitLine(bars);
  return (
    <section
      aria-label="모아서 vs 하나씩"
      data-testid="flow-compare"
      className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-4 py-1"
    >
      <h3 className="truncate text-sm leading-5 font-semibold text-slate-800">
        모아서 vs 하나씩 — 한 번 처리에 걸린 시간
      </h3>
      <div className={cn('flex min-h-0 flex-1 flex-col justify-center gap-1', dim && 'opacity-50')}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
          {bars.map((b) =>
            b.key === 'biz' && b.samples === 0 ? (
              <Fragment key={b.key}>
                <span className="text-label leading-5 text-slate-600">{b.label}</span>
                <p
                  className="col-span-2 line-clamp-2 text-xs leading-4 text-slate-600"
                  data-testid="flow-no-biz"
                  title={NO_BIZ_TEXT}
                >
                  {NO_BIZ_TEXT}
                </p>
              </Fragment>
            ) : (
              <Fragment key={b.key}>
                <span className="truncate text-label leading-5 text-slate-600">{b.label}</span>
                <div className="h-2.5 rounded-sm bg-slate-100">
                  <div
                    className="h-2.5 rounded-sm"
                    style={{
                      width: `${Math.max(b.frac * 100, b.ms === null ? 0 : 2)}%`,
                      background: b.key === 'batch' ? STORE.ch.color : STORE.pg.color,
                    }}
                  />
                </div>
                <span className="text-right text-base leading-5 font-bold text-slate-900 tabular-nums">
                  {durationText(b.ms)}
                </span>
              </Fragment>
            ),
          )}
        </div>
        {wait ? (
          <p
            data-testid="flow-wait"
            className="truncate text-xs leading-4 text-slate-600 tabular-nums"
            title={wait}
          >
            {wait}
          </p>
        ) : null}
      </div>
      <p className="truncate text-xs leading-4 text-slate-600">{COMPARE_NOTE}</p>
    </section>
  );
}
