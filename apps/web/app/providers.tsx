'use client';
// TanStack Query 공급자 — 쿼리별 staleTime · gcTime은 각 쿼리에서 09_tech_stack/01 표대로 준다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
