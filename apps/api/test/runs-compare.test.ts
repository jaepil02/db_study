// 직접 비교(run type compare) — 정본 docs/06_pipeline/10_datagen_inject.md §직접 비교 실행 · docs/07_api/09_datagen.md §직접 비교
// 저장소 없이 본다: 과거 창 계산(UTC 자정 · 보존 안 · r5 H1) · 카드 라인 행 생성(계약 v1) · 계측 차분 · SQL 모양 ·
// 실행기 4부분(가짜 파이프라인 — ClickHouse는 다 받고 PostgreSQL은 키 · 참조 · 값 규칙을 지킨다 · 게이트가 열렸을 때만) · 결과 보관 · 최신 선택.
import {
  CARD_LINES,
  CARD_PROCESSES,
  COMPARE_INGEST_ROWS,
  COMPARE_QUERY_SIZES,
  CONSISTENCY_MISMATCH_LIMIT,
  CompareLatestBody,
  CompareRunResult,
  cardDeviceCode,
  cardTagCode,
  compareQueryStepKey,
  compareSizeName,
  decodeEntry,
  entryTimestamps,
  nominalPointsPerSec,
  RunObject,
  StreamEntryV1,
} from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/common/http/api-error';
import type { GroupBacklog } from '../src/common/redis/durable-key-client';
import { thresholdsFor } from '../src/modules/runs/backpressure-gate';
import {
  consistencyStart,
  consistencyVerdict,
  diffGroups,
  rowFingerprint,
  storeSummary,
  tagLabels,
} from '../src/modules/runs/compare-consistency';
import {
  counterRate,
  type GenDevice,
  genChunk,
  genDevicesOf,
  genSecondCut,
  genValue,
  pointsPerSimSecond,
  type SeedTagRow,
} from '../src/modules/runs/compare-gen';
import {
  type CompareMeterSnapshot,
  type HistSnapshot,
  histDiff,
  histQuantile,
  toMs,
} from '../src/modules/runs/compare-metrics';
import {
  type AggRow,
  type CutRow,
  compareAgg,
  cutSeconds,
  type SecondCount,
} from '../src/modules/runs/compare-query';
import {
  DAY_MS,
  HOUR_MS,
  ingestRange,
  ingestWideRange,
  type TimeRange,
  utcDayIds,
  utcMidnight,
  wholeUtcDaysIn,
  withinRetention,
} from '../src/modules/runs/compare-range';
import {
  COMPARE_DRAIN_LIMIT_MS,
  COMPARE_START_BACKLOG_LIMIT_MS,
  COMPARE_STEPS,
  COMPRESS_WARNING,
  type CompareClock,
  type CompareDeps,
  CompareRunExecutor,
  DayCompressor,
  DRAIN_TIMEOUT_WARNING,
  INFLIGHT_COMPRESS_MIN_MS,
  INGEST_INCOMPLETE_MESSAGE,
  liveIngestResult,
  PLANT_ON_MESSAGE,
  TimelineSampler,
} from '../src/modules/runs/compare-runner';
import {
  chClearRawStatements,
  chClearRollupStatements,
  chMs,
  chPartitionId,
  SIZE_AGG_SQL,
} from '../src/modules/runs/compare-sql';
import {
  type CompareStores,
  type GroupSum,
  type SizeSlice,
  type StorePair,
  shareOf,
} from '../src/modules/runs/compare-stores';
import { RunRegistry } from '../src/modules/runs/run-registry';
import {
  completeIngestRange,
  type LastIngest,
  lastIngestOf,
  latestEntryOf,
  PgRunResultStore,
  type RunResultRow,
} from '../src/modules/runs/run-result';

/** 2026-10-11 12:00 KST */
const NOW = Date.parse('2026-10-11T03:00:00Z');

/** 카드 라인 시드 행 — 설비 30 · 태그 129(설비 · 태그 오름차순 ID) */
function cardSeedRows(): SeedTagRow[] {
  const rows: SeedTagRow[] = [];
  let deviceId = 0;
  let tagId = 0;
  for (const line of CARD_LINES)
    for (const p of CARD_PROCESSES) {
      deviceId += 1;
      const code = cardDeviceCode(line.code, p.code);
      for (const t of p.tags)
        rows.push({
          device_id: deviceId,
          device_code: code,
          tag_id: ++tagId,
          tag_code: cardTagCode(code, t.suffix),
        });
    }
  return rows;
}

describe('과거 창(UTC 자정 · 보존 안 · 서로 다른 UTC 날 — r5 H1)', () => {
  it('UTC 자정 — 그날 00:00 UTC(KST 09:00)', () => {
    expect(new Date(utcMidnight(NOW)).toISOString()).toBe('2026-10-11T00:00:00.000Z');
    expect(utcMidnight(Date.parse('2026-10-11T23:59:59Z'))).toBe(utcMidnight(NOW));
    expect(utcMidnight(Date.parse('2026-10-12T00:00:00Z'))).toBe(utcMidnight(NOW) + DAY_MS);
  });

  it('넣기 — UTC D−52 00:00부터 정확히 N행(마지막 초는 일부) · 카드 라인 10억이면 약 50일 · 비우기는 D−52 ~ D−1 51일', () => {
    const r = ingestRange(NOW, 100_000, 231);
    expect(new Date(r.start).toISOString()).toBe('2026-08-20T00:00:00.000Z');
    // 10만 ÷ 231 = 432.9초 → 433초째까지(마지막 초는 앞 208행만)
    expect(r.end - r.start).toBe(433_000);
    const big = ingestRange(NOW, 1_000_000_000, 231);
    expect((big.end - big.start) / DAY_MS).toBeCloseTo(50.1, 1);
    const wide = ingestWideRange(NOW);
    expect(new Date(wide.start).toISOString()).toBe('2026-08-20T00:00:00.000Z');
    expect(wide.end).toBe(utcMidnight(NOW) - DAY_MS);
    expect((wide.end - wide.start) / DAY_MS).toBe(51);
    expect(big.end).toBeLessThan(wide.end);
  });

  it('보존 60일 안 — 하루 중 언제 시작해도(UTC 00:00 · 23:59) 넣기 · 비우기 창은 보존 경계까지 7일 넘게 남는다', () => {
    for (const now of [Date.parse('2026-10-11T00:00:00Z'), Date.parse('2026-10-11T23:59:59Z')]) {
      for (const r of [
        ingestRange(now, 100_000, 231),
        ingestRange(now, 1_000_000_000, 231),
        ingestWideRange(now),
      ])
        expect(withinRetention(r, now)).toBe(true);
      // tag_raw TTL(ts + 60일) · control_check_range(시작 ≥ now − 60일)
      expect(ingestWideRange(now).start - (now - 60 * DAY_MS)).toBeGreaterThan(7 * DAY_MS);
    }
  });

  it('UTC 날 — 비우는 창은 일 파티션 51개를 통째로 덮는다(걸친 날 DELETE 없음)', () => {
    const r = ingestWideRange(NOW);
    expect(utcDayIds(r)).toHaveLength(51);
    expect(utcDayIds(r)[0]).toBe('20260820');
    expect(utcDayIds(r).at(-1)).toBe('20261009');
    expect(wholeUtcDaysIn(r)).toEqual(utcDayIds(r));
    expect(
      chClearRawStatements(r, wholeUtcDaysIn(r), utcDayIds(r)).every((q) => q.includes('DROP PARTITION')),
    ).toBe(true);
  });
});

describe('카드 라인 행 생성 — Stream 계약 v1 · 주기 · 결정적 값', () => {
  const devices = genDevicesOf(cardSeedRows());

  it('시드 → 설비 30 · 태그 129 · 1초 점 수 = 공정 명목 합 × 라인 3', () => {
    expect(devices).toHaveLength(30);
    expect(devices.reduce((a, d) => a + d.tags.length, 0)).toBe(129);
    const nominal = CARD_PROCESSES.reduce((a, p) => a + nominalPointsPerSec(p), 0) * CARD_LINES.length;
    expect(pointsPerSimSecond(devices)).toBe(nominal);
    // 카드 라인이 아닌 설비(시연 · 슬라이스)는 뺀다
    expect(genDevicesOf([{ device_id: 99, device_code: 'DEMO-FLOW-DEV', tag_id: 1, tag_code: 'X' }])).toEqual(
      [],
    );
  });

  it('엔트리 = 설비 하나의 1초 — 발행자 스키마 통과 · t0 = 초 시작 · 점마다 주기대로', () => {
    const start = ingestWideRange(NOW).start;
    const c = genChunk(devices, start, start + 2000, start);
    expect(c.payloads).toHaveLength(60);
    expect(c.totalPoints).toBe(pointsPerSimSecond(devices) * 2);
    const seen = new Set<string>();
    c.payloads.forEach((p, i) => {
      const e = StreamEntryV1.parse(decodeEntry(p));
      expect(e.tg.length).toBe(c.points[i]);
      expect(e.t0 % 1000).toBe(0);
      for (const [k, ts] of entryTimestamps(e).entries()) {
        const key = `${e.d}:${e.tg[k]}:${ts}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    });
  });

  it('마지막 초 자르기 — (시각 · 설비 · 태그) 순 앞 limit점만 · 계약 통과(min(dt) = 0) · 0이면 엔트리 없음', () => {
    const start = ingestWideRange(NOW).start;
    const order = (rows: { d: number; t: number; ts: number }[]) =>
      [...rows].sort((a, b) => a.ts - b.ts || a.d - b.d || a.t - b.t);
    const rowsOf = (c: { payloads: Buffer[] }) =>
      c.payloads.flatMap((p) => {
        const e = StreamEntryV1.parse(decodeEntry(p));
        return entryTimestamps(e).map((ts, i) => ({
          d: e.d,
          t: e.tg[i] as number,
          ts,
          v: e.va[i] as number,
        }));
      });
    const full = order(rowsOf(genChunk(devices, start, start + 1000, start)));
    for (const limit of [1, 30, 129, 130, 208, 230]) {
      const c = genSecondCut(devices, start, start, limit);
      expect(c.totalPoints).toBe(limit);
      expect(order(rowsOf(c))).toEqual(full.slice(0, limit));
    }
    expect(genSecondCut(devices, start, start, 0).payloads).toEqual([]);
  });

  it('값 — 범위 안(FLOAT32) · 수량은 단조 증가 · 상태 2(가동) · 같은 입력이면 같은 값', () => {
    const start = ingestWideRange(NOW).start;
    for (const d of devices)
      for (const t of d.tags) {
        const v = genValue(t, start + 12_345, start);
        if (t.kind === 'STATE') expect(v).toBe(2);
        else if (t.kind === 'COUNT') {
          expect(genValue(t, start + 60_000, start)).toBe(60 * counterRate(t.tagId));
          expect(genValue(t, start + 61_000, start)).toBeGreaterThan(genValue(t, start + 60_000, start));
        } else {
          expect(v).toBe(Math.fround(v));
          expect(v).toBeGreaterThanOrEqual(t.rangeMin ?? 0);
          expect(v).toBeLessThanOrEqual(t.rangeMax ?? 100);
        }
        expect(genValue(t, start + 12_345, start)).toBe(v);
      }
  });
});

describe('계측 차분 · 분위수', () => {
  const h = (b: [number, number][], count: number, sum: number): HistSnapshot => ({ buckets: b, count, sum });

  it('버킷 차 · 칸 안 선형 보간 · 표본 0이면 null · +Inf 칸은 아래 경계', () => {
    const a = h(
      [
        [0.05, 10],
        [0.08, 10],
        [Number.POSITIVE_INFINITY, 10],
      ],
      10,
      0.3,
    );
    const b = h(
      [
        [0.05, 10],
        [0.08, 30],
        [Number.POSITIVE_INFINITY, 30],
      ],
      30,
      1.6,
    );
    const d = histDiff(a, b);
    expect(d.count).toBe(20);
    expect(histQuantile(d, 0.5)).toBeCloseTo(0.065, 6);
    expect(toMs(histQuantile(d, 0.95))).toBe(78.5);
    expect(histQuantile(histDiff(a, a), 0.5)).toBeNull();
    expect(
      histQuantile(
        h(
          [
            [0.1, 0],
            [Number.POSITIVE_INFINITY, 4],
          ],
          4,
          4,
        ),
        0.5,
      ),
    ).toBe(0.1);
  });

  it('구간 몫 크기 — 파티션 크기 × 구간 행 ÷ 전체 행 · 행이 없으면 null', () => {
    const rows = new Map([
      ['a', { inRange: 50, total: 100 }],
      ['b', { inRange: 10, total: 10 }],
    ]);
    expect(
      shareOf(
        rows,
        new Map([
          ['a', 1000],
          ['b', 300],
        ]),
      ),
    ).toBe(800);
    expect(shareOf(new Map(), new Map())).toBeNull();
  });
});

describe('SQL 모양', () => {
  it('ClickHouse 구간 비우기 — 통째로 든 날은 DROP PARTITION · 걸친 날은 그 파티션 안 동기 변이(무결성 창 등) · 롤업 셋', () => {
    // UTC 날에 걸친 구간(옛 KST 정렬 72시간) — 넣기는 이제 걸치지 않지만 무결성 창 · 임의 구간은 이 길을 탄다
    const r: TimeRange = {
      start: Date.parse('2026-10-06T15:00:00Z'),
      end: Date.parse('2026-10-09T15:00:00Z'),
    };
    const raw = chClearRawStatements(r, wholeUtcDaysIn(r), utcDayIds(r));
    expect(raw).toEqual([
      "ALTER TABLE plc.tag_raw DROP PARTITION ID '20261007'",
      "ALTER TABLE plc.tag_raw DROP PARTITION ID '20261008'",
      `ALTER TABLE plc.tag_raw DELETE IN PARTITION ID '20261006' WHERE ts >= fromUnixTimestamp64Milli(toInt64(${r.start})) AND ts < fromUnixTimestamp64Milli(toInt64(${r.end})) SETTINGS mutations_sync = 1`,
      `ALTER TABLE plc.tag_raw DELETE IN PARTITION ID '20261009' WHERE ts >= fromUnixTimestamp64Milli(toInt64(${r.start})) AND ts < fromUnixTimestamp64Milli(toInt64(${r.end})) SETTINGS mutations_sync = 1`,
    ]);
    const roll = chClearRollupStatements(r);
    expect(roll).toHaveLength(3);
    expect(roll[2]).toContain('toStartOfDay(toDateTime(');
    expect(roll[2]).toContain("'Asia/Seoul'");
  });

  it('ALTER에 넣는 값은 검사한다 — 정수 ms · YYYYMMDD만', () => {
    expect(() => chMs(1.5)).toThrow();
    expect(() => chPartitionId("2026'; DROP")).toThrow();
    expect(chPartitionId('20261006')).toBe("'20261006'");
  });

  it('원천 N행 집계 — 두 저장소가 같은 모양(자른 시각 앞 전부 UNION ALL 자른 시각의 (설비, 태그)까지) · 바인딩만', () => {
    for (const sql of [SIZE_AGG_SQL.clickhouse, SIZE_AGG_SQL.postgres]) {
      expect(sql).toContain('UNION ALL');
      expect(sql).toMatch(/\(device_id, tag_id\) <= /);
      expect(sql).toContain('GROUP BY device_id, tag_id, h ORDER BY device_id, tag_id, h');
    }
    // 같은 뜻의 OR 한 줄은 PostgreSQL에서 압축 칸 벡터 필터를 못 탄다 — 모양이 되돌아가지 않게
    expect(SIZE_AGG_SQL.postgres).not.toMatch(/\bOR\b/);
    expect(SIZE_AGG_SQL.postgres).toContain('ts >= $1 AND ts < $2');
    expect(SIZE_AGG_SQL.postgres).toContain('ts = $2 AND (device_id, tag_id) <= ($3, $4)');
    expect(SIZE_AGG_SQL.postgres).toContain("time_bucket('1 hour', ts)");
    expect(SIZE_AGG_SQL.postgres).toContain('sum(floor(value * 1000)::bigint)');
    expect(SIZE_AGG_SQL.clickhouse).toContain('ts = fromUnixTimestamp64Milli({t:Int64})');
    expect(SIZE_AGG_SQL.clickhouse).toContain('({d:UInt32}, {g:UInt32})');
    expect(SIZE_AGG_SQL.clickhouse).toContain('sum(toInt64(floor(value * 1000)))');
  });
});

// ── 가짜 파이프라인 — xaddBatch 한 번 = 배치 하나(ClickHouse 삽입 → 게이트가 열렸으면 COPY 한 트랜잭션)

interface Row {
  d: number;
  t: number;
  ts: number;
  v: number;
  /** 품질 · 순번 — 없으면 생성기 값(모의 9 · 그 초의 epoch 초) */
  q?: number;
  seq?: number;
}

/** 두 DB의 실수 반올림(짝수 쪽 — 62.5 → 62 · 63.5 → 64 · 실측 2026-10-13) */
function rint(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** 64비트 모양(16자리 hex) — float8send · reinterpretAsUInt64와 같다 */
function bitsHex(v: number): string {
  const b = Buffer.alloc(8);
  b.writeDoubleBE(v);
  return b.toString('hex');
}

class FakeDb implements CompareStores {
  ch: Row[] = [];
  pg = new Map<string, Row>();
  gate = false;
  gateLog: string[] = [];
  cleared: TimeRange[] = [];
  /** 구간 압축(TimescaleDB)이 실패하는 경우 */
  compressFails = false;
  latestDeleted: number[][] = [];
  meter: CompareMeterSnapshot = {
    insert: { buckets: [], count: 0, sum: 0 },
    copy: { buckets: [], count: 0, sum: 0 },
    copyFailures: 0,
    rowsInserted: 0,
    copyRows: 0,
  };
  questionMs: Record<'clickhouse' | 'postgres', number> = { clickhouse: 5, postgres: 50 };

  constructor(
    readonly devices: GenDevice[],
    readonly registered: Set<number>,
    readonly clock: FakeClock,
  ) {}

  private hist(h: HistSnapshot, sec: number): HistSnapshot {
    const count = h.count + 1;
    return {
      buckets: [
        [0.05, count],
        [Number.POSITIVE_INFINITY, count],
      ],
      count,
      sum: h.sum + sec,
    };
  }

  private batch(rows: Row[]): void {
    this.ch.push(...rows);
    this.meter = {
      ...this.meter,
      insert: this.hist(this.meter.insert, 0.02),
      rowsInserted: this.meter.rowsInserted + rows.length,
    };
    if (!this.gate) return;
    const seen = new Set<string>();
    const ok = rows.every((r) => {
      const k = `${r.d}:${r.t}:${r.ts}`;
      if (this.pg.has(k) || seen.has(k)) return false;
      seen.add(k);
      return this.registered.has(r.d) && !Number.isNaN(r.v) && Math.abs(r.v) <= 1e12;
    });
    if (!ok) {
      this.meter = { ...this.meter, copyFailures: this.meter.copyFailures + 1 };
      return;
    }
    for (const r of rows) this.pg.set(`${r.d}:${r.t}:${r.ts}`, r);
    this.meter = {
      ...this.meter,
      copy: this.hist(this.meter.copy, 0.01),
      copyRows: this.meter.copyRows + rows.length,
    };
  }

  private inRange = (r: TimeRange) => (x: Row) => x.ts >= r.start && x.ts < r.end;

  async loadCardDevices() {
    return this.devices;
  }
  async clearRange(r: TimeRange) {
    this.cleared.push(r);
    this.ch = this.ch.filter((x) => !this.inRange(r)(x));
    for (const [k, x] of this.pg) if (this.inRange(r)(x)) this.pg.delete(k);
  }
  async rangeRows(r: TimeRange): Promise<StorePair<number>> {
    return {
      clickhouse: this.ch.filter(this.inRange(r)).length,
      postgres: [...this.pg.values()].filter(this.inRange(r)).length,
    };
  }
  async clickhouseRangeRows(r: TimeRange) {
    return this.ch.filter(this.inRange(r)).length;
  }
  async rangeStats(r: TimeRange) {
    const rows = await this.rangeRows(r);
    return {
      rows,
      bytes: { clickhouse: rows.clickhouse * 5, postgres: rows.postgres * 90 },
      optimized: true,
      compressed: !this.compressFails,
    };
  }
  async liveBytes(r: TimeRange) {
    const rows = await this.rangeRows(r);
    return { clickhouse: rows.clickhouse * 7, postgres: rows.postgres * 90 };
  }
  /** 넣는 도중 압축 — 건 범위와 그때까지 PostgreSQL에 들어 있던 그 범위 행 수 · 압축한 날 칸 수 */
  compressLog: { range: TimeRange; pgRowsIn: number }[] = [];
  async compressDays(r: TimeRange) {
    this.compressLog.push({ range: r, pgRowsIn: [...this.pg.values()].filter(this.inRange(r)).length });
    return utcDayIds(r).length;
  }
  async hasRows(r: TimeRange) {
    const rows = await this.rangeRows(r);
    return { clickhouse: rows.clickhouse > 0, postgres: rows.postgres > 0 };
  }
  /** ③ 묶음(설비 · 태그 · 1시간) — 행 수 · round(value × 1000) 합 · 최소 · 최대 · 행 지문 합(실제 SQL과 같은 규칙) · 걸린 시간(가짜 시계) */
  scanMs: Record<'clickhouse' | 'postgres', number> = { clickhouse: 30, postgres: 400 };
  /** 저장소 하나를 훑기 시작할 때 — 시험이 그 순간의 실행 결과를 본다 */
  onScan: ((store: 'clickhouse' | 'postgres') => void) | null = null;
  async consistencyGroups(store: 'clickhouse' | 'postgres', r: TimeRange): Promise<GroupSum[]> {
    this.onScan?.(store);
    this.clock.mono += this.scanMs[store];
    const rows = store === 'clickhouse' ? this.ch : [...this.pg.values()];
    const out = new Map<string, GroupSum & { min: number; max: number }>();
    for (const x of rows.filter(this.inRange(r))) {
      const hour = Math.floor(x.ts / HOUR_MS) * HOUR_MS;
      const k = `${x.d}:${x.t}:${hour}`;
      const cur = out.get(k) ?? {
        deviceId: x.d,
        tagId: x.t,
        hour,
        n: 0,
        s: 0n,
        lo: '',
        hi: '',
        f: 0n,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
      };
      cur.n += 1;
      cur.s += BigInt(rint(x.v * 1000));
      cur.min = Math.min(cur.min, x.v);
      cur.max = Math.max(cur.max, x.v);
      cur.f += rowFingerprint({
        deviceId: x.d,
        tagId: x.t,
        tsMs: x.ts,
        value: x.v,
        quality: x.q ?? 9,
        scanSeq: x.seq ?? Math.floor(x.ts / 1000),
      });
      out.set(k, cur);
    }
    return [...out.values()].map(({ min, max, ...g }) => ({ ...g, lo: bitsHex(min), hi: bitsHex(max) }));
  }
  async cardTagRows(): Promise<SeedTagRow[]> {
    const ids = new Set(this.devices.map((d) => d.deviceId));
    return cardSeedRows().filter((x) => ids.has(Number(x.device_id)));
  }
  /** 초별 행 수 — ClickHouse 원본(실제 SQL과 같은 규칙 · 초 오름차순) */
  /** 자를 자리 요청(단계 목록) — ClickHouse 안 계산(CH_SECOND_CUTS)과 같은 규칙의 기준 구현으로 답한다 */
  secondCutsAsked: number[][] = [];
  async secondCuts(r: TimeRange, targets: readonly number[]) {
    this.secondCutsAsked.push([...targets]);
    const out = new Map<number, number>();
    for (const x of this.ch.filter(this.inRange(r))) {
      const sec = Math.floor(x.ts / 1000) * 1000;
      out.set(sec, (out.get(sec) ?? 0) + 1);
    }
    const counts = [...out.entries()].sort(([x], [y]) => x - y).map(([sec, n]) => ({ sec, n }));
    return cutSeconds(counts, targets);
  }
  async secondRows(sec: number): Promise<CutRow[]> {
    return this.ch
      .filter(this.inRange({ start: sec, end: sec + 1000 }))
      .sort(byOrder)
      .map((x) => ({ ts: x.ts, deviceId: x.d, tagId: x.t }));
  }
  /** 원천 N행 집계 — 자른 시각 앞 전부 + 자른 시각의 (설비, 태그)까지 · 설비 · 태그 · 1시간 칸(실제 SQL과 같은 규칙) */
  sizeAggLog: { store: 'clickhouse' | 'postgres'; slice: SizeSlice }[] = [];
  async sizeAgg(store: 'clickhouse' | 'postgres', slice: SizeSlice): Promise<AggRow[]> {
    this.sizeAggLog.push({ store, slice });
    this.clock.mono += this.questionMs[store];
    const { cut } = slice;
    const rows = (store === 'clickhouse' ? this.ch : [...this.pg.values()]).filter(
      (x) =>
        (x.ts >= slice.start && x.ts < cut.ts) ||
        (x.ts === cut.ts && (x.d < cut.deviceId || (x.d === cut.deviceId && x.t <= cut.tagId))),
    );
    const out = new Map<string, AggRow>();
    for (const x of rows) {
      const hour = Math.floor(x.ts / HOUR_MS) * HOUR_MS;
      const k = `${x.d}:${x.t}:${hour}`;
      const cur = out.get(k) ?? { deviceId: x.d, tagId: x.t, hour, n: 0, v: 0, s: 0n };
      cur.v = (cur.v * cur.n + x.v) / (cur.n + 1);
      cur.n += 1;
      cur.s += BigInt(Math.floor(x.v * 1000));
      out.set(k, cur);
    }
    return [...out.values()].sort((a, b) => a.deviceId - b.deviceId || a.tagId - b.tagId || a.hour - b.hour);
  }
  /** 적체 읽기 순서(시험이 채운다) — 비면 0 */
  backlogs: (GroupBacklog | null)[] = [];
  async backlog(): Promise<GroupBacklog | null> {
    return this.backlogs.length > 0 ? (this.backlogs.shift() ?? null) : { lag: 0, pending: 0 };
  }
  /** 대기줄 entries-added(실제로 더해진 엔트리 수) */
  added = 0;
  xaddCalls = 0;
  /**
   * 시간 초과 흉내 — n번째 발행 묶음은 앞 executed개만 서버에 들어가고 응답은 모두 오류(클라이언트가 기다리기를 그만둔 것).
   * othersAdd는 그 사이 다른 쓰는 쪽이 더한 엔트리 수
   */
  failPlan: { call: number; executed: number; othersAdd?: number }[] = [];
  /** entries-added를 읽지 못하는 경우 */
  entriesUnreadable = false;
  async xaddBatch(payloads: readonly Buffer[]) {
    this.xaddCalls += 1;
    const plan = this.failPlan.find((x) => x.call === this.xaddCalls);
    const applied = plan ? payloads.slice(0, plan.executed) : payloads;
    const rows: Row[] = [];
    for (const p of applied) {
      const e = decodeEntry(p);
      entryTimestamps(e).forEach((ts, i) => {
        rows.push({ d: e.d, t: e.tg[i] as number, ts, v: e.va[i] as number, q: e.q[i] as number, seq: e.s });
      });
    }
    if (rows.length > 0) this.batch(rows);
    this.added += applied.length + (plan?.othersAdd ?? 0);
    if (plan)
      return {
        results: payloads.map(() => new Error('Command timed out')),
        backlog: null,
        entriesAdded: null,
      };
    return {
      results: payloads.map((_, i) => `1-${i}`),
      backlog: { lag: 0, pending: 0 },
      entriesAdded: this.entriesUnreadable ? null : this.added,
    };
  }
  async entriesAdded() {
    return this.entriesUnreadable ? null : this.added;
  }
  thresholds() {
    return thresholdsFor(200_000);
  }
  async setGate() {
    if (!this.gate) this.gateLog.push('on');
    this.gate = true;
    return true;
  }
  async delGate() {
    if (this.gate) this.gateLog.push('off');
    this.gate = false;
    return true;
  }
  async deleteLatest(ids: readonly number[]) {
    this.latestDeleted.push([...ids]);
    return ids.length;
  }
}

/** 원천 줄 세우기 — (시각 · 설비 · 태그) */
const byOrder = (a: Row, b: Row) => a.ts - b.ts || a.d - b.d || a.t - b.t;

class FakeClock implements CompareClock {
  mono = 0;
  nowMs() {
    return NOW;
  }
  monoMs() {
    return this.mono;
  }
  async sleep(ms: number) {
    this.mono += Math.max(0, ms);
    await Promise.resolve();
  }
}

class FakeResults {
  rows: RunResultRow[] = [];
  async insert(r: RunResultRow) {
    this.rows.push(r);
  }
  async latestCompare() {
    return {
      ingest: null,
      query: null,
      consistency: null,
      attempts: { ingest: null, query: null, consistency: null },
    };
  }
  /** 마지막 넣기(상태 무관) — PgRunResultStore.lastIngest와 같은 규칙 */
  async lastIngest(): Promise<LastIngest | null> {
    const r = [...this.rows].reverse().find((x) => x.part === 'ingest');
    if (!r) return null;
    const res = r.status === 'completed' && r.result?.part === 'ingest' ? r.result : null;
    return {
      runId: r.runId,
      status: r.status,
      range: res ? { start: Date.parse(res.rangeStart), end: Date.parse(res.rangeEnd) } : null,
      rows: res ? { clickhouse: res.rows.clickhouse, postgres: res.rows.postgres } : null,
      published: res ? res.rows.published : null,
    };
  }
}

function harness(
  devices: GenDevice[],
  opts: { sw09?: 'off' | 'on' | 'gated'; realYield?: boolean; plant?: boolean | 'error' } = {},
) {
  const clock = new FakeClock();
  const db = new FakeDb(devices, new Set(devices.map((d) => d.deviceId)), clock);
  const results = new FakeResults();
  const deps: CompareDeps = {
    stores: db,
    results,
    meter: async () => db.meter,
    plantOn: async () => {
      if (opts.plant === 'error') throw new Error('redis down');
      return opts.plant === true;
    },
    switches: () => ({ 'SW-09': opts.sw09 ?? 'gated' }),
    commitHash: 'abc1234',
    sw09: opts.sw09 ?? 'gated',
    copyTimeoutMs: 500,
    yieldLoop: opts.realYield ? () => new Promise<void>((r) => setImmediate(r)) : async () => {},
  };
  const exec = new CompareRunExecutor(deps, clock);
  const reg = new RunRegistry([exec]);
  return { clock, db, results, exec, reg };
}

/** 작은 카드 라인 — 진동(100 ms) · 라미 · 수량 태그를 가진 설비 둘 */
function smallDevices(): GenDevice[] {
  const rows = cardSeedRows().filter((r) => r.device_code === 'L1-MIL' || r.device_code === 'L1-LAM');
  return genDevicesOf(rows);
}

describe('실행기 — 단계 · 사전 확인 · 보관', () => {
  it('부분마다 단계 목록', () => {
    const { exec } = harness([]);
    expect(exec.steps({ part: 'ingest', rows: 100_000 }).map((s) => s.key)).toEqual(
      COMPARE_STEPS.ingest.map((s) => s.key),
    );
    expect(exec.steps({ part: 'consistency', rows: 100_000 }).map((s) => s.key)).toEqual([
      'prepare',
      'clickhouse',
      'postgres',
      'compare',
    ]);
  });

  it('넣기 전 조회 대결 → 409 datagen.compare_no_data · reason no_ingest(실행을 만들지 않는다)', async () => {
    const { reg } = harness(smallDevices());
    await expect(reg.begin('compare', { part: 'query', rows: 100_000 })).rejects.toMatchObject({
      code: 'datagen.compare_no_data',
      status: 409,
      details: { part: 'query', reason: 'no_ingest', range: null },
    });
    expect(reg.currentRun()).toBeNull();
    // 데이터 정합성도 마지막 넣기 구간을 읽으므로 같은 이유로 거절한다(details.part는 그 부분)
    await expect(reg.begin('compare', { part: 'consistency', rows: 100_000 })).rejects.toMatchObject({
      code: 'datagen.compare_no_data',
      details: { part: 'consistency', reason: 'no_ingest' },
    });
  });

  it('SW-09 off면 넣기는 시작 거부(400 validation_failed · SW-09 enum) · 조회 대결 · 데이터 정합성은 막지 않는다', async () => {
    const h = harness(smallDevices(), { sw09: 'off' });
    for (const part of ['ingest'] as const) {
      const e = await h.reg.begin('compare', { part, rows: 100_000 }).catch((x) => x);
      expect(e, part).toBeInstanceOf(ApiError);
      expect(e).toMatchObject({
        code: 'common.validation_failed',
        status: 400,
        details: { fields: [{ path: 'SW-09', reason: 'enum' }] },
      });
      expect(e.message).toContain('CONTROL_TABLE_ENABLED');
    }
    expect(h.reg.currentRun()).toBeNull();
    // 조회 대결 · 데이터 정합성은 SW-09와 무관 — 데이터가 없어서 409(compare_no_data)이지 400이 아니다
    for (const part of ['query', 'consistency'] as const)
      await expect(h.reg.begin('compare', { part, rows: 100_000 })).rejects.toMatchObject({
        code: 'datagen.compare_no_data',
      });
  });

  it('SW-09 off면 넣기는 failed(PostgreSQL이 받지 않는다) · 보관은 failed · result null', async () => {
    const h = harness(smallDevices(), { sw09: 'off' });
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status).toBe('failed');
    expect(s.error?.message).toContain('SW-09');
    expect(h.results.rows[0]).toMatchObject({ status: 'failed', result: null, part: 'ingest' });
  });
});

describe('① 넣기 — 같은 배치를 두 저장소에 · 행 수 · 크기 · 배치 시간', () => {
  it('10만 행 — 정확히 10만(마지막 초는 앞 4행만) · 발행 = ClickHouse = PostgreSQL · 게이트는 켰다가 끈다 · 결과는 계약 모양 · run_result 보관', async () => {
    const h = harness(smallDevices());
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status, JSON.stringify(s.error)).toBe('completed');
    const r = CompareRunResult.parse(s.result);
    if (r.part !== 'ingest') throw new Error('part');
    const expected = 100_000;
    const pps = pointsPerSimSecond(smallDevices());
    expect(100_000 % pps).toBe(4);
    expect(r.target).toBe(100_000);
    expect(r.inflightCompress).toBe(false);
    expect(r.rows).toEqual({ published: expected, clickhouse: expected, postgres: expected });
    expect(r.rangeStart).toBe('2026-08-20T00:00:00.000Z');
    expect(Date.parse(r.rangeEnd) - Date.parse(r.rangeStart)).toBe(Math.ceil(100_000 / pps) * 1000);
    // 마지막 초의 4행은 (시각 · 설비 · 태그) 순 앞 4행 — 그 초 0 ms의 첫 설비 태그들
    const lastSec = Date.parse(r.rangeEnd) - 1000;
    const tail = h.db.ch.filter((x) => x.ts >= lastSec).sort(byOrder);
    const want = [...genChunk(smallDevices(), lastSec, lastSec + 1000, Date.parse(r.rangeStart)).payloads]
      .flatMap((p) => {
        const e = decodeEntry(p);
        return entryTimestamps(e).map((ts, i) => ({
          d: e.d,
          t: e.tg[i] as number,
          ts,
          v: e.va[i] as number,
          q: e.q[i] as number,
          seq: e.s,
        }));
      })
      .sort(byOrder)
      .slice(0, 4);
    expect(tail).toEqual(want);
    // 꽉 찬 초 3,846개를 10초씩(385묶음) + 마지막 초 1묶음
    expect(r.batches.count).toBe(386);
    expect(r.batches.postgresFailures).toBe(0);
    expect(r.batches.clickhouseMs.p50).not.toBeNull();
    expect(r.bytes).toEqual({ clickhouse: expected * 5, postgres: expected * 90 });
    expect(h.db.gateLog).toEqual(['on', 'off']);
    expect(h.db.gate).toBe(false);
    // 넣기 창 전체(D−52 ~ D−1 · 51일)를 통째로 비웠다 — 앞서 넣은 더 큰 넣기가 남지 않게(칸은 넣을 때 생기므로 미리 만들지 않는다)
    expect(h.db.cleared[0]).toEqual(ingestWideRange(NOW));
    const o = RunObject.parse(s.toObject());
    expect(o.steps.every((x) => x.status === 'done')).toBe(true);
    // 크기는 병합 · 압축 뒤에 잰다 — 둘 다 됐으면 경고 없음
    const verify = o.steps.find((x) => x.key === 'verify');
    expect(verify?.detail).toMatchObject({ optimized: true, compressed: true });
    expect(verify?.detail).not.toHaveProperty('warning');
    const saved = h.results.rows[0] as RunResultRow;
    expect(saved).toMatchObject({
      runId: s.runId,
      part: 'ingest',
      status: 'completed',
      commitHash: 'abc1234',
      plantOn: false,
    });
    expect(saved.endedAt).toBe(s.endedAt);
    expect(CompareRunResult.parse(saved.result).part).toBe('ingest');
  });

  it('7일치를 넘는 넣기 — 다 들어간 날 칸을 하루 늦게 넣는 도중 압축(한 번에 하나) · 결과 inflightCompress · 정확히 N행', async () => {
    // 초당 1점짜리 설비 하나 — 100만 행 = 약 11.6일치(7일 넘음)
    const one: GenDevice[] = [
      {
        deviceId: 1,
        deviceCode: 'L1-PRT',
        lineCode: 'L1',
        tags: [{ deviceId: 1, tagId: 1, kind: 'SPEED', scanRateMs: 1000, rangeMin: 0, rangeMax: 100 }],
      },
    ];
    const h = harness(one);
    const s = h.reg.start('compare', { part: 'ingest', rows: 1_000_000 });
    await h.reg.settled();
    expect(s.status, JSON.stringify(s.error)).toBe('completed');
    const r = CompareRunResult.parse(s.result);
    if (r.part !== 'ingest') throw new Error('part');
    expect(Date.parse(r.rangeEnd) - Date.parse(r.rangeStart)).toBeGreaterThan(INFLIGHT_COMPRESS_MIN_MS);
    expect(r.inflightCompress).toBe(true);
    expect(r.rows).toEqual({ published: 1_000_000, clickhouse: 1_000_000, postgres: 1_000_000 });
    // 압축은 넣는 중에 건다 — 칸은 다 들어간 날만(그 날 행 86,400개가 모두 PostgreSQL에 있다) · 범위는 이어진다 · 넣기 끝 전에 멈춘다
    const start = Date.parse(r.rangeStart);
    expect(h.db.compressLog.length).toBeGreaterThan(0);
    let at = start;
    for (const c of h.db.compressLog) {
      expect(c.range.start).toBe(at);
      expect((c.range.end - c.range.start) % DAY_MS).toBe(0);
      expect(c.pgRowsIn).toBe(((c.range.end - c.range.start) / DAY_MS) * 86_400);
      at = c.range.end;
    }
    expect(at).toBeLessThanOrEqual(utcMidnight(Date.parse(r.rangeEnd)) - DAY_MS);
    const verify = RunObject.parse(s.toObject()).steps.find((x) => x.key === 'verify');
    expect(verify?.detail).toMatchObject({ compressedDays: (at - start) / DAY_MS, compressFailures: 0 });
    expect(verify?.detail).not.toHaveProperty('warning');
  });

  it('넣는 도중 압축(DayCompressor) — 보낸 위치가 그 날 끝보다 하루 넘게 앞서야 · 도는 동안 더 걸지 않는다 · 실패는 세고 넘어간다', async () => {
    const calls: TimeRange[] = [];
    let release: (() => void) | null = null;
    let fail = false;
    const c = new DayCompressor(
      {
        compressDays: (r) => {
          calls.push(r);
          return new Promise<number>((ok, no) => {
            release = () => (fail ? no(new Error('x')) : ok((r.end - r.start) / DAY_MS));
          });
        },
      },
      0,
    );
    c.offer(DAY_MS + 5); // 첫날 안 — 아직 다 들어간 날이 없다
    c.offer(2 * DAY_MS - 1);
    expect(calls).toEqual([]);
    c.offer(2 * DAY_MS + 10); // 셋째 날 — 첫날만 압축할 수 있다
    expect(calls).toEqual([{ start: 0, end: DAY_MS }]);
    c.offer(5 * DAY_MS); // 도는 동안은 더 걸지 않는다
    expect(calls).toHaveLength(1);
    (release as unknown as () => void)();
    await c.settled();
    expect(c.days).toBe(1);
    c.offer(5 * DAY_MS + 1); // 이어서 둘째 ~ 넷째 날
    expect(calls[1]).toEqual({ start: DAY_MS, end: 4 * DAY_MS });
    fail = true;
    (release as unknown as () => void)();
    await c.settled();
    expect([c.days, c.failures]).toEqual([1, 1]);
  });

  it('발행이 시간 초과로 끝나도 — 서버에 실제로 들어간 앞부분은 세고 나머지만 다시 보낸다(중복 · 누락 없음 · 2026-10-12 1억 넣기 실패 재현)', async () => {
    const h = harness(smallDevices());
    // 다섯째 묶음(엔트리 20개)은 앞 7개만 들어가고 응답은 시간 초과 · 열째 묶음은 하나도 안 들어감
    h.db.failPlan = [
      { call: 5, executed: 7 },
      { call: 10, executed: 0 },
    ];
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status, JSON.stringify(s.error)).toBe('completed');
    const r = CompareRunResult.parse(s.result);
    if (r.part !== 'ingest') throw new Error('part');
    expect(r.rows).toEqual({ published: 100_000, clickhouse: 100_000, postgres: 100_000 });
    expect(new Set(h.db.ch.map((x) => `${x.d}:${x.t}:${x.ts}`)).size).toBe(100_000);
    expect(r.batches.postgresFailures).toBe(0);
    const publish = RunObject.parse(s.toObject()).steps.find((x) => x.key === 'publish');
    expect(publish?.detail).toMatchObject({ publishRetries: 2, published: 100_000 });
  });

  it('들어간 수를 셀 수 없거나(대기줄 정보 못 읽음) 앞뒤가 맞지 않으면(다른 쓰는 쪽) — 다시 보내지 않고 멈춘다', async () => {
    const unreadable = harness(smallDevices());
    unreadable.db.entriesUnreadable = true;
    unreadable.db.failPlan = [{ call: 3, executed: 5 }];
    const a = unreadable.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await unreadable.reg.settled();
    expect(a.status).toBe('failed');
    expect(a.error?.message).toContain('셀 수 없어');
    const others = harness(smallDevices());
    others.db.failPlan = [{ call: 3, executed: 20, othersAdd: 4 }];
    const b = others.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await others.reg.settled();
    expect(b.status).toBe('failed');
    expect(b.error?.message).toContain('셀 수 없어');
  });

  it('중단 — stopped · 게이트는 꺼진다 · 결과 null 보관', async () => {
    const h = harness(smallDevices(), { realYield: true });
    const s = h.reg.start('compare', { part: 'ingest', rows: 5_000_000 });
    // prepare · clear가 끝나고 발행 중일 때
    for (let i = 0; i < 2000 && s.toObject().steps[2]?.status !== 'running'; i++)
      await new Promise((r) => setTimeout(r, 1));
    h.reg.stop(s.runId);
    await h.reg.settled();
    expect(s.status).toBe('stopped');
    expect(h.db.gate).toBe(false);
    expect(h.results.rows[0]).toMatchObject({ status: 'stopped', result: null });
  });
});

describe('시작 조건 — 설비 가동 중 거절(r5 M3) · 넣기 전 적체 0 대기(r5 M2)', () => {
  it('설비 가동이 켜져 있으면 넣기는 400 common.validation_failed(fields plant) · 조회 · 정합성은 막지 않는다', async () => {
    const h = harness(smallDevices(), { plant: true });
    for (const part of ['ingest'] as const) {
      const e = await h.reg.begin('compare', { part, rows: 100_000 }).catch((x) => x);
      expect(e, part).toMatchObject({
        code: 'common.validation_failed',
        status: 400,
        message: PLANT_ON_MESSAGE,
        details: { fields: [{ path: 'plant', reason: 'enum' }] },
      });
    }
    expect(h.reg.currentRun()).toBeNull();
    expect(h.db.cleared).toEqual([]);
    // 조회는 가동과 무관 — 데이터가 없어서 409
    await expect(h.reg.begin('compare', { part: 'query', rows: 100_000 })).rejects.toMatchObject({
      code: 'datagen.compare_no_data',
    });
  });

  it('가동 상태를 읽지 못하면 503 realtime.latest_unavailable — 시작하지 않는다', async () => {
    const h = harness(smallDevices(), { plant: 'error' });
    await expect(h.reg.begin('compare', { part: 'ingest', rows: 100_000 })).rejects.toMatchObject({
      code: 'realtime.latest_unavailable',
      status: 503,
    });
    expect(h.reg.currentRun()).toBeNull();
  });

  it('적체가 남아 있으면 0이 될 때까지 기다린 뒤 비운다 · prepare detail backlogWaitMs', async () => {
    const h = harness(smallDevices());
    h.db.backlogs = [
      { lag: 300, pending: 50 },
      { lag: 10, pending: 0 },
      { lag: null, pending: 0 },
      { lag: 0, pending: 0 },
    ];
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status, JSON.stringify(s.error)).toBe('completed');
    expect(s.toObject().steps[0]?.detail).toMatchObject({ backlogWaitMs: 750 });
  });

  it('적체가 30초 넘게 남으면 비우기 전에 failed — 구간 · 게이트를 건드리지 않는다', async () => {
    const h = harness(smallDevices());
    h.db.backlog = async () => ({ lag: 1234, pending: 0 });
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status).toBe('failed');
    expect(s.error?.message).toContain('1234건');
    expect(s.error?.message).toContain(`${COMPARE_START_BACKLOG_LIMIT_MS / 1000}s`);
    expect(s.toObject().steps.map((x) => x.status)).toEqual([
      'failed',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(h.db.cleared).toEqual([]);
    expect(h.db.gateLog).toEqual([]);
    expect(h.results.rows[0]).toMatchObject({ status: 'failed', result: null });
  });

  it('적재 마무리가 상한을 넘으면 drain detail에 timedOut · 경고(결과 계약은 그대로)', async () => {
    const h = harness(smallDevices());
    h.db.clickhouseRangeRows = async () => 0; // 끝까지 다 들어오지 않는다
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status).toBe('completed');
    const drain = s.toObject().steps[3];
    expect(drain?.detail).toMatchObject({ timedOut: true, warning: DRAIN_TIMEOUT_WARNING });
    expect(Number(drain?.detail.drainMs)).toBeGreaterThanOrEqual(COMPARE_DRAIN_LIMIT_MS);
    CompareRunResult.parse(s.result);
  });

  it('TimescaleDB 압축이 실패하면 verify detail에 compressed false · 경고(넣기는 완료 · 결과 계약은 그대로)', async () => {
    const h = harness(smallDevices());
    h.db.compressFails = true;
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status).toBe('completed');
    const verify = s.toObject().steps.find((x) => x.key === 'verify');
    expect(verify?.detail).toMatchObject({ optimized: true, compressed: false, warning: COMPRESS_WARNING });
    CompareRunResult.parse(s.result);
  });
});

describe('마지막 넣기가 완료가 아니면 조회 대결 409(r5 M1)', () => {
  it('완료 → 중단한 넣기 → 조회 409 reason ingest_incomplete · 다시 완료하면 조회가 돈다', async () => {
    const h = harness(smallDevices(), { realYield: true });
    h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    const s = h.reg.start('compare', { part: 'ingest', rows: 5_000_000 });
    for (let i = 0; i < 2000 && s.toObject().steps[2]?.status !== 'running'; i++)
      await new Promise((r) => setTimeout(r, 1));
    h.reg.stop(s.runId);
    await h.reg.settled();
    expect(s.status).toBe('stopped');
    // 앞 완료 구간(1시간치)의 데이터는 사흘 창 비우기로 사라졌다 — 그 구간을 쓰지 않는다
    expect(completeIngestRange(await h.results.lastIngest())).toBeNull();
    await expect(h.reg.begin('compare', { part: 'query', rows: 100_000 })).rejects.toMatchObject({
      code: 'datagen.compare_no_data',
      status: 409,
      message: INGEST_INCOMPLETE_MESSAGE,
      details: { part: 'query', reason: 'ingest_incomplete', range: null },
    });
    h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    const q = await h.reg.begin('compare', { part: 'query', rows: 100_000 });
    await h.reg.settled();
    expect(q.status, JSON.stringify(q.error)).toBe('completed');
  });

  it('완료한 넣기 구간이 지워졌으면(지우기 뒤) 409 reason no_rows', async () => {
    const h = harness(smallDevices());
    h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    h.db.ch = [];
    h.db.pg.clear();
    await expect(h.reg.begin('compare', { part: 'query', rows: 100_000 })).rejects.toMatchObject({
      code: 'datagen.compare_no_data',
      details: { reason: 'no_rows', range: { start: '2026-08-20T00:00:00.000Z' } },
    });
  });
});

describe('② 조회 대결 — 원천 행 수 9단계(넣기 건수와 같은 스케일) · 정확히 N행 · 워밍업 1 + 3회 · 3회 모두 같을 때만 승자', () => {
  /** 넣은 구간의 원천을 (시각 · 설비 · 태그) 순으로 줄 세운 n번째 행 — 자른 자리의 기대값 */
  const nth = (db: FakeDb, n: number) => {
    const x = [...db.ch].sort(byOrder)[n - 1];
    return x ? { ts: x.ts, deviceId: x.d, tagId: x.t } : null;
  };
  const blank = { values: [], median: null, sourceRows: null, groups: null, checksum: null };

  it('단계 — 준비 + 넣기 건수와 같은 9단계(10만 ~ 10억) · key rows-N · 쉬운 이름', () => {
    const { exec } = harness([]);
    expect(COMPARE_QUERY_SIZES).toEqual(COMPARE_INGEST_ROWS);
    expect(exec.steps({ part: 'query', rows: 100_000 }).map((s) => s.key)).toEqual([
      'prepare',
      ...COMPARE_QUERY_SIZES.map(compareQueryStepKey),
    ]);
    expect(COMPARE_QUERY_SIZES.map(compareSizeName)).toEqual([
      '10만',
      '100만',
      '500만',
      '1,000만',
      '3,000만',
      '5,000만',
      '1억',
      '5억',
      '10억',
    ]);
    expect(compareSizeName(12_345)).toBe('12,345');
  });

  it('넣은 데이터(100만 행) 안의 단계만 잰다 — 10만은 초 중간에서 정확히 · 100만은 넣은 행 전부 · 500만부터 건너뜀(단계 skipped · cut null)', async () => {
    const h = harness(smallDevices());
    h.reg.start('compare', { part: 'ingest', rows: 1_000_000 });
    await h.reg.settled();
    const s = await h.reg.begin('compare', { part: 'query', rows: 100_000 });
    await h.reg.settled();
    expect(s.status, JSON.stringify(s.error)).toBe('completed');
    const r = CompareRunResult.parse(s.result);
    if (r.part !== 'query') throw new Error('part');
    const total = 1_000_000;
    expect(r.rows).toBe(total);
    expect(r.sizes.map((x) => x.target)).toEqual([...COMPARE_QUERY_SIZES]);
    // 자를 자리는 단계 목록을 한 번에 묻는다(ClickHouse 안에서 누적 — 초별 행 수를 api로 가져오지 않는다)
    expect(h.db.secondCutsAsked).toEqual([[...COMPARE_QUERY_SIZES]]);

    const [first, second, ...rest] = r.sizes;
    if (!first || !second) throw new Error('first');
    // 10만 번째 행 · 같은 시각에 여러 행이 있어 시각만으로는 자를 수 없다(26행/초 → 3,846초 + 4행)
    expect(100_000 % pointsPerSimSecond(smallDevices())).toBe(4);
    const cut = nth(h.db, 100_000) as CutRow;
    expect(first.cut).toEqual({
      ts: new Date(cut.ts).toISOString(),
      deviceId: cut.deviceId,
      tagId: cut.tagId,
    });
    for (const store of ['clickhouse', 'postgres'] as const) {
      expect(first[store].values).toEqual(store === 'clickhouse' ? [5, 5, 5] : [50, 50, 50]);
      expect(first[store].sourceRows).toBe(100_000);
    }
    expect(first.clickhouse.groups).toBe(first.postgres.groups);
    expect(first.clickhouse.checksum).toBe(first.postgres.checksum);
    expect(first).toMatchObject({ winner: 'clickhouse', ratio: 10, match: true, mismatchGroups: 0 });
    // 100만 = 넣은 행 전부 — 자른 자리는 마지막 행
    const last = nth(h.db, total) as CutRow;
    expect(second.cut).toMatchObject({ ts: new Date(last.ts).toISOString(), deviceId: last.deviceId });
    expect([second.clickhouse.sourceRows, second.postgres.sourceRows]).toEqual([total, total]);
    expect(second.match).toBe(true);
    // 두 저장소가 단계마다 같은 자른 자리로 잰다(워밍업 1 + 3회씩)
    expect(h.db.sizeAggLog.map((x) => x.store)).toEqual(
      [0, 1].flatMap(() => [...Array(4).fill('clickhouse'), ...Array(4).fill('postgres')]),
    );
    expect(new Set(h.db.sizeAggLog.slice(0, 8).map((x) => JSON.stringify(x.slice))).size).toBe(1);
    expect(new Set(h.db.sizeAggLog.map((x) => JSON.stringify(x.slice))).size).toBe(2);

    for (const x of rest) {
      expect(x.target).toBeGreaterThan(total);
      expect(x).toMatchObject({ cut: null, winner: null, ratio: null, match: null, mismatchGroups: null });
      expect(x.clickhouse).toEqual(blank);
    }
    const steps = s.toObject().steps;
    expect(steps.find((x) => x.key === 'rows-100000')).toMatchObject({
      status: 'done',
      detail: { exact: true, match: true, sourceRows: { clickhouse: 100_000, postgres: 100_000 } },
    });
    expect(steps.filter((x) => x.status === 'skipped').map((x) => x.key)).toEqual(
      COMPARE_QUERY_SIZES.slice(2).map(compareQueryStepKey),
    );
    expect(steps.find((x) => x.key === 'rows-5000000')?.detail).toEqual({
      reason: 'not_enough_rows',
      available: total,
    });
  });

  it('PostgreSQL이 원천 안의 행을 잃었으면 — 원천 행 수가 N이 아니고 다른 칸 수가 잡힌다(맞추지 않고 그대로)', async () => {
    const h = harness(smallDevices());
    h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    const lost = [...h.db.pg.entries()].sort(([, a], [, b]) => byOrder(a, b)).slice(100, 103);
    for (const [k] of lost) h.db.pg.delete(k);
    const s = await h.reg.begin('compare', { part: 'query', rows: 100_000 });
    await h.reg.settled();
    const r = CompareRunResult.parse(s.result);
    if (r.part !== 'query') throw new Error('part');
    const first = r.sizes[0];
    expect(first?.clickhouse.sourceRows).toBe(100_000);
    expect(first?.postgres.sourceRows).toBe(100_000 - 3);
    expect(first?.match).toBe(false);
    expect(first?.mismatchGroups).toBe(new Set(lost.map(([, x]) => `${x.d}:${x.t}`)).size);
    expect(s.toObject().steps.find((x) => x.key === 'rows-100000')?.detail).toMatchObject({ exact: false });
  });

  it('진행 중 결과 — 끝난 단계만 싣는다(첫 단계를 재는 동안은 결과 없음 · 끝나면 9단계 모두)', async () => {
    const h = harness(smallDevices());
    h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    const sizesOf = (r: unknown) =>
      r && typeof r === 'object' && 'part' in r && r.part === 'query' && 'sizes' in r
        ? (r.sizes as unknown[]).length
        : null;
    const seen: (number | null)[] = [];
    const orig = h.db.sizeAgg.bind(h.db);
    let state: Awaited<ReturnType<typeof h.reg.begin>> | null = null;
    h.db.sizeAgg = async (store, slice) => {
      seen.push(sizesOf(state?.toObject().result));
      return orig(store, slice);
    };
    state = await h.reg.begin('compare', { part: 'query', rows: 100_000 });
    await h.reg.settled();
    // 10만을 재는 동안(8회)은 끝난 단계 없음 · 나머지는 넣은 데이터보다 커서 건너뜀
    expect(seen).toEqual(Array(8).fill(null));
    expect(sizesOf(state.toObject().result)).toBe(COMPARE_QUERY_SIZES.length);
  });
});

describe('② 조회 대결 자르기 · 대조(순수 함수)', () => {
  const counts: SecondCount[] = [
    { sec: 0, n: 3 },
    { sec: 1000, n: 3 },
    { sec: 3000, n: 2 },
  ];

  it('N번째 행이 든 초 · 그 초 안 순번 — 초 끝에 딱 맞으면 그 초 · 원천보다 크면 null · 목표 순서 무관', () => {
    const m = cutSeconds(counts, [8, 1, 3, 4, 9, 0, 6, 7]);
    expect(m.get(1)).toEqual({ sec: 0, rank: 1 });
    expect(m.get(3)).toEqual({ sec: 0, rank: 3 });
    expect(m.get(4)).toEqual({ sec: 1000, rank: 1 });
    expect(m.get(6)).toEqual({ sec: 1000, rank: 3 });
    expect(m.get(7)).toEqual({ sec: 3000, rank: 1 });
    expect(m.get(8)).toEqual({ sec: 3000, rank: 2 });
    expect(m.get(9)).toBeNull();
    expect(m.get(0)).toBeNull();
    expect(cutSeconds([], [1]).get(1)).toBeNull();
  });

  it('카드 라인 실측 모양(초당 231행) — 10만 행은 432초 + 208행 · 5천만은 216,450초 + 50행 · 1억은 432,900초 + 100행', () => {
    // 5.2일치(45만 초) — 5억 · 10억은 원천이 모자라 null
    const full: SecondCount[] = Array.from({ length: 450_000 }, (_, i) => ({ sec: i * 1000, n: 231 }));
    const m = cutSeconds(full, COMPARE_QUERY_SIZES);
    expect(m.get(100_000)).toEqual({ sec: 432_000, rank: 208 });
    expect(m.get(1_000_000)).toEqual({ sec: 4_329_000, rank: 1 });
    expect(m.get(50_000_000)).toEqual({ sec: 216_450_000, rank: 50 });
    expect(m.get(100_000_000)).toEqual({ sec: 432_900_000, rank: 100 });
    expect(m.get(500_000_000)).toBeNull();
    expect(m.get(1_000_000_000)).toBeNull();
  });

  it('칸 대조 — 행 수 · 체크섬이 같으면 일치 · 한쪽에만 있는 칸 · 행 수 · 체크섬이 다른 칸을 센다', () => {
    const row = (tagId: number, n: number, s: bigint): AggRow => ({
      deviceId: 1,
      tagId,
      hour: 0,
      n,
      v: 1.5,
      s,
    });
    const ch = [row(1, 10, 100n), row(2, 10, 200n), row(3, 5, 50n)];
    expect(compareAgg(ch, [...ch].reverse())).toMatchObject({ match: true, mismatchGroups: 0 });
    // 평균(부동소수)은 보지 않는다
    expect(
      compareAgg(
        ch,
        ch.map((x) => ({ ...x, v: x.v + 1e-12 })),
      ).match,
    ).toBe(true);
    const pg = [row(1, 9, 90n), row(2, 10, 201n), row(4, 1, 1n)];
    const c = compareAgg(ch, pg);
    expect(c).toMatchObject({ match: false, mismatchGroups: 4 });
    expect(c.stores.clickhouse).toEqual({ rows: 25, checksum: 350n, groups: 3 });
    expect(c.stores.postgres).toEqual({ rows: 20, checksum: 292n, groups: 3 });
  });
});

describe('③ 데이터 정합성 — 두 저장소가 받은 결과를 네 기준(행 수 · 값 합계 · 묶음 집계 · 행 지문)으로 맞춘다', () => {
  async function ingested() {
    const h = harness(smallDevices());
    h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    return h;
  }
  async function consistency(h: Awaited<ReturnType<typeof ingested>>) {
    const s = h.reg.start('compare', { part: 'consistency', rows: 100_000 });
    await h.reg.settled();
    expect(s.status, JSON.stringify(s.error)).toBe('completed');
    const r = CompareRunResult.parse(s.result);
    if (r.part !== 'consistency') throw new Error('part');
    return { s, r };
  }
  const pgKeysIn = (h: Awaited<ReturnType<typeof ingested>>, from: number, to: number) =>
    [...h.db.pg.entries()].filter(([, x]) => x.ts >= from && x.ts < to).map(([k]) => k);
  const pgRow = (h: Awaited<ReturnType<typeof ingested>>, k: string) => {
    const row = h.db.pg.get(k);
    if (!row) throw new Error(`row ${k}`);
    return row;
  };

  it('넣은 그대로면 네 기준 모두 같음 — 저장소별 행 수 = 넣은 행 · 합계 · 묶음 · 지문 · 걸린 시간 · 보관 · 읽기만', async () => {
    const h = await ingested();
    const { s, r } = await consistency(h);
    expect(r.match).toBe(true);
    expect(r.checks).toEqual({ rows: true, sum: true, groups: true, fingerprint: true });
    expect(r).toMatchObject({ mismatchGroups: 0, diffGroups: 0, mismatches: [] });
    const groups = new Set(h.db.ch.map((x) => `${x.d}:${x.t}:${Math.floor(x.ts / HOUR_MS)}`)).size;
    expect(r.clickhouse).toMatchObject({ rows: 100_000, groups, scanMs: 30 });
    expect(r.postgres).toMatchObject({ rows: 100_000, groups, scanMs: 400 });
    expect(r.postgres?.sum).toBe(r.clickhouse?.sum);
    expect(r.postgres?.fingerprint).toBe(r.clickhouse?.fingerprint);
    // 값 합계 = round(value × 1000)의 정수 합(÷ 1000이 화면 값)
    const sum = h.db.ch.reduce((a, x) => a + BigInt(rint(x.v * 1000)), 0n);
    expect(r.clickhouse?.sum).toBe(sum.toString());
    expect(s.toObject().steps.map((x) => x.status)).toEqual(['done', 'done', 'done', 'done']);
    expect(h.results.rows.at(-1)).toMatchObject({ part: 'consistency', status: 'completed' });
    // 읽기만 한다 — 게이트 · 구간 비우기를 건드리지 않는다
    expect(h.db.gateLog).toEqual(['on', 'off']);
    expect(h.db.cleared).toHaveLength(1);
  });

  it('재는 동안 — 다 잰 저장소 칸만 채우고(ClickHouse 먼저) 판정은 두 저장소를 다 잰 뒤에만', async () => {
    const h = await ingested();
    const seen: Record<string, unknown> = {};
    let s: ReturnType<typeof h.reg.start> | null = null;
    h.db.onScan = (store) => {
      seen[store] = CompareRunResult.parse(s?.toObject().result);
    };
    s = h.reg.start('compare', { part: 'consistency', rows: 100_000 });
    await h.reg.settled();
    expect(seen.clickhouse).toMatchObject({ clickhouse: null, postgres: null, checks: null, match: null });
    expect(seen.postgres).toMatchObject({ postgres: null, checks: null, mismatchGroups: null, match: null });
    expect((seen.postgres as { clickhouse: unknown }).clickhouse).toMatchObject({ rows: 100_000 });
  });

  it('PostgreSQL에서 빠진 행(COPY 실패) — 네 기준 모두 다름 · 다른 곳은 시각 · 설비 · 태그 순 · 이름 · 두 행 수', async () => {
    const h = await ingested();
    const start = ingestWideRange(NOW).start;
    const lost = pgKeysIn(h, start + 10 * 60_000, start + 13 * 60_000);
    for (const k of lost) h.db.pg.delete(k);
    const { r } = await consistency(h);
    expect(r.match).toBe(false);
    expect(r.checks).toEqual({ rows: false, sum: false, groups: false, fingerprint: false });
    expect((r.clickhouse?.rows ?? 0) - (r.postgres?.rows ?? 0)).toBe(lost.length);
    // 빠진 3분은 첫 1시간 묶음 — 설비 · 태그 짝마다 하나
    const pairs = smallDevices().reduce((a, d) => a + d.tags.length, 0);
    expect(r.mismatchGroups).toBe(pairs);
    expect(r.diffGroups).toBe(pairs);
    expect(r.mismatches).toHaveLength(Math.min(pairs, CONSISTENCY_MISMATCH_LIMIT));
    const [first] = r.mismatches;
    const dev = smallDevices()[0] as GenDevice;
    expect(first).toMatchObject({
      deviceId: dev.deviceId,
      tagId: dev.tags[0]?.tagId,
      hour: new Date(start).toISOString(),
    });
    expect(first?.label).toMatch(/^L1-(MIL|LAM) /);
    expect((first?.clickhouse ?? 0) > (first?.postgres ?? 0)).toBe(true);
  });

  it('품질만 바뀌면 — 행 수 · 합계 · 묶음은 같고 행 지문만 다르다 · 다른 곳은 그 묶음(행 수 같음)', async () => {
    const h = await ingested();
    const start = ingestWideRange(NOW).start;
    const [k] = pgKeysIn(h, start + 5 * 60_000, start + 6 * 60_000);
    const row = pgRow(h, k as string);
    h.db.pg.set(k as string, { ...row, q: 0 });
    const { r } = await consistency(h);
    expect(r.checks).toEqual({ rows: true, sum: true, groups: true, fingerprint: false });
    expect(r).toMatchObject({ match: false, mismatchGroups: 0, diffGroups: 1 });
    expect(r.mismatches).toEqual([
      expect.objectContaining({ deviceId: row.d, tagId: row.t, clickhouse: expect.any(Number) }),
    ]);
    expect(r.mismatches[0]?.clickhouse).toBe(r.mismatches[0]?.postgres);
  });

  it('두 행의 값이 뒤바뀌면(같은 시각 · 다른 태그) — 행 수 · 합계는 같고 묶음 · 지문이 다르다', async () => {
    const h = await ingested();
    const start = ingestWideRange(NOW).start;
    const keys = pgKeysIn(h, start + 7 * 60_000, start + 7 * 60_000 + 1);
    const a = pgRow(h, keys[0] as string);
    const bKey = keys.find((k) => {
      const x = pgRow(h, k);
      return x.t !== a.t && rint(x.v * 1000) !== rint(a.v * 1000);
    });
    const b = pgRow(h, bKey as string);
    h.db.pg.set(keys[0] as string, { ...a, v: b.v });
    h.db.pg.set(bKey as string, { ...b, v: a.v });
    const { r } = await consistency(h);
    expect(r.checks).toEqual({ rows: true, sum: true, groups: false, fingerprint: false });
    expect(r.mismatchGroups).toBe(2);
  });

  it('ClickHouse에 같은 행이 두 번(재시도 중복) — 행 수 · 합계 · 묶음 · 지문이 다르다', async () => {
    const h = await ingested();
    const dup = h.db.ch.find((x) => rint(x.v * 1000) !== 0) as Row;
    h.db.ch.push({ ...dup });
    const { r } = await consistency(h);
    expect(r.checks).toEqual({ rows: false, sum: false, groups: false, fingerprint: false });
    expect(r.mismatches).toEqual([expect.objectContaining({ deviceId: dup.d, tagId: dup.t })]);
    expect((r.mismatches[0]?.clickhouse ?? 0) - (r.mismatches[0]?.postgres ?? 0)).toBe(1);
  });

  it('행 지문 기준 구현 = 두 DB 실측값(2026-10-13 · 같은 행에서 PostgreSQL · ClickHouse가 같은 값을 냈다)', () => {
    const at = { deviceId: 1, tsMs: 1_787_405_820_000, quality: 9, scanSeq: 1_787_405_820 };
    expect(rowFingerprint({ ...at, tagId: 1, value: 20.229328155517578 })).toBe(-3838449109937670369n);
    expect(rowFingerprint({ ...at, tagId: 2, value: 32.18496322631836 })).toBe(-4363484423674076720n);
    expect(rowFingerprint({ ...at, tagId: 3, value: 135420 })).toBe(8316430476487534017n);
  });

  it('순수 대조 — 저장소 값은 묶음 합 · 한쪽에만 있는 묶음 · 지문만 다른 묶음 · 시각 순 앞 CONSISTENCY_MISMATCH_LIMIT개', () => {
    const h0 = Date.parse('2026-10-07T00:00:00Z');
    const g = (d: number, hr: number, over: Partial<GroupSum> = {}): GroupSum => ({
      deviceId: d,
      tagId: d * 10,
      hour: h0 + hr * HOUR_MS,
      n: 100,
      s: 5_000n,
      lo: '3ff0000000000000',
      hi: '4059000000000000',
      f: BigInt(d * 1000 + hr),
      ...over,
    });
    const ch = [g(1, 0), g(1, 1), g(2, 0), g(3, 0), g(4, 0), g(5, 0), g(6, 0), g(7, 0)];
    const pg = [g(1, 0), g(1, 1, { f: 0n }), g(2, 0, { n: 99, s: 4_950n }), g(9, 2)];
    expect(storeSummary(pg, 12.6)).toEqual({
      rows: 399,
      sum: '19950',
      groups: 4,
      fingerprint: String(1000 + 0 + 2000 + 9002),
      scanMs: 13,
    });
    const diff = diffGroups(ch, pg);
    // 묶음 집계가 다른 것: 2(행 수) · 3~7(PG에 없음) · 9(CH에 없음) = 7 · 지문만 다른 것(1의 두 번째 시간)까지 8
    expect(diff.aggregate).toBe(7);
    expect(diff.any).toBe(8);
    expect(diff.first).toHaveLength(CONSISTENCY_MISMATCH_LIMIT);
    expect(diff.first.map((x) => [x.deviceId, x.hour - h0])).toEqual([
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
    ]);
    expect(diff.first[0]).toMatchObject({ clickhouse: 100, postgres: 99 });
    expect(diff.first[1]).toMatchObject({ clickhouse: 100, postgres: null });
    const base = { ...consistencyStart({ start: h0, end: h0 + 3 * HOUR_MS }) };
    const r = consistencyVerdict(
      { ...base, clickhouse: storeSummary(ch, 1), postgres: storeSummary(pg, 2) },
      diff,
      new Map([['2:20', 'L1-PRT 인쇄 · 잉크 온도']]),
    );
    expect(r.checks).toEqual({ rows: false, sum: false, groups: false, fingerprint: false });
    expect(r.mismatches[0]).toEqual({
      deviceId: 2,
      tagId: 20,
      label: 'L1-PRT 인쇄 · 잉크 온도',
      hour: '2026-10-07T00:00:00.000Z',
      clickhouse: 100,
      postgres: 99,
    });
    expect(r.mismatches[1]?.label).toBeNull();
    expect(() => consistencyVerdict(base, diff, new Map())).toThrow();
  });

  it('이름 — 카드 라인 태그면 "설비 코드 공정 · 태그 이름" · 템플릿에 없으면 코드 그대로', () => {
    const rows = cardSeedRows().slice(0, 2);
    const first = rows[0] as SeedTagRow;
    const proc = CARD_PROCESSES[0] as (typeof CARD_PROCESSES)[number];
    const labels = tagLabels([
      ...rows,
      { device_id: 99, device_code: 'X-1', tag_id: 999, tag_code: 'X-1-T' },
    ]);
    expect(labels.get(`${first.device_id}:${first.tag_id}`)).toBe(
      `${first.device_code} ${proc.name} · ${proc.tags[0]?.name}`,
    );
    expect(labels.get('99:999')).toBe('X-1 · X-1-T');
  });
});

describe('결과 보관 · 최신 선택(run_result)', () => {
  const ok = {
    run_id: '11111111-1111-4111-8111-111111111111',
    part: 'consistency' as const,
    params: { part: 'consistency', rows: 100_000 },
    status: 'completed' as const,
    result: {
      part: 'consistency',
      rangeStart: '2026-10-07T00:00:00.000Z',
      rangeEnd: '2026-10-07T01:00:00.000Z',
      clickhouse: { rows: 100, sum: '123456', groups: 2, fingerprint: '-42', scanMs: 30 },
      postgres: { rows: 90, sum: '111111', groups: 2, fingerprint: '17', scanMs: 400 },
      checks: { rows: false, sum: false, groups: false, fingerprint: false },
      mismatchGroups: 1,
      diffGroups: 1,
      mismatches: [
        {
          deviceId: 1,
          tagId: 2,
          label: 'L1-PRT 인쇄 · 잉크 온도',
          hour: '2026-10-07T00:00:00.000Z',
          clickhouse: 50,
          postgres: 40,
        },
      ],
      match: false,
    },
    started_at: new Date('2026-10-11T03:00:00Z'),
    ended_at: new Date('2026-10-11T03:01:30Z'),
    commit_hash: 'abc1234',
    switches: { 'SW-09': 'gated' },
    plant_on: true,
  };

  it('행 → 계약 모양 · 결과가 계약과 어긋나면 result만 null', () => {
    const e = latestEntryOf(ok);
    expect(e).toMatchObject({
      runId: ok.run_id,
      status: 'completed',
      plantOn: true,
      endedAt: '2026-10-11T03:01:30.000Z',
    });
    expect(e.result?.part).toBe('consistency');
    expect(latestEntryOf({ ...ok, result: { part: 'consistency', bad: 1 } }).result).toBeNull();
    // 옛 판(1분 칸 대조 — 2026-10-13 네 기준으로 바뀌기 전)의 결과는 계약과 달라 result null — 화면은 "아직 재지 않았어요"
    const old = {
      ...ok.result,
      published: 100,
      total: { clickhouse: 100, postgres: 90 },
      days: [],
      gaps: [],
    };
    expect(latestEntryOf({ ...ok, result: old }).result).toBeNull();
  });

  it('매개변수는 계약 키만 읽는다 — 옛 판이 함께 적은 키는 버린다 · 값이 어긋나면 기본값', () => {
    const ingest = { ...ok, part: 'ingest' as const, result: null };
    expect(
      latestEntryOf({ ...ingest, params: { part: 'ingest', rows: 50_000_000, oldKey: 20000 } }).params,
    ).toEqual({ part: 'ingest', rows: 50_000_000 });
    expect(latestEntryOf({ ...ingest, params: { part: 'ingest', rows: 7 } }).params).toEqual({
      part: 'ingest',
      rows: 1_000_000,
    });
    // 옛 넣기(시간 구간 — 건수 단위 전)는 rows가 없어 기본값으로 읽힌다
    expect(latestEntryOf({ ...ingest, params: { part: 'ingest', spanHours: 24 } }).params).toEqual({
      part: 'ingest',
      rows: 1_000_000,
    });
    expect(latestEntryOf({ ...ingest, params: null }).params).toEqual({ part: 'ingest', rows: 1_000_000 });
  });

  it('부분별 최근 완료 1건 + 마지막 시도 — 없는 부분은 null · 본문은 CompareLatestBody', async () => {
    const queries: { sql: string; values: unknown[] }[] = [];
    const stopped = {
      run_id: '22222222-2222-4222-8222-222222222222',
      part: 'consistency' as const,
      status: 'stopped' as const,
      ended_at: new Date('2026-10-11T03:05:00Z'),
    };
    const pool = {
      query: async (sql: string, values: unknown[]) => {
        queries.push({ sql, values });
        return { rows: sql.includes("status = 'completed'") ? [ok] : [stopped] };
      },
    };
    const body = await new PgRunResultStore(pool as never).latestCompare();
    expect(CompareLatestBody.parse(body)).toMatchObject({ ingest: null, query: null });
    expect(body.consistency?.runId).toBe(ok.run_id);
    expect(body.attempts).toEqual({
      ingest: null,
      query: null,
      consistency: { runId: stopped.run_id, status: 'stopped', endedAt: '2026-10-11T03:05:00.000Z' },
    });
    expect(Object.keys(body)).toEqual(['ingest', 'query', 'consistency', 'attempts']);
    expect(queries.map((q) => q.values)).toEqual([
      [['ingest', 'query', 'consistency']],
      [['ingest', 'query', 'consistency']],
    ]);
    // 최근 완료는 완료만 · 마지막 시도는 상태 무관
    expect(queries[0]?.sql).toContain("x.status = 'completed'");
    expect(queries[1]?.sql).not.toContain('status =');
  });

  it('마지막 넣기 — 완료면 구간 · 행 수 · 중단 · 실패면 구간 null(그 전 완료로 되돌아가지 않는다)', () => {
    const base = {
      run_id: '33333333-3333-4333-8333-333333333333',
      range_start: '2026-10-07T00:00:00.000Z',
      range_end: '2026-10-08T00:00:00.000Z',
      ch_rows: '19958400',
      pg_rows: '19958400',
      pub_rows: '19958400',
    };
    expect(lastIngestOf({ ...base, status: 'completed' })).toEqual({
      runId: base.run_id,
      status: 'completed',
      range: { start: Date.parse(base.range_start), end: Date.parse(base.range_end) },
      rows: { clickhouse: 19_958_400, postgres: 19_958_400 },
      published: 19_958_400,
    });
    const stopped = lastIngestOf({
      ...base,
      status: 'stopped',
      range_start: null,
      range_end: null,
      ch_rows: null,
      pg_rows: null,
    });
    expect(stopped).toMatchObject({ status: 'stopped', range: null, rows: null, published: null });
    expect(completeIngestRange(stopped)).toBeNull();
    // 옛 결과에 행 수가 없으면 rows만 null
    expect(lastIngestOf({ ...base, status: 'completed', ch_rows: null }).rows).toBeNull();
  });

  it('보관 실패는 종결을 막지 않는다', async () => {
    const h = harness(smallDevices());
    h.results.insert = async () => {
      throw new Error('pg down');
    };
    const s = h.reg.start('compare', { part: 'ingest', rows: 100_000 });
    await h.reg.settled();
    expect(s.status).toBe('completed');
  });
});

describe('실행 객체 — compare 매개변수는 문자열 part를 싣는다', () => {
  it('RunObject.params', async () => {
    const h = harness(smallDevices());
    const s = h.reg.start('compare', { part: 'consistency', rows: 100_000 });
    expect(RunObject.parse(s.toObject()).params).toEqual({ part: 'consistency', rows: 100_000 });
    await h.reg.settled();
  });

  it('ApiError — 사전 확인이 던진 코드는 그대로', async () => {
    const h = harness(smallDevices());
    const e = await h.exec.precheck({ part: 'query', rows: 100_000 }).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
  });
});

describe('넣는 중 결과(실시간 그림)', () => {
  const h = (b: [number, number][], count: number, sum: number): HistSnapshot => ({ buckets: b, count, sum });
  const snap = (over: Partial<CompareMeterSnapshot>): CompareMeterSnapshot => ({
    insert: h([[Number.POSITIVE_INFINITY, 0]], 0, 0),
    copy: h([[Number.POSITIVE_INFINITY, 0]], 0, 0),
    copyFailures: 0,
    rowsInserted: 0,
    copyRows: 0,
    ...over,
  });
  const range = ingestRange(Date.UTC(2026, 9, 11, 12), 831_600, 231);

  it('계측 차분으로 행 수 · 배치 · 속도를 내고 계약을 지킨다 — 속도는 두 DB 중 적은 쪽 ÷ 경과', () => {
    const base = snap({ rowsInserted: 1_000, copyRows: 900, copyFailures: 1 });
    const m = snap({
      insert: h(
        [
          [0.05, 4],
          [0.1, 10],
          [Number.POSITIVE_INFINITY, 10],
        ],
        10,
        0.6,
      ),
      copy: h(
        [
          [0.2, 2],
          [0.4, 8],
          [Number.POSITIVE_INFINITY, 8],
        ],
        8,
        2.4,
      ),
      rowsInserted: 21_000,
      copyRows: 16_900,
      copyFailures: 1,
    });
    const timeline = [{ tSec: 1, clickhouseMs: 60, postgresMs: 300, rows: 20_000 }];
    const r = liveIngestResult({
      target: 831_600,
      range,
      inflightCompress: false,
      published: 25_000,
      base,
      m,
      elapsedMs: 2_000.4,
      bytes: { clickhouse: 1_234, postgres: null },
      timeline,
    });
    expect(CompareRunResult.safeParse(r).success).toBe(true);
    expect(r.rows).toEqual({ published: 25_000, clickhouse: 20_000, postgres: 16_000 });
    expect(r.elapsedMs).toBe(2_000);
    expect(r.rowsPerSec).toBe(8_000); // min(20,000 · 16,000) ÷ 2초
    expect(r.batches.count).toBe(10);
    expect(r.batches.postgresFailures).toBe(0);
    expect(r.batches.clickhouseMs.p50).not.toBeNull();
    expect(r.bytes).toEqual({ clickhouse: 1_234, postgres: null });
    // 표본 배열은 복사한다 — 실행기가 뒤에 점을 더해도 이미 낸 결과는 바뀌지 않는다
    timeline.push({ tSec: 2, clickhouseMs: 50, postgresMs: 280, rows: 21_000 });
    expect(r.timeline).toHaveLength(1);
  });

  it('경과 0이면 속도 0 · 아직 배치가 없으면 분위수 null', () => {
    const r = liveIngestResult({
      target: 1_000_000_000,
      range,
      inflightCompress: true,
      published: 0,
      base: snap({}),
      m: snap({}),
      elapsedMs: 0,
      bytes: { clickhouse: null, postgres: null },
      timeline: [],
    });
    expect(r.rowsPerSec).toBe(0);
    expect(r.batches.clickhouseMs).toEqual({ p50: null, p95: null });
    expect(CompareRunResult.safeParse(r).success).toBe(true);
  });

  it('표본마다 onSample을 부르고 · stop 뒤에 끝난 표본은 버린다(늦은 표본이 최종 결과를 덮지 않게)', async () => {
    let rows = 0;
    let release: (() => void) | null = null;
    const meter = async () => {
      rows += 100;
      return snap({ rowsInserted: rows, copyRows: rows });
    };
    const out: { tSec: number; clickhouseMs: number | null; postgresMs: number | null; rows: number }[] = [];
    const seen: number[] = [];
    let t = 0;
    const clock = { nowMs: () => t, monoMs: () => t, sleep: async () => undefined };
    const s = new TimelineSampler(meter, snap({}), 0, clock as unknown as CompareClock, out, (m) =>
      seen.push(m.rowsInserted),
    );
    t = 1_000;
    await s.sample();
    expect(out).toHaveLength(1);
    expect(seen).toEqual([100]);
    // 읽는 도중에 멈춘다 — 그 표본은 남기지 않는다
    const slow = new TimelineSampler(
      () =>
        new Promise<CompareMeterSnapshot>((res) => {
          release = () => res(snap({ rowsInserted: 999 }));
        }),
      snap({}),
      0,
      clock as unknown as CompareClock,
      out,
      (m) => seen.push(m.rowsInserted),
    );
    const pending = slow.sample();
    slow.stop();
    (release as unknown as () => void)();
    await pending;
    expect(out).toHaveLength(1);
    expect(seen).toEqual([100]);
  });
});
