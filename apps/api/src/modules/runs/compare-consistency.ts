// ③ 데이터 정합성 대조(순수 함수) — 두 저장소가 받은 결과가 같은지 네 기준으로 맞춘다(사용자 결정 2026-10-13 — 행 수 · 값 합계 · 묶음 집계 · 행 지문)
// 정본 docs/07_api/09_datagen.md §데이터 정합성 · 기전 docs/06_pipeline/10_datagen_inject.md §직접 비교 실행
// 저장소마다 묶음(설비 · 태그 · 1시간) 결과 하나(compare-sql CH_ · PG_CONSISTENCY_GROUPS)에서 네 기준을 낸다 — 행 수 · 합계 · 지문은 묶음 값의 합이다.
// 묶음 집계는 묶음마다 행 수 · 값 합계 · 최소 · 최대가 모두 같아야 같다(한쪽에만 있는 묶음도 다른 묶음) — 지문은 넣지 않는다(④가 따로 본다).
// 행 지문은 data-diff(Datafold)와 같은 방식 — 행마다 MD5 → 합. XOR로 합치면 같은 행이 두 번 들어갈 때 지워져 중복을 못 잡는다.
// 다른 곳(mismatches)은 어느 값이든(지문 포함) 다른 묶음 — 품질만 바뀌어 ④만 다를 때도 어디인지 짚는다.
import { createHash } from 'node:crypto';
import {
  CONSISTENCY_MISMATCH_LIMIT,
  type CompareRunResultBody,
  type ConsistencyStoreBody,
  cardTagCode,
  parseCardDeviceCode,
} from '@db-study/shared';
import type { SeedTagRow } from './compare-gen';
import type { TimeRange } from './compare-range';
import type { GroupSum } from './compare-stores';

type ConsistencyResult = Extract<CompareRunResultBody, { part: 'consistency' }>;

const iso = (ms: number) => new Date(ms).toISOString();
const keyOf = (g: Pick<GroupSum, 'deviceId' | 'tagId' | 'hour'>) => `${g.deviceId}:${g.tagId}:${g.hour}`;

/** 재기 전 — 구간만 있고 두 저장소 모두 비었다(재는 동안 화면이 칸을 다 그린다) */
export function consistencyStart(range: TimeRange): ConsistencyResult {
  return {
    part: 'consistency',
    rangeStart: iso(range.start),
    rangeEnd: iso(range.end),
    clickhouse: null,
    postgres: null,
    checks: null,
    mismatchGroups: null,
    diffGroups: null,
    mismatches: [],
    match: null,
  };
}

/** 저장소 하나의 네 기준 값 — 묶음 결과의 합(정수라 더하는 순서와 무관) */
export function storeSummary(groups: readonly GroupSum[], scanMs: number): ConsistencyStoreBody {
  let rows = 0;
  let sum = 0n;
  let fingerprint = 0n;
  for (const g of groups) {
    rows += g.n;
    sum += g.s;
    fingerprint += g.f;
  }
  return {
    rows,
    sum: sum.toString(),
    groups: groups.length,
    fingerprint: fingerprint.toString(),
    scanMs: Math.round(scanMs),
  };
}

export interface GroupDiff {
  deviceId: number;
  tagId: number;
  hour: number;
  /** 묶음 행 수 — 그쪽에 묶음이 없으면 null */
  clickhouse: number | null;
  postgres: number | null;
}

/**
 * 두 저장소 묶음 대조 — ③ 묶음 집계가 다른 묶음 수(행 수 · 합계 · 최소 · 최대) · 어느 값이든 다른 묶음 수 · 앞 몇 개(시각 · 설비 · 태그 순).
 */
export function diffGroups(
  clickhouse: readonly GroupSum[],
  postgres: readonly GroupSum[],
  limit = CONSISTENCY_MISMATCH_LIMIT,
): { aggregate: number; any: number; first: GroupDiff[] } {
  const pg = new Map(postgres.map((g) => [keyOf(g), g]));
  const diffs: GroupDiff[] = [];
  let aggregate = 0;
  const seen = new Set<string>();
  const push = (g: GroupSum, c: GroupSum | undefined, p: GroupSum | undefined) =>
    diffs.push({
      deviceId: g.deviceId,
      tagId: g.tagId,
      hour: g.hour,
      clickhouse: c?.n ?? null,
      postgres: p?.n ?? null,
    });
  for (const c of clickhouse) {
    const k = keyOf(c);
    seen.add(k);
    const p = pg.get(k);
    const sameAgg = p !== undefined && c.n === p.n && c.s === p.s && c.lo === p.lo && c.hi === p.hi;
    if (!sameAgg) aggregate += 1;
    if (!sameAgg || c.f !== p.f) push(c, c, p);
  }
  for (const p of postgres) {
    if (seen.has(keyOf(p))) continue;
    aggregate += 1;
    push(p, undefined, p);
  }
  diffs.sort((a, b) => a.hour - b.hour || a.deviceId - b.deviceId || a.tagId - b.tagId);
  return { aggregate, any: diffs.length, first: diffs.slice(0, limit) };
}

/** 두 저장소를 다 잰 뒤 — 기준별 판정 · 다른 곳(이름은 labels — 설비 · 태그 키 `${deviceId}:${tagId}`) */
export function consistencyVerdict(
  r: ConsistencyResult,
  diff: ReturnType<typeof diffGroups>,
  labels: ReadonlyMap<string, string>,
): ConsistencyResult {
  const { clickhouse: ch, postgres: pg } = r;
  if (!ch || !pg) throw new Error('두 저장소를 다 잰 뒤에만 판정한다');
  const checks = {
    rows: ch.rows === pg.rows,
    sum: ch.sum === pg.sum,
    groups: diff.aggregate === 0,
    fingerprint: ch.fingerprint === pg.fingerprint,
  };
  return {
    ...r,
    checks,
    mismatchGroups: diff.aggregate,
    diffGroups: diff.any,
    mismatches: diff.first.map((d) => ({
      deviceId: d.deviceId,
      tagId: d.tagId,
      label: labels.get(`${d.deviceId}:${d.tagId}`) ?? null,
      hour: iso(d.hour),
      clickhouse: d.clickhouse,
      postgres: d.postgres,
    })),
    match: checks.rows && checks.sum && checks.groups && checks.fingerprint,
  };
}

/** 설비 · 태그 이름 — "L1-PRT 인쇄 · 잉크 온도"(카드 라인 템플릿에 없는 태그는 코드 그대로) */
export function tagLabels(rows: readonly SeedTagRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const parsed = parseCardDeviceCode(r.device_code);
    const tpl = parsed?.process.tags.find((t) => cardTagCode(r.device_code, t.suffix) === r.tag_code);
    out.set(
      `${Number(r.device_id)}:${Number(r.tag_id)}`,
      parsed && tpl
        ? `${r.device_code} ${parsed.process.name} · ${tpl.name}`
        : `${r.device_code} · ${r.tag_code}`,
    );
  }
  return out;
}

/** 2000-01-01T00:00:00Z(epoch ms) — PostgreSQL timestamptz_send의 0점 */
const PG_EPOCH_MS = 946_684_800_000;

/**
 * 행 지문의 기준 구현 — compare-sql CH_ · PG_CONSISTENCY_GROUPS가 행마다 내는 값과 같은 규칙(시험이 두 DB 실측값으로 고정한다).
 * 6열의 빅엔디언 바이트 — 설비 int32 · 태그 int32 · 시각 int64(2000-01-01부터 마이크로초) · 값 float64 · 품질 int16 · 순번 int64 → MD5 앞 8바이트(부호 있음).
 */
export function rowFingerprint(r: {
  deviceId: number;
  tagId: number;
  tsMs: number;
  value: number;
  quality: number;
  scanSeq: number;
}): bigint {
  const b = Buffer.alloc(34);
  b.writeInt32BE(r.deviceId, 0);
  b.writeInt32BE(r.tagId, 4);
  b.writeBigInt64BE(BigInt(r.tsMs - PG_EPOCH_MS) * 1000n, 8);
  b.writeDoubleBE(r.value, 16);
  b.writeInt16BE(r.quality, 24);
  b.writeBigInt64BE(BigInt(r.scanSeq), 26);
  return createHash('md5').update(b).digest().readBigInt64BE(0);
}
