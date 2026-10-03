// 저장소 3 — 색 · 라벨 · 짧은 이름 한 곳(globals.css @theme --color-store-* 와 같은 값 · 08_screen/08 색 계약)
export const STORE_KEYS = ['ch', 'pg', 'redis'] as const;
export type StoreKey = (typeof STORE_KEYS)[number];

export interface StoreInfo {
  /** 점 · 선 · 막대 색 */
  color: string;
  /** 연한 배경(칩 · 띠) */
  soft: string;
  /** 그 저장소 색으로 쓰는 글자 — 원색보다 어두운 같은 계열(흰 바탕 · soft 바탕 모두 4.5:1 이상 · globals.css 실측 주석) */
  ink: string;
  label: string;
  short: string;
}

export const STORE: Record<StoreKey, StoreInfo> = {
  ch: { color: '#d97706', soft: '#fffbeb', ink: '#b45309', label: 'ClickHouse', short: 'CH' },
  pg: { color: '#2563eb', soft: '#eff6ff', ink: '#1d4ed8', label: 'PostgreSQL', short: 'PG' },
  redis: { color: '#dc2626', soft: '#fef2f2', ink: '#b91c1c', label: 'Redis', short: 'Redis' },
};

/** 저장소 색 점 — 장식이라 접근성 트리에서 뺀다(이름은 옆 글자가 말한다) */
export const STORE_DOT_CLASS = 'inline-block h-2 w-2 shrink-0 rounded-full';
