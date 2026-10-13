// 숫자 쉬운 표기 — 걸린 시간 · 바이트 · 배수. 직접 비교 실험(components/lab)과 제어 문구(components/controls)가 같이 쓴다.
// 순수 함수만 둔다(단위 시험 test/format.test.ts).

/** ms 쉬운 표기 — 100 이상 정수(천 단위 구분) · 1 이상 소수 1자리 · 1 미만 유효 숫자 2자리 */
export function msText(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString('ko-KR');
  if (v >= 1) return String(Math.round(v * 10) / 10);
  return String(Number(v.toPrecision(2)));
}

/**
 * 대강의 크기 — 먼저 소수 1자리로 반올림하고 그 값으로 자릿수를 고른다(10 미만 소수 1자리 · 이상은 정수).
 * 9.96을 "10.0"으로 · 99.6을 "100"이 아닌 다른 자릿수로 보이지 않게 — 반올림 전 값으로 고르면 경계에서 형식이 갈린다.
 * 배수("24배")와 행당 바이트("4.5바이트")가 같은 규칙이라 화면의 나눗셈이 맞아 보인다(108 ÷ 4.5 = 24).
 */
export function roughText(x: number): string {
  const r1 = Math.round(x * 10) / 10;
  return r1 >= 10 ? Math.round(x).toLocaleString('ko-KR') : r1.toFixed(1);
}

/** 배수 크기 — roughText와 같은 규칙 */
export const timesText = roughText;

/** 걸린 시간 쉬운 표기 — 1s 미만은 ms(msText) · 이상은 s(roughText — 10s 이상 정수) */
export function durText(ms: number): string {
  return ms >= 1000 ? `${roughText(ms / 1000)}s` : `${msText(ms)}ms`;
}

/** 바이트 쉬운 표기 — 10^3 단위(KB · MB · GB · TB) · 크기 숫자는 roughText(10 이상 정수 · 미만 소수 1자리) */
export function bytesText(b: number): string {
  const units: [number, string][] = [
    [1e12, 'TB'],
    [1e9, 'GB'],
    [1e6, 'MB'],
    [1e3, 'KB'],
  ];
  for (const [u, name] of units) if (b >= u) return `${roughText(b / u)}${name}`;
  return `${Math.round(b)}바이트`;
}
