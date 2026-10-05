// EXP-12 S5 — WebSocket 연결 계단(수백) · 티어 M+ 10 Hz · SW-07 100/0. 대상 ws://api:3000/ws/realtime · Origin 허용 오리진.
// S4 시나리오(scripts/lab/s4/k6-ws.js)와 같은 모양에 연결 실패 · 세션 수 계수를 더했다 — 동시 연결 상한 판독용.
// 계단: STAGES="100:5,100:60,200:5,200:60"(연결 수:초) — VU 하나가 연결 하나 · 연결마다 DEVICES개 설비 구독(VU 번호로 흩는다)
import { Counter } from 'k6/metrics';
import ws from 'k6/ws';

const frames = new Counter('ws_rt_frames');
const closes4413 = new Counter('ws_closed_4413');
const connectFailed = new Counter('ws_connect_failed');
const opened = new Counter('ws_opened');
const STAGES = (__ENV.STAGES || '10:60').split(',').map((s) => {
  const [t, d] = s.split(':');
  return { target: Number(t), duration: `${d}s` };
});
const DEVICES = Number(__ENV.DEVICES || 5);
const NDEV = Number(__ENV.NDEV || 50);
const HOLD = Number(__ENV.HOLD || 30);

export const options = {
  scenarios: { conn: { executor: 'ramping-vus', startVUs: 0, stages: STAGES, gracefulRampDown: '5s', gracefulStop: '5s' } },
};

export default function () {
  const devs = Array.from({ length: DEVICES }, (_, i) => ((__VU * DEVICES + i) % NDEV) + 1);
  const res = ws.connect('ws://api:3000/ws/realtime', { headers: { Origin: 'http://localhost:13001' } }, (s) => {
    s.on('open', () => {
      opened.add(1);
      s.send(JSON.stringify({ type: 'subscribe', devices: devs }));
    });
    s.on('message', (m) => {
      const t = m.slice(0, 20);
      if (t.includes('"rt"')) frames.add(1);
      else if (t.includes('"ping"')) s.send(JSON.stringify({ type: 'pong', t: JSON.parse(m).t }));
    });
    s.on('close', (code) => {
      if (code === 4413) closes4413.add(1);
    });
    s.setTimeout(() => s.close(1000), HOLD * 1000);
  });
  if (!res || res.status !== 101) connectFailed.add(1);
}
