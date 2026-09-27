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
export const PERF_CACHES = ['warm', 'cold'] as const;
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
/** 지수 → "10^7.25" */
export const expLabel = (e: number): string => `10^${e}`;
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

export interface HeatCell {
  query: string;
  exponent: number;
  /** PG ÷ CH 중앙값 배수(참고값) · 두 점 중 하나라도 없으면 null */
  ratio: number | null;
  verdict: Verdict | null;
}

/** 배수 히트맵 — 행(지수) × Q1~Q5 · 칸 = PG ÷ CH · 색 = 그 점의 3/3 우열 */
export function heatCells(view: Pick<PerfView, 'points' | 'verdicts'>, cache: string, variant: PgVariant) {
  const exps = [...new Set(view.points.map((p) => p.exponent))].sort((a, b) => a - b);
  const cells: HeatCell[] = [];
  for (const e of exps)
    for (const q of PERF_QUERIES) {
      const at = (f: (p: PerfPoint) => boolean) =>
        view.points.find((p) => p.exponent === e && p.query === q && p.cache === cache && f(p));
      const ch = at((p) => p.store === 'clickhouse');
      const pg = at((p) => p.store === 'postgresql' && p.index === variant);
      const v = view.verdicts.find(
        (x) => x.exponent === e && x.query === q && x.cache === cache && x.pgVariant === variant,
      );
      cells.push({
        query: q,
        exponent: e,
        ratio: ch && pg && ch.median > 0 ? pg.median / ch.median : null,
        verdict: v?.verdict ?? null,
      });
    }
  return { exponents: exps, cells };
}

/** 우열 미정 점 — 선택 쿼리 · 캐시의 undetermined와 P4 미정(변형별) */
export function undeterminedMarks(
  view: Pick<PerfView, 'verdicts' | 'ranges'>,
  query: string,
  cache: string,
): { exponent: number; pgVariant: string }[] {
  const out = new Map<string, { exponent: number; pgVariant: string }>();
  for (const r of view.ranges)
    if (r.query === query && r.cache === cache)
      for (const u of r.undetermined)
        out.set(`${r.pgVariant}|${u}`, { exponent: parseExp(u), pgVariant: r.pgVariant });
  for (const v of view.verdicts)
    if (v.query === query && v.cache === cache && v.verdict === 'undetermined')
      out.set(`${v.pgVariant}|${expLabel(v.exponent)}`, { exponent: v.exponent, pgVariant: v.pgVariant });
  return [...out.values()].sort((a, b) => a.exponent - b.exponent || a.pgVariant.localeCompare(b.pgVariant));
}

export interface PgLead {
  query: string;
  cache: string;
  pgVariant: string;
  /** 앞서는 관측 구간 — 역전 없음이면 range · 역전이면 관측 하한 ~ 역전 전 마지막 점 a */
  span: [string, string];
  kind: 'no-crossover' | 'before-crossover';
}

/** 결론 카드 "PostgreSQL이 앞서는 경우" — winner postgresql 행과 역전 전 구간(from postgresql) */
export function postgresLeads(ranges: readonly PerfRange[], minExponent: number): PgLead[] {
  const out: PgLead[] = [];
  for (const r of ranges) {
    if (r.crossover === null && r.winner === 'postgresql')
      out.push({
        query: r.query,
        cache: r.cache,
        pgVariant: r.pgVariant,
        span: r.range,
        kind: 'no-crossover',
      });
    else if (r.crossover !== null && r.direction?.from === 'postgresql')
      out.push({
        query: r.query,
        cache: r.cache,
        pgVariant: r.pgVariant,
        span: [expLabel(minExponent), r.crossover[0]],
        kind: 'before-crossover',
      });
  }
  return out.sort((a, b) => a.query.localeCompare(b.query) || a.cache.localeCompare(b.cache));
}

/** 10^7.25 = 17,780,000행(가로축 툴팁) */
export const rowsTooltip = (p: Pick<PerfPoint, 'exponent' | 'rows'>): string =>
  `${expLabel(p.exponent)} = ${p.rows.toLocaleString('ko-KR')}행`;

/** 계획 노드 줄임 — 이어지는 같은 노드는 "Seq Scan ×10"으로 */
export function compactNodes(nodes: readonly string[]): string {
  const out: string[] = [];
  let prev: string | null = null;
  let n = 0;
  const flush = () => {
    if (prev !== null) out.push(n > 1 ? `${prev} ×${n}` : prev);
  };
  for (const x of nodes) {
    if (x === prev) n++;
    else {
      flush();
      prev = x;
      n = 1;
    }
  }
  flush();
  return out.join(' › ');
}

/** 딥링크 파라미터 — q(Q1~Q5 · 기본 Q2) · cache(warm · cold · 기본 warm) · 벗어난 값은 기본값 */
export function parsePerfParams(p: { q?: string | string[]; cache?: string | string[] }): {
  query: string;
  cache: string;
} {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = one(p.q);
  const c = one(p.cache);
  return {
    query: q && (PERF_QUERIES as readonly string[]).includes(q) ? q : 'Q2',
    cache: c && (PERF_CACHES as readonly string[]).includes(c) ? c : 'warm',
  };
}
