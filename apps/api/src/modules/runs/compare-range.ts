// 직접 비교 실행의 과거 시각 창(순수 함수) — 정본 docs/07_api/09_datagen.md §과거 시각 창(r5 H1)
// 비교 행은 실행이 정한 과거 구간에만 싣는다 — 지금 흐르는 설비 가동 데이터(현재 시각)와 섞이지 않고, 보존 60일(tag_raw TTL · TimescaleDB 보존 정책) 안에 든다.
// 창은 넣기 하나다(D는 오늘 UTC 날짜) — 조회 대결 · 데이터 정합성은 마지막 넣기 구간을 읽기만 한다:
//   넣기(ingest)     UTC D−52 00:00부터 정확히 N행(건수 단위 · 사용자 결정 2026-10-12) — 카드 라인 초당 231행이라 10억이면 약 50일치(D−2에서 끝난다)
//   비우기            UTC D−52 00:00 ~ D−1 00:00(51일 통째) — 앞서 넣은 더 큰 넣기가 남지 않게 · 오늘 · 어제의 가동 데이터는 건드리지 않는다
// 경계는 UTC 자정이다 — 두 저장소의 하루 단위(ClickHouse 일 파티션 toYYYYMMDD(ts) · PostgreSQL hypertable 칸 1일)가 UTC 날이라,
// 비우는 창은 하루 단위를 통째로 덮어 DROP PARTITION · drop_chunks로만 비운다. 걸친 날의 DELETE가 남긴 죽은 행 자리가 다음 넣기의
// PostgreSQL 크기를 부풀리지 않는다(r5 H1).
// 보존 여유: tag_raw TTL은 행마다 ts + 60일 · TimescaleDB 보존 정책 60일(칸 통째) · control_check_range는 시작 ≥ now − 60일 — D−52 00:00은 하루 중 언제 시작해도 7일 넘게 남는다.
// 조회 대결은 이 구간의 앞에서부터 원천 N행을 잘라 1시간 칸(UTC)으로 집계한다 — 5,000만 행 이상을 넣어야 조회 대결 10단계를 다 잰다.

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
/** 넣기 구간 시작 — 오늘(UTC) 자정에서 며칠 전 */
export const INGEST_DAYS_BACK = 52;
/** 넣기 · 비우기 창의 끝 — 오늘(UTC) 자정에서 며칠 전(어제 자정) · 창이 이보다 길면 넣지 않는다 */
export const INGEST_END_DAYS_BACK = 1;
/** 보존(tag_raw TTL 60일 · TimescaleDB add_retention_policy 60 days) — 창이 이 안에 있어야 실행 도중 지워지지 않는다 */
export const RETENTION_MS = 60 * DAY_MS;
/** 보존 경계까지 남겨 둘 여유 — 실행(10억이면 수 시간)이 끝나기 전에 TTL · 보존 정책이 창을 지우지 않게 */
export const RETENTION_MARGIN_MS = 6 * HOUR_MS;

export interface TimeRange {
  start: number;
  end: number;
}

/** nowMs가 속한 UTC 날의 자정(epoch ms) */
export function utcMidnight(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS;
}

/**
 * 넣기 구간 — UTC D−52 00:00부터 rows행. 초당 pps행이 고르게 들어가므로 끝은 마지막 행이 든 초의 끝이다
 * (rows가 pps의 배수가 아니면 마지막 초는 일부만 — 자르는 순서는 compare-gen genSecondCut).
 */
export function ingestRange(nowMs: number, rows: number, pps: number): TimeRange {
  const start = utcMidnight(nowMs) - INGEST_DAYS_BACK * DAY_MS;
  return { start, end: start + Math.ceil(rows / pps) * 1000 };
}

/** 넣기가 비우는 창 — UTC D−52 00:00 ~ D−1 00:00(통째인 UTC 날 51개) · 넣기 구간은 이 안에 들어야 한다 */
export function ingestWideRange(nowMs: number): TimeRange {
  const mid = utcMidnight(nowMs);
  return { start: mid - INGEST_DAYS_BACK * DAY_MS, end: mid - INGEST_END_DAYS_BACK * DAY_MS };
}

/** 구간이 걸친 UTC 날 — ClickHouse tag_raw 파티션 ID(toYYYYMMDD(ts) · UTC) · PostgreSQL 일 파티션 접미와 같은 'YYYYMMDD' */
export function utcDayIds(r: TimeRange): string[] {
  const out: string[] = [];
  for (let d = Math.floor(r.start / DAY_MS) * DAY_MS; d < r.end; d += DAY_MS) {
    out.push(new Date(d).toISOString().slice(0, 10).replaceAll('-', ''));
  }
  return out;
}

/** UTC 날 하나가 구간에 통째로 들어가는가 — 그 파티션은 DROP · TRUNCATE로 비울 수 있다 */
export function wholeUtcDaysIn(r: TimeRange): string[] {
  return utcDayIds(r).filter((id) => {
    const d = Date.UTC(Number(id.slice(0, 4)), Number(id.slice(4, 6)) - 1, Number(id.slice(6, 8)));
    return d >= r.start && d + DAY_MS <= r.end;
  });
}

/** 창이 보존 안 과거에 있는가(실행 시작 시각 기준 · 경계까지 RETENTION_MARGIN_MS 여유) — PostgreSQL control_check_range와 같은 규칙의 코드 쪽 */
export function withinRetention(r: TimeRange, nowMs: number): boolean {
  return r.start >= nowMs - RETENTION_MS + RETENTION_MARGIN_MS && r.end <= nowMs && r.end > r.start;
}
