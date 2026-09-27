import { defineConfig } from 'vitest/config';
// tsconfig의 jsx: preserve는 Next.js 빌드용 — 테스트에서 컴포넌트를 렌더(renderToStaticMarkup)하려면 JSX를 변환한다
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['test/**/*.test.ts'] },
});
