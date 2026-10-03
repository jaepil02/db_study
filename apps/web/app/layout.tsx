import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Shell } from '../components/shell/shell';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'db_study',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="h-dvh overflow-hidden bg-canvas text-slate-900 antialiased">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
