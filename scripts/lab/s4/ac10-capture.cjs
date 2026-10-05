// AC-10 WebSocket 재연결 — 서버 소켓 종료(api 컨테이너 정지 DOWN초 → 기동) 뒤 복구
// 판정: 재연결 간격이 지수로 늘고 상한(30초)에서 멈춘다 · 재연결 직후 REST 최신값 요청 1건 · 화면 값 = rt:latest
// (재연결 REST 응답의 태그마다 ts가 직후 읽은 Redis Hash보다 새롭지 않고 두 읽기 경과 + 한 주기 안 — 값은 rt:latest에서 온다)
// 사용: PLAYWRIGHT_CORE=… node scripts/lab/s4/ac10-capture.cjs <DOWN초>
const { chromium } = require(process.env.PLAYWRIGHT_CORE);
const { execSync } = require('node:child_process');
const DOWN = Number(process.argv[2] || 75);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.addInitScript(() => {
    const Orig = window.WebSocket;
    window.__ws = [];
    window.WebSocket = class extends Orig {
      constructor(...a) {
        super(...a);
        const rec = { created: Date.now(), opened: null, closed: null, code: null };
        window.__ws.push(rec);
        this.addEventListener('open', () => { rec.opened = Date.now(); });
        this.addEventListener('close', (e) => { rec.closed = Date.now(); rec.code = e.code; });
      }
    };
  });
  const rest = [];
  p.on('response', async (r) => {
    if (r.url().includes('/api/v1/realtime/devices/1/tags')) {
      try { rest.push({ at: Date.now(), status: r.status(), body: await r.json() }); } catch { rest.push({ at: Date.now(), status: r.status() }); }
    }
  });
  await p.goto('http://localhost:13001/realtime/1');
  await sleep(5000);
  const tStop = Date.now();
  execSync('docker stop -t 30 db_study-api-1');
  const tStopped = Date.now();
  const T = Date.now();
  while (Date.now() - T < DOWN * 1000) await sleep(1000);
  execSync('docker start db_study-api-1');
  const tStart = Date.now();
  let up = null;
  for (let i = 0; i < 150; i++) {
    const ws = await p.evaluate(() => window.__ws);
    const last = ws[ws.length - 1];
    if (last && last.opened && last.created > tStart - 1000) { up = last; break; }
    await sleep(1000);
  }
  // 재연결 REST 응답이 오는 즉시 Hash를 읽는다 — 두 읽기 사이 경과만큼만 Redis가 앞설 수 있다
  for (let i = 0; i < 100 && up && !rest.some((r) => r.at >= up.opened); i++) await sleep(50);
  const tHash = Date.now();
  const hash = execSync('docker exec db_study-redis-1 redis-cli HGETALL rt:latest:1').toString().trim().split('\n');
  await sleep(3000);
  const ws = await p.evaluate(() => window.__ws);
  const afterClose = ws.filter((w) => w.created >= tStop);
  const gaps = afterClose.slice(1).map((w, i) => w.created - (afterClose[i].closed ?? afterClose[i].created));
  const restAfter = up ? rest.filter((r) => r.at >= up.opened) : [];
  // 화면 값 대조 — 재연결 REST 응답의 각 태그가 Redis Hash의 같은 태그보다 새롭지 않고, 차이는 한 주기 이하
  const redis = {};
  for (let i = 0; i + 1 < hash.length; i += 2) redis[hash[i]] = hash[i + 1].split(',').map(Number);
  const slack = restAfter[0] ? tHash - restAfter[0].at + 1000 : 0;
  const cmp = (restAfter[0]?.body?.items ?? []).map((it) => {
    const r = redis[String(it.tagId)];
    return r ? { tagId: it.tagId, lagMs: r[0] - it.ts, same: r[0] === it.ts && r[1] === it.value } : { tagId: it.tagId, missing: true };
  });
  const out = {
    downS: DOWN, stopMs: tStopped - tStop,
    attempts: afterClose.map((w) => ({ createdMsFromStop: w.created - tStop, opened: w.opened !== null, code: w.code })),
    gapsMs: gaps,
    reconnectedMsAfterStart: up ? up.opened - tStart : null,
    restAfterReconnect: restAfter.length,
    restStatus: restAfter.map((r) => r.status),
    valueCheck: { items: cmp.length, slackMs: slack, source: restAfter[0]?.body?.meta?.source ?? null, withinSlack: cmp.filter((c) => !c.missing && c.lagMs >= 0 && c.lagMs <= slack).length, exactSame: cmp.filter((c) => c.same).length, missing: cmp.filter((c) => c.missing).length },
  };
  const g = out.gapsMs;
  out.backoffDoubling = g.length >= 3 && g.slice(0, 5).every((x, i) => i === 0 || x >= g[i - 1] * 1.5 || x >= 29000);
  out.capped = g.some((x) => x >= 29000 && x <= 32000) && g.every((x) => x <= 32000);
  out.pass = out.backoffDoubling && out.capped && out.restAfterReconnect === 1 && out.valueCheck.items > 0 && out.valueCheck.withinSlack === out.valueCheck.items;
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => { console.log(JSON.stringify({ pass: false, error: e.message })); process.exit(0); });
