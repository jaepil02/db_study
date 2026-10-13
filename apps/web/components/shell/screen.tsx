// 화면 틀 — 7화면 공통 조각(정본 docs/08_screen/01_standards.md §공통 틀 · §반응형 규칙)
// 질문형 제목 + 설명 한 줄 → 본문(그림이 주인공) → 회색 각주. 맞춤 보기(fit: — 1280×720 이상)에서는 틀이 셸 본문 높이에 꼭 맞고
// 본문이 남는 높이를 다 가진다 — 안쪽 덩어리는 min-h-0 · flex-1로 줄고 늘어 페이지 스크롤이 생기지 않는다.
// 작은 화면(맞춤 보기 밖)은 내용 높이대로 쌓이고 셸 본문만 세로로 스크롤한다.
// 스크롤은 목록형 조각(ScrollList) 안에서만 — 그 밖의 상자는 넘치지 않게 줄이거나 줄 수를 줄인다(e2e/support.ts expectFits가 data-scroll-list 밖의 넘침을 잡는다).
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Screen({
  id,
  title,
  lead,
  aside,
  foot,
  children,
  bodyClassName,
}: {
  /** data-screen 값 — e2e가 화면을 찾는 이름(경로와 같게) */
  id: string;
  /** 질문형 제목 */
  title: string;
  /** 설명 한 줄 */
  lead?: ReactNode;
  /** 제목 줄 오른쪽 — 화면 단위 동작(스위치 · 버튼) */
  aside?: ReactNode;
  /** 맨 아래 회색 각주(Footnote) */
  foot?: ReactNode;
  children: ReactNode;
  /** 본문 배치 — 기본은 세로로 쌓기(flex-col) */
  bodyClassName?: string;
}) {
  return (
    <div data-screen={id} className="flex flex-col gap-[var(--gap)] fit:h-full fit:min-h-0">
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-title font-bold text-slate-900">{title}</h2>
        {lead ? <p className="text-body text-slate-600">{lead}</p> : null}
        {aside ? <div className="ml-auto flex shrink-0 items-center gap-2 self-center">{aside}</div> : null}
      </header>
      <div data-screen-body className={cn('flex min-h-0 flex-1 flex-col gap-[var(--gap)]', bodyClassName)}>
        {children}
      </div>
      {foot ? <footer className="shrink-0">{foot}</footer> : null}
    </div>
  );
}

/** 흰 칸 — 제목(용어는 괄호 작게) · 오른쪽 덧붙임 · 본문. 맞춤 보기에서 줄고 늘 수 있게 min-h-0 */
export function Panel({
  title,
  term,
  aside,
  children,
  className,
  bodyClassName,
  label,
}: {
  title?: ReactNode;
  term?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** 접근성 이름 — 제목이 글자가 아닐 때 */
  label?: string;
}) {
  return (
    <section
      aria-label={label ?? (typeof title === 'string' ? title : undefined)}
      className={cn(
        'flex min-h-0 min-w-0 flex-col gap-[calc(var(--gap)*0.75)] rounded-lg border border-line bg-surface p-[var(--pad)]',
        className,
      )}
    >
      {title || aside ? (
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          {title ? (
            <h3 className="text-head font-semibold text-slate-900">
              {title}
              {term ? <span className="ml-1 text-note font-normal text-slate-500">({term})</span> : null}
            </h3>
          ) : null}
          {aside ? <div className="ml-auto text-note text-slate-600">{aside}</div> : null}
        </div>
      ) : null}
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </section>
  );
}

/** 회색 각주 한 줄 — 세부는 ⓘ 툴팁(마우스 · 키보드 초점) */
export function Footnote({ children, tip, testId }: { children: ReactNode; tip?: string; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-foot text-slate-600"
    >
      <span className="min-w-0">{children}</span>
      {tip ? (
        // 단추라 키보드 초점으로도 닿는다 — 누를 일은 없고 title(툴팁) · 이름(aria-label)이 세부를 말한다
        <button
          type="button"
          aria-label={tip}
          title={tip}
          className="inline-flex shrink-0 cursor-help rounded-sm text-slate-500 hover:text-slate-800"
        >
          <InfoGlyph />
        </button>
      ) : null}
    </p>
  );
}

/** 목록형 조각 — 상자 높이는 바깥이 정하고 넘치는 줄은 이 안에서만 세로로 스크롤한다(페이지 스크롤 대신) */
export function ScrollList({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <section
      data-scroll-list
      aria-label={label}
      className={cn('min-h-0 flex-1 overflow-x-hidden overflow-y-auto', className)}
    >
      {children}
    </section>
  );
}

function InfoGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.1em]"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
