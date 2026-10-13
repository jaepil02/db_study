'use client';
// 셸 머리 자리 — 화면이 <HeaderActions>children</HeaderActions>을 그리면 셸 머리 오른쪽 동작 자리에 나타난다(docs/08_screen/01_standards.md §요청 경로와 공통 셸)
// 셸이 그 자리(DOM 노드)를 컨텍스트로 내려 주고, 이 컴포넌트가 그 자리에 포털로 그린다. 화면이 사라지면 같이 사라진다.
import { createContext, type ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';

export interface HeaderSlots {
  actions: HTMLElement | null;
}

export const HeaderSlotContext = createContext<HeaderSlots>({ actions: null });

export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext).actions;
  return slot ? createPortal(children, slot) : null;
}
