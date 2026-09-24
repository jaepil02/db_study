// 시각 표시 — 정본 docs/11_glossary/05_units_and_time.md §표시 시간대 · docs/08_screen/01_standards.md §시각 표시
// 측정 시각은 epoch ms 정수, 업무 시각은 UTC ISO(Z)로 받는다 — 둘 다 Asia/Seoul로 렌더 직전 한 번만 변환한다.

const KST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hourCycle: 'h23',
});

function parts(epochMs: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of KST_PARTS.formatToParts(new Date(epochMs))) out[p.type] = p.value;
  return out;
}

/** 2026-09-24 10:15:03 KST — withMs면 10:15:03.120 */
export function formatKst(epochMs: number, withMs = false): string {
  const p = parts(epochMs);
  const time = `${p.hour}:${p.minute}:${p.second}${withMs ? `.${p.fractionalSecond}` : ''}`;
  return `${p.year}-${p.month}-${p.day} ${time} KST`;
}

/** UTC ISO(Z) 업무 시각을 같은 규칙으로 표시 */
export function formatKstIso(iso: string, withMs = false): string {
  return formatKst(Date.parse(iso), withMs);
}

/**
 * 요청 시각 파라미터 — 오프셋 포함 ISO 8601(+09:00). 표시 변환이 아니라 요청 직렬화다.
 * KST는 일광 절약 시간이 없어 +09:00 고정이다.
 */
export function toKstOffsetIso(epochMs: number): string {
  const shifted = new Date(epochMs + 9 * 3_600_000).toISOString();
  return `${shifted.slice(0, -1)}+09:00`;
}

/** 값의 나이 — 1.2초 · 3분 4초 */
export function formatAge(ms: number): string {
  if (ms < 0) return '0초';
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}초`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 ${s % 60}초`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}
