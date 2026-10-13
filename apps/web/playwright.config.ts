// 유저 플로우 E2E — 화면 명세 docs/08_screen(01 공통 셸 · 업무 쓰기 응답 · 05 · 06 · 08)를 실제 화면으로 확인한다.
// 웹은 next build 뒤 next start(127.0.0.1:13001)로 띄우고, api · 저장소는 이미 떠 있는 docker compose(127.0.0.1:13000)를 쓴다.
// 화면은 http://localhost:13001로 연다 — api CORS · WS Origin 허용 오리진이 http://localhost:13001 하나다(lib/config.ts).
import { defineConfig, devices } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:13000';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  // 한 api · 한 DB를 함께 쓴다 — 쓰기 흐름끼리 서로의 목록 · 흐름 이벤트를 흔들지 않게 한 줄로 돈다
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: './e2e/.report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:13001',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1600, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } },
  ],
  webServer: {
    // next를 직접 exec한다 — pnpm start를 거치면 종료 신호가 next-server에 닿지 않아 teardown이 멈추고 13001에 고아가 남는다
    command:
      'node node_modules/next/dist/bin/next build && exec node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 13001',
    url: 'http://127.0.0.1:13001/bff/health',
    reuseExistingServer: false,
    timeout: 300_000,
    env: { API_BASE_URL },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
