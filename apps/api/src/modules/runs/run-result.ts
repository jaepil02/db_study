// 직접 비교 결과 보관(PG run_result · 마이그레이션 008) — 정본 docs/05_data_stores/01_postgresql_schema.md §run_result 설계
// 실행 상태는 메모리(진행 1 + 마지막 1)라 재기동이면 사라진다 — ⑤ 패널의 "마지막 결과"는 여기서 읽는다.
// 읽기는 부분 목록(COMPARE_PARTS)만 — 계약에서 지운 부분의 옛 행이 남아 있어도 읽지 않는다.
// 쓰기는 종결 직전 한 번(RunRegistry archive) · 읽기는 GET /api/v1/runs/latest?type=compare —
// 부분별 최근 완료(completed) 1건 + 부분별 마지막 시도(attempts — 완료 · 중단 · 실패 무엇이든). 화면은 마지막 시도가 완료보다 뒤면
// "마지막 시도는 중단됐어요"를 그 전 완료 결과 위에 보인다(r5 L3).
// 마지막 넣기(lastIngest)는 상태를 가리지 않는다 — 마지막 넣기가 중단 · 실패면 사흘 창은 이미 비워졌고 앞부분만 다시 찼으므로
// 앞서 완료한 넣기의 구간이 아니라 "비교 데이터 없음"으로 본다(r5 M1 · 조회 대결 409 · 현황 compareRange null).
import {
  COMPARE_PARTS,
  type CompareAttemptBody,
  type CompareLatestBodyType,
  type CompareLatestEntryBody,
  type ComparePart,
  CompareRunParams,
  CompareRunResult,
  type CompareRunResultBody,
  RUN_DEFAULTS,
} from '@db-study/shared';
import type { Pool } from 'pg';

export const RUN_RESULTS = Symbol('RunResults');

export interface RunResultRow {
  runId: string;
  part: ComparePart;
  params: Record<string, number | string>;
  status: 'completed' | 'stopped' | 'failed';
  result: CompareRunResultBody | null;
  startedAt: number;
  endedAt: number;
  commitHash: string | null;
  switches: Record<string, string | number>;
  plantOn: boolean;
}

export interface RunResultReader {
  latestCompare(): Promise<CompareLatestBodyType>;
}

/** 마지막 넣기(상태 무관) — 완료면 구간 · 넣기 끝에 센 행 수가 있다 */
export interface LastIngest {
  runId: string;
  status: 'completed' | 'stopped' | 'failed';
  range: { start: number; end: number } | null;
  /** 넣기 verify 단계가 센 구간 행 수(두 저장소) — 완료가 아니면 null */
  rows: { clickhouse: number; postgres: number } | null;
  /** 넣기가 Redis로 보낸 행 수 — 완료가 아니면 null(데이터 정합성이 합계 옆에 보인다) */
  published: number | null;
}

export interface RunResultStore extends RunResultReader {
  insert(row: RunResultRow): Promise<void>;
  /** 가장 최근에 끝난 넣기(완료 · 중단 · 실패 무엇이든) — 없으면 null */
  lastIngest(): Promise<LastIngest | null>;
}

/** 비교 데이터가 온전한 넣기 구간 — 마지막 넣기가 완료일 때만 · 중단 · 실패 · 없음이면 null */
export function completeIngestRange(last: LastIngest | null): { start: number; end: number } | null {
  return last?.status === 'completed' ? last.range : null;
}

export const RUN_RESULT_INSERT = `
INSERT INTO run_result (run_id, type, part, params, status, result, started_at, ended_at, commit_hash, switches, plant_on)
VALUES ($1, 'compare', $2, $3, $4, $5, $6, $7, $8, $9, $10)`;

/** 부분별 최근 완료 1건 — 인덱스 (type, part, ended_at DESC)를 부분마다 한 번 내려간다(부분은 $1 — COMPARE_PARTS만) */
export const RUN_RESULT_LATEST = `
SELECT r.run_id, r.part, r.params, r.status, r.result, r.started_at, r.ended_at, r.commit_hash, r.switches, r.plant_on
  FROM unnest($1::text[]) AS p(part)
  CROSS JOIN LATERAL (
    SELECT * FROM run_result x
     WHERE x.type = 'compare' AND x.part = p.part AND x.status = 'completed'
     ORDER BY x.ended_at DESC
     LIMIT 1
  ) r`;

/** 부분별 마지막 시도 1건(상태 무관) */
export const RUN_RESULT_ATTEMPTS = `
SELECT r.run_id, r.part, r.status, r.ended_at
  FROM unnest($1::text[]) AS p(part)
  CROSS JOIN LATERAL (
    SELECT x.run_id, x.part, x.status, x.ended_at FROM run_result x
     WHERE x.type = 'compare' AND x.part = p.part
     ORDER BY x.ended_at DESC
     LIMIT 1
  ) r`;

/** 마지막 넣기(상태 무관) — 완료면 결과의 구간 · 행 수를 함께 읽는다 */
export const RUN_RESULT_LAST_INGEST = `
SELECT run_id, status, result->>'rangeStart' AS range_start, result->>'rangeEnd' AS range_end,
       result->'rows'->>'clickhouse' AS ch_rows, result->'rows'->>'postgres' AS pg_rows,
       result->'rows'->>'published' AS pub_rows
  FROM run_result
 WHERE type = 'compare' AND part = 'ingest'
 ORDER BY ended_at DESC
 LIMIT 1`;

interface LatestRow {
  run_id: string;
  part: ComparePart;
  params: unknown;
  status: 'completed' | 'stopped' | 'failed';
  result: unknown;
  started_at: Date;
  ended_at: Date;
  commit_hash: string | null;
  switches: Record<string, string | number>;
  plant_on: boolean;
}

interface AttemptRow {
  run_id: string;
  part: ComparePart;
  status: 'completed' | 'stopped' | 'failed';
  ended_at: Date;
}

export function attemptOf(r: AttemptRow): CompareAttemptBody {
  return { runId: r.run_id, status: r.status, endedAt: new Date(r.ended_at).toISOString() };
}

interface LastIngestRow {
  run_id: string;
  status: 'completed' | 'stopped' | 'failed';
  range_start: string | null;
  range_end: string | null;
  ch_rows: string | null;
  pg_rows: string | null;
  pub_rows?: string | null;
}

/** 행 → 마지막 넣기 — 구간 · 행 수는 완료이고 결과 json에 값이 있을 때만 */
export function lastIngestOf(r: LastIngestRow): LastIngest {
  const start = r.range_start === null ? Number.NaN : Date.parse(r.range_start);
  const end = r.range_end === null ? Number.NaN : Date.parse(r.range_end);
  const done = r.status === 'completed';
  const range = done && Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
  const ch = r.ch_rows === null ? Number.NaN : Number(r.ch_rows);
  const pg = r.pg_rows === null ? Number.NaN : Number(r.pg_rows);
  const pub = r.pub_rows == null ? Number.NaN : Number(r.pub_rows);
  return {
    runId: r.run_id,
    status: r.status,
    range,
    rows: range && Number.isInteger(ch) && Number.isInteger(pg) ? { clickhouse: ch, postgres: pg } : null,
    published: range && Number.isInteger(pub) ? pub : null,
  };
}

/**
 * 매개변수는 계약 키(part · rows)만 읽는다 — 옛 판이 함께 적은 키는 버린다.
 * 옛 넣기(시간 구간 spanHours — 2026-10-12 건수 단위로 바뀌기 전)는 rows가 없어 기본값으로 읽힌다(그 결과 json은 계약과 달라 result null).
 */
function paramsOf(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw;
  const { part, rows } = raw as Record<string, unknown>;
  return { part, rows };
}

/** 행 하나 → 계약 모양 — 결과 json이 지금 계약과 어긋나면(옛 판) result만 null로 둔다(행은 버리지 않는다) */
export function latestEntryOf(r: LatestRow): CompareLatestEntryBody {
  const params = CompareRunParams.safeParse(paramsOf(r.params));
  const result = r.result === null ? null : CompareRunResult.safeParse(r.result);
  return {
    runId: r.run_id,
    status: r.status,
    params: params.success ? params.data : { part: r.part, rows: RUN_DEFAULTS.compare.rows },
    result: result?.success ? result.data : null,
    startedAt: new Date(r.started_at).toISOString(),
    endedAt: new Date(r.ended_at).toISOString(),
    commitHash: r.commit_hash,
    switches: r.switches ?? {},
    plantOn: r.plant_on,
  };
}

export class PgRunResultStore implements RunResultStore {
  constructor(private readonly pool: Pool) {}

  async insert(row: RunResultRow): Promise<void> {
    await this.pool.query(RUN_RESULT_INSERT, [
      row.runId,
      row.part,
      JSON.stringify(row.params),
      row.status,
      row.result === null ? null : JSON.stringify(row.result),
      new Date(row.startedAt),
      new Date(row.endedAt),
      row.commitHash,
      JSON.stringify(row.switches),
      row.plantOn,
    ]);
  }

  async latestCompare(): Promise<CompareLatestBodyType> {
    const parts = [...COMPARE_PARTS];
    const rs = await this.pool.query<LatestRow>(RUN_RESULT_LATEST, [parts]);
    const at = await this.pool.query<AttemptRow>(RUN_RESULT_ATTEMPTS, [parts]);
    const out: CompareLatestBodyType = {
      ingest: null,
      query: null,
      consistency: null,
      attempts: { ingest: null, query: null, consistency: null },
    };
    for (const r of rs.rows) out[r.part] = latestEntryOf(r);
    for (const r of at.rows) out.attempts[r.part] = attemptOf(r);
    return out;
  }

  async lastIngest(): Promise<LastIngest | null> {
    const r = (await this.pool.query<LastIngestRow>(RUN_RESULT_LAST_INGEST)).rows[0];
    return r ? lastIngestOf(r) : null;
  }
}
