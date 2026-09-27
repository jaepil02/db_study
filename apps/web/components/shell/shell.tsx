'use client';
// 공통 셸 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸
// WebSocket 연결은 셸이 하나만 연다. 셸 요소는 메뉴 · 실험 조건 배지(OBS-06 표시 — health 1회) · WS 표지 · 무효화 신호 수신(S4 · RLT-09) ·
// 알람 통지 수신(S7 ① · RLT-08 — ALM-CONSOLE 겹침 층 · DSH 알람 띠 세션 목록 둘에 싣는다)(사용자 메뉴는 S7 ② 로그인 뒤).
// 레이아웃: 좌측 내비 트리(sidebar.tsx · 접으면 레일) + 콘텐츠 머리(고정 · 섹션 › 화면 · 우측 표지) + 콘텐츠 본문(이 영역만 스크롤).
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAlarmBandStore } from '../../lib/alarm-band';
import { alarmKeys } from '../../lib/alarms';
import { useAlarmOverlay } from '../../lib/alarms-store';
import { actionsForSignal, RECONNECT_ACTIONS, type SignalAction } from '../../lib/cache-signal';
import { markMasterFresh } from '../../lib/master-api';
import { resolveNav } from '../../lib/nav';
import { realtimeSocket, useConnectionStore } from '../../lib/realtime-socket';
import { useRealtimeStore } from '../../lib/realtime-store';
import { cn } from '../../lib/utils';
import { ExperimentBadge } from './experiment-badge';
import { Sidebar, useSidebarCollapsed } from './sidebar';
import { WsIndicator } from './ws-indicator';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const qc = useQueryClient();
  useEffect(() => {
    // 신호 → 쿼리 키 무효화. timeseries는 어떤 신호에도 무효화하지 않는다
    // 신선 창은 신호에만 — 재연결 무효화는 BFF 사본을 거친다(쓰기는 이미 ⑤로 비웠다 · 전 탭 재연결 폭주가 api로 몰리지 않게 · 검수 N2)
    const apply = (actions: readonly SignalAction[], fresh: boolean) => {
      if (fresh && actions.some((a) => a.kind === 'query' && a.key[0] === 'master')) markMasterFresh();
      for (const a of actions) {
        if (a.kind === 'query') void qc.invalidateQueries({ queryKey: [...a.key] });
        else if (a.kind === 'realtimeTag') {
          // 그 태그를 가진 설비를 보고 있을 때만 — 최신값 쿼리는 사건 호출형(enabled false)이라 epoch로 알린다
          if (useRealtimeStore.getState().meta[a.tagId])
            useConnectionStore.setState((s) => ({ metaEpoch: s.metaEpoch + 1 }));
        }
        // permNotice — 역할 안내는 S7(로그인 사용자가 생긴 뒤)
      }
    };
    const off = realtimeSocket.on((e) => {
      if (e.type === 'cacheinv') apply(actionsForSignal(e.keys), true);
      else if (e.type === 'alarm') {
        // 알람 통지 — 콘솔 겹침 층과 대시보드 띠 세션 목록에 싣는다. 목록은 곧바로 다시 읽지 않는다: 서버 목록 캐시(cache:alarmevents)가
        // 확인 커밋 뒤에만 지워져 지금 읽어도 옛 목록이다 — 겹침 행이 생긴 뒤 TTL이 지나면 콘솔이 한 번 다시 읽는다(08_screen/05)
        // 띠 목록은 겹침 층과 수명이 달라 따로 든다 — 콘솔 반영(drop) · 재연결(clear)이 띠를 비우지 않게(08_screen/03 "이 세션에서 받은 이벤트")
        useAlarmOverlay.getState().push(e.frame);
        useAlarmBandStore.getState().push(e.frame);
      } else {
        apply(RECONNECT_ACTIONS, false);
        // 재연결 — 겹침 층을 비우고 알람 목록 재조회 1회(07_api/11 §연결 관리와 재연결 · 08_screen/05 §실시간 겹침) · 띠 세션 목록은 두고 간다
        useAlarmOverlay.getState().clear();
        void qc.invalidateQueries({ queryKey: [...alarmKeys.events()] });
      }
    });
    realtimeSocket.start();
    return () => {
      off();
      realtimeSocket.stop();
    };
  }, [qc]);
  const current = resolveNav(pathname);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <aside
        data-shell="nav"
        className={cn(
          'shrink-0 border-r border-sidebar-line',
          collapsed ? 'w-[var(--sidebar-rail-width)]' : 'w-[var(--sidebar-width)]',
        )}
      >
        <Sidebar pathname={pathname} collapsed={collapsed} onCollapsedChange={setCollapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-shell="content-header"
          className="flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b border-line bg-surface px-5"
        >
          <div className="flex min-w-0 items-center gap-2">
            {current ? (
              <>
                {current.section.flat ? null : (
                  <>
                    <span className="text-sm text-sidebar-fg-muted">{current.section.label}</span>
                    <span aria-hidden className="text-sidebar-fg-muted">
                      /
                    </span>
                  </>
                )}
                <h1 className="truncate text-base font-semibold text-sidebar-fg-strong">
                  {current.item.label}
                </h1>
                <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-sidebar-fg-muted">
                  {current.item.code}
                </span>
              </>
            ) : (
              <h1 className="text-base font-semibold text-sidebar-fg-strong">db_study</h1>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ExperimentBadge />
            <WsIndicator />
          </div>
        </header>
        {/* relative — 본문 안 absolute 요소(sr-only legend 등)의 포함 블록을 본문에 가둔다 · 없으면 초기 포함 블록 기준으로 놓여 문서 높이를 키운다(본문만 스크롤 위반) */}
        <main data-shell="content-body" className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
