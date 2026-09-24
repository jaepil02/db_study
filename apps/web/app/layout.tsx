import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import 'uplot/dist/uPlot.min.css';
import './globals.css';
import { Shell } from '../components/shell/shell';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'db_study',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
