// 실증 요약 판독기 — 역방향 대조(EXP-40~44 · reverse) · 스트리밍 동시 적재(EXP-45 · streamSteps).
// 형식 정본 10_observability/04_experiment_protocol.md §기계 판독 블록(선택 필드 reverse · streamSteps) · §BFF 판독 규칙 7.
// 키의 뜻 정본 05_data_stores/10_olap_vs_rdb_control.md §EXP 연결 · 기계 판독 블록 제안 · §스트리밍 동시 적재 — EXP-45.
// 순수 함수만 둔다 — 파일 읽기는 BFF 라우트(app/bff/measurements)가 한다. 역전 지점 판독(lib/measurements)과 규칙 1~5 · 7은 같고,
// 규칙 6의 자리(어느 기록의 어느 필드를 쓰는가)만 다르다 — reverse는 EXP-40~44를 인용한 기록, streamSteps는 EXP-45를 인용한 기록.
import { formatRows, jsonFences, memoryLimitOf, type RunInfo, SCHEMA_V1, type Store } from './measurements';
import { timesAtLeast, timesText } from './perf';

export const REVERSE_EXPS = ['EXP-40', 'EXP-41', 'EXP-42', 'EXP-43', 'EXP-44'] as const;
export const STREAM_EXP = 'EXP-45';
export type ReverseExp = (typeof REVERSE_EXPS)[number];

const SWITCH_IDS = Array.from({ length: 11 }, (_, i) => `SW-${String(i + 1).padStart(2, '0')}`);
const RECORD_FILE = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/** 행마다 붙는 4요소 — 툴팁에 싣는다(08_screen/08_evidence_screens.md 계약 "4요소"와 같은 표시 계약) */
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
  /**
   * 구조 지표의 대상 수 — 판독 자리 시나리오(inject · pairs)에 맞는 기록 conditions의 대상 주문 수(042 inject 20 · pairs 20) ·
   * 없으면 null. 상황 카드의 "20번 중 20번 깨짐"의 분모(08_screen/08 §표시 계약 구조 결과).
   */
  target: number | null;
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

/** 판독에서 뺀 기록 — 업무 작업 카드가 "기록 폐기 — 구조 사실만"과 "기록 없음"을 가른다 */
export interface ExcludedRecord {
  record: string;
  /** 기록 머리 exp 가운데 이 판독기가 보는 것(EXP-40~45) */
  exps: string[];
  reason: 'status' | 'deviation' | 'conditions';
}

export interface EvidenceResult {
  counts: EvidenceCounts;
  unreadableFiles: string[];
  excludedRecords: ExcludedRecord[];
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

/** 규칙 4 — run 네 필드와 switches 11키가 전부 null이 아니다(배열 값은 원소마다 · memoryLimitMb는 memoryLimitOf 예외) */
function conditionsComplete(b: Block): RunInfo | null {
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

const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** values는 배열이고 원소는 수 또는 null이어야 한다 — 다른 값이 섞이면 형식 위반 */
function runValues(v: unknown): (number | null)[] | null {
  if (!Array.isArray(v)) return null;
  if (!v.every((x) => x === null || isNum(x))) return null;
  return v as (number | null)[];
}

function parseReverse(r: unknown, ref: EvidenceRef, conditions: Record<string, unknown>): ReverseRow | null {
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
    target: targetOf(strOrNull(r.read), conditions),
  };
}

/** 판독 자리의 시나리오 이름(콜론 앞) → conditions의 같은 이름 수(대상 주문 수) · 없으면 null */
function targetOf(read: string | null, conditions: Record<string, unknown>): number | null {
  const scenario = read?.split(':')[0];
  if (scenario !== 'inject' && scenario !== 'pairs') return null;
  const v = conditions[scenario];
  return isNum(v) && v > 0 ? v : null;
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
  const excludedRecords: ExcludedRecord[] = [];
  const exclude = (b: Block, reason: ExcludedRecord['reason']) =>
    excludedRecords.push({
      record: b.record,
      exps: b.exp.filter((e) => e === STREAM_EXP || (REVERSE_EXPS as readonly string[]).includes(e)),
      reason,
    });
  for (const b of blocks.sort((x, y) => x.record.localeCompare(y.record))) {
    const isReverse = b.exp.some((e) => (REVERSE_EXPS as readonly string[]).includes(e));
    const isStream = b.exp.includes(STREAM_EXP);
    if (!isReverse && !isStream) continue; // 규칙 6의 자리 — 다른 실험의 폐기 · 누락을 이 패널 수에 섞지 않는다
    if (isReverse) counts.reverse++;
    if (isStream) counts.stream++;
    if (b.status !== 'valid' || superseded.has(b.record)) {
      counts.excludedStatus++; // 규칙 3
      exclude(b, 'status');
      continue;
    }
    if (b.repeat.runs < 3 || b.repeat.deviation > b.repeat.threshold) {
      counts.excludedDeviation++; // 규칙 5
      exclude(b, 'deviation');
      continue;
    }
    const run = conditionsComplete(b);
    if (!run) {
      counts.missingConditions++; // 규칙 4
      exclude(b, 'conditions');
      continue;
    }
    const ref: EvidenceRef = { record: b.record, run, switches: b.switches };
    if (isReverse) {
      for (const raw of b.reverse) {
        const r = parseReverse(raw, ref, b.conditions);
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
  return {
    counts,
    unreadableFiles,
    excludedRecords,
    reverse: [...reverse.values()],
    stream: [...stream.values()],
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

const SCENARIO_READS = new Set(['inject', 'pairs', 'probe']);

/** 판독 자리 → 행 이름 덧말 — "inject:upm_auto" → "동시 모드 auto" · "window_100" → "윈도우 100" · 시나리오만이면 없음 */
export function armLabel(read: string | null): string | null {
  if (read === null) return null;
  const arm = read.includes(':') ? (read.split(':')[1] ?? '') : SCENARIO_READS.has(read) ? '' : read;
  if (arm === '') return null;
  const upm = /^upm_(\w+)$/.exec(arm);
  if (upm) return `동시 모드 ${upm[1]}`;
  const win = /^window_(\d+)$/.exec(arm);
  if (win) return `윈도우 ${win[1]}`;
  return arm;
}

// ── 업무 작업 요약(상황 카드의 수치 원천 — 08_screen/08 §EXP-PERF 업무 데이터 열) ──

/**
 * 변형 쉬운 이름 — 1층 · 대비표 툴팁용. 모르는 변형은 기록 값 그대로 보인다.
 * 출처 05_data_stores/10 §역방향 대조 — 업무 워크로드 §변형과 판정 지표.
 */
export const VARIANT_LABEL: Record<string, string> = {
  pg: 'PostgreSQL',
  pg_sync_on: 'PostgreSQL synchronous_commit on',
  ch_mt: 'MergeTree',
  ch_rmt: 'ReplacingMergeTree',
  ch_mt_dedup: 'MergeTree 중복 제거 윈도우',
  ch_lwu: '경량 UPDATE',
  ch_sync: '동기 INSERT',
  ch_async: 'async_insert',
  ch_g8192: '그래뉼 8192',
  ch_g256: '그래뉼 256',
};
export const variantLabel = (v: string): string => VARIANT_LABEL[v] ?? v;

export type BusinessTaskId = 'atomic' | 'constraint' | 'point' | 'insert' | 'update';

/**
 * 업무 작업 5 — 판독기 상수(08_screen/08 §데이터 원천 원리 문장 상수 행 — 업무 작업 카드의 대표 지표 선택 · 상황 카드 수치).
 * 구조 문장의 출처 05_data_stores/10 §역방향 대조 — 업무 워크로드 §원리 대응 · §결과 역방향 대조표 — 문서 표가 바뀌면 같은 변경 단위에서 고친다.
 * 수치는 여기 두지 않는다 — 카드 · 대비표의 수치는 기록에서 읽는다(taskSummary).
 */
export const BUSINESS_TASKS: readonly {
  id: BusinessTaskId;
  exp: ReverseExp;
  name: string;
  /** 대표 지표의 이름(1층 문구) */
  measure: string;
  /** valid 기록이 없을 때 카드 두 줄 — 구조 사실(상수) */
  structural: { postgresql: string; clickhouse: string };
}[] = [
  {
    id: 'atomic',
    exp: 'EXP-42',
    name: '여러 행 한 번에',
    measure: '부분 반영',
    structural: { postgresql: '트랜잭션 — 한 커밋', clickhouse: '문장 단위 원자성' },
  },
  {
    id: 'constraint',
    exp: 'EXP-43',
    name: '무결성 제약',
    measure: '수용',
    structural: { postgresql: '쓰기 시점 거절', clickhouse: 'UNIQUE · FK 없음' },
  },
  {
    id: 'point',
    exp: 'EXP-41',
    name: '키 1건 조회',
    measure: '지연 p50',
    structural: { postgresql: 'B-tree — 행 하나', clickhouse: '그래뉼 하나 전체' },
  },
  {
    id: 'insert',
    exp: 'EXP-44',
    name: '단건 고빈도 쓰기',
    measure: '삽입 p50',
    structural: { postgresql: '힙 끝에 행 추가', clickhouse: '쓰기마다 파트 1' },
  },
  {
    id: 'update',
    exp: 'EXP-40',
    name: '상태 갱신',
    measure: '갱신 지연 p50',
    structural: { postgresql: '행 1개 새 버전', clickhouse: '파트 재작성' },
  },
];

/**
 * EXP-43 사례별 정상 수용 상한 — 업무 요구(무결성)를 저장소가 지켰는가의 기준(판독기 상수).
 * ⓐ 같은 order_no 동시 K행은 1행만 · ⓓ 같은 주문 재삽입은 1번만 받아야 하고, 없는 line_id · CHECK 위반(INSERT · UPDATE 경로)은 0이어야 한다.
 * 출처 05_data_stores/10 §변형과 판정 지표 EXP-43 행 ⓐ~ⓓ. 중복 제거 윈도우 사례(reinsert_hash · reinsert_token)는 멱등 수단의 질문이라 카드에 넣지 않는다.
 */
export const CONSTRAINT_ALLOWED: Record<string, number> = { dup_order_no: 1, reinsert: 1 };
/** 저장소별 기본 변형 — 카드 1층 수치는 이 변형 하나로 말한다(05_data_stores/10 §변형과 판정 지표의 기본 행) */
export const DEFAULT_VARIANT: Record<Store, string> = { postgresql: 'pg', clickhouse: 'ch_mt' };
const CONSTRAINT_CASE = /^accepted_count\.(dup_order_no|reinsert|missing_line|check_[a-z_]+|update_[a-z_]+)$/;

export interface TaskSide {
  /** 대표 지표 한 줄 — 수치 + 단위(예 "부분 반영 20건" · "지연 p50 0.10 ms") · 원천이 없으면 구조 사실 문장 */
  text: string;
  /** 업무 요구를 저장소가 지키는가 — 판정하는 작업(원자성 · 제약)만 · 나머지 null */
  ok: boolean | null;
  /** 툴팁 — 변형 · 조건별 값 */
  detail: string[];
  /** 대표 수치의 최소 · 최대(건수 · ms) — 원천이 없으면 null(쉬운 말 카드가 숫자 문장을 만든다) */
  range: [number, number] | null;
  /** range의 단위(count · ms) */
  unit: string;
  /** 구조 작업의 대상 수(모든 칸이 같은 대상 수일 때만) — 원자성 "20번 중" · 없으면 null */
  of: number | null;
  /** 3회 미만 칸이 있어 판정하지 않았다 — "판정할 만큼 재지 않았어요" */
  incomplete: boolean;
  /**
   * 제약만 — 받아도 되는 몫(CONSTRAINT_ALLOWED)을 뺀 "규칙을 어긴" 건수의 최소 · 최대 · 기본 변형(DEFAULT_VARIANT) 하나 기준.
   * 사례 구성이 다른 변형(MergeTree 17 · ReplacingMergeTree 11)을 한 범위로 섞지 않는다 — 변형 차이는 detail(툴팁)에.
   */
  violated?: [number, number] | null;
}

export interface TaskSummary {
  id: BusinessTaskId;
  /** valid 행이 있다(measured) · 없고 폐기 기록이 있다(discarded) · 둘 다 없다(none) */
  source: 'measured' | 'discarded' | 'none';
  records: string[];
  postgresql: TaskSide;
  clickhouse: TaskSide;
}

const fmtShort = (v: number) =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v === 0 ? '0' : v.toPrecision(2);

/** 구조 값 줄이기 — 모든 칸이 3회 같은 한 값이면 그 값 · 아니면 "최소~최대" · 3회 미만 칸이 있으면 null(판정하지 않는다) */
function structuralText(cells: readonly (readonly (number | null)[])[]): string | null {
  const all: number[] = [];
  for (const v of cells) {
    const sv = structuralVerdict(v);
    if (sv.kind === 'incomplete') return null;
    all.push(...(v as number[]));
  }
  if (all.length === 0) return null;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return lo === hi ? String(lo) : `${lo}~${hi}`;
}

/** 구조 값 최소 · 최대(structuralText가 판정을 통과한 칸들) */
function countRange(cells: readonly (readonly (number | null)[])[]): [number, number] | null {
  const all = cells.flat().filter(isNum);
  return all.length ? [Math.min(...all), Math.max(...all)] : null;
}

/** 분포 값 범위 — 중앙값의 최소~최대 */
function medianRange(rows: readonly ReverseRow[]): string | null {
  const ms = rows.map((r) => r.median).filter(isNum);
  if (ms.length === 0) return null;
  const lo = Math.min(...ms);
  const hi = Math.max(...ms);
  return lo === hi ? fmtShort(lo) : `${fmtShort(lo)}~${fmtShort(hi)}`;
}

const maxOf = (xs: readonly number[]) => (xs.length ? Math.max(...xs) : null);
const minOf = (xs: readonly number[]) => (xs.length ? Math.min(...xs) : null);

/** 분포 작업의 대표 행 — 지표 · 가장 큰 업무 규모 · 손잡이(동시성 최소 · 요청률 최대) */
function distributionRows(rows: readonly ReverseRow[], metric: string, knob: 'concurrency' | 'rate') {
  const own = rows.filter((r) => r.metric === metric && !r.structural);
  const scale = maxOf(own.map((r) => r.scale));
  const at = own.filter((r) => r.scale === scale);
  const ks = at.map((r) => r[knob]).filter(isNum);
  const k = knob === 'concurrency' ? minOf(ks) : maxOf(ks);
  return { scale, knob: k, rows: at.filter((r) => k === null || r[knob] === k) };
}

function distributionSide(
  rows: readonly ReverseRow[],
  store: Store,
  metric: string,
  knob: 'concurrency' | 'rate',
  measure: string,
  fallback: string,
): TaskSide {
  const pick = distributionRows(
    rows.filter((r) => r.store === store),
    metric,
    knob,
  );
  const range = medianRange(pick.rows);
  if (range === null)
    return { text: fallback, ok: null, detail: [], range: null, unit: '', of: null, incomplete: false };
  const unit = pick.rows[0]?.unit ?? '';
  const ms = pick.rows.map((r) => r.median).filter(isNum);
  const where = [
    pick.scale === null ? null : `업무 규모 ${formatRows(pick.scale)}행`,
    pick.knob === null ? null : knob === 'concurrency' ? `동시성 ${pick.knob}` : `${pick.knob} req/s`,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    text: `${measure} ${range} ${unit}`.trim(),
    ok: null,
    range: [Math.min(...ms), Math.max(...ms)],
    unit,
    of: null,
    incomplete: false,
    detail: [
      `${metric} · ${where}`,
      ...pick.rows.map(
        (r) => `${variantLabel(r.variant)} ${r.median === null ? '—' : fmtShort(r.median)} ${unit}`,
      ),
    ],
  };
}

/** 업무 작업 하나의 카드 · 대비표 값 — 수치는 기록에서 · 지표 선택과 판정 기준은 판독기 상수 */
export function taskSummary(
  d: Pick<EvidenceResult, 'reverse' | 'excludedRecords'>,
  task: (typeof BUSINESS_TASKS)[number],
): TaskSummary {
  const rows = d.reverse.filter((r) => r.exp === task.exp);
  const discarded = d.excludedRecords.some((x) => x.exps.includes(task.exp));
  const fallback = (s: Store): TaskSide => ({
    text: task.structural[s],
    ok: null,
    detail: [],
    range: null,
    unit: '',
    of: null,
    incomplete: false,
  });
  const base = {
    id: task.id,
    records: [...new Set(rows.map((r) => r.record))].sort(),
  };
  if (rows.length === 0)
    return {
      ...base,
      source: discarded ? 'discarded' : 'none',
      postgresql: fallback('postgresql'),
      clickhouse: fallback('clickhouse'),
    };

  const side = (s: Store): TaskSide => {
    const own = rows.filter((r) => r.store === s);
    if (task.id === 'atomic') {
      const cells = own.filter((r) => r.structural && r.metric === 'partial_apply_count');
      const t = structuralText(cells.map((r) => r.values));
      if (t === null) return { ...fallback(s), incomplete: cells.length > 0 };
      const targets = [...new Set(cells.map((r) => r.target))];
      return {
        text: `${task.measure} ${t}건`,
        ok: cells.every((r) => r.values.every((v) => v === 0)),
        range: countRange(cells.map((r) => r.values)),
        unit: 'count',
        of: targets.length === 1 ? (targets[0] ?? null) : null,
        incomplete: false,
        detail: cells.map(
          (r) =>
            `${variantLabel(r.variant)}${r.read ? ` ${r.read}` : ''} · ${formatRows(r.scale)}행 — ${r.values.join(' · ')}`,
        ),
      };
    }
    if (task.id === 'constraint') {
      const cells = own.filter((r) => r.structural && CONSTRAINT_CASE.test(r.metric));
      // (변형 · 판독 팔 · 동시성 · 규모)마다 반복 자리별 합 — 3회 같은지 본다.
      // 판독 팔(read) · 동시성이 다른 행은 같은 사례를 다른 조건으로 잰 것이라 한 합에 섞지 않는다(섞으면 같은 사례를 두 번 센다).
      const groups = new Map<string, ReverseRow[]>();
      for (const r of cells) {
        const k = JSON.stringify([r.variant, r.read, r.concurrency, r.scale]);
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      const sums: (number | null)[][] = [];
      // 규칙을 어긴 몫 — 반복 자리별로 사례마다 받아도 되는 몫을 뺀 나머지의 합(변형별로 따로 모은다)
      const violations = new Map<string, (number | null)[][]>();
      const detail: string[] = [];
      const allowedOf = (r: ReverseRow) => CONSTRAINT_ALLOWED[r.metric.slice('accepted_count.'.length)] ?? 0;
      for (const g of groups.values()) {
        const n = Math.max(...g.map((r) => r.values.length));
        const sum = Array.from({ length: n }, (_, i) => {
          const xs = g.map((r) => r.values[i]);
          return xs.every(isNum) ? xs.reduce((a, b) => a + b, 0) : null;
        });
        const bad = Array.from({ length: n }, (_, i) => {
          const xs = g.map((r) => r.values[i]);
          return xs.every(isNum)
            ? g.reduce((a, r, j) => a + Math.max(0, (xs[j] as number) - allowedOf(r)), 0)
            : null;
        });
        sums.push(sum);
        const r0 = g[0] as ReverseRow;
        violations.set(r0.variant, [...(violations.get(r0.variant) ?? []), bad]);
        const arm = armLabel(r0.read);
        detail.push(
          `${variantLabel(r0.variant)}${arm ? ` · ${arm}` : ''} · ${formatRows(r0.scale)}행 — ${sum.map((v) => v ?? '—').join(' · ')}(규칙 어김 ${bad.map((v) => v ?? '—').join(' · ')})`,
        );
      }
      const t = structuralText(sums);
      if (t === null) return { ...fallback(s), incomplete: sums.length > 0 };
      const ok = cells.every((r) => {
        const c = r.metric.slice('accepted_count.'.length);
        const allowed = CONSTRAINT_ALLOWED[c] ?? 0;
        return r.values.every((v) => isNum(v) && v <= allowed);
      });
      // 기본 변형이 없으면 기록에 처음 나온 변형 하나로(그래도 섞지 않는다)
      const variant = violations.has(DEFAULT_VARIANT[s]) ? DEFAULT_VARIANT[s] : [...violations.keys()][0];
      return {
        text: `${task.measure} ${t}건`,
        ok,
        detail,
        range: countRange(sums),
        unit: 'count',
        of: null,
        incomplete: false,
        violated: variant === undefined ? null : countRange(violations.get(variant) ?? []),
      };
    }
    if (task.id === 'point')
      return distributionSide(own, s, 'latency_p50', 'concurrency', task.measure, task.structural[s]);
    if (task.id === 'insert')
      return distributionSide(own, s, 'insert_latency_p50', 'rate', task.measure, task.structural[s]);
    // 상태 갱신 — 갱신 지연 p50 지표(이름에 latency_p50 · 가시성 지표 제외)가 있으면 그것
    const metric = [...new Set(own.filter((r) => !r.structural).map((r) => r.metric))]
      .filter((m) => /latency_p50$/.test(m) && !/visib/i.test(m))
      .sort()[0];
    return metric
      ? distributionSide(own, s, metric, 'concurrency', task.measure, task.structural[s])
      : fallback(s);
  };
  return { ...base, source: 'measured', postgresql: side('postgresql'), clickhouse: side('clickhouse') };
}

// ── 상황 카드(주니어 눈높이 — 08_screen/08 §EXP-PERF 업무 데이터 열 · 설계 .omc/plans/web-junior-redesign.md §2) ──

/**
 * 상황 카드 4 — 질문형 제목 · 쉬운 "왜?" 한 줄(PRINCIPLES를 비유로 다시 쓴 판독기 상수).
 * 출처는 PRINCIPLES와 같다(05_data_stores/10 §원리 대응) — 문서 표가 바뀌면 같은 변경 단위에서 고친다. 수치는 taskSummary가 기록에서 읽는다.
 * 상태 갱신(EXP-40)은 기록이 폐기돼 카드에 넣지 않는다.
 */
export const SITUATIONS: readonly {
  id: Exclude<BusinessTaskId, 'update'>;
  title: string;
  /** 용어 괄호 — 작게 */
  term: string;
  why: string;
}[] = [
  {
    id: 'atomic',
    title: '작업 완료 중 오류가 나면?',
    term: '트랜잭션',
    why: 'PG는 여러 작업을 한 묶음으로 처리해서, 중간에 실패하면 전부 되돌려요. CH는 문장 하나씩만 지켜요.',
  },
  {
    id: 'constraint',
    title: '규칙에 어긋나는 데이터를 넣으면?',
    term: '제약 조건',
    why: 'PG는 저장 전에 "중복 금지 · 없는 번호 금지" 같은 규칙을 검사해 거절해요. CH에는 이런 검사가 거의 없어요.',
  },
  {
    id: 'point',
    title: '주문 1건 찾기',
    term: '점 조회',
    why: 'PG는 책의 목차처럼 그 행 위치로 바로 가요. CH는 수천 행 묶음을 통째로 읽어야 해요.',
  },
  {
    id: 'insert',
    title: '1건씩 아주 자주 저장하기',
    term: '단건 삽입',
    why: 'PG는 한 건을 바로 끝에 붙여 써요. CH는 저장할 때마다 새 조각 파일을 만들거나, 모았다가 한꺼번에 써요.',
  },
];

export interface SituationLine {
  ok: boolean | null;
  text: string;
}

/** 수치 줄 빈 값 · 3회 미만(08_screen/08 §상태 4행 ④ · §표시 계약 구조 결과 · 분포 값) */
export const NO_VALUE_TEXT = '잰 값 없음';
export const INCOMPLETE_TEXT = '판정할 만큼 재지 않았어요';

const countText = ([lo, hi]: [number, number]) => (lo === hi ? `${lo}` : `${lo}~${hi}`);
const msShort = (v: number) =>
  v >= 100 ? Math.round(v).toLocaleString('ko-KR') : String(Number(v.toPrecision(2)));
const msRange = ([lo, hi]: [number, number]) => {
  const a = msShort(lo);
  const b = msShort(hi);
  return a === b ? `${a}밀리초` : `${a}~${b}밀리초`;
};

/**
 * 상황 카드 두 줄(PG · CH) — taskSummary의 수치 · 판정을 쉬운 문장으로.
 * 원천이 없으면 "잰 값 없음"(수치를 지어내지 않는다 · 질문형 제목과 "왜?"는 상수라 그대로) · 3회 미만이면 "판정할 만큼 재지 않았어요".
 * 원자성은 대상 수가 있으면 "20번 중 20번 깨짐" · 시간 작업은 CH 줄에 "N배 느림" — 보수적으로 CH 최솟값 ÷ PG 최댓값.
 * 범위가 있으면 "N배 이상"이고 하한이라 반올림하지 않고 내린다(timesAtLeast — 40.8 → "40배 이상" · 2.75 → "2.7배 이상").
 */
export function situationLines(s: TaskSummary): { postgresql: SituationLine; clickhouse: SituationLine } {
  const pg = s.postgresql;
  const ch = s.clickhouse;
  const blank = (x: TaskSide): SituationLine => ({
    ok: null,
    text: x.incomplete ? INCOMPLETE_TEXT : NO_VALUE_TEXT,
  });
  if (s.source !== 'measured' || !pg.range || !ch.range)
    return {
      postgresql: pg.range ? lineOf(s, pg) : blank(pg),
      clickhouse: ch.range ? lineOf(s, ch) : blank(ch),
    };
  if ((s.id === 'point' || s.id === 'insert') && pg.unit === 'ms' && ch.unit === 'ms') {
    const slow = ch.range[0] / pg.range[1];
    const wide = pg.range[0] !== pg.range[1] || ch.range[0] !== ch.range[1];
    const times = wide ? timesAtLeast(slow) : timesText(slow);
    return {
      postgresql: { ok: null, text: `보통 ${msRange(pg.range)}` },
      clickhouse: {
        ok: null,
        // 1.0배는 차이가 없다는 말이라 붙이지 않는다
        text:
          slow > 1 && times !== '1.0'
            ? `보통 ${msRange(ch.range)} — ${times}배${wide ? ' 이상' : ''} 느림`
            : `보통 ${msRange(ch.range)}`,
      },
    };
  }
  return { postgresql: lineOf(s, pg), clickhouse: lineOf(s, ch) };
}

/** 한 저장소 줄 — 원자성 · 제약은 건수 문장 · 시간 작업은 밀리초 */
function lineOf(s: TaskSummary, x: TaskSide): SituationLine {
  const r = x.range as [number, number];
  if (x.unit === 'ms') return { ok: null, text: `보통 ${msRange(r)}` };
  if (s.id === 'atomic') {
    if (x.ok) return { ok: true, text: `전부 되돌림 — 깨진 데이터 ${countText(r)}건` };
    const of = x.of === null ? '' : `${x.of}번 중 `;
    return { ok: x.ok, text: `반만 저장 — ${of}${countText(r)}번 깨짐` };
  }
  if (s.id === 'constraint') {
    if (x.ok) return { ok: true, text: `막아 냄 — 받아도 되는 ${countText(r)}건만 받음` };
    // 받은 건수 전부가 아니라 받아도 되는 몫을 뺀 "규칙을 어긴" 건수 · 기본 변형 하나(taskSummary violated)
    return x.violated
      ? { ok: x.ok, text: `규칙을 어긴 데이터 ${countText(x.violated)}건까지 받음` }
      : { ok: x.ok, text: `받은 데이터 ${countText(r)}건(규칙을 어긴 몫은 못 셌어요)` };
  }
  return { ok: x.ok, text: x.text };
}
