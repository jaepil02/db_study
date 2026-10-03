'use client';
// 셸 머리 자리 — 화면이 <HeaderActions>children</HeaderActions>을 그리면 셸 머리 오른쪽 동작 자리에 나타난다(.omc/web2-brief.md §5)
// <HeaderStatus>는 WS 표지 알약 안 덧붙임 자리(/monitoring — 흐름 구독 표지의 마지막 배치 나이)에 그린다. 표지가 없는 화면에서는 그리지 않는다.
// 셸이 두 자리(DOM 노드)를 컨텍스트로 내려 주고, 이 컴포넌트가 그 자리에 포털로 그린다. 화면이 사라지면 같이 사라진다.
import { createContext, type ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';

export interface HeaderSlots {
  actions: HTMLElement | null;
  status: HTMLElement | null;
}

export const HeaderSlotContext = createContext<HeaderSlots>({ actions: null, status: null });

export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext).actions;
  return slot ? createPortal(children, slot) : null;
}

export function HeaderStatus({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext).status;
  return slot ? createPortal(children, slot) : null;
}
