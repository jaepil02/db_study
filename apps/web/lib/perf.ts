// EXP-PERF 판독기 — 규모별 성능 비교(08_screen/08_evidence_screens.md §EXP-PERF §데이터 원천 · §판독 규칙 P1~P6).
// 기록 판독의 공통 규칙(파일명 · 블록 1개 · 필수 형식 · 4요소 · 구조 판정 원천 선택)은 lib/measurements.ts를 그대로 쓰고,
// 여기서는 규칙 3(status valid) · 5(편차)를 참고값 표시로 바꾼 성능 보기만 만든다(리드 판정 1 · 10_observability/04 §기록 상태와 정정의 화면 참고값 예외).
// 순수 함수만 둔다 — 파일 읽기는 BFF 라우트(app/bff/measurements?view=perf)가 한다. 기록을 만들거나 고치는 경로가 없다.
import {
  type Block,
  conditionsComplete,
  pickBlock,
  RECORD_FILE,
  type RunInfo,
  readMeasurements,
  type Store,
  type StructuralRange,
  validate,
} from './measurements';

/** 곡선 · 히트맵 · 원리 증거가 싣는 쿼리 — Q5x(auxPoints)는 싣지 않는다(§판독 규칙 아래 auxPoints 불릿) */
export const PERF_QUERIES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
export const PG_VARIANTS = ['I1', 'I2'] as const;
export type PgVariant = (typeof PG_VARIANTS)[number];
/** 공통 논리 크기의 행당 바이트 — 설계 상수(05_data_stores/10 §비교 축 6 · 같은 변경 단위에서 따라간다) */
export const LOGICAL_ROW_BYTES = 41;

/** 점 단위 우열 — 저장소 · 우열 미정 · 방향 미상(P4 — crossover는 있는데 방향을 찾지 못함) */
export type Verdict = Store | 'undetermined' | 'unknown-direction';

export interface PerfPoint {
  record: string;
  /** 기록 status 그대로 — discarded면 점선 · 회색 · 참고값 배지(P3) */
  status: string;
  query: string;
  rows: number;
  /** log10(rows)를 0.25 단위로 반올림(P4) */
  exponent: number;
  /** 053 정밀화 점 이름(r5.5 등) · 단계 기록은 null */
  point: string | null;
  store: Store;
  index: string | null;
  cache: string;
  values: number[];
  median: number;
  serverValues: number[] | null;
  serverMedian: number | null;
  /** 편차 판정 기준(client · server) */
  basis: string | null;
  deviation: number | null;
  /** 그 기록의 repeat.threshold — 점 편차가 넘으면 툴팁 "편차 N% > 기준"(P3) */
  threshold: number;
  resultMatch: boolean | null;
}

export interface PointVerdict {
  query: string;
  cache: string;
  pgVariant: string;
  exponent: number;
  verdict: Verdict;
  record: string;
}

/** structuralRanges 한 행 + 방향 보강(053은 행에 방향이 없고 crossovers[]에만 있다 — 같은 키로 찾는다) */
export type PerfRange = StructuralRange;

export interface ScanPg {
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  tempReadBlocks: number | null;
  workersLaunched: number | null;
  actualRows: number | null;
  /** 버퍼 블록(hit + read) ÷ 힙 블록 — 100%를 넘으면 방문 횟수 */
  bufferRatio: number | null;
  /** 계획 노드 — 051 · 052만 · 없으면 null("계획 노드 기록 없음") */
  nodes: string[] | null;
}

export interface ScanQuery {
  query: string;
  ch: { readRows: number; readBytes: number; resultRows: number | null; readBytesRatio: number } | null;
  pg: Partial<Record<PgVariant, ScanPg>>;
}

/** 원리 증거 한 규모(단계 기록 1개) */
export interface ScanStage {
  record: string;
  status: string;
  rows: number;
  exponent: number;
  /** 공통 논리 크기 = rows × 41 B */
  logicalBytes: number;
  /** 같은 기록 Q5 I1의 hit + read — Seq Scan이 힙 전부를 읽는다 · 없으면 null */
  heapBlocks: number | null;
  queries: ScanQuery[];
}

/** 저장 비용 한 규모 — 결정적 값(단계당 1회) */
export interface StorageStage {
  record: string;
  status: string;
  rows: number;
  exponent: number;
  perRowBytes: { ch: number | null; pg: number | null };
  compression: { ch: number | null; pg: number | null };
  indexBytes: { ch: number | null; brin: number | null; btree: number | null };
  /** PostgreSQL WAL 증폭 비율 그대로 */
  walAmplification: number | null;
  /** I2 인덱스 생성 WAL 바이트 — 기록 값이 있을 때만(051 · 052 buildWalBytes · 적재 WAL 아님) */
  btreeBuildWalBytes: number | null;
}

/** 조건 표지 — 원천 기록의 run · switches · conditions에서 */
export interface ConditionMarks {
  record: string;
  status: string;
  run: RunInfo;
  switches: Record<string, unknown>;
  repeat: { runs: number; deviation: number; threshold: number };
  cpuset: string | null;
  storeResources: string | null;
  controlMemoryMb: string | null;
  clickhouseMaxThreads: string | null;
  pgMaxParallelWorkersPerGather: string | null;
  clickhouseServerLogLevel: string | null;
  tieRule: string | null;
  serverTimeAsymmetry: string | null;
  cacheDefinition: string | null;
}

export interface PerfRecord {
  record: string;
  status: string;
  run: RunInfo;
  switches: Record<string, unknown>;
}

export type StageExclusion = 'absent' | 'unreadable' | 'superseded' | 'missing-conditions';

export interface StageRecordRef {
  stage: number;
  record: string;
  /** null = 곡선 · 원리 증거 · 저장 비용에 더했다 */
  excluded: StageExclusion | null;
}

export interface PerfCounts {
  /** 규칙 1을 통과한 기록 파일 수 */
  files: number;
  /** 판독 불가 기록 */
  unreadable: number;
  /** 단계 기록 가운데 4요소 누락으로 뺀 수 */
  missingConditions: number;
  /** structuralRanges 형식이 어긋난 행 */
  invalidRanges: number;
  /** structuralRanges가 배열이 아닌 대조 기록 */
  invalidStructural: number;
  /** 형식이 어긋난 점 · scan · axes 행 */
  invalidRows: number;
  /** median null · unit ms 아님 — 그리지 않은 점(P6) · 로그 축의 0 이하는 nonPositive로 따로 */
  undrawn: number;
  /** median 0 이하 — 로그 축에서 그리지 않는다(선형이면 그린다) */
  nonPositive: number;
  /** 같은 점이 두 기록에 있어 번호가 큰 기록만 남긴 수(P5) */
  duplicatePoints: number;
}

export interface PerfView {
  /** P1 원천 기록 — 없으면 null(빈 값 ①) */
  source: ConditionMarks | null;
  /** P2 — null = 원천 기록에 conditions.stageRecords 목록 없음 */
  stageRecords: StageRecordRef[] | null;
  /** 곡선에 더한 기록(원천 + 단계) — 점 툴팁의 4요소 · status */
  records: PerfRecord[];
  /** 그려진 점의 기록 가운데 discarded인 것 — 참고값 배지(P3) */
  discardedRecords: string[];
  points: PerfPoint[];
  verdicts: PointVerdict[];
  ranges: PerfRange[];
  scan: ScanStage[];
  storage: StorageStage[];
  unreadableFiles: string[];
  counts: PerfCounts;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);
const nums = (v: unknown): number[] | null => (Array.isArray(v) && v.every(isNum) ? (v as number[]) : null);

/** 저장소 값 한 모양 — dominance의 "CH" · "PG"를 pairVerdicts · structuralRanges · crossovers 값으로(P4) */
export function normalizeStore(v: unknown): Store | null {
  if (v === 'clickhouse' || v === 'CH') return 'clickhouse';
  if (v === 'postgresql' || v === 'PG') return 'postgresql';
  return null;
}

/** 행 수 → 지수 — log10을 0.25 단위로 반올림(P4) */
export const exponentOf = (rows: number): number => Math.round(Math.log10(rows) * 4) / 4;

/**
 * 비율 → 백분율 문구 — 작은 비율이 "0.0%"로 뭉개지지 않게 1% 미만은 유효 숫자 2자리(0.012% · 0.5%) · 1% 이상은 소수 1자리 ·
 * 0.001% 미만은 "< 0.001%" · 정확히 0은 "0%". 기록이 0.01%를 냈는데 화면이 0.0%로 보이면 "읽지 않았다"로 읽힌다.
 */
export function ratioPercent(r: number): string {
  const p = r * 100;
  if (p === 0) return '0%';
  if (Math.abs(p) >= 1) return `${p.toFixed(1)}%`;
  if (Math.abs(p) < 0.001) return '< 0.001%';
  return `${Number(p.toPrecision(2))}%`;
}
/** "10^7.25" → 7.25 */
export const parseExp = (s: string): number => Number(s.slice(3));

/** 조건 칸 문자열 — 객체는 "키=값" 나열 */
function condText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  if (isObj(v))
    return Object.entries(v)
      .map(([k, x]) => `${k}=${String(x)}`)
      .join(' · ');
  return String(v);
}

interface Loaded {
  name: string;
  raw: Record<string, unknown>;
  block: Block;
}

/** 점 한 개 — 기록별 이름(server.* · serverValues · judgment.* · deviationBasis · judgmentBasis)을 한 모양으로 */
function parsePoint(
  p: unknown,
  rec: { record: string; status: string; threshold: number },
): PerfPoint | 'undrawn' | null {
  if (!isObj(p)) return null;
  const store = normalizeStore(p.store);
  if (typeof p.query !== 'string' || !isNum(p.rows) || p.rows <= 0 || !store) return null;
  if (!isNum(p.median) || p.unit !== 'ms') return 'undrawn'; // P6
  const server = isObj(p.server) ? p.server : null;
  const judgment = isObj(p.judgment) ? p.judgment : null;
  const basis = judgment?.basis ?? p.deviationBasis ?? p.judgmentBasis;
  return {
    record: rec.record,
    status: rec.status,
    query: p.query,
    rows: p.rows,
    exponent: exponentOf(p.rows),
    point: typeof p.point === 'string' ? p.point : null,
    store,
    index: typeof p.index === 'string' ? p.index : null,
    cache: typeof p.cache === 'string' ? p.cache : '',
    values: nums(p.values) ?? [],
    median: p.median,
    serverValues: nums(server ? server.values : p.serverValues),
    serverMedian: numOrNull(server ? server.median : p.serverMedian),
    basis: typeof basis === 'string' ? basis : null,
    deviation: numOrNull(judgment ? judgment.deviation : p.deviation),
    threshold: rec.threshold,
    resultMatch: typeof p.resultMatch === 'boolean' ? p.resultMatch : null,
  };
}

/** 단계 기록의 점 단위 우열 — 048~050 dominance[] · 051 · 052 pairVerdicts[] */
function stageVerdicts(raw: Record<string, unknown>, record: string, exponent: number): PointVerdict[] {
  const out: PointVerdict[] = [];
  const push = (q: unknown, c: unknown, v: unknown, w: Store | null) => {
    if (typeof q !== 'string' || typeof c !== 'string' || typeof v !== 'string') return;
    out.push({ query: q, cache: c, pgVariant: v, exponent, verdict: w ?? 'undetermined', record });
  };
  if (Array.isArray(raw.dominance))
    for (const d of raw.dominance)
      if (isObj(d)) push(d.query, d.cache, d.index, d.unanimous === true ? normalizeStore(d.winner) : null);
  if (Array.isArray(raw.pairVerdicts))
    for (const d of raw.pairVerdicts)
      if (isObj(d)) push(d.query, d.cache, d.index, normalizeStore(d.structuralWinner));
  return out;
}

/**
 * structuralRanges 행에서 한 점의 우열(P4 — 053 정밀화 점).
 * undetermined에 그 지수가 있으면 미정 · crossover (a, b]가 있으면 a 이하는 from · b 이상은 to · 사이는 미정 ·
 * 방향을 찾지 못하면 방향 미상 · crossover null이면 range 안은 winner · 밖은 미정.
 */
export function verdictFromRange(r: PerfRange, exponent: number): Verdict {
  if (r.undetermined.some((u) => parseExp(u) === exponent)) return 'undetermined';
  if (r.crossover !== null) {
    const [a, b] = r.crossover.map(parseExp) as [number, number];
    if (exponent > a && exponent < b) return 'undetermined';
    if (!r.direction) return 'unknown-direction';
    return exponent <= a ? r.direction.from : r.direction.to;
  }
  const [lo, hi] = r.range.map(parseExp) as [number, number];
  return exponent >= lo && exponent <= hi ? r.winner : 'undetermined';
}

/** 원리 증거 한 규모 — invalid = 형식이 어긋난 scan 행 수 */
function parseScan(
  raw: Record<string, unknown>,
  record: string,
  status: string,
  rows: number,
): { stage: ScanStage; invalid: number } | null {
  if (!Array.isArray(raw.scan)) return null;
  const byQuery = new Map<string, ScanQuery>();
  let invalid = 0;
  const rowsOf = (q: string) => {
    const had = byQuery.get(q) ?? { query: q, ch: null, pg: {} };
    byQuery.set(q, had);
    return had;
  };
  const logicalBytes = rows * LOGICAL_ROW_BYTES;
  const q5 = raw.scan.find(
    (s) => isObj(s) && s.query === 'Q5' && s.store === 'postgresql' && s.index === 'I1',
  );
  const heapBlocks =
    isObj(q5) && isNum(q5.sharedHitBlocks) && isNum(q5.sharedReadBlocks)
      ? q5.sharedHitBlocks + q5.sharedReadBlocks
      : null;
  for (const s of raw.scan) {
    if (!isObj(s) || typeof s.query !== 'string') {
      invalid++;
      continue;
    }
    if (!(PERF_QUERIES as readonly string[]).includes(s.query)) continue; // Q5x 제외
    const store = normalizeStore(s.store);
    if (store === 'clickhouse' && isNum(s.readRows) && isNum(s.readBytes)) {
      rowsOf(s.query).ch = {
        readRows: s.readRows,
        readBytes: s.readBytes,
        resultRows: numOrNull(s.resultRows),
        readBytesRatio: s.readBytes / logicalBytes,
      };
    } else if (
      store === 'postgresql' &&
      (s.index === 'I1' || s.index === 'I2') &&
      isNum(s.sharedHitBlocks) &&
      isNum(s.sharedReadBlocks)
    ) {
      rowsOf(s.query).pg[s.index] = {
        sharedHitBlocks: s.sharedHitBlocks,
        sharedReadBlocks: s.sharedReadBlocks,
        tempReadBlocks: numOrNull(s.tempReadBlocks),
        workersLaunched: numOrNull(s.workersLaunched),
        actualRows: numOrNull(s.actualRows),
        bufferRatio: heapBlocks ? (s.sharedHitBlocks + s.sharedReadBlocks) / heapBlocks : null,
        nodes: Array.isArray(s.nodes) && s.nodes.every((n) => typeof n === 'string') ? s.nodes : null,
      };
    } else invalid++;
  }
  return {
    stage: {
      record,
      status,
      rows,
      exponent: exponentOf(rows),
      logicalBytes,
      heapBlocks,
      queries: PERF_QUERIES.filter((q) => byQuery.has(q)).map((q) => byQuery.get(q) as ScanQuery),
    },
    invalid,
  };
}

function parseStorage(
  raw: Record<string, unknown>,
  record: string,
  status: string,
  rows: number,
): StorageStage | null {
  if (!Array.isArray(raw.axes)) return null;
  const find = (axis: string, store: Store, index: string | null) => {
    const a = (raw.axes as unknown[]).find(
      (x) =>
        isObj(x) &&
        x.axis === axis &&
        normalizeStore(x.store) === store &&
        x.index === index &&
        x.rows === rows,
    );
    return isObj(a) ? a : null;
  };
  const val = (a: Record<string, unknown> | null) => (a ? numOrNull(a.value) : null);
  const chStorage = val(find('storage_bytes', 'clickhouse', null));
  const pgStorage = val(find('storage_bytes', 'postgresql', 'I1'));
  const btree = find('index_bytes', 'postgresql', 'I2');
  return {
    record,
    status,
    rows,
    exponent: exponentOf(rows),
    perRowBytes: {
      ch: chStorage === null ? null : chStorage / rows,
      pg: pgStorage === null ? null : pgStorage / rows,
    },
    compression: {
      ch: val(find('compression_ratio', 'clickhouse', null)),
      pg: val(find('compression_ratio', 'postgresql', 'I1')),
    },
    indexBytes: {
      ch: val(find('index_bytes', 'clickhouse', null)),
      brin: val(find('index_bytes', 'postgresql', 'I1')),
      btree: val(btree),
    },
    walAmplification: val(find('write_amplification', 'postgresql', 'I1')),
    btreeBuildWalBytes: btree ? numOrNull(btree.buildWalBytes) : null,
  };
}

/** 단계 기록 한 개의 규모 — conditions.gridRows가 있으면 그것 · 없으면 점의 행 수 가운데 가장 흔한 값 */
function stageRows(raw: Record<string, unknown>): number | null {
  const c = isObj(raw.conditions) ? raw.conditions : {};
  if (isNum(c.gridRows) && c.gridRows > 0) return c.gridRows;
  const tally = new Map<number, number>();
  if (Array.isArray(raw.points))
    for (const p of raw.points)
      if (isObj(p) && isNum(p.rows)) tally.set(p.rows, (tally.get(p.rows) ?? 0) + 1);
  let best: number | null = null;
  for (const [r, n] of tally) if (best === null || n > (tally.get(best) ?? 0)) best = r;
  return best;
}

/**
 * 기록 파일 목록 → EXP-PERF 성능 보기.
 * P1 원천(readMeasurements의 구조 판정 원천과 같은 하나) → P2 단계 기록 → P5 중복 → P6 그리지 않은 점 → P4 점 단위 우열.
 */
export function readPerf(files: readonly { name: string; text: string }[]): PerfView {
  const base = readMeasurements(files);
  const counts: PerfCounts = {
    files: base.counts.files,
    unreadable: base.counts.unreadable,
    missingConditions: 0,
    invalidRanges: 0,
    invalidStructural: base.counts.invalidStructural,
    invalidRows: 0,
    undrawn: 0,
    nonPositive: 0,
    duplicatePoints: 0,
  };
  const empty: PerfView = {
    source: null,
    stageRecords: null,
    records: [],
    discardedRecords: [],
    points: [],
    verdicts: [],
    ranges: [],
    scan: [],
    storage: [],
    unreadableFiles: base.unreadableFiles,
    counts,
  };
  // 판독 가능한 기록 — 원시 블록(모르는 필드 포함)과 검사한 블록을 함께 둔다
  const loaded = new Map<string, Loaded>();
  for (const f of files) {
    if (!RECORD_FILE.test(f.name)) continue;
    const raw = pickBlock(f.text);
    const block = validate(raw);
    if (!block || !isObj(raw) || loaded.has(block.record)) continue;
    loaded.set(block.record, { name: f.name, raw, block });
  }
  const superseded = new Set(
    [...loaded.values()]
      .filter((l) => l.block.status === 'valid' && l.block.supersedes)
      .map((l) => l.block.supersedes),
  );

  // P1 — 원천 기록
  const st = base.structural;
  const src = st ? loaded.get(st.record) : undefined;
  if (!st || !src) return empty;
  counts.invalidRanges = st.invalidRanges;
  const cond = isObj(src.raw.conditions) ? src.raw.conditions : {};
  const source: ConditionMarks = {
    record: st.record,
    status: st.status,
    run: st.run,
    switches: st.switches,
    repeat: src.block.repeat,
    cpuset: condText(cond.cpuset),
    storeResources: condText(cond.storeResources),
    controlMemoryMb: condText(cond.controlMemoryMb),
    clickhouseMaxThreads: condText(cond.clickhouseMaxThreads),
    pgMaxParallelWorkersPerGather: condText(cond.pgMaxParallelWorkersPerGather),
    clickhouseServerLogLevel: condText(cond.clickhouseServerLogLevel),
    tieRule: condText(cond.tieRule),
    serverTimeAsymmetry: condText(cond.serverTimeAsymmetry),
    cacheDefinition: condText(cond.cacheDefinition),
  };

  // 방향 보강 — 행에 방향이 없으면 crossovers[](query · cache · pgVariant · from · to)에서 같은 키로
  const crossovers = Array.isArray(src.raw.crossovers) ? src.raw.crossovers.filter(isObj) : [];
  const ranges: PerfRange[] = st.ranges.map((r) => {
    if (r.crossover === null || r.direction) return r;
    const c = crossovers.find(
      (x) => x.query === r.query && x.cache === r.cache && x.pgVariant === r.pgVariant,
    );
    const from = c ? normalizeStore(c.from) : null;
    const to = c ? normalizeStore(c.to) : null;
    return { ...r, direction: from && to && from !== to ? { from, to } : null };
  });

  // P2 — 단계 기록
  let stageRecords: StageRecordRef[] | null = null;
  const used: (Loaded & { run: RunInfo })[] = [];
  if (isObj(cond.stageRecords)) {
    stageRecords = [];
    const entries = Object.entries(cond.stageRecords)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .sort(([a], [b]) => Number(a) - Number(b));
    for (const [stage, record] of entries) {
      const l = loaded.get(record);
      const unreadable = base.unreadableFiles.some((n) => n.startsWith(`${record}-`));
      const run = l ? conditionsComplete(l.block) : null;
      let excluded: StageExclusion | null = null;
      if (!l) excluded = unreadable ? 'unreadable' : 'absent';
      else if (l.block.status === 'superseded' || superseded.has(record)) excluded = 'superseded';
      else if (!run) {
        excluded = 'missing-conditions';
        counts.missingConditions++;
      }
      stageRecords.push({ stage: Number(stage), record, excluded });
      if (!excluded && l && run && record !== src.block.record) used.push({ ...l, run });
    }
  }
  // 기록 번호 오름차순 — 같은 점은 뒤(번호가 큰) 기록이 덮는다(P5)
  const all = [...used, { ...src, run: st.run }].sort((a, b) => a.block.record.localeCompare(b.block.record));

  const byKey = new Map<string, PerfPoint>();
  const verdicts: PointVerdict[] = [];
  const scan: ScanStage[] = [];
  const storage: StorageStage[] = [];
  for (const l of all) {
    const rec = { record: l.block.record, status: l.block.status, threshold: l.block.repeat.threshold };
    for (const raw of l.block.points) {
      const p = parsePoint(raw, rec);
      if (p === null) counts.invalidRows++;
      else if (p === 'undrawn') counts.undrawn++;
      else {
        const key = `${p.query}|${p.rows}|${p.store}|${p.index}|${p.cache}`;
        if (byKey.has(key)) counts.duplicatePoints++;
        byKey.set(key, p);
      }
    }
    // 단계 기록(원천 기록이 아닌 것)만 — 원리 증거 · 저장 비용 · 점 단위 우열 기록값. 053 정밀화 axes는 읽지 않는다
    if (l.block.record === src.block.record) continue;
    const rows = stageRows(l.raw);
    if (rows === null) continue;
    verdicts.push(...stageVerdicts(l.raw, rec.record, exponentOf(rows)));
    const s = parseScan(l.raw, rec.record, rec.status, rows);
    if (s) {
      scan.push(s.stage);
      counts.invalidRows += s.invalid;
    }
    const a = parseStorage(l.raw, rec.record, rec.status, rows);
    if (a) storage.push(a);
  }
  const points = [...byKey.values()].filter((p) => (PERF_QUERIES as readonly string[]).includes(p.query));
  counts.nonPositive = points.filter((p) => p.median <= 0).length;

  // P4 — 기록에 점 단위 판정이 없는 점(053 정밀화)은 structuralRanges에서 계산
  const have = new Set(verdicts.map((v) => `${v.query}|${v.cache}|${v.pgVariant}|${v.exponent}`));
  const exps = [...new Set(points.map((p) => p.exponent))];
  for (const r of ranges)
    for (const e of exps) {
      if (have.has(`${r.query}|${r.cache}|${r.pgVariant}|${e}`)) continue;
      const rec = points.find((p) => p.exponent === e && p.query === r.query && p.cache === r.cache)?.record;
      if (!rec) continue;
      verdicts.push({
        query: r.query,
        cache: r.cache,
        pgVariant: r.pgVariant,
        exponent: e,
        verdict: verdictFromRange(r, e),
        record: rec,
      });
    }

  return {
    source,
    stageRecords,
    records: all.map((l) => ({
      record: l.block.record,
      status: l.block.status,
      run: l.run,
      switches: l.block.switches,
    })),
    discardedRecords: [...new Set(points.filter((p) => p.status !== 'valid').map((p) => p.record))].sort(),
    points,
    verdicts,
    ranges,
    scan: scan.sort((a, b) => a.rows - b.rows),
    storage: storage.sort((a, b) => a.rows - b.rows),
    unreadableFiles: base.unreadableFiles,
    counts,
  };
}

// ── 화면 계산(순수) ──

export interface CurveLine {
  key: 'clickhouse' | PgVariant;
  store: Store;
  points: PerfPoint[];
}

/** 선 3 — ClickHouse · PostgreSQL I1 · I2 · 선택 쿼리 · 캐시 · 행 수 오름차순 */
export function curveLines(points: readonly PerfPoint[], query: string, cache: string): CurveLine[] {
  const pick = (f: (p: PerfPoint) => boolean) =>
    points.filter((p) => p.query === query && p.cache === cache && f(p)).sort((a, b) => a.rows - b.rows);
  return [
    { key: 'clickhouse', store: 'clickhouse', points: pick((p) => p.store === 'clickhouse') },
    { key: 'I1', store: 'postgresql', points: pick((p) => p.store === 'postgresql' && p.index === 'I1') },
    { key: 'I2', store: 'postgresql', points: pick((p) => p.store === 'postgresql' && p.index === 'I2') },
  ];
}

export const findRange = (
  ranges: readonly PerfRange[],
  query: string,
  cache: string,
  pgVariant: string,
): PerfRange | undefined =>
  ranges.find((r) => r.query === query && r.cache === cache && r.pgVariant === pgVariant);

/** 행 수 쉬운 말 — 정수 지수는 정확히("10만 행" · "10억 행") · 사이 값은 "약 3천만 행" · "약 1.8억 행" · "약 56만 행" */
export function rowsWords(exponent: number): string {
  const exact: Record<number, string> = {
    4: '1만',
    5: '10만',
    6: '100만',
    7: '1천만',
    8: '1억',
    9: '10억',
    10: '100억',
  };
  const e = exact[exponent];
  if (e) return `${e} 행`;
  const n = 10 ** exponent;
  if (n >= 1e8) {
    const v = n / 1e8;
    return `약 ${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}억 행`;
  }
  const man = n / 1e4;
  if (man >= 1000) return `약 ${Math.round(man / 1000)}천만 행`;
  return `약 ${Math.round(man)}만 행`;
}

/** 밀리초 쉬운 표기 — 100 이상 정수(천 단위 구분) · 1 이상 소수 1자리 · 1 미만 유효 숫자 2자리 */
export function msText(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString('ko-KR');
  if (v >= 1) return String(Math.round(v * 10) / 10);
  return String(Number(v.toPrecision(2)));
}

export interface SpeedBar {
  query: string;
  /** 그림 1의 규모 — 원천에서 가장 큰 규모(모든 행이 같은 규모) */
  exponent: number;
  /**
   * win = 3/3 우열로 방향이 섰다 · even = 3/3 우열은 섰지만 중간값 비가 그 방향과 어긋나거나 1.0배로 반올림된다(회색 "비슷" · 배수 없음 — 근거는 툴팁)
   * · undetermined = 우열 미정(회색 "승패 미정" · 배수 없음) · none = 그 규모에 점 쌍이 없다("판정 없음")
   */
  kind: 'win' | 'even' | 'undetermined' | 'none';
  /** PG ÷ CH 중앙값 배수(참고값) — none이면 null */
  ratio: number | null;
  /** 빠른 쪽 — 그 점의 3/3 우열(정본) · win · even일 때 */
  winner: Store | null;
  /** 반올림한 배수(빠른 쪽 기준 — "101" · "1.7") · win일 때만 */
  times: string | null;
}

/**
 * 그림 1 — 질문 5개 × 가장 큰 규모(보통 10억 행)에서 누가 몇 배 빠른가(08_screen/08 §표시 계약 승패 막대).
 * 웜 · PG(B-tree) 기준 · 방향은 점 단위 3/3 우열(P4)만 · 미정이면 배수를 쓰지 않는다 · 그 규모에 점 쌍이 없으면 "판정 없음".
 */
export function speedBars(view: Pick<PerfView, 'points' | 'verdicts'>): SpeedBar[] {
  const warm = view.points.filter((p) => p.cache === 'warm');
  if (warm.length === 0) return [];
  const e = Math.max(...warm.map((p) => p.exponent));
  return PERF_QUERIES.map((q) => {
    const at = (f: (p: PerfPoint) => boolean) => warm.find((p) => p.query === q && p.exponent === e && f(p));
    const ch = at((p) => p.store === 'clickhouse');
    const pg = at((p) => p.store === 'postgresql' && p.index === 'I2');
    if (!ch || !pg || !(ch.median > 0) || !(pg.median > 0))
      return { query: q, exponent: e, kind: 'none', ratio: null, winner: null, times: null };
    const ratio = pg.median / ch.median;
    const v = view.verdicts.find(
      (x) => x.query === q && x.cache === 'warm' && x.pgVariant === 'I2' && x.exponent === e,
    );
    const winner = v?.verdict === 'clickhouse' || v?.verdict === 'postgresql' ? v.verdict : null;
    if (!winner) return { query: q, exponent: e, kind: 'undetermined', ratio, winner: null, times: null };
    // 승자 쪽으로 본 중간값 배수 — 1 이하(어긋남)거나 "1.0"이면 배수를 말하지 않는다("CH 0.9배" · "CH 1.0배"는 반대로 읽힌다)
    const oriented = winner === 'clickhouse' ? ratio : 1 / ratio;
    const times = timesText(oriented);
    if (oriented <= 1 || times === '1.0')
      return { query: q, exponent: e, kind: 'even', ratio, winner, times: null };
    return { query: q, exponent: e, kind: 'win', ratio, winner, times };
  });
}

/** 그림 1 행 툴팁 — 질문 코드 · 구간 판정 · 중간값 비 · 비슷이면 그 근거 */
export function speedTip(b: SpeedBar, range: string): string {
  const name = b.winner === 'clickhouse' ? 'CH' : 'PG';
  return [
    `${b.query} · ${range}`,
    b.ratio !== null ? `PG ÷ CH 중간값 ${b.ratio.toFixed(2)}(참고값)` : null,
    b.kind === 'even' ? `3번 모두 ${name}가 빨랐지만 중간값으로는 차이가 거의 없어요` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 그림 1 행 툴팁의 구간 판정 문장 — "1천만 행부터 CH" · "PG 우세 전 구간"(structuralRanges I2 · 웜) */
export function rangeText(r: PerfRange | undefined): string {
  if (!r) return '판정 행 없음';
  const name = (s: Store) => (s === 'clickhouse' ? 'CH' : 'PG');
  if (r.crossover === null)
    return r.winner === 'postgresql' ? 'PG 우세 전 구간' : `전 구간 ${name(r.winner)}`;
  const [a, b] = r.crossover.map(parseExp) as [number, number];
  if (!r.direction) return `${rowsWords(a)}~${rowsWords(b)} 사이 역전 — 방향 미상`;
  const head = r.direction.from === 'postgresql' ? `${rowsWords(a)}까지 PG · ` : '';
  return `${head}${rowsWords(b)}부터 ${name(r.direction.to)}`;
}

/** 그림 2의 ? 표지 — 선택 질문 · 웜 · I2의 undetermined 지수와 P4 미정 점(08_screen/08 §표시 계약 우열 미정) */
export function undeterminedExps(view: Pick<PerfView, 'ranges' | 'verdicts'>, query: string): number[] {
  const out = new Set<number>();
  const r = findRange(view.ranges, query, 'warm', 'I2');
  for (const u of r?.undetermined ?? []) out.add(parseExp(u));
  for (const v of view.verdicts)
    if (v.query === query && v.cache === 'warm' && v.pgVariant === 'I2' && v.verdict === 'undetermined')
      out.add(v.exponent);
  return [...out].sort((x, y) => x - y);
}

/** 판독 계수 가운데 0이 아닌 것 — 각주 줄에 한 마디로 오른다(08_screen/08 §표시 계약 판독 계수) */
export function countIssues(c: PerfCounts): string[] {
  return [
    c.unreadable ? `읽지 못한 기록 ${c.unreadable}` : null,
    c.missingConditions ? `조건이 빠진 기록 ${c.missingConditions}` : null,
    c.invalidRows ? `모양이 어긋난 줄 ${c.invalidRows}` : null,
    c.invalidStructural || c.invalidRanges
      ? `모양이 어긋난 판정 ${c.invalidStructural + c.invalidRanges}`
      : null,
    c.undrawn + c.nonPositive ? `그리지 않은 점 ${c.undrawn + c.nonPositive}` : null,
  ].filter((x): x is string => x !== null);
}

/** 한계 2 — 각주 툴팁 상시(08_screen/08 §표시 계약 4요소 각주) */
export const LIMIT_MARKS = [
  '① ClickHouse 측정에 trace 로그 쓰기 부하가 포함됐다(clickhouseServerLogLevel)',
  '② 동률 점(ClickHouse 10 ms 미만 · 두 저장소 차 1 ms 미만)은 서버 µs로 판정했고 PostgreSQL 서버 값은 계획 시간을 뺀다(serverTimeAsymmetry)',
] as const;

/** 각주 툴팁의 기록 쪽 줄 — 원천 · 단계 기록 · 4요소 · 기록 스위치 · 한계 2 · 판독 계수 전부(0이어도) · 판독 시각은 화면이 붙인다 */
export function recordTipLines(view: PerfView): string[] {
  const s = view.source;
  if (!s) return ['원천 기록 없음(EXP-01~05 구조 판정 기록 없음)'];
  const sw = Object.entries(s.switches)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : String(v)}`);
  const limit = s.run.memoryLimitMb === null ? (s.run.memoryLimitSource ?? '') : `${s.run.memoryLimitMb} MB`;
  const stages = view.stageRecords
    ? view.stageRecords.map((x) => `${x.record}${x.excluded ? `(${x.excluded} — 뺌)` : ''}`).join(' · ')
    : '단계 기록 목록 없음';
  const c = view.counts;
  return [
    `원천 기록 ${s.record}(${s.status}) · 단계 기록 ${stages}`,
    `커밋 ${[...new Set(view.records.map((r) => r.run.commitHash))].join(' · ')} · 프로파일 ${s.run.memoryProfile} · 상한 ${limit} · 티어 ${s.run.capacityTier}`,
    `기록 스위치 ${sw.join(' · ') || '없음'}(기록에 없는 스위치는 도입 전 · 기본값)`,
    ...LIMIT_MARKS,
    `판독 계수 — 파일 ${c.files} · 판독 불가 ${c.unreadable} · 4요소 누락 ${c.missingConditions} · 형식이 어긋난 행 ${c.invalidRows} · 형식이 어긋난 structuralRanges 기록 ${c.invalidStructural + c.invalidRanges} · 그리지 않은 점 ${c.undrawn + c.nonPositive} · 뒤 기록이 덮은 중복 ${c.duplicatePoints}`,
    view.discardedRecords.length
      ? `참고값 — 편차 기준 초과(구조 판정만 정본) · 기록 ${view.discardedRecords.join(' · ')}`
      : '',
  ].filter(Boolean);
}

/** 그림 2 아래 한 문장 — 역전 구간(structuralRanges · 정본)을 쉬운 말로 */
export function crossSentence(r: PerfRange | undefined): string {
  if (!r) return '이 질문은 누가 이기는지 판정한 기록이 없어요';
  const name = (s: Store) => (s === 'clickhouse' ? 'CH' : 'PG');
  if (r.crossover === null) return `이 범위에서는 뒤집히지 않아요 — 앞선 쪽 ${name(r.winner)}`;
  const [a, b] = r.crossover.map(parseExp) as [number, number];
  const where = `${rowsWords(a).replace(' 행', '')}~${rowsWords(b).replace('약 ', '')} 사이에서 역전`;
  if (!r.direction) return `${where}돼요`;
  return `${where} — 작으면 ${name(r.direction.from)}, 크면 ${name(r.direction.to)}가 빨라요`;
}

export interface ReadShare {
  exponent: number;
  record: string;
  /** 전체 데이터 가운데 읽은 비율 — CH 읽은 바이트 ÷ 논리 크기 · PG 읽은 블록 ÷ 힙 블록(1을 넘으면 같은 페이지를 여러 번) */
  ch: number;
  pg: number;
  /** PG가 CH보다 몇 배 많이 읽나 */
  times: number;
}

/** 왜? 카드 ① — 선택 질문 · 가장 큰 단계 규모의 읽은 양(scan · 구조 사실) · 값이 없으면 null */
export function readShare(view: Pick<PerfView, 'scan'>, query: string): ReadShare | null {
  const stage = view.scan.at(-1);
  const q = stage?.queries.find((x) => x.query === query);
  const ch = q?.ch?.readBytesRatio;
  const pg = q?.pg.I2?.bufferRatio;
  // 분모(CH 몫)가 0이거나 없으면 배수를 만들지 않는다 — 화면은 "잰 값 없음"
  if (!stage || ch == null || pg == null || !(ch > 0)) return null;
  return { exponent: stage.exponent, record: stage.record, ch, pg, times: pg / ch };
}

/** 왜? 카드 ① 문장 한 조각 — strong이면 굵게 */
export interface WhyPart {
  text: string;
  strong?: boolean;
}

export interface ReadWhy {
  /** ch = 그림 1에서 CH가 이겼고 PG가 더 많이 읽었다 · pg = 그림 1에서 PG가 이겼다 · neutral = 비슷 · 미정 · 판정 없음 · 읽은 몫이 방향과 어긋남 */
  kind: 'ch' | 'pg' | 'neutral';
  parts: WhyPart[];
  /** 읽은 몫 숫자 — "읽은 몫 PG 1.1% · CH 0.009%"(ch는 카드 아래 줄 · 나머지는 툴팁) */
  shares: string;
}

/**
 * 왜? 카드 ① 문장 — 선택 질문의 그림 1 결론(speedBars)과 같은 방향으로만 말한다(그림 1과 반대로 읽히는 조합 금지).
 * CH 승리 · PG가 더 많이 읽음 → "같은 질문에 PG는 CH보다 전체 중 N배 많은 몫을 읽어요"
 * PG 승리 → "이 질문은 몇 줄만 콕 집어 읽어서 PG가 빨라요(목차 · 인덱스)"(읽은 몫 숫자는 툴팁)
 * 그 밖(비슷 · 승패 미정 · 판정 없음 · CH 승리인데 PG가 덜 읽음) → 방향 없는 사실 문장. 읽은 몫이 없으면 null(화면은 "잰 값 없음").
 */
export function readWhy(bar: SpeedBar | undefined, read: ReadShare | null): ReadWhy | null {
  if (!read) return null;
  const shares = `읽은 몫 PG ${shareText(read.pg)} · CH ${shareText(read.ch)}`;
  if (bar?.kind === 'win' && bar.winner === 'postgresql')
    return {
      kind: 'pg',
      parts: [
        { text: '이 질문은 몇 줄만 콕 집어 읽어서 ' },
        { text: 'PG가 빨라요', strong: true },
        { text: '(목차 · 인덱스)' },
      ],
      shares,
    };
  const times = timesText(read.times);
  if (bar?.kind === 'win' && bar.winner === 'clickhouse' && read.times > 1 && times !== '1.0')
    return {
      kind: 'ch',
      parts: [
        { text: '같은 질문에 PG는 CH보다 전체 중 ' },
        { text: `${times}배`, strong: true },
        { text: ' 많은 몫을 읽어요' },
      ],
      shares,
    };
  const head =
    bar?.kind === 'even'
      ? '이 질문은 두 DB가 비슷해요 — '
      : bar?.kind === 'undetermined'
        ? '이 질문은 3번 결과가 엇갈려요 — '
        : '';
  return { kind: 'neutral', parts: [{ text: `${head}${shares}` }], shares };
}

export interface RowBytes {
  exponent: number;
  record: string;
  /** 1행 저장 바이트 — CH 압축된 열 · PG 힙 + B-tree 목차 */
  ch: number;
  pg: number;
  times: number;
}

/** 왜? 카드 ② — 가장 큰 단계 규모의 행당 바이트(저장 비용 · 결정적 값) · 값이 없으면 null */
export function rowBytes(view: Pick<PerfView, 'storage'>): RowBytes | null {
  const s = view.storage.at(-1);
  if (!s || s.perRowBytes.ch === null || s.perRowBytes.pg === null || !(s.perRowBytes.ch > 0)) return null;
  const pg = s.perRowBytes.pg + (s.indexBytes.btree ?? 0) / s.rows;
  return { exponent: s.exponent, record: s.record, ch: s.perRowBytes.ch, pg, times: pg / s.perRowBytes.ch };
}

/** 읽은 비율 쉬운 말 — 1 미만은 백분율 · 정확히 1은 "전부" · 1을 넘으면 같은 곳을 여러 번 읽은 것("전체의 1.3배") */
export function shareText(r: number): string {
  if (r > 1) return `전체의 ${timesText(r)}배`;
  if (r === 1) return '전부';
  return ratioPercent(r);
}

/** 진입 파라미터 — q(Q1~Q5 · 기본 Q2) 하나 · 벗어난 값은 기본값 */
export function parsePerfParams(p: { q?: string | string[] }): { query: string } {
  const q = Array.isArray(p.q) ? p.q[0] : p.q;
  return { query: q && (PERF_QUERIES as readonly string[]).includes(q) ? q : 'Q2' };
}

/** 질문 쉬운 이름 — Q1~Q5 코드는 툴팁에만(05_data_stores/10 §동일 쿼리 5종) */
export const QUERY_NAME: Record<string, string> = {
  Q1: '센서 1개 · 최근 1시간',
  Q2: '센서 1개 · 7일',
  Q3: '설비 1대 · 하루',
  Q4: '전체 설비 · 1분 평균',
  Q5: '전체 데이터 훑기',
};

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

/**
 * "N배 이상"의 N — 하한이라 반올림하지 않고 내린다(10 이상 정수 · 미만 소수 1자리). 40.8 → "40" · 9.97 → "9.9" · 2.75 → "2.7".
 * 반올림하면 실제보다 큰 하한을 말하게 된다(40.8을 "41배 이상"으로).
 */
export function timesAtLeast(x: number): string {
  return x >= 10 ? Math.floor(x).toLocaleString('ko-KR') : (Math.floor(x * 10) / 10).toFixed(1);
}

/** 가장 큰 규모 점의 배수(참고값) — 쿼리 · 캐시 · 변형에서 두 저장소 점이 함께 있는 가장 큰 지수 */
export function topRatio(
  points: readonly PerfPoint[],
  query: string,
  cache: string,
  variant: PgVariant,
): { exponent: number; ratio: number } | null {
  const at = new Map<number, { ch?: PerfPoint; pg?: PerfPoint }>();
  for (const p of points) {
    if (p.query !== query || p.cache !== cache) continue;
    const slot = at.get(p.exponent) ?? {};
    if (p.store === 'clickhouse') slot.ch = p;
    else if (p.index === variant) slot.pg = p;
    at.set(p.exponent, slot);
  }
  const exps = [...at.keys()].sort((a, b) => b - a);
  for (const e of exps) {
    const { ch, pg } = at.get(e) ?? {};
    if (ch && pg && ch.median > 0 && pg.median > 0) return { exponent: e, ratio: pg.median / ch.median };
  }
  return null;
}
