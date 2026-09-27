// 채움 대조(쓰지 않는다) — 복원한 채움 스냅샷이 지금 코드의 채움 상태와 같은가를 내용으로 확인한다(러너 adopt · 재측정 · 2026-09-27).
// 검사 범위(이것이 전부다 — judgeVerify):
//   ① (order_id · order_no) 집합 md5 — 세 테이블(PG work_order · CH work_order_control · _rmt) 각각을 지금 코드의 기대값(orderNoOf)과
//   ② 행 수 — 세 테이블 각각 order_id ≤ 규모 안 · 테이블 전체가 규모와 같다
//   ③ 상태 분포 — 세 테이블 각각을 기대 분포(statusOf)와
//   ④ 실험 로그 테이블이 비었다 — PG production_log · audit_log · CH production_log_control(채우기는 감사 · 실적을 쓰지 않는다)
//   ⑤ 표본 행 전 컬럼 — 200행(1 · 규모 포함 · 해시로 흩음)을 workOrderRow와 세 테이블 각각
// 한계: 전 행에 걸리는 것은 ①~④뿐이다 — line · product · qty · 계획 시각은 표본 200행 밖의 변경을 못 잡는다. RMT version 컬럼은 보지 않는다
// (⑤의 plain 판독 · ②의 행 수로 버전 2 행이 없음만 간접 확인).
// 그래서 스냅샷을 만든 커밋 뒤 oltp-rows.ts가 바뀌어도(대상 창 등) 채움 상태가 위 범위에서 같으면 재사용하고, 다르면 거부한다.
import { createHash } from 'node:crypto';
import type { ClickHouseClient } from '@clickhouse/client';
import type { Client } from 'pg';
import { chTable } from './oltp-context';
import { chSetMd5Sql, PG_SET_MD5_SQL, pgLineIds } from './oltp-fill';
import type { VerifyArgs } from './oltp-options';
import { hash32, orderNoOf, statusOf, type WorkOrderRow, workOrderRow } from './oltp-rows';
import { chRows, chScalar } from './oltp-stores';

/** 전 컬럼 대조 표본 수(첫 · 끝 행 포함) */
export const VERIFY_SAMPLE = 200;

/** 기대 (order_id · order_no) 집합 md5 — PG_SET_MD5_SQL · chSetMd5Sql과 같은 문자열 규칙('id:no'를 order_id 순으로 ',' 연결) */
export function expectedSetMd5(seed: number, scale: number): string {
  const h = createHash('md5');
  for (let i = 1; i <= scale; i++) h.update(`${i === 1 ? '' : ','}${i}:${orderNoOf(seed, i)}`);
  return h.digest('hex');
}

/** 기대 상태 분포 — [상태, 행 수] 상태 이름 오름차순(fill과 같은 모양) */
export function expectedStatus(seed: number, scale: number, inProgress: number): [string, number][] {
  const m = new Map<string, number>();
  for (let i = 1; i <= scale; i++) {
    const s = statusOf(seed, i, inProgress);
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  return [...m.entries()].sort(([x], [y]) => (x < y ? -1 : 1));
}

/** 전 컬럼 대조 표본 — 1 · scale · 해시로 흩은 나머지(결정적 · 중복 제거 · 오름차순) */
export function sampleIds(seed: number, scale: number, n = VERIFY_SAMPLE): number[] {
  const s = new Set<number>([1, scale]);
  for (let k = 0; s.size < Math.min(n, scale); k++) s.add((hash32(seed, k, 97) % scale) + 1);
  return [...s].sort((a, b) => a - b);
}

/** 행 한 줄의 비교 문자열 — 시각은 epoch ms · 수는 Number로 정규화(ClickHouse 64비트 정수는 JSON 문자열로 온다) */
export function rowKey(r: {
  id: unknown;
  line: unknown;
  no: unknown;
  prod: unknown;
  qty: unknown;
  ps: unknown;
  pe: unknown;
  st: unknown;
}): string {
  return [
    Number(r.id),
    Number(r.line),
    String(r.no),
    String(r.prod),
    Number(r.qty),
    Number(r.ps),
    Number(r.pe),
    String(r.st),
  ].join('|');
}

export function expectedKey(w: WorkOrderRow): string {
  return rowKey({
    id: w.orderId,
    line: w.lineId,
    no: w.orderNo,
    prod: w.productCode,
    qty: w.targetQty,
    ps: w.plannedStartMs,
    pe: w.plannedEndMs,
    st: w.status,
  });
}

type KeyRow = {
  id: unknown;
  line: unknown;
  no: unknown;
  prod: unknown;
  qty: unknown;
  ps: unknown;
  pe: unknown;
  st: unknown;
};

type Counted = { md5: string | undefined; n: number; total: number };

/** 대조 관측값 — verifyFill이 저장소에서 모은다(판정은 judgeVerify · 저장소 없이 시험) */
export interface VerifyObserved {
  scale: number;
  expectedMd5: string;
  expectedStatus: [string, number][];
  set: { pg: Counted; ch: Counted; chRmt: Counted };
  status: { pg: [string, number][]; ch: [string, number][]; chRmt: [string, number][] };
  /** 실험 로그 테이블 행 수 — 채움 스냅샷에서는 0이어야 한다 */
  logs: { pgProductionLog: number; pgAuditLog: number; chProductionLogControl: number };
  sample: { n: number; mismatch: { pg: number; ch: number; chRmt: number } };
}

/** 판정 — 어긋난 항목 이름 목록(빈 목록 = 일치) */
export function judgeVerify(o: VerifyObserved): { match: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  for (const [name, c] of Object.entries(o.set)) {
    if (c.md5 !== o.expectedMd5) reasons.push(`${name}.md5`);
    if (c.n !== o.scale || c.total !== o.scale) reasons.push(`${name}.rows`);
  }
  for (const [name, st] of Object.entries(o.status))
    if (!same(st, o.expectedStatus)) reasons.push(`${name}.status`);
  for (const [name, n] of Object.entries(o.logs)) if (n !== 0) reasons.push(`logs.${name}`);
  for (const [name, n] of Object.entries(o.sample.mismatch)) if (n !== 0) reasons.push(`sample.${name}`);
  return { match: reasons.length === 0, reasons };
}

export async function verifyFill(
  a: VerifyArgs,
  pg: Client,
  ch: ClickHouseClient,
): Promise<Record<string, unknown>> {
  const lineIds = await pgLineIds(pg);
  const wo = chTable(a.chDb, 'work_order_control');
  const rmt = chTable(a.chDb, 'work_order_control_rmt');
  const expMd5 = expectedSetMd5(a.seed, a.scale);
  const expStatus = expectedStatus(a.seed, a.scale, a.inProgress);
  const [p] = (await pg.query<{ h: string; n: string }>(PG_SET_MD5_SQL, [a.scale])).rows;
  const [c1] = await chRows<{ h: string; n: string }>(ch, chSetMd5Sql(wo), { scale: a.scale });
  const [c2] = await chRows<{ h: string; n: string }>(ch, chSetMd5Sql(rmt), { scale: a.scale });
  const [pgTotal] = (await pg.query<{ n: string }>('SELECT count(*)::bigint AS n FROM work_order')).rows;
  const [chTotal] = await chRows<{ a: string; b: string }>(
    ch,
    `SELECT (SELECT count() FROM ${wo}) AS a, (SELECT count() FROM ${rmt}) AS b`,
  );
  const statusPg = (
    await pg.query<{ s: string; n: string }>(
      'SELECT status AS s, count(*)::bigint AS n FROM work_order GROUP BY 1 ORDER BY 1',
    )
  ).rows.map((x): [string, number] => [x.s, Number(x.n)]);
  const statusOfCh = async (t: string) =>
    (
      await chRows<{ s: string; n: string }>(
        ch,
        `SELECT status AS s, count() AS n FROM ${t} GROUP BY s ORDER BY s`,
      )
    ).map((x): [string, number] => [x.s, Number(x.n)]);
  const statusCh = await statusOfCh(wo);
  const statusRmt = await statusOfCh(rmt);
  const [pgLogs] = (
    await pg.query<{ p: string; a: string }>(
      'SELECT (SELECT count(*) FROM production_log)::bigint AS p, (SELECT count(*) FROM audit_log)::bigint AS a',
    )
  ).rows;
  const chLogs = Number(
    await chScalar(ch, `SELECT count() AS n FROM ${chTable(a.chDb, 'production_log_control')}`),
  );
  // 표본 행 전 컬럼 — 세 테이블 각각 기대 행과 같은가
  const ids = sampleIds(a.seed, a.scale);
  const expected = ids.map((i) => expectedKey(workOrderRow(a.seed, i, a.inProgress, lineIds)));
  const pgRows = (
    await pg.query<KeyRow>(
      `SELECT order_id AS id, line_id AS line, order_no AS no, product_code AS prod, target_qty AS qty,
              (extract(epoch FROM planned_start) * 1000)::bigint AS ps, (extract(epoch FROM planned_end) * 1000)::bigint AS pe,
              status AS st FROM work_order WHERE order_id = ANY($1::bigint[]) ORDER BY order_id`,
      [ids],
    )
  ).rows.map(rowKey);
  const chKeys = async (t: string) =>
    (
      await chRows<KeyRow>(
        ch,
        `SELECT order_id AS id, line_id AS line, order_no AS no, product_code AS prod, target_qty AS qty,
                toUnixTimestamp64Milli(planned_start) AS ps, toUnixTimestamp64Milli(planned_end) AS pe, status AS st
           FROM ${t} WHERE order_id IN ({ids:Array(UInt64)}) ORDER BY order_id`,
        { ids },
      )
    ).map(rowKey);
  const chWo = await chKeys(wo);
  const chRmt = await chKeys(rmt);
  const diff = (got: string[]) =>
    expected.filter((e, k) => got[k] !== e).length + Math.abs(got.length - expected.length);
  const obs: VerifyObserved = {
    scale: a.scale,
    expectedMd5: expMd5,
    expectedStatus: expStatus,
    set: {
      pg: { md5: p?.h, n: Number(p?.n), total: Number(pgTotal?.n) },
      ch: { md5: c1?.h, n: Number(c1?.n), total: Number(chTotal?.a) },
      chRmt: { md5: c2?.h, n: Number(c2?.n), total: Number(chTotal?.b) },
    },
    status: { pg: statusPg, ch: statusCh, chRmt: statusRmt },
    logs: {
      pgProductionLog: Number(pgLogs?.p),
      pgAuditLog: Number(pgLogs?.a),
      chProductionLogControl: chLogs,
    },
    sample: { n: ids.length, mismatch: { pg: diff(pgRows), ch: diff(chWo), chRmt: diff(chRmt) } },
  };
  return { ...obs, lineIds: lineIds.length, ...judgeVerify(obs) };
}
