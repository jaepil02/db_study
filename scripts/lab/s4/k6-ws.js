// S4 WebSocket 연결 계단 — EXP-12(SW-07) · EXP-11 고정 연결. 대상 ws://api:3000/ws/realtime · Origin 허용 오리진.
// 계단: STAGES="10:60,50:60,100:60"(연결 수:초) — VU 하나가 연결 하나 · 연결마다 DEVICES개 설비 구독(VU 번호로 흩는다)
import ws from 'k6/ws';
import { Counter } from 'k6/metrics';

const frames = new Counter('ws_rt_frames');
const closes4413 = new Counter('ws_closed_4413');
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
  ws.connect('ws://api:3000/ws/realtime', { headers: { Origin: 'http://localhost:3001' } }, (s) => {
    s.on('open', () => s.send(JSON.stringify({ type: 'subscribe', devices: devs })));
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
}
