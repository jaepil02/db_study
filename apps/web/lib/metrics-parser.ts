// Prometheus 텍스트 형식의 작은 파서 — BFF(/bff/metrics?view=flow)가 api /metrics를 읽어 흐름 보기로 요약한다(lib/flow.ts summarizeFlow).
// 파서 선택은 09_tech_stack/01 §미확인 · 미설계 등재("라이브러리 또는 직접 구현")였다 — 직접 구현을 택한다.
// 근거: 화면이 읽는 것은 gauge · counter 샘플 줄(이름 · 레이블 · 값)뿐이고 히스토그램 · 요약의 구조 해석이 필요 없다.
// 라이브러리(prom-client는 생산자용 · 파서가 아니다)를 들이면 웹 의존성과 버전 고정표 행이 늘어 학습 대상이 아닌 층이 는다.
// 범위: # 주석 줄 무시 · name{k="v",...} value [timestamp] · 레이블 값 이스케이프(\\ \" \n) · NaN · ±Inf.

export interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

function parseValue(raw: string): number {
  switch (raw) {
    case 'NaN':
      return Number.NaN;
    case '+Inf':
    case 'Inf':
      return Number.POSITIVE_INFINITY;
    case '-Inf':
      return Number.NEGATIVE_INFINITY;
    default:
      return Number(raw);
  }
}

/** 레이블 블록 본문(중괄호 안)을 읽고 닫는 중괄호 다음 위치를 돌려준다 — 형식 위반이면 null */
function parseLabels(line: string, from: number): { labels: Record<string, string>; next: number } | null {
  const labels: Record<string, string> = {};
  let i = from;
  for (;;) {
    while (line[i] === ' ' || line[i] === ',') i++;
    if (line[i] === '}') return { labels, next: i + 1 };
    const eq = line.indexOf('=', i);
    if (eq < 0 || line[eq + 1] !== '"') return null;
    const key = line.slice(i, eq).trim();
    let j = eq + 2;
    let val = '';
    while (j < line.length && line[j] !== '"') {
      if (line[j] === '\\') {
        const c = line[j + 1];
        val += c === 'n' ? '\n' : (c ?? '');
        j += 2;
      } else {
        val += line[j];
        j++;
      }
    }
    if (j >= line.length) return null;
    labels[key] = val;
    i = j + 1;
  }
}

/** 텍스트 전체 → 샘플 배열. 읽을 수 없는 줄은 건너뛴다(한 줄 결함이 요약 전체를 지우지 않게) */
export function parsePrometheusText(text: string): MetricSample[] {
  const out: MetricSample[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const nameEnd = line.search(/[{\s]/);
    if (nameEnd <= 0) continue;
    const name = line.slice(0, nameEnd);
    let labels: Record<string, string> = {};
    let rest: string;
    if (line[nameEnd] === '{') {
      const parsed = parseLabels(line, nameEnd + 1);
      if (!parsed) continue;
      labels = parsed.labels;
      rest = line.slice(parsed.next);
    } else {
      rest = line.slice(nameEnd);
    }
    const valueToken = rest.trim().split(/\s+/)[0];
    if (valueToken === undefined || valueToken === '') continue;
    const value = parseValue(valueToken);
    if (Number.isNaN(value) && valueToken !== 'NaN') continue;
    out.push({ name, labels, value });
  }
  return out;
}

/**
 * 초당 값 — 두 폴링 사이 누적값 차 ÷ 경과 초.
 * 누적값이 줄면 재기동(카운터 0 복귀)이라 계산하지 않는다(재기동은 누적값을 0으로 되돌린다).
 */
export function ratePerSecond(
  prev: { value: number | null; atMs: number } | null,
  cur: { value: number | null; atMs: number },
): number | null {
  if (!prev || prev.value === null || cur.value === null) return null;
  const dt = (cur.atMs - prev.atMs) / 1000;
  if (dt <= 0 || cur.value < prev.value) return null;
  return (cur.value - prev.value) / dt;
}

// 이름 · 레이블 정본은 10_observability/01_metrics_catalog.md다. 흐름 보기 요약(summarizeFlow)은 lib/flow.ts가 한다.
