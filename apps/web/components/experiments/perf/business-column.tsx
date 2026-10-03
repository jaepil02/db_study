'use client';
// 업무 데이터 구역(파랑) — 머리 띠(연한 파랑 · 구역 이름 + 결론 16px) + 흰 본문 한 겹 · 상황 네 줄을 가는 줄로 가른다(카드 안 카드 없음).
// 네 줄은 같은 문법: [질문 14px 굵게 (용어)] [이긴 쪽 알약] / PG · CH 두 줄 / "왜?" 13px 회색.
// 정확성 줄(트랜잭션 · 제약)은 지킴 · 못 지킴 표시 + 답 조각(깨진 데이터 0건 · 20번 중 20번 깨짐)을 16px 굵게 ·
// 속도 줄(점 조회 · 단건 삽입)은 막대 2개(로그 길이 · 진한 곳 = 가장 빠른 조건 · 연한 곳 = 가장 느린 조건) + 숫자 + "N배 이상 느림" 16px 굵게.
// 수치는 lib/evidence.ts taskSummary(기록) → situationLines(쉬운 문장 · 조각) · 이긴 쪽은 situationWinner(이미 낸 판정에서만) · "왜?"는 SITUATIONS 상수.
// 대비표 · 구조 그리드 · 3회 값 · 측정 조건은 두지 않는다(설계 §2 상황 카드 행). 기록 번호는 줄 툴팁에만. 다듬기 .omc/plans/web-ux-polish.md §2.2.
// 세로 배치(§7.1 R11a · L4): 네 줄은 내용 높이 그대로 위에서부터 쌓고, 줄 사이 틈만 늘어난다 — 틈 칸(가는 줄 포함)은 최대 2rem이라
// 위 줄 글자 끝 ~ 아래 줄 글자 시작은 줄 위아래 여백 8 + 8을 더해 최대 48px · 그보다 남는 높이는 구역 아래로 간다(1920 × 1080에서 줄 사이가 벌어지지 않게).
// 넓고 높은 화면(가로 ≥ 1680 · 세로 ≥ 1000 — roomy.ts · §9 P1)은 글자 한 단계 크게 · 줄 안 높이 비례 · 틈 칸 최대 3rem(줄 사이 최대 64px) — 1440 × 900 · 1280 × 800은 그대로.
import { Fragment, useMemo } from 'react';
import {
  BUSINESS_TASKS,
  type EvidenceResult,
  SITUATIONS,
  type SituationLine,
  situationLines,
  situationWinner,
  taskSummary,
} from '../../../lib/evidence';
import { cn } from '../../../lib/utils';
import { UiIcon } from '../../ui/icon';
import { STORE } from '../../ui/store';
import { ROOMY } from './roomy';

type Side = 'pg' | 'ch';

/** 속도 막대 길이(0~1) — 한 상황 안 두 저장소가 같은 로그 눈금을 쓴다 · 가장 작은 값의 1/4을 0으로 둬 가장 짧은 막대도 보인다 */
export function logSpan(v: number, lo: number, hi: number): number {
  const floor = Math.log10(lo / 4);
  const top = Math.log10(hi);
  if (!(top > floor)) return 1;
  return Math.min(1, Math.max(0, (Math.log10(v) - floor) / (top - floor)));
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function OkMark({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-white',
        ok ? 'bg-emerald-600' : 'bg-red-600',
        ROOMY.bizMark,
      )}
    >
      <UiIcon name={ok ? 'check' : 'cross'} className={cn('size-3', ROOMY.icon)} />
      <span className="sr-only">{ok ? '지킴' : '못 지킴'}</span>
    </span>
  );
}

/** 한 저장소 줄 — 정확성(지킴 표시 · 앞 조각 · 답 조각) · 속도(막대 · 숫자 · 느림) · 그 밖(문장 그대로) */
function Line({
  side,
  line,
  scale,
}: {
  side: Side;
  line: SituationLine;
  /** 속도 줄 막대 눈금 — 이 상황 두 저장소 값의 최소 · 최대 */
  scale: [number, number] | null;
}) {
  const s = STORE[side];
  return (
    <div
      data-ok={line.ok ?? undefined}
      className={cn('flex h-6 min-w-0 items-center gap-2 text-sm text-slate-800', ROOMY.bizLine, ROOMY.sm)}
    >
      <span className={cn('w-6 shrink-0 text-xs font-semibold text-slate-500', ROOMY.xs)}>{s.short}</span>
      {line.ms && scale ? (
        <>
          <span
            className={cn('relative h-2.5 w-2/5 shrink-0 rounded-sm bg-slate-100', ROOMY.bizBar)}
            title="조건마다 잰 보통 값 — 진한 곳까지 가장 빠른 조건 · 연한 곳은 가장 느린 조건(길이는 로그)"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-sm opacity-35"
              style={{ width: pct(logSpan(line.ms[1], ...scale)), backgroundColor: s.color }}
            />
            <span
              className="absolute inset-y-0 left-0 rounded-sm"
              style={{ width: pct(logSpan(line.ms[0], ...scale)), backgroundColor: s.color }}
            />
          </span>
          <span
            className={cn('shrink-0 text-label whitespace-nowrap text-slate-700 tabular-nums', ROOMY.label)}
          >
            {line.value}
          </span>
          {line.slower ? (
            <span className={cn('truncate text-base font-bold tabular-nums text-red-700', ROOMY.base)}>
              {line.slower}
            </span>
          ) : null}
        </>
      ) : line.key ? (
        <>
          {line.ok === null ? null : <OkMark ok={line.ok} />}
          {line.lead ? <span className="shrink-0 whitespace-nowrap text-slate-600">{line.lead}</span> : null}
          <span
            className={cn(
              'truncate text-base font-bold tabular-nums',
              ROOMY.base,
              line.ok === true ? 'text-emerald-700' : line.ok === false ? 'text-red-700' : 'text-slate-900',
            )}
          >
            {line.key}
          </span>
        </>
      ) : (
        <span className="min-w-0 truncate">{line.text}</span>
      )}
    </div>
  );
}

export function BusinessColumn({ d, failed }: { d: EvidenceResult | undefined; failed: boolean }) {
  const rows = useMemo(
    () =>
      SITUATIONS.map((s) => {
        const task = BUSINESS_TASKS.find((t) => t.id === s.id);
        const summary = d && task ? taskSummary(d, task) : null;
        // 줄 툴팁 — 실험 코드 · 기록 번호 · 3회 값(변형 · 조건별)
        const tip = summary
          ? [
              `${task?.exp ?? ''} · 기록 ${summary.records.join(' · ') || '없음'}`,
              ...summary.postgresql.detail.map((x) => `PG ${x}`),
              ...summary.clickhouse.detail.map((x) => `CH ${x}`),
            ].join('\n')
          : undefined;
        const lines = summary ? situationLines(summary) : null;
        const winner = lines ? situationWinner(lines) : null;
        const ms = lines ? [lines.postgresql.ms, lines.clickhouse.ms] : [];
        const scale: [number, number] | null =
          ms[0] && ms[1] ? [Math.min(ms[0][0], ms[1][0]), Math.max(ms[0][1], ms[1][1])] : null;
        return { ...s, tip, lines, winner, scale };
      }),
    [d],
  );
  // 업무 기록 0(EXP-41~44 행 없음) — 결론 문장 대신 빈 값 문구(§상태 4행 ④)
  const empty = !!d && !d.reverse.some((r) => r.exp !== 'EXP-40');
  return (
    <section
      aria-label="업무 데이터"
      className="flex min-h-0 flex-col rounded-lg border border-line bg-surface"
    >
      <header className="shrink-0 rounded-t-lg border-b border-line bg-store-pg-soft px-4 py-2">
        <p className={cn('text-label font-semibold text-store-pg-ink', ROOMY.label)}>
          업무 데이터 — 정확해야 하고 한 건씩 다뤄요
        </p>
        {failed ? (
          <p className={cn('text-base font-bold text-amber-800', ROOMY.base)}>기록을 읽지 못했어요</p>
        ) : empty ? (
          <p className={cn('text-base font-bold text-slate-500', ROOMY.base)} title="EXP-41~44 기록 없음">
            아직 잰 기록이 없어요
          </p>
        ) : (
          <p className={cn('text-base font-bold text-slate-900', ROOMY.base)}>
            정확해야 하는 업무 데이터는 PostgreSQL이 맞아요
          </p>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4">
        {rows.map((c, i) => (
          <Fragment key={c.id}>
            {i > 0 ? (
              // 줄 사이 틈 — 남는 높이를 나눠 받되 최대 2rem(32px · 넓고 높은 화면 3rem) · 가운데 가는 줄 한 겹(1px 중립)
              <div
                aria-hidden="true"
                data-testid="situation-gap"
                className={cn('flex max-h-8 min-h-px flex-1 items-center', ROOMY.bizGapMax)}
              >
                <span className="h-px w-full bg-line" />
              </div>
            ) : null}
            <article
              data-testid="situation-card"
              data-task={c.id}
              data-winner={c.winner ?? undefined}
              title={c.tip}
              className={cn('flex shrink-0 flex-col gap-0.5 py-2', ROOMY.bizGap)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <h3 className={cn('min-w-0 truncate text-sm font-bold text-slate-900', ROOMY.sm)}>
                  {c.title}{' '}
                  <span className={cn('text-xs font-normal text-slate-500', ROOMY.xs)}>({c.term})</span>
                </h3>
                {c.winner ? (
                  <span
                    data-testid="situation-winner"
                    title="이 상황에서 맞는 쪽"
                    className={cn(
                      'ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
                      ROOMY.xs,
                    )}
                    style={{
                      backgroundColor: STORE[c.winner === 'postgresql' ? 'pg' : 'ch'].soft,
                      borderColor: `${STORE[c.winner === 'postgresql' ? 'pg' : 'ch'].color}40`,
                      color: STORE[c.winner === 'postgresql' ? 'pg' : 'ch'].ink,
                    }}
                  >
                    <span className="sr-only">맞는 쪽 </span>
                    {STORE[c.winner === 'postgresql' ? 'pg' : 'ch'].label}
                    <UiIcon name="check" className={cn('size-3', ROOMY.icon)} />
                  </span>
                ) : null}
              </div>
              {c.lines ? (
                <>
                  <Line side="pg" line={c.lines.postgresql} scale={c.scale} />
                  <Line side="ch" line={c.lines.clickhouse} scale={c.scale} />
                </>
              ) : (
                <span
                  className={cn('h-12 w-full rounded bg-slate-100 motion-safe:animate-pulse', ROOMY.bizBox)}
                />
              )}
              <p className={cn('text-label text-slate-600', ROOMY.label)}>
                <span className="font-semibold text-slate-700">왜? </span>
                {c.why}
              </p>
            </article>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
