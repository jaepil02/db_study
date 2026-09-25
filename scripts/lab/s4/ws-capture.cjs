// EXP-11 프레임 내용 수집 — 설비 1~5 구독 · SECONDS초 동안 rt 프레임의 모양을 요약한다(두 팔 대조용)
// 요약: 프레임 수 · 설비 집합 · 설비별 태그 집합 크기 · 튜플 길이 집합 · 태그별 ts 역행 수 · 수신 − ts 지연 분위수(수집 · 적재 포함 — 참고)
// 사용: node scripts/lab/s4/ws-capture.cjs <초>  (ws 모듈은 apps/api의 의존성을 쓴다)
const path = require('node:path');
const WebSocket = require(path.join(__dirname, '../../../apps/api/node_modules/ws'));
const SEC = Number(process.argv[2] || 30);
const ws = new WebSocket('ws://127.0.0.1:3000/ws/realtime', { headers: { origin: 'http://localhost:3001' } });
const tags = new Map();
const lastTs = new Map();
const tupleLens = new Set();
const lags = [];
let frames = 0;
let backwards = 0;
ws.on('open', () => ws.send(JSON.stringify({ type: 'subscribe', devices: [1, 2, 3, 4, 5] })));
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.type === 'ping') return ws.send(JSON.stringify({ type: 'pong', t: m.t }));
  if (m.type !== 'rt') return;
  frames++;
  const now = Date.now();
  for (const dev of m.devices) {
    const s = tags.get(dev.deviceId) ?? new Set();
    for (const t of dev.tags) {
      tupleLens.add(t.length);
      s.add(t[0]);
      const k = `${dev.deviceId}:${t[0]}`;
      if ((lastTs.get(k) ?? 0) > t[1]) backwards++;
      lastTs.set(k, t[1]);
      lags.push(now - t[1]);
    }
    tags.set(dev.deviceId, s);
  }
});
setTimeout(() => {
  lags.sort((a, b) => a - b);
  const q = (p) => (lags.length ? lags[Math.min(lags.length - 1, Math.floor(p * lags.length))] : null);
  console.log(JSON.stringify({
    frames,
    devices: [...tags.keys()].sort((a, b) => a - b),
    tagsPerDevice: Object.fromEntries([...tags].map(([k, v]) => [k, v.size])),
    tupleLens: [...tupleLens],
    backwards,
    recvMinusTsMs: { p50: q(0.5), p95: q(0.95), n: lags.length },
  }));
  ws.close(1000);
  process.exit(0);
}, SEC * 1000);
