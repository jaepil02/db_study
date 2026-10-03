import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';
import { Shell } from '../components/shell/shell';
import { Providers } from './providers';

// Pretendard Variable 자체 호스팅 — npm pretendard(버전 고정 package.json)의 woff2 한 벌(굵기 45~930 가변 — 글꼴 wght 축 범위 그대로) · 외부 CDN 요청 없음.
// --font-pretendard를 <html>에 달아 globals.css --font-sans가 읽는다 · 대체 글꼴은 이전 순서 그대로(fallback).
// adjustFontFallback 끔 — 기본 보정 대상이 Arial이라 한글 대체 글꼴(Apple SD Gothic Neo)에는 맞지 않는다.
const pretendard = localFont({
  src: '../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
  weight: '45 930',
  display: 'swap',
  variable: '--font-pretendard',
  fallback: ['system-ui', '-apple-system', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'db_study',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="h-dvh overflow-hidden bg-canvas text-slate-900 antialiased">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
