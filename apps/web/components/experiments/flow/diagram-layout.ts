// /monitoring 흐름도 좌표 — 노드 12 · Redis 기둥 · 간선 · 라벨 자리 · 점이 머무는 자리를 한 곳에 둔다(그리기는 flow-diagram.tsx).
// 설계 .omc/plans/web-junior-redesign.md §8 — Redis를 "서버와 DB 사이 한 기둥"으로 그린다. 오른쪽 저장 열은 진짜 DB 2(ClickHouse · PostgreSQL)뿐.
// §9 — 세 번째 줄 "조회 요청": 조회 요청 → 기둥 ⑤ 조회 사본(캐시) → 있으면 바로 응답 · 없으면 ClickHouse · PostgreSQL에서 읽어 와 ⑤에 사본 담고 응답.
//   조회는 워커가 처리하지 않는다(api가 직접 Redis를 먼저 본다) — 조회 줄에는 "누가 처리하나" 노드가 없고, DB로 가는 선은 처리기 노드 아래로 지난다.
//   조회는 flow 프레임 요약이 없어 점을 그리지 않는다(선 굵기 · 숫자로만) — 조회 줄 노드에는 점 길을 비워 두지 않는다.
// 노드 12 = 어디서 오나 3 + Redis 기둥 칸 5(① 센서 대기줄 · ② 지금 값 · 알람 상태 · ③ 업무 대기줄 · ④ 옛 사본 지움 · 결과 알림 · ⑤ 조회 사본) + 누가 처리하나 2 + DB 2.
// 브라우저 없이 겹침을 막으려고 글자 폭을 보수적으로 어림하는 함수(textWidth)와 상자 계산(labelBox · nodeTextBoxes)을 함께 두고,
// test/flow-layout.test.ts가 최악의 문구(6자리 초당 값 · 10억 행 누적)로 라벨 ↔ 노드 · 라벨 ↔ 라벨 · 노드 글자 ↔ 점 자리의 겹침 0을 검사한다.
//
// 배치 근거(viewBox 1132 × 474 — 1440 × 900에서 흐름도 안쪽 약 1,126 × 454(진행 띠 있음) ~ 494(없음) · 높이 쪽으로 맞춰 0.96 ~ 1배)
// ① 맨 위 y 14에 단 머리 넷(어디서 오나 · Redis — 서버와 DB 사이 중간층 · 누가 처리하나 · 어디에 저장하나) — 기둥 틀은 y 24부터 · 칸은 y 44부터.
// ② 기둥 칸 높이 76 · 칸 사이 6 — 글자 3줄 + 아래 점 길 13이 들어가는 가장 작은 높이. 센서 줄은 ①, 업무 줄은 ③, 조회 줄은 ⑤ 높이에 맞춘다.
// ③ 노드 사이 틈 84 이상 — 간선 라벨 "999,999개/초"(어림 82)가 틈 안에 들어간다.
// ④ 처리기 → DB 통로 134 · ClickHouse 선은 점 길 높이 그대로 · 세로 버스 x 744 · 760 — 긴 라벨(알람 · 비교용 사본)은 두 줄로 통로 안에 넣는다.
// ⑤ 줄 노드 · 기둥 칸은 아래 13px을 점 길(lane)로 비워 둔다 — 글자는 위쪽에 모으고 점은 길을 따라 움직여 글자 위를 지나지 않는다.
// ⑥ DB 노드의 점 자리는 왼쪽 가장자리 + 14 — 글자는 가운데 맞춤이고 가장 긴 줄 폭이 상자 폭 − 2 × 21 이하라 점(반지름 ≤ 7)과 만나지 않는다.
// ⑦ 간선 최대 굵기 6 · 화살촉은 굵기와 무관한 고정 크기(userSpaceOnUse).
// ⑧ 조회 줄의 DB 선 — ⑤ 오른쪽에서 처리기 노드 아래(y 396)로 지나 PostgreSQL은 바닥으로, ClickHouse는 DB 열 오른쪽 버스(x 1124)를 타고 오른쪽 가장자리로 든다.
//    ⑤ 쪽 끝에도 화살촉 — "읽어 와 사본 담기"(가고 오는 길을 선 하나로).
// ⑨ 대기줄 없이 바로 저장(비교 실험)은 업무 점 길(y 271)을 곧게 지난다 — 꺼진 칸(점선) 위로 그려 "거치지 않고 지나감"을 보인다(점도 같은 직선).

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const VIEW_W = 1132;
export const VIEW_H = 474;

/** 글자 크기 — 노드 제목 · 노드 줄 · 간선 라벨 · 단 머리 */
export const FONT = { title: 13, line: 11, label: 11, column: 12 } as const;
/** 노드 줄 간격 · 라벨 여러 줄 간격 */
export const LINE_H = 15;
export const LABEL_LINE_H = 13;
/** 점 반지름 상한 — lib/flow batchDotRadius의 상한과 같다 */
export const DOT_R_MAX = 7;

export type BoxId =
  | 'src'
  | 'bizSrc'
  | 'readSrc'
  | 'stream'
  | 'latest'
  | 'bizStream'
  | 'reply'
  | 'readCache'
  | 'worker'
  | 'bizWorker'
  | 'ch'
  | 'pg';

/** Redis 기둥 칸 다섯의 세로 자리 — ① 센서 대기줄 · ② 지금 값 · ③ 업무 대기줄 · ④ 결과 알림 · ⑤ 조회 사본 */
const CELL_H = 76;
const CELL_GAP = 6;
const cellY = (i: number) => 44 + i * (CELL_H + CELL_GAP); // 44 · 126 · 208 · 290 · 372
const ROW_A = { y: cellY(0), h: CELL_H };
const ROW_B = { y: cellY(2), h: CELL_H };
const ROW_C = { y: cellY(4), h: CELL_H };
export const LANE_RESERVE = 22;
const lane = (y: number) => y + CELL_H - 13;
export const LANE_A = lane(cellY(0)); // 107
export const LANE_B = lane(cellY(2)); // 271

/** Redis 기둥 틀 — 칸 다섯을 감싼다(노드가 아니다 · 머리 한 줄 · 바닥에 메모리 크기) */
export const PILLAR: Box = { x: 242, y: 24, w: 224, h: 446 };
const CELL_X = PILLAR.x + 8;
const CELL_W = PILLAR.w - 16;
export const PILLAR_HEAD_Y = 38;
export const PILLAR_FOOT_Y = 462;

export const BOX: Record<BoxId, Box> = {
  src: { x: 8, w: 150, ...ROW_A },
  bizSrc: { x: 8, w: 150, ...ROW_B },
  readSrc: { x: 8, w: 150, ...ROW_C },
  stream: { x: CELL_X, w: CELL_W, y: cellY(0), h: CELL_H },
  latest: { x: CELL_X, w: CELL_W, y: cellY(1), h: CELL_H },
  bizStream: { x: CELL_X, w: CELL_W, y: cellY(2), h: CELL_H },
  reply: { x: CELL_X, w: CELL_W, y: cellY(3), h: CELL_H },
  readCache: { x: CELL_X, w: CELL_W, y: cellY(4), h: CELL_H },
  worker: { x: 550, w: 176, ...ROW_A },
  bizWorker: { x: 550, w: 176, ...ROW_B },
  ch: { x: 860, y: 44, w: 244, h: 120 },
  pg: { x: 860, y: 208, w: 244, h: 152 },
};

/** 점 길이 있는 노드인가(줄 노드 · 기둥 칸) — DB 노드 · 조회 줄(점 없음)은 가운데 맞춤 */
export const HAS_LANE: Record<BoxId, boolean> = {
  src: true,
  bizSrc: true,
  readSrc: false,
  stream: true,
  latest: true,
  bizStream: true,
  reply: true,
  readCache: false,
  worker: true,
  bizWorker: true,
  ch: false,
  pg: false,
};

/** 단 머리 넷 — 가운데 x */
export const COLUMNS: readonly { x: number; text: string }[] = [
  { x: BOX.src.x + BOX.src.w / 2, text: '어디서 오나' },
  { x: PILLAR.x + PILLAR.w / 2, text: 'Redis — 서버와 DB 사이 중간층' },
  { x: BOX.worker.x + BOX.worker.w / 2, text: '누가 처리하나' },
  { x: BOX.ch.x + BOX.ch.w / 2, text: '어디에 저장하나' },
];
export const COLUMN_Y = 14;

/** 줄 가름(점선) — 기둥 밖 두 토막(어디서 오나 · 누가 처리하나) · ②와 ③ 사이 · ④와 ⑤ 사이 높이 */
export const DIVIDER_YS: readonly number[] = [cellY(2) - CELL_GAP / 2, cellY(4) - CELL_GAP / 2]; // 205 · 369
export const DIVIDERS: readonly [number, number][] = [
  [BOX.src.x, PILLAR.x - 8],
  [PILLAR.x + PILLAR.w + 8, BOX.worker.x + BOX.worker.w],
];

/** 업무 줄 옆 한 줄 — ClickHouse와 PostgreSQL 사이(업무 데이터가 왜 ClickHouse로 가지 않는지) · 두 줄 가운데 맞춤 */
export const BIZ_NOTE = {
  spot: { x: BOX.ch.x + BOX.ch.w / 2 + 12, y: 182, align: 'middle' as const },
  lines: ['업무 데이터는 ClickHouse로 보내지 않아요', '이유는 성능 비교 화면 오른쪽'],
};

const laneX = (id: BoxId) => BOX[id].x + BOX[id].w / 2;
const laneY = (id: BoxId) => BOX[id].y + BOX[id].h - 13;
export const STORE_DOT_X = BOX.ch.x + 14;
/** 기둥 칸 안 오른쪽 · 왼쪽 점 자리 — 글자(가운데 맞춤) 아래 점 길 위 */
const CELL_RIGHT = CELL_X + CELL_W - 40;
const CELL_LEFT = CELL_X + 40;

/** 배치 점이 머무는 자리 — 접은 단계(XACK · 알람 판정)는 처리기 노드 안 점 길 위 · 최신값은 기둥 ② */
export const BATCH_AT = {
  src: { x: laneX('src'), y: LANE_A },
  stream: { x: laneX('stream'), y: LANE_A },
  worker: { x: laneX('worker'), y: LANE_A },
  alarm: { x: laneX('worker') - 30, y: LANE_A },
  xack: { x: laneX('worker') + 30, y: LANE_A },
  ch: { x: STORE_DOT_X, y: LANE_A },
  latest: { x: CELL_RIGHT, y: laneY('latest') },
  pgCopy: { x: STORE_DOT_X, y: 336 },
} as const satisfies Record<string, Pt>;

/**
 * 업무 점이 머무는 자리 — 하나씩 처리 → PostgreSQL(저장) → 기둥 ④(옛 사본 지움 → 결과 알림) → 업무 요청(결과 받음).
 * lib/flow bizPlan의 cache(옛 사본 지움) · result(결과 알림) 두 자리가 모두 ④ 칸 점 길 위다(오른쪽 → 왼쪽).
 */
export const BIZ_AT = {
  api: { x: laneX('bizSrc'), y: LANE_B },
  bizStream: { x: laneX('bizStream'), y: LANE_B },
  bizWorker: { x: laneX('bizWorker'), y: LANE_B },
  pgTx: { x: STORE_DOT_X, y: LANE_B },
  cache: { x: CELL_RIGHT, y: laneY('reply') },
  result: { x: CELL_LEFT, y: laneY('reply') },
} as const satisfies Record<string, Pt>;

/** 업무 표지(✕ 거절 · ⚠ 저장 못 함 · ⌛ 시간 초과 · ↺ 이미 처리됨) 자리 — 노드 글자와 겹치지 않는 귀퉁이(왼쪽 맞춤) · 요청 노드는 폭이 좁아 노드 바로 아래 */
export const MARK_AT = {
  api: { x: BIZ_AT.api.x + 10, y: ROW_B.y + ROW_B.h + 14 },
  bizWorker: { x: BIZ_AT.bizWorker.x + 10, y: LANE_B + 4 },
  pgTx: { x: BOX.pg.x + 8, y: BOX.pg.y + 15 },
} as const satisfies Record<string, Pt>;
/** 알람 켜짐 · 꺼짐 표지 자리 — PostgreSQL 노드 오른쪽 위(오른쪽 맞춤) */
export const ALARM_AT: Pt = { x: BOX.pg.x + BOX.pg.w - 8, y: BOX.pg.y + 15 };

export type Align = 'start' | 'middle' | 'end';
export interface LabelSpot {
  /** 첫 줄 글자 바탕선 */
  x: number;
  y: number;
  align: Align;
}

export type EdgeId =
  | 'src-stream'
  | 'stream-worker'
  | 'worker-ch'
  | 'worker-latest'
  | 'worker-pg-alarm'
  | 'worker-pg-copy'
  | 'biz-stream'
  | 'biz-worker'
  | 'biz-pg'
  | 'biz-notice'
  | 'biz-reply'
  | 'biz-direct'
  | 'read-ask'
  | 'read-answer'
  | 'read-miss'
  | 'read-pg'
  | 'read-ch';

const PILLAR_R = BOX.stream.x + BOX.stream.w; // 기둥 칸 오른쪽 가장자리 458
const W = BOX.worker; // 처리기 열
const DB_X = BOX.ch.x;
/** 처리기 → 기둥 되돌아가는 선이 내려오는 x — 처리기 왼쪽 가장자리 + 24 */
const BACK_X = W.x + 24;
/** ④ → 업무 요청 · 처리기 → ④ 가로선 높이 */
const REPLY_Y = 340;
/** 조회 줄 — 조회 요청 → ⑤(묻기) · ⑤ → 조회 요청(응답) · ⑤ ↔ DB 줄기 높이 */
const ASK_Y = 396;
const ANSWER_Y = 428;
/** ⑤ ↔ DB 줄기가 PostgreSQL 바닥으로 갈라지는 x · ClickHouse로 오르는 오른쪽 버스 x */
const READ_PG_X = 1000;
const READ_BUS_X = 1124;

export const EDGE: Record<EdgeId, { path: Pt[]; label: LabelSpot | null }> = {
  // 센서 줄 — 점 길(y 111)을 따라 · 공장 센서 → ① → 모아서 저장
  'src-stream': {
    path: [
      { x: BOX.src.x + BOX.src.w, y: LANE_A },
      { x: BOX.stream.x, y: LANE_A },
    ],
    label: { x: 200, y: LANE_A - 9, align: 'middle' },
  },
  'stream-worker': {
    path: [
      { x: PILLAR_R, y: LANE_A },
      { x: W.x, y: LANE_A },
    ],
    label: { x: 508, y: LANE_A - 9, align: 'middle' },
  },
  // 처리기 → DB — ClickHouse는 점 길(y 111) 그대로 곧게 · 알람 · 사본은 처리기 오른쪽 가장자리 y 72 · 90에서 나가 버스 x 760 · 744를 탄다
  'worker-ch': {
    path: [
      { x: W.x + W.w, y: LANE_A },
      { x: DB_X, y: LANE_A },
    ],
    label: null,
  },
  // 모아서 저장이 기둥 ②(지금 값 · 알람 상태)를 쓴다 — 처리기 아래에서 왼쪽으로 되돌아간다
  'worker-latest': {
    path: [
      { x: BACK_X, y: W.y + W.h },
      { x: BACK_X, y: 164 },
      { x: PILLAR_R, y: 164 },
    ],
    label: { x: 512, y: 158, align: 'middle' },
  },
  'worker-pg-alarm': {
    path: [
      { x: W.x + W.w, y: 68 },
      { x: 760, y: 68 },
      { x: 760, y: 232 },
      { x: DB_X, y: 232 },
    ],
    label: { x: DB_X - 6, y: 202, align: 'end' },
  },
  // 비교용 사본(SW-09 on일 때만 그린다)
  'worker-pg-copy': {
    path: [
      { x: W.x + W.w, y: 86 },
      { x: 744, y: 86 },
      { x: 744, y: 336 },
      { x: DB_X, y: 336 },
    ],
    label: { x: DB_X - 6, y: 314, align: 'end' },
  },
  // 업무 줄 — 점 길(y 275)을 따라 · 업무 요청 → ③ → 하나씩 처리 → PostgreSQL
  'biz-stream': {
    path: [
      { x: BOX.bizSrc.x + BOX.bizSrc.w, y: LANE_B },
      { x: BOX.bizStream.x, y: LANE_B },
    ],
    label: { x: 200, y: LANE_B - 9, align: 'middle' },
  },
  'biz-worker': {
    path: [
      { x: PILLAR_R, y: LANE_B },
      { x: W.x, y: LANE_B },
    ],
    label: null,
  },
  'biz-pg': {
    path: [
      { x: W.x + W.w, y: LANE_B },
      { x: DB_X, y: LANE_B },
    ],
    label: { x: DB_X - 6, y: 262, align: 'end' },
  },
  // 저장한 뒤 기둥 ④ — 옛 사본 지움 · 결과 알림(06_pipeline/07 §적용 단계 ⑤ → ⑥ → ⑦)
  'biz-notice': {
    path: [
      { x: BACK_X, y: BOX.bizWorker.y + BOX.bizWorker.h },
      { x: BACK_X, y: REPLY_Y },
      { x: PILLAR_R, y: REPLY_Y },
    ],
    label: { x: 512, y: REPLY_Y - 6, align: 'middle' },
  },
  // 결과 받음 — ④의 결과 알림을 기다리던 요청이 받는다(⑧ api 응답)
  'biz-reply': {
    path: [
      { x: BOX.reply.x, y: REPLY_Y },
      { x: laneX('bizSrc'), y: REPLY_Y },
      { x: laneX('bizSrc'), y: BOX.bizSrc.y + BOX.bizSrc.h },
    ],
    label: { x: 200, y: REPLY_Y - 6, align: 'middle' },
  },
  // 대기줄 없이 바로 저장(SW-12 direct — 비교 실험 · 켜졌을 때만 그린다) — 업무 점 길을 곧게(꺼진 칸 위로 그린다 · 배치 근거 ⑨)
  'biz-direct': {
    path: [
      { x: BOX.bizSrc.x + BOX.bizSrc.w, y: LANE_B },
      { x: DB_X, y: LANE_B },
    ],
    label: { x: DB_X - 6, y: LANE_B + 15, align: 'end' },
  },
  // 조회 줄(§9) — 조회 요청 → ⑤ 조회 사본 · ⑤ → 조회 요청(있으면 바로 · 없으면 사본 담은 뒤)
  'read-ask': {
    path: [
      { x: BOX.readSrc.x + BOX.readSrc.w, y: ASK_Y },
      { x: BOX.readCache.x, y: ASK_Y },
    ],
    label: { x: 200, y: ASK_Y - 9, align: 'middle' },
  },
  'read-answer': {
    path: [
      { x: BOX.readCache.x, y: ANSWER_Y },
      { x: BOX.readSrc.x + BOX.readSrc.w, y: ANSWER_Y },
    ],
    label: { x: 200, y: ANSWER_Y - 9, align: 'middle' },
  },
  // ⑤ ↔ DB 줄기 — ⑤ 쪽 끝 화살촉(읽어 와 사본 담기) · 처리기 노드 아래로 지난다(조회는 워커를 거치지 않는다)
  'read-miss': {
    path: [
      { x: PILLAR_R, y: ASK_Y },
      { x: READ_PG_X, y: ASK_Y },
    ],
    label: { x: 732, y: ASK_Y - 9, align: 'middle' },
  },
  'read-pg': {
    path: [
      { x: READ_PG_X, y: ASK_Y },
      { x: READ_PG_X, y: BOX.pg.y + BOX.pg.h },
    ],
    label: null,
  },
  'read-ch': {
    path: [
      { x: READ_PG_X, y: ASK_Y },
      { x: READ_BUS_X, y: ASK_Y },
      { x: READ_BUS_X, y: BOX.ch.y + 60 },
      { x: BOX.ch.x + BOX.ch.w, y: BOX.ch.y + 60 },
    ],
    label: null,
  },
};

/** 간선 굵기 상한 — 통로 안 나란한 선(간격 ≥ 18)이 서로 붙지 않는 값 */
export const EDGE_W_MAX = 6;

// ── 글자 폭 어림(보수적) ──

/** 한 글자 폭 ÷ 글자 크기 — 한글 · 기호는 1.0, 좁은 글자는 0.35, 그 밖 라틴 · 숫자는 0.62(실제 시스템 글꼴보다 넓게 잡는다) */
function charWidth(ch: string): number {
  if (/[ᄀ-ᇿ㄰-㆏가-힯←-⯿■-◿⏳]/.test(ch)) return 1.0;
  if (/[.,:;·'|!il ]/.test(ch)) return 0.35;
  return 0.62;
}

export function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w * size;
}

/** 라벨 상자(배경 포함 · 여백 2) — 여러 줄은 LABEL_LINE_H 간격 */
export function labelBox(spot: LabelSpot, lines: readonly string[], size: number = FONT.label): Box {
  const w = Math.max(0, ...lines.map((l) => textWidth(l, size))) + 4;
  const x = spot.align === 'start' ? spot.x - 2 : spot.align === 'end' ? spot.x - w + 2 : spot.x - w / 2;
  const top = spot.y - size * 0.85 - 1;
  const h = (lines.length - 1) * LABEL_LINE_H + size * 1.1 + 2;
  return { x, y: top, w, h };
}

/** 노드 글자 첫 줄 중심 y — 점 길이 있는 노드는 길을 뺀 위쪽 가운데 · 저장소는 상자 가운데 */
export function nodeTextTop(id: BoxId, lineCount: number): number {
  const b = BOX[id];
  const area = HAS_LANE[id] ? b.h - LANE_RESERVE : b.h;
  return b.y + area / 2 - ((lineCount - 1) * LINE_H) / 2;
}

/** 노드 글자 줄마다 상자(가운데 맞춤) — 겹침 검사용 */
export function nodeTextBoxes(id: BoxId, lines: readonly string[]): Box[] {
  const b = BOX[id];
  const top = nodeTextTop(id, lines.length);
  return lines.map((t, i) => {
    const size = i === 0 ? FONT.title : FONT.line;
    const w = textWidth(t, size);
    return { x: b.x + b.w / 2 - w / 2, y: top + i * LINE_H - size * 0.6, w, h: size * 1.2 };
  });
}

export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const inside = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;
