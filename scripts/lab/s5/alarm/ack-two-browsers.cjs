// EXP-33 ACK 반영 지연(두 브라우저) — 정본 10_observability/02_instrumentation.md §확인(ACK) 신호 부재의 계측
//   "실제 전파 지연 | EXP-33에서 두 브라우저 — 한쪽 확인 시각 · 다른 쪽 표시 시각 | 측정 기록 | 3계층 미확인"
//   ch:alarm은 열림 · 닫힘만 싣고 확인은 싣지 않는다 — 다른 탭의 확인 표시는 목록 재조회 때다(08_screen/05 §실시간 겹침 · 재조회 계기 = 겹침 TTL 경과).
// 방법: 한 브라우저 프로세스의 격리된 두 컨텍스트 A · B(저장소 · WebSocket 연결이 따로)가 같은 이력 탭(같은 조회 조건 — 목록 캐시 키가 같다)을 연다.
//   A가 행의 확인 버튼을 누른다(화면 조작) → A의 확인 응답 수신 시각 = 확인 시각 · B의 같은 행에 확인자 표시가 나타난 시각 = 표시 시각.
//   행 ↔ eventId는 각 탭이 받은 목록 응답의 items 순서(화면은 items를 그대로 그린다)로 잇는다. 두 탭의 alarm 프레임 수신 시각 · B의 목록 재조회 시각도 남긴다.
// 사용: PW_CORE=… CHROME=… ACK_MARK=… WEB=http://localhost:13001 API=http://127.0.0.1:13000 RULES=1,2,3 TRIALS=3 TIMEOUT_S=90 LIMIT_S=420 node ack-two-browsers.cjs <출력 json>
// 접속 주소는 localhost(127.0.0.1은 CORS · WS Origin 거부). 브라우저 종료가 멈추는 사례 — 닫기 5초 상한 뒤 강제 종료(러너가 표지 인자로 남은 프로세스를 거둔다).
const fs = require('node:fs');
const { chromium } = require(process.env.PW_CORE);
const OUT = process.argv[2];
const WEB = process.env.WEB || 'http://localhost:13001';
const API = process.env.API || 'http://127.0.0.1:13000';
const RULES = new Set((process.env.RULES || '').split(',').filter(Boolean).map(Number));
const TRIALS = Number(process.env.TRIALS || 3);
const TIMEOUT_MS = Number(process.env.TIMEOUT_S || 90) * 1000;
const LIMIT_MS = Number(process.env.LIMIT_S || 420) * 1000;
const PATH = '/alarms?tab=history&range=1d';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {
  method: 'two isolated contexts · same history tab · A clicks 확인 · B row shows 확인자',
  url: WEB + PATH, startedMs: Date.now(), trials: [], framesA: [], framesB: [], framesDetailA: [], framesDetailB: [],
  listFetchesB: [], error: null,
};
let browser = null;
let written = false;
function write() {
  if (written) return;
  written = true;
  out.endedMs = Date.now();
  fs.writeFileSync(OUT, JSON.stringify(out));
}
// 전체 상한 — 넘으면 지금까지를 쓰고 끝낸다(러너 호출 시간 한도 안)
setTimeout(() => {
  out.error = out.error || `limit ${LIMIT_MS} ms`;
  write();
  process.exit(3);
}, LIMIT_MS).unref();

// 탭 준비 — alarm 프레임 수신 시각(WebSocket 훅 → exposeBinding으로 받는 즉시 Node 쪽 배열에 쌓는다 — 상한 초과 · 예외에도 ack.json에 남는다)
//   · 목록 응답(첫 페이지)의 items
async function tab(ctx, frames, detail, fetches) {
  await ctx.exposeBinding('__exp33Frame', (_src, eventId, transition) => {
    const at = Date.now();
    frames.push(at);
    detail.push([at, eventId, transition]);
  });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    const Orig = window.WebSocket;
    window.WebSocket = class extends Orig {
      constructor(...a) {
        super(...a);
        this.addEventListener('message', (e) => {
          try {
            const m = JSON.parse(e.data);
            if (m && m.type === 'alarm') window.__exp33Frame(m.eventId, m.transition);
          } catch {}
        });
      }
    };
  });
  const st = { items: null, itemsAt: 0 };
  p.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/bff/alarms/events?') || u.includes('cursor=') || r.request().method() !== 'GET') return;
    const at = Date.now();
    try {
      const body = await r.json();
      st.items = body.items || [];
      st.itemsAt = at;
      if (fetches) fetches.push([at, r.status(), st.items.length]);
    } catch {
      if (fetches) fetches.push([at, r.status(), null]);
    }
  });
  st.page = p;
  return st;
}

// 화면 행 i의 규칙 링크 · 확인 칸 문자열
const rowsOf = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('tbody tr')].map((tr) => {
      const a = tr.querySelector('a[href^="/alarms/rules/"]');
      const cells = tr.querySelectorAll('td');
      const last = cells[cells.length - 1];
      const btn = last ? [...last.querySelectorAll('button')].find((b) => b.innerText.trim() === '확인') : null;
      return {
        rule: a ? Number(a.getAttribute('href').split('/').pop()) : null,
        ack: last ? last.innerText.trim() : '',
        enabled: !!btn && !btn.disabled,
      };
    }),
  );

async function freshActiveUnacked() {
  try {
    const r = await fetch(`${API}/api/v1/alarms/events?state=ACTIVE&acked=false`);
    if (!r.ok) return null;
    const b = await r.json();
    return new Set((b.items || []).map((i) => i.eventId));
  } catch {
    return null;
  }
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROME, args: [`--exp33-ack-marker=${process.env.ACK_MARK}`] });
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const A = await tab(ctxA, out.framesA, out.framesDetailA, null);
  const B = await tab(ctxB, out.framesB, out.framesDetailB, out.listFetchesB);
  // 같은 분에 연다 — 이력 탭의 to는 연 순간의 분 경계라 두 탭이 같은 조회 조건(같은 목록 캐시 필드)을 가져야 한다
  while (new Date().getSeconds() > 45) await sleep(1000);
  await Promise.all([A.page.goto(WEB + PATH), B.page.goto(WEB + PATH)]);
  await Promise.all([A.page.waitForSelector('tbody tr', { timeout: 30000 }), B.page.waitForSelector('tbody tr', { timeout: 30000 })]);
  out.loadedMs = Date.now();
  const tried = new Set();
  for (let attempt = 0; out.trials.filter((t) => t.status === 200).length < TRIALS && attempt < TRIALS * 3; attempt++) {
    const live = await freshActiveUnacked();
    const domA = await rowsOf(A.page);
    const itemsA = A.items || [];
    const itemsB = B.items || [];
    let idx = -1;
    for (let i = 0; i < itemsA.length && i < domA.length; i++) {
      const it = itemsA[i];
      if (tried.has(it.eventId) || !RULES.has(it.ruleId) || it.ackedAt || it.state !== 'ACTIVE') continue;
      if (domA[i].rule !== it.ruleId || !domA[i].enabled) continue;
      if (live && !live.has(it.eventId)) continue;
      if (!itemsB.some((x) => x.eventId === it.eventId && !x.ackedAt)) continue;
      idx = i;
      break;
    }
    if (idx < 0) {
      out.trials.push({ status: null, reason: 'no candidate', at: Date.now() });
      await sleep(10000);
      continue;
    }
    const ev = itemsA[idx];
    tried.add(ev.eventId);
    const t = { eventId: ev.eventId, ruleId: ev.ruleId, occurredAt: ev.occurredAt, rowIndexA: idx, inProgress: true };
    out.trials.push(t); // 먼저 싣는다 — 상한 · 예외로 끝나도 진행 중 시도가 남는다
    const respP = A.page.waitForResponse((r) => r.url().includes(`/bff/alarms/events/${ev.eventId}/ack`), { timeout: 15000 });
    t.clickMs = Date.now();
    await A.page.locator('tbody tr').nth(idx).getByRole('button', { name: '확인', exact: true }).click();
    try {
      const r = await respP;
      t.respMs = Date.now();
      t.status = r.status();
    } catch (e) {
      t.status = null;
      t.reason = `no ack response — ${e.message}`;
    }
    if (t.status !== 200) {
      delete t.inProgress;
      await sleep(2000);
      continue;
    }
    // A — 쓴 탭은 곧바로 재조회한다(자기 확인 표시)
    for (const until = Date.now() + 10000; Date.now() < until; ) {
      const i = (A.items || []).findIndex((x) => x.eventId === ev.eventId);
      if (i >= 0 && (A.items[i].ackedAt || null)) {
        const d = await rowsOf(A.page);
        if (d[i] && d[i].ack.includes('사용자 #')) {
          t.aDomMs = Date.now();
          break;
        }
      }
      await sleep(50);
    }
    // B — 같은 이벤트 행에 확인자 표시가 나타날 때까지(재조회 계기는 겹침 TTL 경과뿐)
    const t0 = Date.now();
    for (; Date.now() - t0 < TIMEOUT_MS; ) {
      const items = B.items || [];
      const i = items.findIndex((x) => x.eventId === ev.eventId);
      if (i >= 0 && items[i].ackedAt) {
        if (!t.bFetchMs) t.bFetchMs = B.itemsAt;
        const d = await rowsOf(B.page);
        if (d[i] && d[i].rule === ev.ruleId && d[i].ack.includes('사용자 #')) {
          t.bDomMs = Date.now();
          break;
        }
      }
      await sleep(100);
    }
    t.waitedMs = Date.now() - t0;
    delete t.inProgress;
    await sleep(2000);
  }
})()
  .catch((e) => {
    out.error = e.message;
  })
  .finally(async () => {
    write();
    if (browser) await Promise.race([browser.close().catch(() => {}), sleep(5000)]);
    process.exit(0);
  });
