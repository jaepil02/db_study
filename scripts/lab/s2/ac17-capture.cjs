// AC-17 육안 판정의 기계 대조 — 헤드리스 Chromium으로 /realtime/1을 10초 간격 두 번 본다(EXP-29 · 기록 014)
// 판정(전부 성립해야 성립): ① 최신값 표 8행 ② 8행 모두 10초 사이 측정 시각 갱신 ③ 트렌드 캔버스에 그림이 있다
// ④ 두 촬영 사이 캔버스 픽셀이 바뀐다(새 점) ⑤ WS 표시 "연결" ⑥ 페이지 오류 0. 스크린샷 두 장을 남긴다.
// 사용: PLAYWRIGHT_CORE=<playwright-core 경로> node scripts/lab/s2/ac17-capture.cjs <출력 디렉터리> <접두>
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

async function canvasInk(page) {
  // uPlot 캔버스의 불투명 픽셀 수와 간단한 해시 — 점이 새로 그려지면 둘 중 하나가 바뀐다
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { ink: 0, hash: 0 };
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    let hash = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) {
        ink++;
        hash = (hash * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13 + i) % 2147483647;
      }
    }
    return { ink, hash };
  });
}

async function rows(page) {
  return page.locator('table').first().locator('tbody tr').allInnerTexts();
}

(async () => {
  const [out, prefix] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3001/realtime/1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  const r0 = await rows(page);
  const c0 = await canvasInk(page);
  await page.screenshot({ path: `${out}/${prefix}-t0.png`, fullPage: true });
  await page.waitForTimeout(10000);
  const r1 = await rows(page);
  const c1 = await canvasInk(page);
  await page.screenshot({ path: `${out}/${prefix}-t10.png`, fullPage: true });
  const ws = await page.getByText('WS 연결', { exact: true }).count();
  const ts = (t) => (t.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/) || [''])[0];
  const updated = r0.filter((t, i) => r1[i] && ts(t) && ts(r1[i]) > ts(t)).length;
  const checks = {
    rows8: r0.length === 8 && r1.length === 8,
    allUpdated: updated === 8,
    canvasInk: c0.ink > 0 && c1.ink > 0,
    canvasChanged: c0.hash !== c1.hash,
    wsConnected: ws > 0,
    noPageErrors: errors.length === 0,
  };
  const pass = Object.values(checks).every(Boolean);
  process.stdout.write(
    `${JSON.stringify({ pass, checks, updated, rowsT0: r0, rowsT10: r1, canvas: [c0, c1], errors })}\n`,
  );
  await browser.close();
  process.exitCode = pass ? 0 : 1;
})();
