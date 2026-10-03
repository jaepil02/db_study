'use client';
// EXP-PERF — 성능 비교(/performance) 한 장 화면. 설계 .omc/plans/web-junior-redesign.md §1 원칙 · §2 화면 A · §4 용어표 · §5 픽셀 예산 · 다듬기 .omc/plans/web-ux-polish.md §2.
// 1440 × 900에서 스크롤 · 서랍 · 탭 없이: 제목(질문형) · 설명 한 줄 → 두 구역(센서 데이터 주황 · 업무 데이터 파랑 — 머리 띠 + 흰 본문 한 겹) → 한 줄 정리(두 조각 알약) · 각주.
// 화면 높이는 본문 높이(100dvh − 셸 머리 − 위아래 여백 40)로 고정하고 그림 2만 늘거나 준다 — 진행 띠가 생기면 그림 2가 흡수한다.
// 바닥 높이: 1360px 이상 46rem(제목 · 그림 1 머리가 한 줄) · 1024~1359px는 줄바꿈으로 높아지는 만큼 52rem(1280 × 800은 본문 스크롤 허용 — 구역이 겹치지 않게).
// 두 범위는 겹치지 않게 쓴다(lg:max-[1360px] · min-[1360px]) — Tailwind가 px 임의 중단점과 rem 중단점의 순서를 정하지 못해 겹치면 앞뒤가 뒤바뀐다.
// 폭: 최대 88rem(1408px) 가운데 — 1440 × 900의 본문 비(1152 × 804 ≈ 1.43)를 1920 × 1080(본문 높이 984 × 1.43 ≈ 1408)에서도 지켜 늘어나 휑하지 않게.
// 직접 재 보기(GEN-11)는 셸 머리 버튼 → 규모 선택 팝오버 → 진행 띠 한 줄(실행 중 · 끝난 뒤 30초) · 지난 결과는 셸 머리 작은 글자 · 그림 2에 "내 측정" 점. URL은 선택 질문 q 하나만 남긴다.
import { useEffect, useState } from 'react';
import { useShellHealth } from '../../../lib/health';
import { countIssues, recordTipLines } from '../../../lib/perf';
import type { HealthBody } from '../../../lib/shared';
import { buildSwitchRows, conditionsSummary } from '../../../lib/switches';
import { formatKst } from '../../../lib/time';
import { RunProvider } from '../../runs/run-context';
import { RunControl } from '../../runs/run-control';
import { RunProgress } from '../../runs/run-progress';
import { PERF_PARAM_DEFS } from '../../runs/run-spec';
import { HeaderActions } from '../../shell/header-actions';
import { UiIcon } from '../../ui/icon';
import { STORE } from '../../ui/store';
import { useEvidence } from '../evidence';
import { BusinessColumn } from './business-column';
import { usePerfView } from './perf-data';
import { SensorColumn } from './sensor-column';

export const PERF_TITLE = 'PostgreSQL과 ClickHouse, 어떤 데이터에 무엇이 맞을까?';
export const PERF_LEAD =
  '같은 데이터를 두 DB에 넣고 같은 일을 시켜 봤어요. 데이터의 성격에 따라 이기는 쪽이 바뀝니다.';
/** 한 줄 정리 두 조각 — 데이터 성격 → 맞는 DB(알약 바탕은 그 DB의 연한 색) */
export const PERF_SUMMARY_PARTS = [
  { store: 'ch', data: '많이 쌓아 두고 크게 훑는 데이터' },
  { store: 'pg', data: '정확하게 한 건씩 다루는 데이터' },
] as const;
export const PERF_SUMMARY = PERF_SUMMARY_PARTS.map((p) => `${p.data} → ${STORE[p.store].label}`).join(' · ');
/** 각주 고정 문구(08_screen/08 §표시 계약 시간 참고값) */
export const PERF_FOOTNOTE =
  '같은 일을 3번씩 시킨 중간값 · 걸린 시간은 참고용 · 누가 이기는지는 3번 모두 같을 때만';

/** 각주 툴팁의 지금 기동 줄 — health 스위치 전수(기본값과 다르면 *) · 저장소별 상태 · 실패면 "구성을 읽지 못했어요" */
export function healthTipLines(health: HealthBody | null, failed: boolean): string[] {
  if (!health) return [failed ? '지금 기동 — 구성을 읽지 못했어요' : '지금 기동 — 읽는 중이에요'];
  const sw = buildSwitchRows(health.switches).map((r) =>
    r.kind === 'present'
      ? `${r.spec.id}=${r.value}${r.sameAsDefault ? '' : '*'}`
      : r.kind === 'not_introduced'
        ? `${r.spec.id}(도입 전)`
        : `${r.id}=${r.value}`,
  );
  const stores = Object.entries(health.stores).map(([k, v]) => `${k} ${v.status}`);
  return [
    `지금 기동 — ${conditionsSummary(health, false)} · 저장소 ${stores.join(' · ')}`,
    `지금 스위치(*는 기본값과 다름) ${sw.join(' · ')}`,
  ];
}
export const RUN_INTRO =
  '같은 질문 5개를 두 DB에 3번씩 시켜 봐요. 끝나면 그림 2에 "내 측정" 점으로 나와요. 어디까지 넣어 볼까요?';

export function PerfScreen({ initialQuery }: { initialQuery: string }) {
  const perf = usePerfView();
  const evidence = useEvidence({ entry: true });
  const health = useShellHealth({ entry: true });
  const [query, setQuery] = useState(initialQuery);

  // 선택 질문만 주소에 남긴다(공유 · 새로고침이 같은 질문으로 열린다 · 기록을 쌓지 않게 replaceState)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    window.history.replaceState(window.history.state, '', url);
  }, [query]);

  const view = perf.data;
  const issues = view ? countIssues(view.counts) : [];
  const footTip = [
    ...(view ? recordTipLines(view) : ['기록을 읽는 중']),
    view ? `판독 ${formatKst(view.readAt, true)}` : '',
    ...healthTipLines(health.data?.body ?? null, health.isError),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <RunProvider type="perf">
      <HeaderActions>
        <RunControl params={PERF_PARAM_DEFS} buttonLabel="내 컴퓨터에서 직접 재 보기" intro={RUN_INTRO} />
      </HeaderActions>
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-3 lg:max-[1360px]:h-[max(calc(100dvh-var(--header-height)-2.5rem),52rem)] min-[1360px]:h-[max(calc(100dvh-var(--header-height)-2.5rem),46rem)]">
        <header className="flex shrink-0 flex-wrap items-baseline gap-x-4">
          <h2 className="text-xl font-bold text-slate-900">{PERF_TITLE}</h2>
          <p className="text-sm text-slate-600">{PERF_LEAD}</p>
        </header>
        <RunProgress className="shrink-0" />
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
          <SensorColumn view={perf.data} failed={perf.isError} query={query} onQuery={setQuery} />
          <BusinessColumn d={evidence.data?.evidence} failed={evidence.isError} />
        </div>
        <footer className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1">
          <p data-testid="perf-summary" className="flex flex-wrap items-center gap-2">
            <span className="text-label font-semibold text-slate-700">한 줄 정리</span>
            {PERF_SUMMARY_PARTS.map((p) => (
              <span
                key={p.store}
                className="rounded-full border px-3 py-0.5 text-sm font-medium text-slate-800"
                style={{ backgroundColor: STORE[p.store].soft, borderColor: `${STORE[p.store].color}40` }}
              >
                {p.data} → <b style={{ color: STORE[p.store].ink }}>{STORE[p.store].label}</b>
              </span>
            ))}
          </p>
          <p data-testid="perf-footnote" className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
            <span className="min-w-0 truncate">
              {PERF_FOOTNOTE}
              {issues.length > 0 ? <span className="text-amber-800"> · {issues.join(' · ')}</span> : null}
            </span>
            <span
              data-testid="perf-footnote-tip"
              role="img"
              aria-label="기록 조건 · 판독 계수 · 지금 기동"
              title={footTip}
              className="inline-flex shrink-0 cursor-help text-slate-500 hover:text-slate-800"
            >
              <UiIcon name="info" className="size-4" />
            </span>
          </p>
        </footer>
      </div>
    </RunProvider>
  );
}
