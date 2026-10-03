// 측정 기록 판독기 — 두 화면의 기록 원천(08_screen/08_evidence_screens.md).
// 형식 정본 10_observability/04_experiment_protocol.md §기계 판독 블록 · §BFF 판독 규칙 7.
// 순수 함수만 둔다 — 파일 읽기는 BFF 라우트(app/bff/measurements)가 하고, 여기는 (파일명, 본문) 목록을 판정한다.
// BFF는 읽기만 한다 — 기록을 만들거나 고치는 경로가 없다.

export const SCHEMA_V1 = 'measurement/v1';
/** 역전 지점 패널이 쓰는 실험 — 대조군 쿼리 5종(규칙 6 · 채번 정본 10_observability/06) */
export const CONTROL_EXPS = ['EXP-01', 'EXP-02', 'EXP-03', 'EXP-04', 'EXP-05'] as const;
const SWITCH_IDS = Array.from({ length: 11 }, (_, i) => `SW-${String(i + 1).padStart(2, '0')}`);
export const RECORD_FILE = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export type Store = 'postgresql' | 'clickhouse';

export interface RunInfo {
  commitHash: string;
  memoryProfile: string;
  /** null = 도구 컨테이너 경로의 상한 없음 — memoryLimitSource가 함께 있을 때만(10_observability/04 §조건 칸) */
  memoryLimitMb: number | null;
  memoryLimitSource?: string;
  capacityTier: string;
}

/**
 * 메모리 상한 칸 — 수이면 그대로, null이면 memoryLimitSource가 비지 않은 문자열일 때만 충족.
 * 그 밖(api health 경로의 null · 출처 없는 null · 다른 형)은 누락 → undefined
 */
export function memoryLimitOf(
  run: Record<string, unknown>,
): Pick<RunInfo, 'memoryLimitMb' | 'memoryLimitSource'> | undefined {
  const { memoryLimitMb, memoryLimitSource } = run;
  if (isNum(memoryLimitMb)) return { memoryLimitMb };
  if (memoryLimitMb === null && typeof memoryLimitSource === 'string' && memoryLimitSource.trim() !== '')
    return { memoryLimitMb: null, memoryLimitSource };
  return undefined;
}

/** 점마다 붙는 4요소 — 툴팁에 싣는다(08_screen/08_evidence_screens.md 계약 "4요소") */
export interface RecordRef {
  record: string;
  run: RunInfo;
  switches: Record<string, unknown>;
}

export interface ControlPoint extends RecordRef {
  query: string;
  rows: number;
  stage: number | null;
  store: Store;
  index: string | null;
  cache: string | null;
  /** ms로 정규화한 3회 값 · 중앙값 */
  valuesMs: number[];
  medianMs: number;
  resultMatch: boolean | null;
}

export interface AxisEntry extends RecordRef {
  axis: string;
  store: Store;
  index: string | null;
  rows: number;
  value: number;
  unit: string;
}

export interface ReadCounts {
  /** 규칙 1을 통과한 기록 파일 수 */
  files: number;
  /** 규칙 2 — 판독 불가 기록(블록 0 · 2 이상 · 필수 필드 형식 위반) */
  unreadable: number;
  /** 규칙 6 — EXP-01~05를 인용한 판독 가능 기록 */
  control: number;
  /** 규칙 3 — 폐기 · 정정된 대조 기록 */
  excludedStatus: number;
  /** 규칙 5 — 반복 수 부족 · 편차 기준 초과 */
  excludedDeviation: number;
  /** 규칙 4 — 4요소 누락 */
  missingConditions: number;
  /** 형식이 어긋나 뺀 점 · 축 값 */
  invalidPoints: number;
  /** 같은 (쿼리 · 행 · 저장소 · 변형 · 캐시) 점이 여러 기록에 있어 뒤 기록만 남긴 수 */
  duplicatePoints: number;
  /** structuralRanges가 배열이 아닌 대조 기록 — 구조 판정 원천 후보가 아니다 */
  invalidStructural: number;
}

export interface ReadResult {
  counts: ReadCounts;
  /** 판독 불가 기록 파일명 — 조용히 빼지 않는다 */
  unreadableFiles: string[];
  points: ControlPoint[];
  axes: AxisEntry[];
  /** 구조 판정 역전 구간의 원천 — 없으면 null(08_screen/08_evidence_screens.md 계약 "구조 판정 원천 선택") */
  structural: StructuralSource | null;
}

/** structuralRanges 한 행 — 역전이 있으면 crossover 구간, 없으면 winner · range */
export type StructuralRange =
  | {
      query: string;
      cache: string;
      pgVariant: string;
      /** 반개구간 (a, b] — 10_observability/04 §기계 판독 블록 */
      crossover: [string, string];
      /** 선택 — 역전 방향(앞선 쪽 → 뒤 쪽) · 없으면 null */
      direction: { from: Store; to: Store } | null;
      undetermined: string[];
    }
  | {
      query: string;
      cache: string;
      pgVariant: string;
      crossover: null;
      winner: Store;
      /** 닫힌 관측 범위 — 양 끝이 판정에 든다 */
      range: [string, string];
      undetermined: string[];
    };

export interface StructuralSource extends RecordRef {
  /** 원천 기록의 status 그대로 — 근거 표지에 싣는다(폐기 기록이어도 구조 사실은 보인다) */
  status: string;
  ranges: StructuralRange[];
  /** 형식이 어긋나 뺀 행 */
  invalidRanges: number;
}

export interface Block {
  record: string;
  exp: string[];
  status: string;
  supersedes: string | null;
  run: Record<string, unknown>;
  switches: Record<string, unknown>;
  repeat: { runs: number; deviation: number; threshold: number };
  points: unknown[];
  axes: unknown[];
  /** undefined = 필드 없음 · 배열이 아니면 null */
  structuralRanges: unknown[] | null | undefined;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 본문의 json 펜스들 — ```json … ``` (펜스 언어 json만 · 10_observability/04 판정) */
export function jsonFences(text: string): string[] {
  const out: string[] = [];
  const re = /^```json[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) out.push(m[1] ?? '');
  return out;
}

/** schema가 measurement/v1인 블록만 센다 — 정확히 1개가 아니면 null(규칙 2) */
export function pickBlock(text: string): unknown | null {
  const found: unknown[] = [];
  for (const body of jsonFences(text)) {
    try {
      const v: unknown = JSON.parse(body);
      if (isObj(v) && v.schema === SCHEMA_V1) found.push(v);
    } catch {
      // json 펜스지만 JSON이 아니면 기계 판독 블록이 아니다 — 블록 0이면 아래에서 판독 불가로 센다
    }
  }
  return found.length === 1 ? (found[0] ?? null) : null;
}

/** 필수 필드 형식(표 §기계 판독 블록) — 어기면 판독 불가. 모르는 필드는 무시한다(규칙 7) */
export function validate(v: unknown): Block | null {
  if (!isObj(v)) return null;
  const { record, exp, status, supersedes, run, switches, repeat, points, axes } = v;
  if (typeof record !== 'string' || !/^\d{3}$/.test(record)) return null;
  if (!Array.isArray(exp) || !exp.every((e) => typeof e === 'string')) return null;
  if (typeof status !== 'string') return null;
  if (supersedes !== null && typeof supersedes !== 'string') return null;
  if (!isObj(run) || !isObj(switches) || !isObj(repeat)) return null;
  if (!isObj(v.window) || !isObj(v.conditions) || !Array.isArray(v.results)) return null;
  if (!isNum(repeat.runs) || !isNum(repeat.deviation) || !isNum(repeat.threshold)) return null;
  if (points !== undefined && !Array.isArray(points)) return null;
  if (axes !== undefined && !Array.isArray(axes)) return null;
  return {
    record,
    exp: exp as string[],
    status,
    supersedes: supersedes as string | null,
    run,
    switches,
    repeat: { runs: repeat.runs, deviation: repeat.deviation, threshold: repeat.threshold },
    points: (points as unknown[] | undefined) ?? [],
    axes: (axes as unknown[] | undefined) ?? [],
    structuralRanges:
      v.structuralRanges === undefined
        ? undefined
        : Array.isArray(v.structuralRanges)
          ? v.structuralRanges
          : null,
  };
}

/** 규칙 4 — run 네 필드와 switches 11키가 전부 null이 아니다(배열 값은 원소마다 · memoryLimitMb는 memoryLimitOf 예외) */
export function conditionsComplete(b: Block): RunInfo | null {
  const { commitHash, memoryProfile, capacityTier } = b.run;
  if (typeof commitHash !== 'string' || typeof memoryProfile !== 'string') return null;
  const limit = memoryLimitOf(b.run);
  if (limit === undefined || typeof capacityTier !== 'string') return null;
  for (const id of SWITCH_IDS) {
    const sv = b.switches[id];
    if (sv === null || sv === undefined) return null;
    if (Array.isArray(sv) && sv.some((x) => x === null || x === undefined)) return null;
  }
  return { commitHash, memoryProfile, ...limit, capacityTier };
}

function toMs(v: number, unit: unknown): number | null {
  if (unit === 'ms') return v;
  if (unit === 's') return v * 1000;
  if (unit === 'us' || unit === 'µs') return v / 1000;
  return null;
}

const asStore = (v: unknown): Store | null => (v === 'postgresql' || v === 'clickhouse' ? v : null);

function parsePoint(p: unknown, ref: RecordRef): ControlPoint | null {
  if (!isObj(p)) return null;
  const store = asStore(p.store);
  if (typeof p.query !== 'string' || !isNum(p.rows) || p.rows <= 0 || !store || !isNum(p.median)) return null;
  const medianMs = toMs(p.median, p.unit);
  if (medianMs === null) return null;
  const values = Array.isArray(p.values) ? p.values.filter(isNum) : [];
  return {
    ...ref,
    query: p.query,
    rows: p.rows,
    stage: isNum(p.stage) ? p.stage : null,
    store,
    index: typeof p.index === 'string' ? p.index : null,
    cache: typeof p.cache === 'string' ? p.cache : null,
    valuesMs: values.map((x) => toMs(x, p.unit) as number),
    medianMs,
    resultMatch: typeof p.resultMatch === 'boolean' ? p.resultMatch : null,
  };
}

function parseAxis(a: unknown, ref: RecordRef): AxisEntry | null {
  if (!isObj(a)) return null;
  const store = asStore(a.store);
  if (typeof a.axis !== 'string' || !store || !isNum(a.rows) || a.rows <= 0 || !isNum(a.value)) return null;
  return {
    ...ref,
    axis: a.axis,
    store,
    index: typeof a.index === 'string' ? a.index : null,
    rows: a.rows,
    value: a.value,
    unit: typeof a.unit === 'string' ? a.unit : '',
  };
}

/** 행 수 지수 표기 "10^k"(k 소수 허용) — 10_observability/04 §기계 판독 블록 */
const EXP_NOTATION = /^10\^\d+(\.\d+)?$/;
const isExp = (v: unknown): v is string => typeof v === 'string' && EXP_NOTATION.test(v);
const isPair = (v: unknown): v is [string, string] => Array.isArray(v) && v.length === 2 && v.every(isExp);

/** 필수 query · cache · pgVariant · crossover · undetermined · crossover null일 때만 winner · range · from · to 선택 */
function parseRange(r: unknown): StructuralRange | null {
  if (!isObj(r)) return null;
  const { query, cache, pgVariant, crossover, winner, range, undetermined } = r;
  if (typeof query !== 'string' || typeof cache !== 'string' || typeof pgVariant !== 'string') return null;
  if (!Array.isArray(undetermined) || !undetermined.every(isExp)) return null;
  const base = { query, cache, pgVariant, undetermined: undetermined as string[] };
  if (crossover === undefined) return null;
  if (crossover !== null) {
    if (!isPair(crossover) || winner !== undefined || range !== undefined) return null;
    if (r.from === undefined && r.to === undefined) return { ...base, crossover, direction: null };
    const from = asStore(r.from);
    const to = asStore(r.to);
    if (!from || !to || from === to) return null;
    return { ...base, crossover, direction: { from, to } };
  }
  const w = asStore(winner);
  if (!w || !isPair(range)) return null;
  return { ...base, crossover: null, winner: w, range };
}

/**
 * 구조 판정 원천 — EXP-01~05 · structuralRanges 배열 · 4요소 완비 · superseded 아님인 기록 가운데 번호가 가장 큰 하나.
 * 규칙 3의 status 조건(valid)과 규칙 5(편차)는 적용하지 않는다 — 구조 판정에는 편차 폐기가 없다(10_observability/04 §구조 판정과 분포 판정).
 * superseded(status superseded 또는 다른 valid 기록의 supersedes 대상)는 뺀다 — 정정된 판정을 원천으로 삼지 않는다.
 */
function pickStructural(
  blocks: readonly Block[],
  superseded: ReadonlySet<string | null>,
): StructuralSource | null {
  const candidates = blocks
    .filter((b) => b.exp.some((e) => (CONTROL_EXPS as readonly string[]).includes(e)))
    .filter((b) => Array.isArray(b.structuralRanges))
    .filter((b) => b.status !== 'superseded' && !superseded.has(b.record))
    .sort((x, y) => y.record.localeCompare(x.record));
  for (const b of candidates) {
    const run = conditionsComplete(b);
    if (!run) continue;
    const ranges: StructuralRange[] = [];
    let invalidRanges = 0;
    for (const raw of b.structuralRanges as unknown[]) {
      const r = parseRange(raw);
      if (r) ranges.push(r);
      else invalidRanges++;
    }
    return { record: b.record, run, switches: b.switches, status: b.status, ranges, invalidRanges };
  }
  return null;
}

/** 기록 파일 목록 → 역전 지점 패널 입력. 규칙 1~7을 이 순서로 적용한다(규칙 6은 판독 뒤 · 3 · 5 · 4보다 먼저 — 다른 실험의 폐기 · 누락을 패널 수에 섞지 않는다) */
export function readMeasurements(files: readonly { name: string; text: string }[]): ReadResult {
  const counts: ReadCounts = {
    files: 0,
    unreadable: 0,
    control: 0,
    excludedStatus: 0,
    excludedDeviation: 0,
    missingConditions: 0,
    invalidPoints: 0,
    duplicatePoints: 0,
    invalidStructural: 0,
  };
  const unreadableFiles: string[] = [];
  const blocks: Block[] = [];
  for (const f of files) {
    if (!RECORD_FILE.test(f.name)) continue; // 규칙 1 — 기록 파일이 아니다
    counts.files++;
    const b = validate(pickBlock(f.text)); // 규칙 2 · 형식
    if (!b) {
      counts.unreadable++;
      unreadableFiles.push(f.name);
      continue;
    }
    blocks.push(b);
  }
  // 규칙 3의 "다른 valid 기록의 supersedes" — 전체 판독 가능 기록에서 모은다(정정 기록이 다른 exp를 인용해도 옛 기록을 뺀다)
  const superseded = new Set(
    blocks.filter((b) => b.status === 'valid' && b.supersedes).map((b) => b.supersedes),
  );

  const byKey = new Map<string, ControlPoint>();
  const axesByKey = new Map<string, AxisEntry>();
  for (const b of blocks.sort((x, y) => x.record.localeCompare(y.record))) {
    if (!b.exp.some((e) => (CONTROL_EXPS as readonly string[]).includes(e))) continue; // 규칙 6
    counts.control++;
    if (b.structuralRanges === null) counts.invalidStructural++; // 배열이 아닌 structuralRanges — 구조 판정 원천 후보가 아니다
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
    const ref: RecordRef = { record: b.record, run, switches: b.switches };
    for (const raw of b.points) {
      const p = parsePoint(raw, ref);
      if (!p) {
        counts.invalidPoints++;
        continue;
      }
      const key = `${p.query}|${p.rows}|${p.store}|${p.index}|${p.cache}`;
      if (byKey.has(key)) counts.duplicatePoints++; // 기록 번호 오름차순이라 뒤 기록이 덮는다
      byKey.set(key, p);
    }
    for (const raw of b.axes) {
      const a = parseAxis(raw, ref);
      if (!a) {
        counts.invalidPoints++;
        continue;
      }
      // 점과 같은 규칙 — 같은 (축 · 저장소 · 변형 · 행 수)는 뒤 기록이 덮고 그 수를 센다(검수 #10)
      const key = `${a.axis}|${a.store}|${a.index}|${a.rows}`;
      if (axesByKey.has(key)) counts.duplicatePoints++;
      axesByKey.set(key, a);
    }
  }
  return {
    counts,
    unreadableFiles,
    points: [...byKey.values()],
    axes: [...axesByKey.values()],
    structural: pickStructural(blocks, superseded),
  };
}

/** 10^k 표기 — 격자 단계 행 수(10^5 · 10^6 …)는 지수로, 그 밖은 천 단위 구분 */
export function formatRows(rows: number): string {
  const k = Math.log10(rows);
  if (Number.isInteger(k)) return `10^${k}`;
  const m = rows / 10 ** Math.floor(k);
  if (Number.isInteger(m)) return `${m} × 10^${Math.floor(k)}`;
  return rows.toLocaleString('ko-KR');
}
