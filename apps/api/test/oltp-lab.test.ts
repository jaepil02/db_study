// 역방향 대조 실행기(EXP-40~44) — 인자 파싱 · 채우기 결정성(같은 시드 = 같은 행) · 대상 집합 · 분위수 · 구조 판정 집계 ·
// 009 DDL과 그래뉼 변형 DDL의 동형 · 가시성 폴링 · 열린 고리 스케줄러 · 판별(갱신 행 수 응답) · 커넥션 배선 · 머지 뒤 두 라벨 ·
// 경량 UPDATE 쓰기 · patch 판독 설정 명시 · 시간 예산. 저장소 없이 순수 함수 · 가짜 클라이언트로 확인한다.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { ClickHouseClient } from '@clickhouse/client';
import { describe, expect, it } from 'vitest';
import { affectedRows, chUnitSettings } from '../src/modules/datagen/oltp-lab/oltp-atomic';
import {
  caseRow,
  chUpdatePathSettings,
  dedupWindowOf,
  forceStatement43,
  MISSING_LINE_ID,
  REINSERT_SHAPE,
} from '../src/modules/datagen/oltp-lab/oltp-constraint';
import {
  type Ctx,
  productionLogControlDdl,
  workOrderControlDdl,
} from '../src/modules/datagen/oltp-lab/oltp-context';
import { rowCountReported } from '../src/modules/datagen/oltp-lab/oltp-fill';
import { isTooManySimultaneous, openLoop } from '../src/modules/datagen/oltp-lab/oltp-insert';
import {
  connPlan,
  parseOltpArgs,
  type RunArgs,
  VARIANTS,
} from '../src/modules/datagen/oltp-lab/oltp-options';
import { eventLoopOf, pointId, runConcurrent } from '../src/modules/datagen/oltp-lab/oltp-point';
import {
  chRow,
  inProgressIds,
  orderNoOf,
  permute,
  pgCopyLine,
  SLOT_COUNT,
  statusOf,
  targetIds,
  workOrderRow,
} from '../src/modules/datagen/oltp-lab/oltp-rows';
import {
  acceptedCounts,
  atomicCounts,
  dist,
  quantileSorted,
  visibility,
} from '../src/modules/datagen/oltp-lab/oltp-stats';
import {
  IDLE_KEEP_MS,
  LWU_WRITE_SETTINGS,
  now,
  PATCH_READ_SETTINGS,
  pgStmtMean,
} from '../src/modules/datagen/oltp-lab/oltp-stores';
import {
  CONVERGE_READS,
  chVariant,
  convergedOf,
  FORCE_MAX_SEC,
  forceStatement40,
  isVisible,
  pollVisible,
  READ_PHASE_RESERVE_MS,
  runExp40,
  tailReserveMs,
  writeLoop,
} from '../src/modules/datagen/oltp-lab/oltp-update';
import {
  expectedKey,
  expectedSetMd5,
  expectedStatus,
  judgeVerify,
  rowKey,
  sampleIds,
  type VerifyObserved,
} from '../src/modules/datagen/oltp-lab/oltp-verify';

const argv = (...a: string[]) => ['node', 'oltp-lab.js', ...a];

describe('인자', () => {
  it('fill 기본값 · 실측 규모만', () => {
    const a = parseOltpArgs(argv('fill', '--scale', '10000'));
    expect(a).toMatchObject({
      action: 'fill',
      scale: 10000,
      seed: 42,
      inProgress: 0.5,
      stores: 'both',
      chDb: 'plc',
      pgSchema: 'public',
    });
    expect(() => parseOltpArgs(argv('fill', '--scale', '1000'))).toThrow(/10000/);
    expect(() => parseOltpArgs(argv('fill'))).toThrow(/--scale/);
  });
  it('스모크 — 두 대상을 함께 바꾸면 작은 규모 허용 · 한쪽만이면 거부', () => {
    const a = parseOltpArgs(argv('fill', '--scale', '1000', '--ch-db', 'lab_x', '--pg-schema', 'lab_x'));
    expect(a).toMatchObject({ scale: 1000, chDb: 'lab_x' });
    expect(() => parseOltpArgs(argv('fill', '--scale', '1000', '--ch-db', 'lab_x'))).toThrow(/함께/);
    expect(() =>
      parseOltpArgs(argv('fill', '--scale', '1000', '--ch-db', 'x;drop', '--pg-schema', 'lab_x')),
    ).toThrow(/식별자/);
  });
  it('exp 변형 · 필수 인자', () => {
    const a = parseOltpArgs(
      argv('exp40', '--variant', 'ch_lwu', '--scale', '100000', '--rep', '2', '--n', '50'),
    );
    expect(a).toMatchObject({
      action: 'exp40',
      variant: 'ch_lwu',
      rep: 2,
      n: 50,
      converge: 'both',
      pollMax: 2000,
      budgetSec: 510,
    });
    // natural · force를 따로 부르던 모양은 거부 — 한 호출에 두 라벨(M1)
    expect(() =>
      parseOltpArgs(argv('exp40', '--variant', 'ch_lwu', '--scale', '10000', '--converge', 'force')),
    ).toThrow(/both/);
    expect(() => parseOltpArgs(argv('exp40', '--variant', 'ch_g256', '--scale', '10000'))).toThrow(/exp40/);
    expect(() => parseOltpArgs(argv('exp44', '--variant', 'pg', '--scale', '10000'))).toThrow(/--rate/);
    expect(() => parseOltpArgs(argv('exp40', '--variant', 'pg', '--scale', '10000', '--rep', '3'))).toThrow(
      /0~2/,
    );
    expect(() => parseOltpArgs(argv('exp99'))).toThrow(/하위 동작/);
  });
  it('ClickHouse 변형 수 = 12(설계 검산 · W1 검수 ⓓ 윈도우 + 토큰 추가)', () => {
    const ch = Object.values(VARIANTS).flatMap((v) => v.filter((x) => x.startsWith('ch')));
    expect(ch).toHaveLength(12);
  });
  it('EXP-42 팔 · EXP-44 동시 요청 상한', () => {
    const b = ['exp42', '--variant', 'ch_lwu', '--scale', '10000'];
    expect((parseOltpArgs(argv(...b)) as RunArgs).updateParallelMode).toBe('auto');
    expect((parseOltpArgs(argv(...b, '--update-parallel-mode', 'sync')) as RunArgs).updateParallelMode).toBe(
      'sync',
    );
    expect(() => parseOltpArgs(argv(...b, '--update-parallel-mode', 'async'))).toThrow(/auto/);
    const c = ['exp44', '--variant', 'ch_async', '--scale', '10000', '--rate', '200', '--concurrency', '16'];
    expect((parseOltpArgs(argv(...c)) as RunArgs).inflight).toBe(64);
    expect((parseOltpArgs(argv(...c, '--inflight', '32')) as RunArgs).inflight).toBe(32);
  });
  it('pg_stat_statements 평균 — µs 미만 자릿수를 남긴다(기록 041 양자화 편차)', () => {
    // 2,000호출 · 총 9.1 ms → 4.55 µs — 소수 3자리면 0.005(1 µs 칸)
    expect(pgStmtMean({ calls: 10, totalMs: 1 }, { calls: 2010, totalMs: 10.1 }).meanMs).toBe(0.00455);
    expect(pgStmtMean({ calls: 5, totalMs: 1 }, { calls: 5, totalMs: 1 }).meanMs).toBeNull();
  });
  it('EXP-40 R2 예열 — 기본 1(웜 · 예열 1회 뒤 반복) · 0 허용 · 범위 밖 거부', () => {
    const b = ['exp40', '--variant', 'pg', '--scale', '10000'];
    expect((parseOltpArgs(argv(...b)) as RunArgs).readWarmup).toBe(1);
    expect((parseOltpArgs(argv(...b, '--read-warmup', '0')) as RunArgs).readWarmup).toBe(0);
    expect((parseOltpArgs(argv(...b, '--r2-repeat', '50')) as RunArgs).r2Repeat).toBe(50);
    expect(() => parseOltpArgs(argv(...b, '--read-warmup', '101'))).toThrow(/0~100/);
  });
});

describe('채우기 결정성', () => {
  const lines = [1, 3, 7];
  it('같은 시드 = 같은 행 · 다른 시드 = 다른 행', () => {
    expect(workOrderRow(42, 123, 0.5, lines)).toEqual(workOrderRow(42, 123, 0.5, lines));
    expect(workOrderRow(42, 123, 0.5, lines)).not.toEqual(workOrderRow(43, 123, 0.5, lines));
  });
  it('행 필드 — 제약 안 · line_id는 준 목록에서 · order_no 유일', () => {
    const nos = new Set<string>();
    for (let i = 1; i <= 2000; i++) {
      const r = workOrderRow(42, i, 0.5, lines);
      expect(r.orderId).toBe(i);
      expect(lines).toContain(r.lineId);
      expect(r.targetQty).toBeGreaterThan(0);
      expect(r.plannedEndMs).toBeGreaterThan(r.plannedStartMs);
      expect(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).toContain(r.status);
      nos.add(r.orderNo);
    }
    expect(nos.size).toBe(2000);
  });
  it('상태 분포 — IN_PROGRESS 비율이 인자를 따른다', () => {
    const n = 20000;
    const ip = inProgressIds(42, n, 0.5).length / n;
    expect(ip).toBeGreaterThan(0.48);
    expect(ip).toBeLessThan(0.52);
    expect(inProgressIds(42, n, 0.2).length / n).toBeLessThan(0.22);
    expect(statusOf(42, 5, 0.5)).toBe(statusOf(42, 5, 0.5));
  });
  it('COPY 줄과 ClickHouse 행이 같은 값을 싣는다', () => {
    const r = workOrderRow(42, 9, 0.5, lines);
    const f = pgCopyLine(r).trimEnd().split('\t');
    const c = chRow(r);
    expect(f).toEqual([
      String(c.line_id),
      c.order_no,
      c.product_code,
      String(c.target_qty),
      new Date(c.planned_start as number).toISOString(),
      new Date(c.planned_end as number).toISOString(),
      c.status,
    ]);
    expect(c.order_id).toBe(9);
  });
});

describe('대상 집합', () => {
  const ids = inProgressIds(42, 10000, 0.5);
  it('순열은 전단사', () => {
    for (const m of [1, 2, 97, 1000, 4999]) {
      const p = permute(42, m);
      expect(new Set(Array.from({ length: m }, (_, j) => p(j))).size).toBe(m);
    }
  });
  it('반복 · 슬롯끼리 겹치지 않고 전부 IN_PROGRESS · 결정적', () => {
    const all: number[] = [];
    for (let slot = 0; slot < SLOT_COUNT; slot++)
      for (let rep = 0; rep < 3; rep++) all.push(...targetIds(ids, 42, slot, rep, 100));
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(statusOf(42, id, 0.5)).toBe('IN_PROGRESS');
    expect(targetIds(ids, 42, 0, 1, 100)).toEqual(targetIds(ids, 42, 0, 1, 100));
  });
  it('반복 r 대상은 N과 무관하게 같은 집합의 앞부분(공정성 규칙 1 — ch_rmt N 50 대 나머지 300)', () => {
    for (let rep = 0; rep < 3; rep++) {
      const big = targetIds(ids, 42, 0, rep, 300);
      expect(targetIds(ids, 42, 0, rep, 50)).toEqual(big.slice(0, 50));
    }
  });
  it('슬롯 폭보다 큰 N은 거부', () => {
    expect(() => targetIds(ids, 42, 0, 0, Math.ceil(ids.length / SLOT_COUNT / 3) + 1)).toThrow(/대상 부족/);
  });
  it('점조회 번호는 1..scale · 반복마다 다른 순서', () => {
    const a = Array.from({ length: 500 }, (_, k) => pointId(42, 0, 1000, k));
    for (const x of a) expect(x >= 1 && x <= 1000).toBe(true);
    expect(a).not.toEqual(Array.from({ length: 500 }, (_, k) => pointId(42, 1, 1000, k)));
  });
});

describe('분위수 · 요약', () => {
  it('선형 보간(R-7)', () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantileSorted(s, 0.5)).toBe(5.5);
    expect(quantileSorted(s, 0.95)).toBeCloseTo(9.55);
    expect(quantileSorted([7], 0.95)).toBe(7);
    expect(quantileSorted([], 0.5)).toBeNull();
  });
  it('dist는 입력 순서와 무관', () => {
    expect(dist([3, 1, 2])).toEqual({ count: 3, p50: 2, p95: 2.9, p99: 2.98, mean: 2, max: 3 });
    expect(dist([]).p50).toBeNull();
  });
  it('가시성 — 상한 안 미관측(null)을 따로 센다', () => {
    const v = visibility([1, null, 3, null]);
    expect(v.unobserved).toBe(2);
    expect(v.count).toBe(2);
    expect(v.p50).toBe(2);
  });
});

describe('구조 판정 집계', () => {
  it('부분 반영 · 경합 위반', () => {
    const r = atomicCounts([
      { completed: true, logs: 0 },
      { completed: true, logs: 1 },
      { completed: true, logs: 2 },
      { completed: false, logs: 0 },
    ]);
    expect(r).toEqual({ partialApply: 1, raceViolation: 1, completedWithLog: 2 });
  });
  it('수용 건수', () => {
    const r = acceptedCounts([
      { case: 'dup', ok: true },
      { case: 'dup', ok: false },
      { case: 'dup', ok: false },
      { case: 'fk', ok: true },
    ]);
    expect(r).toEqual({ dup: { attempts: 3, accepted: 1 }, fk: { attempts: 1, accepted: 1 } });
  });
  it('EXP-43 입력 행 — 경우마다 위반 필드 하나만', () => {
    const b = workOrderRow(42, 1, 0.5, [1]);
    expect(caseRow(b, 'missing_line', 'x').lineId).toBe(MISSING_LINE_ID);
    expect(caseRow(b, 'check_target_qty', 'x').targetQty).toBe(0);
    const p = caseRow(b, 'check_planned', 'x');
    expect(p.plannedEndMs).toBe(p.plannedStartMs);
    expect(caseRow(b, 'check_status', 'x').status).toBe('BOGUS');
    expect(caseRow(b, 'reinsert', 'x')).toMatchObject({
      orderNo: 'x',
      status: 'PLANNED',
      targetQty: b.targetQty,
    });
  });
});

describe('중복 제거 윈도우 판독', () => {
  it('설정 문자열에 없으면 기본 0', () => {
    expect(dedupWindowOf('MergeTree ORDER BY order_id SETTINGS index_granularity = 8192')).toBe(0);
    expect(
      dedupWindowOf(
        'MergeTree ORDER BY x SETTINGS index_granularity = 8192, non_replicated_deduplication_window = 100',
      ),
    ).toBe(100);
  });
});

describe('판별 — UPDATE 갱신 행 수 응답', () => {
  it('맞은 문장과 빗나간 문장의 요약이 같으면 실리지 않는다', () => {
    const same = { written_rows: '0', result_rows: '0', read_rows: '10' };
    expect(rowCountReported(same, { ...same, read_rows: '12' })).toBe(false);
    expect(rowCountReported({ ...same, written_rows: '1' }, same)).toBe(true);
    expect(rowCountReported(undefined, same)).toBe(false);
  });
  it('실리지 않으면 갱신 행 수 입력이 없다(null — 0으로 읽어 중단하지 않는다)', () => {
    expect(affectedRows({ written_rows: '0' }, false)).toBeNull();
    expect(affectedRows({ written_rows: '0' }, true)).toBe(0);
    expect(affectedRows({ written_rows: '1' }, true)).toBe(1);
  });
});

describe('DDL 동형', () => {
  const ddl = readFileSync(join(__dirname, '../../../infra/clickhouse/ddl/009_business_control.sql'), 'utf8');
  const norm = (s: string) =>
    s
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();
  const statements = norm(ddl).split(/;\s*/).filter(Boolean);
  it('work_order_control — 009와 같은 문(granularity 8192)', () => {
    expect(statements).toContain(norm(workOrderControlDdl('plc', 8192)));
  });
  it('production_log_control — 009와 같은 문', () => {
    expect(statements).toContain(norm(productionLogControlDdl('plc')));
  });
  it('그래뉼 변형은 granularity만 다르다', () => {
    expect(
      workOrderControlDdl('lab_oltp_g256', 256).replace('lab_oltp_g256', 'plc').replace('= 256', '= 8192'),
    ).toBe(workOrderControlDdl('plc', 8192));
  });
  it('RMT는 같은 컬럼 · 제약에 version · 블록 컬럼 설정 없음', () => {
    const rmt = statements.find((s) => s.includes('work_order_control_rmt')) ?? '';
    expect(rmt).toContain('version UInt64');
    expect(rmt).toContain('ReplacingMergeTree(version)');
    expect(rmt).not.toContain('enable_block_number_column');
    expect(rmt).toContain(
      "CONSTRAINT c_status CHECK status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')",
    );
  });
});

describe('가시성 폴링', () => {
  it('판독기마다 처음 본 시각 · 상한 안 미관측은 null', async () => {
    let calls = 0;
    let t = 100;
    const readers = [
      { name: 'soon', read: async () => (++calls >= 3 ? ['COMPLETED'] : ['IN_PROGRESS']) },
      { name: 'never', read: async () => ['COMPLETED', 'IN_PROGRESS'] },
    ];
    const { seen, cut } = await pollVisible(readers, 1, 100, 0, 10, { clock: () => (t += 1) });
    expect(seen.soon).not.toBeNull();
    expect(seen.never).toBeNull();
    expect(cut).toEqual([]);
  });
  it('판독기끼리 독립 — 느린 판독기의 왕복이 빠른 판독기 시각에 더해지지 않는다(M4)', async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const readers = [
      {
        name: 'slow',
        read: async () => {
          await wait(80);
          return ['COMPLETED'];
        },
      },
      { name: 'fast', read: async () => ['COMPLETED'] },
    ];
    const ack = performance.now();
    const { seen } = await pollVisible(readers, 1, ack, 0, 5);
    expect(seen.slow).toBeGreaterThanOrEqual(70);
    expect(seen.fast).toBeLessThan(40);
  });
  it('예산 마감 — 끊은 판독기는 값 없이 cut(미관측 null과 가른다 · M3)', async () => {
    let t = 0;
    const readers = [{ name: 'never', read: async () => ['IN_PROGRESS'] }];
    const { seen, cut } = await pollVisible(readers, 1, 0, 0, 1000, { deadline: 5, clock: () => t++ });
    expect(cut).toEqual(['never']);
    expect(seen.never).toBeNull();
  });
  it('isVisible — 행이 있고 전부 새 값', () => {
    expect(isVisible([])).toBe(false);
    expect(isVisible(['COMPLETED'])).toBe(true);
    expect(isVisible(['COMPLETED', 'IN_PROGRESS'])).toBe(false);
  });
});

describe('동시성 · 열린 고리', () => {
  it('runConcurrent — 번호를 한 번씩 · 동시 상한', async () => {
    const seen: number[] = [];
    let live = 0;
    let peak = 0;
    const lat = await runConcurrent(50, 4, async (k) => {
      live++;
      peak = Math.max(peak, live);
      seen.push(k);
      await new Promise((r) => setTimeout(r, 1));
      live--;
    });
    expect(lat).toHaveLength(50);
    expect(new Set(seen).size).toBe(50);
    expect(peak).toBeLessThanOrEqual(4);
  });
  it('openLoop — 예정 수 · 상한 넘치면 누락 · 오류 계수', async () => {
    const r = await openLoop(200, 0.1, 2, async (k) => {
      await new Promise((res) => setTimeout(res, 30));
      if (k % 2 === 1) throw new Error('x');
    });
    expect(r.scheduled).toBe(20);
    expect(r.sent + r.dropped).toBe(20);
    expect(r.dropped).toBeGreaterThan(0);
    expect(r.ok + r.errors).toBe(r.sent);
    expect(r.rejectedTooMany).toBe(0);
  });
  it('openLoop — ClickHouse 동시 쿼리 상한 거절(202)을 errors 안에서 따로 센다(N5)', async () => {
    const tooMany = Object.assign(new Error('Too many simultaneous queries. Maximum: 100'), { code: '202' });
    const r = await openLoop(100, 0.04, 10, async (k) => {
      if (k === 0) throw tooMany;
      if (k === 1) throw new Error('Code: 202. DB::Exception: (TOO_MANY_SIMULTANEOUS_QUERIES)');
      if (k === 2) throw new Error('duplicate key');
    });
    expect(r.errors).toBe(3);
    expect(r.rejectedTooMany).toBe(2);
    expect(isTooManySimultaneous(new Error('connection refused'))).toBe(false);
  });
});

describe('커넥션 배선(L9 · L4)', () => {
  const base = { concurrency: 16, k: 8 };
  it('41 · 44는 --concurrency · 43은 K · 나머지 4 — 두 저장소 같은 수', () => {
    for (const action of ['exp41', 'exp44'] as const) {
      const p = connPlan({ ...base, action });
      expect([p.pgMax, p.chMax]).toEqual([16, 16]);
    }
    const c = connPlan({ ...base, action: 'exp43' });
    expect([c.pgMax, c.chMax]).toEqual([8, 8]);
    const u = connPlan({ ...base, action: 'exp40' });
    expect([u.pgMax, u.chMax]).toEqual([4, 4]);
    // EXP-40 판독기 두 개가 독립 폴링 — 판독 클라이언트 소켓이 모자라지 않게
    expect(u.chAuxMax).toBeGreaterThanOrEqual(2);
  });
  it('EXP-43 --k가 풀 크기로 흐른다', () => {
    const a = parseOltpArgs(argv('exp43', '--variant', 'ch_mt', '--scale', '10000', '--k', '12')) as RunArgs;
    expect(connPlan(a).pgMax).toBe(12);
    expect(connPlan(a).chMax).toBe(12);
  });
});

describe('머지 뒤 두 라벨(M1)', () => {
  it('두 EXP 공통 라벨 · 강제 문장', () => {
    expect(CONVERGE_READS).toEqual(['after_wait', 'after_force']);
    expect(forceStatement40('ch_lwu', 'plc.work_order_control')).toBe(
      'ALTER TABLE plc.work_order_control APPLY PATCHES',
    );
    expect(forceStatement40('ch_rmt', 'plc.work_order_control_rmt')).toBe(
      'OPTIMIZE TABLE plc.work_order_control_rmt FINAL',
    );
    expect(forceStatement40('ch_alter_async', 'plc.work_order_control')).toBeNull();
    expect(forceStatement43('plc.work_order_control')).toBe('OPTIMIZE TABLE plc.work_order_control FINAL');
  });
  it('수렴 = 강제 문장 성공 + mutation 완료 — patch 파트 수는 조건이 아니다(리드 판정)', () => {
    expect(convergedOf({ mutationsPending: 0, forceOk: true })).toBe(true);
    // after_wait — 강제 문장이 없다(forceOk null) · 미완 mutation 0만 본다(N1)
    expect(convergedOf({ mutationsPending: 0, forceOk: null })).toBe(true);
    expect(convergedOf({ mutationsPending: 2, forceOk: null })).toBe(false);
    expect(convergedOf({ mutationsPending: 1, forceOk: true })).toBe(false);
    expect(convergedOf({ mutationsPending: 0, forceOk: false })).toBe(false);
    expect(convergedOf({ mutationsPending: undefined, forceOk: true })).toBe(false);
  });
  it('예산 — 머지 뒤 단계 몫을 남긴다 · skip · PostgreSQL은 판독 한 단계만', () => {
    const a = { converge: 'both' as const, settleMaxSec: 120 };
    expect(tailReserveMs(a, 'clickhouse')).toBe(3 * READ_PHASE_RESERVE_MS + (120 + FORCE_MAX_SEC) * 1000);
    expect(tailReserveMs({ ...a, converge: 'skip' }, 'clickhouse')).toBe(READ_PHASE_RESERVE_MS);
    expect(tailReserveMs(a, 'postgresql')).toBe(READ_PHASE_RESERVE_MS);
    // 기본 예산 510초 안에 쓰기 창이 남는다
    expect(510_000 - tailReserveMs(a, 'clickhouse')).toBeGreaterThan(0);
  });
});

describe('경량 UPDATE 설정 명시(M2 · L9)', () => {
  function fakeCh() {
    const calls: { kind: string; p: Record<string, unknown> }[] = [];
    const client = {
      command: async (p: Record<string, unknown>) => {
        calls.push({ kind: 'command', p });
        return {};
      },
      query: async (p: Record<string, unknown>) => {
        calls.push({ kind: 'query', p });
        return { json: async () => [{ status: 'COMPLETED' }] };
      },
    };
    return { calls, client: client as unknown as ClickHouseClient };
  }
  it('EXP-40 ③ — 쓰기 enable_lightweight_update 1 · 판독 apply_patch_parts 1', async () => {
    const w = fakeCh();
    const r = fakeCh();
    const args = parseOltpArgs(argv('exp40', '--variant', 'ch_lwu', '--scale', '10000')) as RunArgs;
    const ctx: Ctx = {
      args,
      store: 'clickhouse',
      runId: 't',
      ch: w.client,
      chAux: r.client,
      pg: null,
      pgAux: null,
      pgUrl: '',
      lineIds: [1],
    };
    const v = chVariant(ctx, w.client, r.client);
    await v.write(7);
    await v.readers[0]?.read(7);
    const ws = w.calls[0]?.p.clickhouse_settings as Record<string, unknown>;
    const rs = r.calls[0]?.p.clickhouse_settings as Record<string, unknown>;
    expect(ws.enable_lightweight_update).toBe(1);
    expect(rs.apply_patch_parts).toBe(1);
    expect(v.reads.every((x) => x.settings.apply_patch_parts === 1)).toBe(true);
    expect(v.settingsWritten).toEqual({ write: LWU_WRITE_SETTINGS, read: PATCH_READ_SETTINGS });
  });
  it('EXP-42 완료 단위 · EXP-43 UPDATE 경로', () => {
    expect(chUnitSettings('sync', 'c')).toEqual({
      enable_lightweight_update: 1,
      update_parallel_mode: 'sync',
      log_comment: 'c',
    });
    expect(chUpdatePathSettings('lwu', 'c')).toMatchObject({ enable_lightweight_update: 1 });
    expect(chUpdatePathSettings('alter', 'c')).toMatchObject({ mutations_sync: 1 });
    expect(chUpdatePathSettings('alter', 'c')).not.toHaveProperty('enable_lightweight_update');
  });
  it('EXP-43 ⓓ 입력 모양 기록(L5)', () => {
    expect(REINSERT_SHAPE.postgresql).toMatch(/order_no/);
    expect(REINSERT_SHAPE.clickhouse).toMatch(/order_id/);
  });
});

describe('EXP-40 시간 예산 · 수렴 기록(M3 · N1 · N6)', () => {
  const reader = (name: string, delayMs = 0) => ({
    name,
    read: async () => {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return ['IN_PROGRESS'];
    },
  });
  const args40 = (...extra: string[]) =>
    parseOltpArgs(argv('exp40', '--variant', 'ch_lwu', '--scale', '10000', '--n', '3', ...extra)) as RunArgs;

  it('writeLoop — 마감을 넘기면 쓰지 않고 판독기마다 budgetExhausted로 센다', async () => {
    let writes = 0;
    const r = await writeLoop(
      [1, 2, 3],
      async () => {
        writes++;
        return 1;
      },
      [reader('a'), reader('b')],
      args40(),
      now() - 1,
    );
    expect(writes).toBe(0);
    expect(r.written).toBe(0);
    expect(r.skippedWrites).toBe(3);
    expect(r.budgetExhausted).toEqual({ a: 3, b: 3 });
    expect(r.vis).toEqual({});
  });

  it('writeLoop — 폴링을 끊은 판독기만 budgetExhausted · 나머지는 값(미관측 null)으로', async () => {
    const r = await writeLoop(
      [1],
      async () => 1,
      [reader('fast'), reader('slow', 40)],
      { ...args40(), pollIntervalMs: 0, pollMax: 3 },
      now() + 20,
    );
    expect(r.written).toBe(1);
    // fast는 상한(3회) 안 미관측 → null 한 건 · slow는 두 번째 판독 전 마감 → 끊김
    expect(r.vis.fast).toEqual([null]);
    expect(r.vis.slow).toBeUndefined();
    expect(r.budgetExhausted).toEqual({ fast: 0, slow: 1 });
  });

  /** 모든 조회에 같은 한 행 — 계기 · 판독이 값을 읽을 수 있을 만큼만(첫 값은 chNow가 읽는 시각) */
  function fakeCh(): ClickHouseClient {
    const row = { t: '2026-01-01 00:00:00.000000', a: '1', pp: '0', r: '0', b: '0', n: '0', pend: '0' };
    return {
      command: async () => ({}),
      query: async () => ({
        json: async () => [{ ...row, m: '0', mu: '0', q: 0, status: 'COMPLETED' }],
      }),
    } as unknown as ClickHouseClient;
  }
  const ctx40 = (args: RunArgs): Ctx => ({
    args,
    store: 'clickhouse',
    runId: 't',
    ch: fakeCh(),
    chAux: fakeCh(),
    pg: null,
    pgAux: null,
    pgUrl: '',
    lineIds: [1],
  });

  it('예산이 모자라면 쓰기 · after_wait · after_force를 건너뛰고 기록한다', async () => {
    const { measures, detail } = await runExp40(ctx40(args40('--budget-sec', '30')));
    const budget = detail.budget as Record<string, unknown>;
    expect(budget.written).toBe(0);
    expect(budget.skippedWrites).toBe(3);
    expect(budget.skippedPhases).toEqual(['after_wait', 'after_force']);
    expect(detail.converge).toEqual({});
    const ex = measures.find((m) => m.metric === 'budget_exhausted');
    expect(ex).toMatchObject({ unit: 'count', value: 3, read: 'default' });
    expect(measures.some((m) => m.read === 'after_wait' || m.read === 'after_force')).toBe(false);
    expect(detail.keepAlive).toEqual({ chIdleSocketTtlMs: IDLE_KEEP_MS, pgIdleTimeoutMs: IDLE_KEEP_MS });
  });

  it('수렴 판정은 detail.converge에만 — 관측 행(measure)에 converged가 없다 · after_wait는 forceOk null', async () => {
    const { measures, detail } = await runExp40(ctx40(args40('--settle-max-sec', '6')));
    expect(measures.some((m) => m.metric === 'converged' || m.unit === 'bool')).toBe(false);
    const conv = detail.converge as Record<string, Record<string, unknown>>;
    expect(conv.after_wait).toMatchObject({ forceOk: null, converged: true });
    expect(conv.after_force).toMatchObject({ forceOk: true, converged: true });
    expect(measures.some((m) => m.read === 'after_force' && m.metric === 'patch_parts')).toBe(true);
  }, 30_000);
});

describe('채움 대조 verify(adopt — 복원 스냅샷 = 지금 행 벡터)', () => {
  it('기대 집합 md5 — PG string_agg 규칙(id:no를 순서대로 , 연결)과 같은 문자열의 md5', () => {
    const joined = Array.from({ length: 3 }, (_, k) => `${k + 1}:${orderNoOf(42, k + 1)}`).join(',');
    expect(expectedSetMd5(42, 3)).toBe(createHash('md5').update(joined).digest('hex'));
  });
  it('기대 상태 분포 — 합이 규모 · 이름 오름차순', () => {
    const st = expectedStatus(42, 10000, 0.5);
    expect(st.reduce((a, [, n]) => a + n, 0)).toBe(10000);
    expect(st.map(([s]) => s)).toEqual([...st.map(([s]) => s)].sort());
  });
  it('표본 — 1 · scale 포함 · 중복 없음 · 결정적 · 작은 규모는 전부', () => {
    const s = sampleIds(42, 10000);
    expect(s).toHaveLength(200);
    expect(s[0]).toBe(1);
    expect(s[s.length - 1]).toBe(10000);
    expect(new Set(s).size).toBe(s.length);
    expect(sampleIds(42, 10000)).toEqual(s);
    expect(sampleIds(42, 50)).toHaveLength(50);
  });
  it('행 비교 문자열 — ClickHouse 문자열 정수 · 기대 행과 같은 모양', () => {
    const w = workOrderRow(42, 7, 0.5, [1, 2, 3]);
    const fromCh = rowKey({
      id: '7',
      line: String(w.lineId),
      no: w.orderNo,
      prod: w.productCode,
      qty: String(w.targetQty),
      ps: String(w.plannedStartMs),
      pe: String(w.plannedEndMs),
      st: w.status,
    });
    expect(fromCh).toBe(expectedKey(w));
  });
  const okObs = (): VerifyObserved => {
    const st: [string, number][] = [
      ['IN_PROGRESS', 6],
      ['PLANNED', 4],
    ];
    const c = { md5: 'h', n: 10, total: 10 };
    return {
      scale: 10,
      expectedMd5: 'h',
      expectedStatus: st,
      set: { pg: { ...c }, ch: { ...c }, chRmt: { ...c } },
      status: { pg: st, ch: st, chRmt: st },
      logs: { pgProductionLog: 0, pgAuditLog: 0, chProductionLogControl: 0 },
      sample: { n: 10, mismatch: { pg: 0, ch: 0, chRmt: 0 } },
    };
  };
  it('판정 — 모두 맞으면 일치', () => {
    expect(judgeVerify(okObs())).toEqual({ match: true, reasons: [] });
  });
  it('판정 — 실험 로그 테이블이 비지 않으면 거부(PG 실적 · 감사 · CH 실적)', () => {
    for (const k of ['pgProductionLog', 'pgAuditLog', 'chProductionLogControl'] as const) {
      const o = okObs();
      o.logs[k] = 1;
      expect(judgeVerify(o)).toEqual({ match: false, reasons: [`logs.${k}`] });
    }
  });
  it('판정 — RMT 상태 분포가 기대와 다르면 거부(md5 · 행 수가 같아도)', () => {
    const o = okObs();
    o.status.chRmt = [
      ['COMPLETED', 1],
      ['IN_PROGRESS', 5],
      ['PLANNED', 4],
    ];
    expect(judgeVerify(o)).toEqual({ match: false, reasons: ['chRmt.status'] });
  });
  it('판정 — md5 · 행 수 · 표본 불일치를 항목별로', () => {
    const o = okObs();
    o.set.ch.md5 = 'x';
    o.set.pg.total = 11;
    o.sample.mismatch.chRmt = 2;
    expect(judgeVerify(o).reasons).toEqual(['pg.rows', 'ch.md5', 'sample.chRmt']);
  });
  it('verify 인자 — fill과 같은 규모 · 시드 · 비율', () => {
    expect(parseOltpArgs(argv('verify', '--scale', '100000', '--seed', '7'))).toMatchObject({
      action: 'verify',
      scale: 100000,
      seed: 7,
      inProgress: 0.5,
    });
    expect(() => parseOltpArgs(argv('verify'))).toThrow(/--scale/);
  });
});

describe('EXP-41 이벤트 루프 사용률(기록만)', () => {
  it('측정 창 ELU — 0~1 · 활성 · 유휴 ms', async () => {
    const start = performance.eventLoopUtilization();
    await new Promise((r) => setTimeout(r, 20));
    const e = eventLoopOf(start);
    expect(e.utilization).toBeGreaterThanOrEqual(0);
    expect(e.utilization).toBeLessThanOrEqual(1);
    expect(e.idleMs + e.activeMs).toBeGreaterThan(0);
  });
});
