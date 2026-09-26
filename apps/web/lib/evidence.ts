// 실증 요약 판독기 — 역방향 대조(EXP-40~44 · reverse) · 스트리밍 동시 적재(EXP-45 · streamSteps).
// 형식 정본 10_observability/04_experiment_protocol.md §기계 판독 블록(선택 필드 reverse · streamSteps) · §BFF 판독 규칙 7.
// 키의 뜻 정본 05_data_stores/10_olap_vs_rdb_control.md §EXP 연결 · 기계 판독 블록 제안 · §스트리밍 동시 적재 — EXP-45.
// 순수 함수만 둔다 — 파일 읽기는 BFF 라우트(app/bff/measurements)가 한다. 역전 지점 판독(lib/measurements)과 규칙 1~5 · 7은 같고,
// 규칙 6의 자리(어느 기록의 어느 필드를 쓰는가)만 다르다 — reverse는 EXP-40~44를 인용한 기록, streamSteps는 EXP-45를 인용한 기록.
import { formatRows, jsonFences, type RunInfo, SCHEMA_V1, type Store } from './measurements';

export const REVERSE_EXPS = ['EXP-40', 'EXP-41', 'EXP-42', 'EXP-43', 'EXP-44'] as const;
export const STREAM_EXP = 'EXP-45';
export type ReverseExp = (typeof REVERSE_EXPS)[number];

const SWITCH_IDS = Array.from({ length: 11 }, (_, i) => `SW-${String(i + 1).padStart(2, '0')}`);
const RECORD_FILE = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/** 행마다 붙는 4요소 — 툴팁에 싣는다(08_screen/07 §대조군 역전 지점 계약 "4요소"와 같은 표시 계약) */
export interface EvidenceRef {
  record: string;
  run: RunInfo;
  switches: Record<string, unknown>;
}

/** reverse 한 행 — 키는 05_data_stores/10 §EXP 연결 · 기계 판독 블록 제안 */
export interface ReverseRow extends EvidenceRef {
  exp: ReverseExp;
  op: string | null;
  store: Store;
  variant: string;
  /** work_order 행 수(업무 규모 단계) */
  scale: number;
  concurrency: number | null;
  /** EXP-44 req/s */
  rate: number | null;
  /** EXP-40 판독 설정 · after_merge 여부 */
  read: string | null;
  metric: string;
  unit: string;
  /** 반복별 값 — null은 그 반복에서 값이 없음(예: 상한 안 미관측) */
  values: (number | null)[];
  median: number | null;
  /** 구조 지표 — 중앙값이 아니라 3회 전부를 본다 */
  structural: boolean;
}

/** streamSteps 한 행 — 계단 pps마다 두 싱크 */
export interface StreamRow extends EvidenceRef {
  pps: number;
  store: Store;
  metric: string;
  unit: string;
  values: (number | null)[];
  median: number | null;
  /**
   * 반복별 실패 수 — 반복 자리 단위(재기동 · 포화 반복 자리는 null).
   * 행 failures 자체가 null이면 빈 배열이고 judged false.
   */
  failures: (number | null)[];
  /**
   * 판정 점에 쓰는 행인가 — 행의 valid가 false(그 저장소 유효 반복 0)이거나 failures가 null이면 false(그리기는 하되 판정에서 뺀다).
   * judged true여도 median이 null이고 failures에 수가 없는 행은 관측 범위를 넓히지 않는다(streamJudgement).
   */
  judged: boolean;
  /** 이 기록 conditions의 판정 기준(초) — 저장소별 · 없으면 null(STREAM_THRESHOLD_KEYS) */
  thresholdSec: number | null;
}

export interface EvidenceCounts {
  /** 규칙 1을 통과한 기록 파일 수(역전 지점 패널과 같은 모수) */
  files: number;
  /** 규칙 2 — 판독 불가 기록 */
  unreadable: number;
  /** EXP-40~44를 인용한 판독 가능 기록 */
  reverse: number;
  /** EXP-45를 인용한 판독 가능 기록 */
  stream: number;
  /** 규칙 3 — 폐기 · 정정 */
  excludedStatus: number;
  /** 규칙 5 — 반복 수 부족 · 편차 기준 초과 */
  excludedDeviation: number;
  /** 규칙 4 — 4요소 누락 */
  missingConditions: number;
  /** 형식이 어긋나 뺀 행 */
  invalidRows: number;
  /** 같은 키의 행이 여러 기록에 있어 뒤 기록만 남긴 수 */
  duplicateRows: number;
}

export interface EvidenceResult {
  counts: EvidenceCounts;
  unreadableFiles: string[];
  reverse: ReverseRow[];
  stream: StreamRow[];
}

interface Block {
  record: string;
  exp: string[];
  status: string;
  supersedes: string | null;
  run: Record<string, unknown>;
  switches: Record<string, unknown>;
  conditions: Record<string, unknown>;
  repeat: { runs: number; deviation: number; threshold: number };
  reverse: unknown[];
  streamSteps: unknown[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const asStore = (v: unknown): Store | null => (v === 'postgresql' || v === 'clickhouse' ? v : null);

/** 규칙 2 — schema가 measurement/v1인 json 블록이 정확히 1개(lib/measurements와 같은 판정) */
function pickBlock(text: string): unknown | null {
  const found: unknown[] = [];
  for (const body of jsonFences(text)) {
    try {
      const v: unknown = JSON.parse(body);
      if (isObj(v) && v.schema === SCHEMA_V1) found.push(v);
    } catch {
      // json 펜스지만 JSON이 아니면 기계 판독 블록이 아니다
    }
  }
  return found.length === 1 ? (found[0] ?? null) : null;
}

/** 필수 필드 형식(§기계 판독 블록 필드 표) — 어기면 판독 불가. 모르는 필드는 무시한다(규칙 7) */
function validate(v: unknown): Block | null {
  if (!isObj(v)) return null;
  const { record, exp, status, supersedes, run, switches, conditions, repeat, reverse, streamSteps } = v;
  if (typeof record !== 'string' || !/^\d{3}$/.test(record)) return null;
  if (!Array.isArray(exp) || !exp.every((e) => typeof e === 'string')) return null;
  if (typeof status !== 'string') return null;
  if (supersedes !== null && typeof supersedes !== 'string') return null;
  if (!isObj(run) || !isObj(switches) || !isObj(repeat) || !isObj(conditions)) return null;
  if (!isObj(v.window) || !Array.isArray(v.results)) return null;
  if (!isNum(repeat.runs) || !isNum(repeat.deviation) || !isNum(repeat.threshold)) return null;
  if (v.points !== undefined && !Array.isArray(v.points)) return null;
  if (v.axes !== undefined && !Array.isArray(v.axes)) return null;
  if (reverse !== undefined && !Array.isArray(reverse)) return null;
  if (streamSteps !== undefined && !Array.isArray(streamSteps)) return null;
  return {
    record,
    exp: exp as string[],
    status,
    supersedes: supersedes as string | null,
    run,
    switches,
    conditions,
    repeat: { runs: repeat.runs, deviation: repeat.deviation, threshold: repeat.threshold },
    reverse: (reverse as unknown[] | undefined) ?? [],
    streamSteps: (streamSteps as unknown[] | undefined) ?? [],
  };
}

/** 규칙 4 — run 네 필드와 switches 11키가 전부 null이 아니다(배열 값은 원소마다) */
function conditionsComplete(b: Block): RunInfo | null {
  const { commitHash, memoryProfile, memoryLimitMb, capacityTier } = b.run;
  if (typeof commitHash !== 'string' || typeof memoryProfile !== 'string') return null;
  if (!isNum(memoryLimitMb) || typeof capacityTier !== 'string') return null;
  for (const id of SWITCH_IDS) {
    const sv = b.switches[id];
    if (sv === null || sv === undefined) return null;
    if (Array.isArray(sv) && sv.some((x) => x === null || x === undefined)) return null;
  }
  return { commitHash, memoryProfile, memoryLimitMb, capacityTier };
}

const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** values는 배열이고 원소는 수 또는 null이어야 한다 — 다른 값이 섞이면 형식 위반 */
function runValues(v: unknown): (number | null)[] | null {
  if (!Array.isArray(v)) return null;
  if (!v.every((x) => x === null || isNum(x))) return null;
  return v as (number | null)[];
}

function parseReverse(r: unknown, ref: EvidenceRef): ReverseRow | null {
  if (!isObj(r)) return null;
  const exp = (REVERSE_EXPS as readonly string[]).includes(r.exp as string) ? (r.exp as ReverseExp) : null;
  const store = asStore(r.store);
  const values = runValues(r.values);
  if (!exp || !store || !values) return null;
  if (typeof r.variant !== 'string' || typeof r.metric !== 'string' || typeof r.unit !== 'string')
    return null;
  if (!isNum(r.scale) || r.scale <= 0) return null;
  if (r.median !== null && !isNum(r.median)) return null;
  return {
    ...ref,
    exp,
    op: strOrNull(r.op),
    store,
    variant: r.variant,
    scale: r.scale,
    concurrency: numOrNull(r.concurrency),
    rate: numOrNull(r.rate),
    read: strOrNull(r.read),
    metric: r.metric,
    unit: r.unit,
    values,
    median: r.median as number | null,
    structural: r.structural === true,
  };
}

/**
 * EXP-45 판정 점 기준을 읽는 conditions 키(초 단위 수).
 * 판정 점 — ClickHouse 삽입 p95 > 창 폭 W · PostgreSQL COPY p95 > COPY 타임아웃(05_data_stores/10 §스트리밍 동시 적재 지표 표 "판정 점").
 * 두 값은 2계층으로 "기록 조건 칸에 적는다"만 정해져 있고 블록 키 이름의 정본은 docs/10_observability/04_experiment_protocol.md §기계 판독 블록 conditions 행이다.
 */
export const STREAM_THRESHOLD_KEYS: Record<Store, string> = {
  clickhouse: 'flushWindowSeconds',
  postgresql: 'copyTimeoutSeconds',
};

function parseStream(s: unknown, ref: EvidenceRef, conditions: Record<string, unknown>): StreamRow | null {
  if (!isObj(s)) return null;
  const store = asStore(s.store);
  const values = runValues(s.values);
  if (!store || !values || !isNum(s.pps) || s.pps <= 0) return null;
  if (typeof s.metric !== 'string' || typeof s.unit !== 'string') return null;
  if (s.median !== null && !isNum(s.median)) return null;
  if (s.valid !== undefined && typeof s.valid !== 'boolean') return null;
  const failures = s.failures === undefined || s.failures === null ? [] : runValues(s.failures);
  if (!failures) return null;
  const th = conditions[STREAM_THRESHOLD_KEYS[store]];
  return {
    ...ref,
    pps: s.pps,
    store,
    metric: s.metric,
    unit: s.unit,
    values,
    median: s.median as number | null,
    failures,
    judged: s.valid !== false && s.failures !== null,
    thresholdSec: isNum(th) && th > 0 ? th : null,
  };
}

const reverseKey = (r: ReverseRow) =>
  [r.exp, r.op, r.store, r.variant, r.scale, r.concurrency, r.rate, r.read, r.metric].join('|');
const streamKey = (s: StreamRow) => [s.pps, s.store, s.metric].join('|');

/** 기록 파일 목록 → 실증 요약 패널 입력. 규칙 1 · 2 → (규칙 6의 자리) → 3 → 5 → 4 순서는 역전 지점 판독기와 같다 */
export function readEvidence(files: readonly { name: string; text: string }[]): EvidenceResult {
  const counts: EvidenceCounts = {
    files: 0,
    unreadable: 0,
    reverse: 0,
    stream: 0,
    excludedStatus: 0,
    excludedDeviation: 0,
    missingConditions: 0,
    invalidRows: 0,
    duplicateRows: 0,
  };
  const unreadableFiles: string[] = [];
  const blocks: Block[] = [];
  for (const f of files) {
    if (!RECORD_FILE.test(f.name)) continue; // 규칙 1
    counts.files++;
    const b = validate(pickBlock(f.text)); // 규칙 2 · 형식
    if (!b) {
      counts.unreadable++;
      unreadableFiles.push(f.name);
      continue;
    }
    blocks.push(b);
  }
  const superseded = new Set(
    blocks.filter((b) => b.status === 'valid' && b.supersedes).map((b) => b.supersedes),
  );

  const reverse = new Map<string, ReverseRow>();
  const stream = new Map<string, StreamRow>();
  for (const b of blocks.sort((x, y) => x.record.localeCompare(y.record))) {
    const isReverse = b.exp.some((e) => (REVERSE_EXPS as readonly string[]).includes(e));
    const isStream = b.exp.includes(STREAM_EXP);
    if (!isReverse && !isStream) continue; // 규칙 6의 자리 — 다른 실험의 폐기 · 누락을 이 패널 수에 섞지 않는다
    if (isReverse) counts.reverse++;
    if (isStream) counts.stream++;
    if (b.status !== 'valid' || superseded.has(b.record)) {
      counts.excludedStatus++; // 규칙 3
      continue;
    }
    if (b.repeat.runs < 3 || b.repeat.deviation > b.repeat.threshold) {
      counts.excludedDeviation++; // 규칙 5
      continue;
    }
    const run = conditionsComplete(b);
    if (!run) {
      counts.missingConditions++; // 규칙 4
      continue;
    }
    const ref: EvidenceRef = { record: b.record, run, switches: b.switches };
    if (isReverse) {
      for (const raw of b.reverse) {
        const r = parseReverse(raw, ref);
        // 행의 exp가 기록 머리의 exp에 없으면 다른 실험의 값이 섞인 것이다 — 형식 위반으로 센다
        if (!r || !b.exp.includes(r.exp)) {
          counts.invalidRows++;
          continue;
        }
        const k = reverseKey(r);
        if (reverse.has(k)) counts.duplicateRows++; // 기록 번호 오름차순 — 뒤 기록이 덮는다
        reverse.set(k, r);
      }
    }
    if (isStream) {
      for (const raw of b.streamSteps) {
        const s = parseStream(raw, ref, b.conditions);
        if (!s) {
          counts.invalidRows++;
          continue;
        }
        const k = streamKey(s);
        if (stream.has(k)) counts.duplicateRows++;
        stream.set(k, s);
      }
    }
  }
  return { counts, unreadableFiles, reverse: [...reverse.values()], stream: [...stream.values()] };
}

// ── 요약 ──

/** 3회 값의 중앙값 — 기록의 median이 없을 때 쓰지 않는다(판독기는 기록 값을 그린다) · 테스트 · 검산용 */
export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** 역방향 막대 · 선의 가로축 — EXP별로 정본 표가 정한 손잡이 */
export type ReverseX = 'scale' | 'concurrency' | 'rate';
export const REVERSE_X: Record<ReverseExp, ReverseX> = {
  'EXP-40': 'scale', // 변형별 갱신 · 가시성 · 물리 비용 — 업무 규모 축
  'EXP-41': 'concurrency', // 동시성 1 · 8 · 32
  'EXP-42': 'scale', // 구조 — 그리드로 그린다
  'EXP-43': 'scale', // 구조(수용) + 분포(FINAL 비용)
  'EXP-44': 'rate', // 50 · 200 · 500 req/s
};

/** 행이 속하는 계열 이름 — 저장소 · 변형 · 판독 설정 · 가로축이 아닌 손잡이(값이 있을 때만) */
export function seriesLabel(r: ReverseRow, x: ReverseX): string {
  const parts = [r.store === 'postgresql' ? 'PostgreSQL' : 'ClickHouse', r.variant];
  if (r.read) parts.push(r.read);
  if (x !== 'scale') parts.push(`${formatRows(r.scale)}행`);
  if (x !== 'concurrency' && r.concurrency !== null) parts.push(`동시성 ${r.concurrency}`);
  if (x !== 'rate' && r.rate !== null) parts.push(`${r.rate} req/s`);
  return parts.join(' · ');
}

export interface BarModel {
  x: number[];
  series: { label: string; store: Store; cells: (ReverseRow | null)[] }[];
  unit: string;
  /** 중앙값이 없어 막대를 그리지 않은 행 */
  noMedian: number;
}

/** 한 EXP · 한 지표(+선택한 업무 규모)의 분포 막대 모델 — 구조 지표는 뺀다(3회 전부를 막대로 줄이지 않는다) */
export function reverseBars(
  rows: readonly ReverseRow[],
  sel: { exp: ReverseExp; metric: string; scale: number | null },
): BarModel {
  const x = REVERSE_X[sel.exp];
  const picked = rows.filter(
    (r) =>
      r.exp === sel.exp &&
      r.metric === sel.metric &&
      !r.structural &&
      (x === 'scale' || sel.scale === null || r.scale === sel.scale),
  );
  const xOf = (r: ReverseRow) => (x === 'scale' ? r.scale : x === 'concurrency' ? r.concurrency : r.rate);
  const xs = [...new Set(picked.map(xOf).filter((v): v is number => v !== null))].sort((a, b) => a - b);
  const groups = new Map<string, ReverseRow[]>();
  for (const r of picked) {
    if (xOf(r) === null) continue;
    const k = seriesLabel(r, x);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  // PostgreSQL 계열을 먼저 — 같은 저장소 안에서는 이름 순
  const labels = [...groups.keys()].sort((a, b) => {
    const pa = a.startsWith('PostgreSQL') ? 0 : 1;
    const pb = b.startsWith('PostgreSQL') ? 0 : 1;
    return pa - pb || a.localeCompare(b);
  });
  return {
    x: xs,
    series: labels.map((label) => {
      const g = groups.get(label) ?? [];
      return {
        label,
        store: (g[0] as ReverseRow).store,
        cells: xs.map((v) => g.find((r) => xOf(r) === v) ?? null),
      };
    }),
    unit: picked[0]?.unit ?? '',
    noMedian: picked.filter((r) => r.median === null).length,
  };
}

export type StructuralVerdict =
  | { kind: 'consistent'; value: number }
  | { kind: 'varies'; min: number; max: number }
  | { kind: 'incomplete'; present: number };

/**
 * 구조 지표의 "3회 전부" 판정(10_observability/04 §구조 판정과 분포 판정 — 구조 판정은 분포가 없다).
 * 3회가 모두 값을 가지면 — 전부 같으면 성립(그 값) · 다르면 반복마다 구조 결과가 다르다(최소 · 최대).
 * 값이 3개 미만이면 판정하지 않는다 — 중앙값으로 채우지 않는다.
 */
export function structuralVerdict(values: readonly (number | null)[]): StructuralVerdict {
  const nums = values.filter(isNum);
  if (nums.length < 3 || nums.length !== values.length) return { kind: 'incomplete', present: nums.length };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? { kind: 'consistent', value: min } : { kind: 'varies', min, max };
}

export interface StructuralGrid {
  /** 열 — 사례(지표 · 조작) */
  cases: string[];
  /** 행 — 저장소 · 변형 · 업무 규모 */
  rows: { label: string; store: Store; cells: (ReverseRow | null)[] }[];
}

/** EXP-42 · 43 구조 판정 그리드 — 저장소 × 사례(structural true 행만) */
export function structuralGrid(rows: readonly ReverseRow[], exp: ReverseExp): StructuralGrid {
  const picked = rows.filter((r) => r.exp === exp && r.structural);
  const caseOf = (r: ReverseRow) => (r.op && r.op !== exp ? `${r.metric} · ${r.op}` : r.metric);
  const cases = [...new Set(picked.map(caseOf))].sort();
  const rowOf = (r: ReverseRow) =>
    [
      r.store === 'postgresql' ? 'PostgreSQL' : 'ClickHouse',
      r.variant,
      r.read,
      `${formatRows(r.scale)}행`,
      r.concurrency === null ? null : `동시성 ${r.concurrency}`,
    ]
      .filter((s): s is string => s !== null)
      .join(' · ');
  const groups = new Map<string, ReverseRow[]>();
  for (const r of picked) groups.set(rowOf(r), [...(groups.get(rowOf(r)) ?? []), r]);
  const labels = [...groups.keys()].sort((a, b) => {
    const pa = a.startsWith('PostgreSQL') ? 0 : 1;
    const pb = b.startsWith('PostgreSQL') ? 0 : 1;
    return pa - pb || a.localeCompare(b);
  });
  return {
    cases,
    rows: labels.map((label) => {
      const g = groups.get(label) ?? [];
      return {
        label,
        store: (g[0] as ReverseRow).store,
        cells: cases.map((c) => g.find((r) => caseOf(r) === c) ?? null),
      };
    }),
  };
}

/** 구조 판정 집계 — 저장소별 (성립 · 반복마다 다름 · 판정 불가) 칸 수 · 한 번이라도 0이 아닌 칸 수 */
export function structuralSummary(rows: readonly ReverseRow[], exp: ReverseExp) {
  const out: Record<Store, { consistent: number; varies: number; incomplete: number; nonZero: number }> = {
    postgresql: { consistent: 0, varies: 0, incomplete: 0, nonZero: 0 },
    clickhouse: { consistent: 0, varies: 0, incomplete: 0, nonZero: 0 },
  };
  for (const r of rows) {
    if (r.exp !== exp || !r.structural) continue;
    const v = structuralVerdict(r.values);
    out[r.store][v.kind]++;
    if (r.values.some((x) => isNum(x) && x !== 0)) out[r.store].nonZero++;
  }
  return out;
}

// ── EXP-45 ──

/** 단위 → 초 */
export function toSeconds(v: number, unit: string): number | null {
  if (unit === 's') return v;
  if (unit === 'ms') return v / 1000;
  if (unit === 'us' || unit === 'µs') return v / 1e6;
  return null;
}

export const STREAM_QUANTILES = ['p50', 'p95'] as const;
export type StreamQuantile = (typeof STREAM_QUANTILES)[number];

/** 지표 이름 끝의 분위수 — 규약 insert_duration_seconds_p50 · _p95 · control_copy_seconds_p50 · _p95(.omc 기록 규약) */
export function quantileOf(metric: string): StreamQuantile | null {
  const m = /(?:^|_)(p50|p95)$/i.exec(metric);
  return m ? ((m[1] as string).toLowerCase() as StreamQuantile) : null;
}

export interface StreamSeries {
  store: Store;
  /** 이 선에 쓴 지표 이름 — 그 분위수로 끝나는 지표가 없으면 null */
  metric: string | null;
  steps: StreamRow[];
}

/**
 * 분위수 하나의 두 싱크 선 — 저장소마다 이름 끝이 그 분위수인 지표를 묶는다(싱크마다 지표 이름이 다르다).
 * 한 저장소에 그런 지표가 여럿이면 이름순 첫 지표만 쓴다(같은 pps에 점이 겹치지 않게).
 */
export function streamSeries(rows: readonly StreamRow[], quantile: StreamQuantile): StreamSeries[] {
  return (['postgresql', 'clickhouse'] as const).map((store) => {
    const own = rows.filter((r) => r.store === store && quantileOf(r.metric) === quantile);
    const metric = [...new Set(own.map((r) => r.metric))].sort()[0] ?? null;
    return {
      store,
      metric,
      steps: own.filter((r) => r.metric === metric).sort((a, b) => a.pps - b.pps),
    };
  });
}

export type StreamJudgement =
  | { kind: 'crossed'; pps: number; reason: 'threshold' | 'failure'; thresholdSec: number | null }
  | { kind: 'none'; maxPps: number; thresholdSec: number | null }
  /** ClickHouse — 판정 기준(창 폭 W)이 기록에 없어 판정하지 않는다(실패로 대신하지 않는다) */
  | { kind: 'noThreshold'; maxPps: number }
  | { kind: 'insufficient' };

/** 판정 점을 읽는 지표 — p95 시간 지표(05_data_stores/10 지표 표 "판정 점": 삽입 p95 · COPY p95) */
export const isP95Metric = (metric: string) => quantileOf(metric) === 'p95';

/**
 * 한 싱크의 판정 점(05_data_stores/10 §스트리밍 동시 적재 — EXP-45 지표 표 "판정 점") — 계단을 pps 오름차순으로 본다.
 * ClickHouse — 삽입 p95 중앙값이 창 폭 W를 넘는 첫 계단만(실패 · DLQ는 판정 점이 아니다) · W가 없으면 판정하지 않는다.
 * PostgreSQL — 실패가 한 반복이라도 있는 첫 계단 또는 COPY p95 중앙값이 COPY 타임아웃을 넘는 첫 계단 · 타임아웃이 없으면 실패만.
 * judged false 행(valid false — 그 저장소 유효 반복 0 · failures null)은 판정에서 뺀다.
 * 관측 범위 안에서 넘지 않으면 그 범위(판정 행 중 median이 있거나 failures에 수가 있는 행의 최대 pps)를 적는다 —
 * 전부 무효 · median null 계단은 관측 범위를 넓히지 않는다(그런 행은 판정 점도 될 수 없다).
 */
export function streamJudgement(rows: readonly StreamRow[], store: Store): StreamJudgement {
  const own = rows
    .filter((r) => r.store === store && r.judged && (r.median !== null || r.failures.some(isNum)))
    .sort((a, b) => a.pps - b.pps);
  if (own.length === 0) return { kind: 'insufficient' };
  // 기준은 첫 행의 것을 쓴다 — EXP-45는 배치 안 A만 돌아(러너가 다른 안 · 반복끼리 다른 조건을 멈춘다) 기록마다 기준이 같다는 전제다.
  // 배치 안이 다른 기록이 섞이면 뒤 기록 행도 첫 행 기준으로 판정되는 한계가 있다.
  const thresholdSec = own.find((r) => r.thresholdSec !== null)?.thresholdSec ?? null;
  const ppsList = [...new Set(own.map((r) => r.pps))];
  const maxPps = ppsList[ppsList.length - 1] as number;
  if (store === 'clickhouse' && thresholdSec === null) return { kind: 'noThreshold', maxPps };
  for (const pps of ppsList) {
    const at = own.filter((r) => r.pps === pps);
    if (store === 'postgresql' && at.some((r) => r.failures.some((f) => isNum(f) && f > 0))) {
      return { kind: 'crossed', pps, reason: 'failure', thresholdSec };
    }
    if (thresholdSec !== null) {
      const over = at.some((r) => {
        if (!isP95Metric(r.metric) || r.median === null) return false;
        const s = toSeconds(r.median, r.unit);
        return s !== null && s > thresholdSec;
      });
      if (over) return { kind: 'crossed', pps, reason: 'threshold', thresholdSec };
    }
  }
  return { kind: 'none', maxPps, thresholdSec };
}

// ── 원리 대응 ──

/**
 * 측정 장부 지표 — 원리 칸의 관측값이 아니다: budget_exhausted(unit count · 예산 마감으로 재지 못한 건) ·
 * converged(unit bool · 옛 원시에만 남은 수렴 판정 — 지금은 detail.converge에만 둔다). unit bool 지표는 이름과 무관하게 뺀다.
 */
export const BOOKKEEPING_METRICS: ReadonlySet<string> = new Set(['budget_exhausted', 'converged']);

/**
 * 원리 대응 표 — 문서에서 판독하지 않고 옮긴 상수다.
 * 출처: docs/05_data_stores/10_olap_vs_rdb_control.md §역방향 대조 — 업무 워크로드 › §원리 대응(관측 7행 · 2026-09-26 W1 개정본).
 * 문서 표가 바뀌면 이 상수를 같은 변경 단위에서 고친다. 오른쪽 구조 열은 구조 사실이고 관측 값은 기록이 채운다.
 */
export const PRINCIPLES: readonly {
  exp: ReverseExp | typeof STREAM_EXP;
  /**
   * 같은 EXP의 두 관측(EXP-40 갱신 비용 · 보이기까지)을 가르는 지표 조건 — 판독기 쪽 규칙(가시성 지표는 이름에 visib).
   * 가시성 칸은 시간 단위 지표만 쓴다 — visible_unobserved(unit count)는 막대 카드에서만 고른다.
   * 비용 칸은 측정 장부 지표(BOOKKEEPING_METRICS · unit bool)를 뺀다 — 비용 관측이 아니다.
   */
  metrics?: (metric: string, unit: string) => boolean;
  observation: string;
  postgresql: string;
  clickhouse: string;
  question: string;
}[] = [
  {
    exp: 'EXP-40',
    metrics: (m, u) => !/visib/i.test(m) && !BOOKKEEPING_METRICS.has(m) && u !== 'bool',
    observation: '갱신 비용(40)',
    postgresql:
      'MVCC — UPDATE는 새 튜플 버전을 쓰고 옛 버전은 죽은 튜플로 남아 VACUUM을 기다린다 · 모든 변경은 WAL에 먼저 쓴다 · status가 인덱스 (line_id, status)의 키라 HOT 조건을 만족하지 않아 인덱스 항목도 새로 쓴다',
    clickhouse:
      '파트는 불변이다 — mutation은 대상 행이 있는 파트의 바뀐 컬럼을 다시 쓴다 · 경량 UPDATE는 바뀐 컬럼 · 정렬 키 · 행 위치 시스템 컬럼만 담은 patch 파트를 쓴다 · RMT는 새 행을 쓰고 옛 버전은 머지가 지운다',
    question: '행 하나를 바꾸는 비용의 단위가 행인가 파트인가',
  },
  {
    exp: 'EXP-40',
    metrics: (m, u) => /visib/i.test(m) && toSeconds(1, u) !== null,
    observation: '보이기까지(40)',
    postgresql: '커밋이 가시성 경계다 — 다음 스냅샷이 새 버전을 본다',
    clickhouse:
      '비동기 mutation은 머지 스케줄에 묶인다(apply_mutations_on_fly가 조회에서 앞당긴다) · patch는 조회 때 적용된다 · RMT는 FINAL이 조회 때 합친다',
    question: '가시성이 쓰기 쪽 비용인가 읽기 쪽 비용인가',
  },
  {
    exp: 'EXP-41',
    observation: '점조회(41)',
    postgresql: 'B-tree는 루트에서 리프까지 몇 페이지로 행 하나를 가리킨다',
    clickhouse: '희소 기본 인덱스는 그래뉼 하나를 가리키고 그 그래뉼 전체를 읽는다',
    question: '조회당 읽는 행 수가 그래뉼 크기에 묶이는가',
  },
  {
    exp: 'EXP-42',
    observation: '원자성(42)',
    postgresql: '트랜잭션 — 문장 여럿이 한 커밋이다 · 조건부 UPDATE가 행을 잠가 두 번째 완료가 0행을 본다',
    clickhouse: '문장 단위 원자성 · 다문장 트랜잭션 없음(실험 기능은 쓰지 않는다)',
    question: '부분 반영과 경합을 저장소가 막는가 앱이 막아야 하는가',
  },
  {
    exp: 'EXP-43',
    observation: '제약(43)',
    postgresql: 'UNIQUE는 btree 검사 · FK는 참조 행 검사 · CHECK — 전부 커밋 전에 거절',
    clickhouse:
      'CHECK CONSTRAINT는 INSERT 때 행마다 검사 · UNIQUE · FK 없음 · RMT는 정렬 키 단위로 머지 뒤에만 중복을 합친다',
    question: '무결성이 쓰기 시점 보장인가 최종적 수렴인가',
  },
  {
    exp: 'EXP-44',
    observation: '단건 삽입(44)',
    postgresql: '힙 페이지 끝에 행 추가 + WAL · 커밋 단위가 행 하나',
    clickhouse: '삽입마다 새 파트 · 머지가 합친다 · async_insert는 서버 버퍼가 묶어 한 파트로 쓴다',
    question: '쓰기 단위가 작을 때 파트 수 한도가 먼저 오는가',
  },
  {
    exp: 'EXP-45',
    observation: '스트리밍 적재(45)',
    postgresql: 'COPY 한 트랜잭션 · WAL · 삽입 기준 autovacuum',
    clickhouse: '배치 하나 = 파트 · 머지',
    question: '같은 배치에서 두 싱크의 시간이 부하에 따라 어떻게 벌어지는가',
  },
];

const fmtNum = (v: number) =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(2);

/**
 * 원리 대응 행 옆에 둘 기록 값 — 문구가 아니라 기록에서 계산한다.
 * 분포 지표 — 지표마다 가장 큰 업무 규모에서 저장소별 중앙값 범위(변형 · 손잡이 전체의 최소~최대).
 * 구조 지표 — 저장소별 "3회 일치 칸 / 전체 칸 · 한 번이라도 0이 아닌 칸".
 * EXP-45 — 저장소별 판정 점.
 */
export function principleEvidence(
  d: Pick<EvidenceResult, 'reverse' | 'stream'>,
  p: (typeof PRINCIPLES)[number],
): { records: string[]; lines: string[] } {
  const storeName = (s: Store) => (s === 'postgresql' ? 'PG' : 'CH');
  if (p.exp === STREAM_EXP) {
    const lines = (['postgresql', 'clickhouse'] as const).map((s) => {
      const j = streamJudgement(d.stream, s);
      return j.kind === 'crossed'
        ? `${storeName(s)} ${j.pps.toLocaleString('ko-KR')} pps에서 ${j.reason === 'failure' ? '첫 실패' : '기준 초과'}`
        : j.kind === 'none'
          ? `${storeName(s)} 관측 범위(~${j.maxPps.toLocaleString('ko-KR')} pps) 안에서 넘지 않음`
          : j.kind === 'noThreshold'
            ? `${storeName(s)} 기준(창 폭 W) 기재 없음 — 판정하지 않음`
            : `${storeName(s)} 판정할 계단 없음`;
    });
    const records = [...new Set(d.stream.map((r) => r.record))].sort();
    return { records, lines: records.length ? lines : [] };
  }
  const rows = d.reverse.filter((r) => r.exp === p.exp && (!p.metrics || p.metrics(r.metric, r.unit)));
  const lines: string[] = [];
  for (const metric of [...new Set(rows.filter((r) => !r.structural).map((r) => r.metric))].sort()) {
    const of = rows.filter((r) => r.metric === metric && !r.structural && r.median !== null);
    const top = Math.max(...of.map((r) => r.scale));
    const parts = (['postgresql', 'clickhouse'] as const).flatMap((s) => {
      const ms = of.filter((r) => r.store === s && r.scale === top).map((r) => r.median as number);
      if (ms.length === 0) return [];
      const lo = Math.min(...ms);
      const hi = Math.max(...ms);
      return [`${storeName(s)} ${lo === hi ? fmtNum(lo) : `${fmtNum(lo)}~${fmtNum(hi)}`}`];
    });
    if (parts.length)
      lines.push(`${metric} @${formatRows(top)}행 — ${parts.join(' · ')} ${of[0]?.unit ?? ''}`.trim());
  }
  if (rows.some((r) => r.structural)) {
    const sum = structuralSummary(rows, p.exp);
    for (const s of ['postgresql', 'clickhouse'] as const) {
      const c = sum[s];
      const total = c.consistent + c.varies + c.incomplete;
      if (total)
        lines.push(`${storeName(s)} 구조 3회 일치 ${c.consistent}/${total}칸 · 0 아닌 칸 ${c.nonZero}`);
    }
  }
  return { records: [...new Set(rows.map((r) => r.record))].sort(), lines };
}
