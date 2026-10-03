// 넓고 높은 화면 변형 — 가로 ≥ 1680 그리고 세로 ≥ 1000(1920 × 1080 · MacBook 16형 1728 × 1117)에서만 두 구역 글자를 한 단계 키운다(.omc/plans/web-ux-polish.md §9 P1).
// 1440 × 900 · 1280 × 800은 이 변형이 꺼져 있어 바탕 클래스 그대로다 — 여기 클래스는 바탕 클래스 옆에 덧붙이기만 한다.
// Tailwind는 소스에서 클래스 글자 그대로를 찾으므로 변형을 문자열로 조립하지 않고 클래스 전체를 적는다(그래서 미디어가 줄마다 되풀이된다).
// 칸 폭 근거(Pretendard 실측): 그림 1 질문 이름 16px 가장 긴 "센서 1개 · 최근 1시간" 600 131px + 왼쪽 여백 6 · 점 6 · 틈 8 = 151 ≤ 10rem(160) ·
// 배수 라벨 20px 700 고정 폭 숫자 가장 긴 "PG 10.5배" 94px + 틈 6 = 100 ≤ 6.5rem(104).
// 업무 줄 높이 근거(1920 × 1080): 구역 906 = 위아래 테두리 2 + 머리 띠 65(여백 16 + 14px 줄 20 + 20px 줄 28 + 가는 줄 1) + 줄 4 × 142 + 틈 칸 3 × 48 + 아래 빈 127 —
// 줄 142 = 위아래 여백 16 + 질문 24 + 틈 6 + PG 32 + 틈 6 + CH 32 + 틈 6 + 왜? 20(14px 한 줄 — 가장 긴 문장 614px ≤ 칸 662).

/** 이 변형이 켜지는 미디어 조건(시험 · 문서 대조용) */
export const ROOMY_MEDIA = '(min-width:1680px) and (min-height:1000px)';

export const ROOMY = {
  // 글자 한 단계(단계 12 · 13 · 14 · 16 · 20 · 28 안에서)
  /** 12 → 13 */
  xs: '[@media(min-width:1680px)_and_(min-height:1000px)]:text-label',
  /** 13 → 14 */
  label: '[@media(min-width:1680px)_and_(min-height:1000px)]:text-sm',
  /** 14 → 16 */
  sm: '[@media(min-width:1680px)_and_(min-height:1000px)]:text-base',
  /** 16 → 20 */
  base: '[@media(min-width:1680px)_and_(min-height:1000px)]:text-xl',

  // 그림 1 — 막대 두께 · 줄 높이 · 질문 이름 칸 · 배수 라벨 칸(글자에 비례)
  /** 질문 이름 칸 9rem → 10rem(머리 줄과 막대 줄이 같은 칸) */
  fig1Cols: '[@media(min-width:1680px)_and_(min-height:1000px)]:grid-cols-[10rem_1fr_1fr]',
  /** 줄 높이 30 → 36 */
  fig1Row: '[@media(min-width:1680px)_and_(min-height:1000px)]:h-9',
  /** 막대 두께 18 → 22 */
  fig1Bar: '[@media(min-width:1680px)_and_(min-height:1000px)]:h-5.5',
  /** 배수 라벨 칸 84 → 104(PG 쪽 왼쪽) */
  fig1PadL: '[@media(min-width:1680px)_and_(min-height:1000px)]:pl-[6.5rem]',
  /** 배수 라벨 칸 84 → 104(CH 쪽 오른쪽) */
  fig1PadR: '[@media(min-width:1680px)_and_(min-height:1000px)]:pr-[6.5rem]',
  /** 그림 1 자리 표시(5줄) 150 → 180 */
  fig1Box: '[@media(min-width:1680px)_and_(min-height:1000px)]:h-[180px]',
  /** 축 위 짧은 선 6 → 8 */
  fig1Tick: '[@media(min-width:1680px)_and_(min-height:1000px)]:h-2',

  // 업무 구역 — 줄 안 높이 · 줄 사이 상한
  /** PG · CH 한 줄 높이 24 → 32(20px 숫자 줄 상자 28 + 위아래 2) */
  bizLine: '[@media(min-width:1680px)_and_(min-height:1000px)]:h-8',
  /** 줄 안 틈 2 → 6 */
  bizGap: '[@media(min-width:1680px)_and_(min-height:1000px)]:gap-1.5',
  /** 줄 사이 틈 칸 상한 32 → 48 — 줄 위아래 여백 8 + 8을 더해 글자 사이 최대 64px */
  bizGapMax: '[@media(min-width:1680px)_and_(min-height:1000px)]:max-h-12',
  /** 속도 막대 두께 10 → 12 */
  bizBar: '[@media(min-width:1680px)_and_(min-height:1000px)]:h-3',
  /** 지킴 · 못 지킴 표지 16 → 20 */
  bizMark: '[@media(min-width:1680px)_and_(min-height:1000px)]:size-5',
  /** 표지 · 알약 안 그린 기호 12 → 14 */
  icon: '[@media(min-width:1680px)_and_(min-height:1000px)]:size-3.5',
  /** 업무 줄 자리 표시(두 줄) 48 → 70(32 + 6 + 32) */
  bizBox: '[@media(min-width:1680px)_and_(min-height:1000px)]:h-[70px]',
} as const;
