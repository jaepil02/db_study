// AC-06 캐시 정합성 — 세 층(API 직결 · BFF 경유 · 브라우저 쓴 탭 · 다른 탭)에서 "무효화 사건 이후의 첫 읽기"가 새 값인가(03_requirements/14 §캐시 정합성 판정)
// 쓰기는 쓴 탭(A)의 ADM-MASTER 편집 폼으로 한다(BFF 경유 PATCH). 다른 탭(B)은 같은 설비의 태그 탭을 열어 둔다.
// 사건: API Redis 층 — 쓰기 응답 수신 · Dictionary 층 — mst_dict_reloads_total 증가(④ 완료) · BFF — 쓰기 응답 · A — 쓰기 응답 · B — cacheinv 수신
// 사용: PLAYWRIGHT_CORE=… node scripts/lab/s4/ac06-capture.cjs <tagId> <새 이름>
const { chromium } = require(process.env.PLAYWRIGHT_CORE);
const W = 'http://localhost:3001';
const A = 'http://127.0.0.1:3000';
const TAG = Number(process.argv[2]);
const NAME = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const metric = async (n) =>
  (await (await fetch(`${A}/metrics`)).text()).split('\n').filter((l) => l.startsWith(n)).reduce((a, l) => a + Number(l.split(' ').pop()), 0);
const iso = (ms) => new Date(ms + 9 * 3600e3).toISOString().replace('Z', '+09:00');

(async () => {
  const tag = await (await fetch(`${A}/api/v1/tags/${TAG}`)).json();
  const dev = tag.deviceId;
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const open = async () => {
    const p = await ctx.newPage();
    const reads = [];
    p.on('response', async (r) => {
      if (r.url().includes('/bff/master/tags')) {
        try { reads.push({ at: Date.now(), body: await r.text() }); } catch {}
      }
    });
    const sig = [];
    p.on('websocket', (ws) => ws.on('framereceived', (f) => { if (String(f.payload).includes('"cacheinv"')) sig.push({ at: Date.now(), payload: String(f.payload) }); }));
    await p.goto(`${W}/admin/master/devices/${dev}`);
    await p.getByRole('button', { name: '태그', exact: true }).click();
    await p.waitForSelector(`text=${tag.tagCode}`);
    return { p, reads, sig };
  };
  const a = await open();
  const b = await open();
  await sleep(1500);
  const reloads0 = await metric('mst_dict_reloads_total');
  // 쓴 탭 A — 편집 폼으로 이름만 바꿔 저장
  const row = a.p.locator('tr', { hasText: tag.tagCode });
  await row.getByRole('button', { name: '편집' }).click();
  const nameInput = a.p.locator('label', { hasText: '태그명' }).locator('input');
  await nameInput.fill(NAME);
  const [resp] = await Promise.all([
    a.p.waitForResponse((r) => r.url().includes(`/bff/master/tags/${TAG}`) && r.request().method() === 'PATCH'),
    a.p.getByRole('button', { name: '저장' }).click(),
  ]);
  const tWrite = Date.now();
  // API 직결 Redis 층 — 응답 뒤 첫 읽기(단건 · 목록)
  const direct1 = (await (await fetch(`${A}/api/v1/tags/${TAG}`)).json()).tagName;
  const directList = (await (await fetch(`${A}/api/v1/tags?deviceId=${dev}`)).json()).items.find((t) => t.tagId === TAG).tagName;
  // BFF 층 — 응답 뒤 첫 읽기
  const bff = (await (await fetch(`${W}/bff/master/tags?deviceId=${dev}&includeInactive=false`)).json()).items.find((t) => t.tagId === TAG).tagName;
  // Dictionary 층 — ④ 완료(재적재 계수 증가) 뒤 첫 시계열 조회(최근 구간 — cache:q를 거치지 않는다)
  let tReload = null;
  for (let i = 0; i < 100; i++) { if ((await metric('mst_dict_reloads_total')) > reloads0) { tReload = Date.now(); break; } await sleep(20); }
  const now = Date.now();
  const ts = await (await fetch(`${A}/api/v1/timeseries/query`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tagIds: [TAG], from: iso(now - 120e3), to: iso(now) }) })).json();
  const dictName = ts.series[0]?.tagName;
  // 브라우저 — A: 응답 뒤 첫 BFF 목록 읽기 · B: 신호 뒤 첫 BFF 목록 읽기 · 둘 다 화면에 새 이름
  await a.p.waitForSelector(`td:has-text("${NAME}")`, { timeout: 5000 }).catch(() => null);
  await b.p.waitForSelector(`td:has-text("${NAME}")`, { timeout: 5000 }).catch(() => null);
  const firstAfter = (reads, t) => reads.find((r) => r.at >= t);
  const aRead = firstAfter(a.reads, tWrite);
  const bSig = b.sig[0] ?? null;
  const bRead = bSig ? firstAfter(b.reads, bSig.at) : null;
  const has = (r) => (r ? r.body.includes(`"tagName":"${NAME}"`) : null);
  const out = {
    tagId: TAG, deviceId: dev, newName: NAME, writeStatus: resp.status(),
    api: { tagSingle: direct1 === NAME, tagList: directList === NAME },
    dictionary: { reloadObservedMsAfterWrite: tReload ? tReload - tWrite : null, firstQueryName: dictName, ok: dictName === NAME },
    bff: { firstList: bff === NAME },
    browserWriter: { firstReadAfterResponse: has(aRead), readLagMs: aRead ? aRead.at - tWrite : null, rendered: (await a.p.locator(`td:has-text("${NAME}")`).count()) > 0 },
    browserOther: { signal: bSig ? JSON.parse(bSig.payload).keys : null, signalMsAfterWrite: bSig ? bSig.at - tWrite : null, firstReadAfterSignal: has(bRead), rendered: (await b.p.locator(`td:has-text("${NAME}")`).count()) > 0 },
  };
  out.pass = out.writeStatus === 200 && out.api.tagSingle && out.api.tagList && out.dictionary.ok && out.bff.firstList &&
    out.browserWriter.firstReadAfterResponse && out.browserWriter.rendered && out.browserOther.firstReadAfterSignal && out.browserOther.rendered;
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => { console.log(JSON.stringify({ pass: false, error: e.message })); process.exit(0); });
