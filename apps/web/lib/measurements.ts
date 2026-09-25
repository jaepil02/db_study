// 측정 기록 판독기 — EXP-COMPARE 대조군 역전 지점 패널의 원천(08_screen/07 §대조군 역전 지점).
// 형식 정본 10_observability/04_experiment_protocol.md §기계 판독 블록 · §BFF 판독 규칙 7.
// 순수 함수만 둔다 — 파일 읽기는 BFF 라우트(app/bff/measurements)가 하고, 여기는 (파일명, 본문) 목록을 판정한다.
// BFF는 읽기만 한다 — 기록을 만들거나 고치는 경로가 없다.

export const SCHEMA_V1 = 'measurement/v1';
/** 역전 지점 패널이 쓰는 실험 — 대조군 쿼리 5종(규칙 6 · 채번 정본 10_observability/06) */
export const CONTROL_EXPS = ['EXP-01', 'EXP-02', 'EXP-03', 'EXP-04', 'EXP-05'] as const;
/** EXP ↔ 쿼리 1:1(05_data_stores/10 §EXP 예약 대역 연결) */
export const QUERY_LABELS: Record<string, string> = {
  Q1: 'Q1 단일 태그 1시간 (EXP-01)',
  Q2: 'Q2 단일 태그 7일 (EXP-02)',
  Q3: 'Q3 설비 전체 1일 (EXP-03)',
  Q4: 'Q4 분 단위 롤업 재계산 (EXP-04)',
  Q5: 'Q5 전체 스캔 count (EXP-05)',
};
/** 비 쿼리 축 5(axes.axis 값) — 쿼리 시간(points) 1과 합쳐 비교 축 6(05_data_stores/10 §비교 축 6) */
export const AXIS_LABELS: Record<string, string> = {
  storage_bytes: '저장 용량',
  compression_ratio: '압축률',
  insert_rows_per_sec: '삽입 처리량',
  write_amplification: 'VACUUM/WAL 증폭',
  index_bytes: '인덱스 크기',
};
const SWITCH_IDS = Array.from({ length: 11 }, (_, i) => `SW-${String(i + 1).padStart(2, '0')}`);
const RECORD_FILE = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export type Store = 'postgresql' | 'clickhouse';

export interface RunInfo {
  commitHash: string;
  memoryProfile: string;
  memoryLimitMb: number;
  capacityTier: string;
}

/** 점마다 붙는 4요소 — 툴팁에 싣는다(08_screen/07 §대조군 역전 지점 계약 "4요소") */
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
}

export interface ReadResult {
  counts: ReadCounts;
  /** 판독 불가 기록 파일명 — 조용히 빼지 않는다 */
  unreadableFiles: string[];
  points: ControlPoint[];
  axes: AxisEntry[];
}

interface Block {
  record: string;
  exp: string[];
  status: string;
  supersedes: string | null;
  run: Record<string, unknown>;
  switches: Record<string, unknown>;
  repeat: { runs: number; deviation: number; threshold: number };
  points: unknown[];
  axes: unknown[];
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
function pickBlock(text: string): unknown | null {
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
function validate(v: unknown): Block | null {
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
  return { counts, unreadableFiles, points: [...byKey.values()], axes: [...axesByKey.values()] };
}

// ── 역전 판정 ──

export interface SeriesPoint {
  rows: number;
  medianMs: number;
  point: ControlPoint;
}

export type Crossover =
  | { kind: 'crossed'; rows: number; prevRows: number | null; before: Store | 'tie'; after: Store | 'tie' }
  | { kind: 'none'; maxRows: number; leader: Store | 'tie' }
  | { kind: 'insufficient' };

/** 선택(쿼리 · 인덱스 변형 · 캐시 상태)에 맞는 두 선 — PostgreSQL은 고른 변형 · ClickHouse는 변형 없음(index null)이 기본이다 */
export function selectSeries(
  points: readonly ControlPoint[],
  sel: { query: string; index: string; cache: string },
): { postgresql: SeriesPoint[]; clickhouse: SeriesPoint[] } {
  const pick = (store: Store) =>
    points
      .filter(
        (p) =>
          p.store === store &&
          p.query === sel.query &&
          (p.cache ?? '') === sel.cache &&
          (store === 'postgresql' ? p.index === sel.index : p.index === null || p.index === sel.index),
      )
      .map((p) => ({ rows: p.rows, medianMs: p.medianMs, point: p }))
      .sort((a, b) => a.rows - b.rows);
  // ClickHouse 쪽에 변형 없는 점과 같은 변형 점이 함께 있으면 변형 없는 점을 쓴다(행 수당 1점)
  const dedupe = (xs: SeriesPoint[]) => {
    const m = new Map<number, SeriesPoint>();
    for (const x of xs) {
      const had = m.get(x.rows);
      if (!had || (had.point.index !== null && x.point.index === null)) m.set(x.rows, x);
    }
    return [...m.values()].sort((a, b) => a.rows - b.rows);
  };
  return { postgresql: pick('postgresql'), clickhouse: dedupe(pick('clickhouse')) };
}

const faster = (pg: number, ch: number): Store | 'tie' =>
  pg < ch ? 'postgresql' : ch < pg ? 'clickhouse' : 'tie';

/**
 * 두 선이 처음 교차하는 용량 단계 — 두 저장소가 모두 있는 행 수만 본다.
 * 첫 공통 단계의 앞선 쪽(더 빠른 쪽)이 바뀌는 첫 단계가 역전 단계다. 같음(tie)은 그 단계에서 교차한 것으로 본다.
 * 첫 단계들이 같음이면 처음으로 한쪽이 앞선 단계를 기준으로 삼는다.
 */
export function findCrossover(pg: readonly SeriesPoint[], ch: readonly SeriesPoint[]): Crossover {
  const chBy = new Map(ch.map((c) => [c.rows, c.medianMs]));
  const common = pg
    .filter((p) => chBy.has(p.rows))
    .map((p) => ({ rows: p.rows, lead: faster(p.medianMs, chBy.get(p.rows) as number) }))
    .sort((a, b) => a.rows - b.rows);
  if (common.length === 0) return { kind: 'insufficient' };
  let base: Store | 'tie' = 'tie';
  let prevRows: number | null = null;
  for (const c of common) {
    if (base === 'tie') {
      base = c.lead;
    } else if (c.lead !== base) {
      return { kind: 'crossed', rows: c.rows, prevRows, before: base, after: c.lead };
    }
    prevRows = c.rows;
  }
  const last = common[common.length - 1] as { rows: number; lead: Store | 'tie' };
  return { kind: 'none', maxRows: last.rows, leader: base };
}

/** 10^k 표기 — 격자 단계 행 수(10^5 · 10^6 …)는 지수로, 그 밖은 천 단위 구분 */
export function formatRows(rows: number): string {
  const k = Math.log10(rows);
  if (Number.isInteger(k)) return `10^${k}`;
  const m = rows / 10 ** Math.floor(k);
  if (Number.isInteger(m)) return `${m} × 10^${Math.floor(k)}`;
  return rows.toLocaleString('ko-KR');
}
