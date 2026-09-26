// 역방향 실행기 공용 — 실행 문맥 · 측정 한 줄 · 테이블 이름 · 대조 테이블 DDL(그래뉼 변형 · 판별 탐침용)
// 측정 한 줄 = 한 반복의 한 지표(값 하나) — 3회 중앙값 · 편차 · 기계 판독 reverse 블록은 오케스트레이터 collect가 만든다.
import type { ClickHouseClient } from '@clickhouse/client';
import type { Pool } from 'pg';
import type { RunArgs } from './oltp-options';

export type Store = 'postgresql' | 'clickhouse';
export type Op = 'update' | 'point' | 'atomic' | 'constraint' | 'insert';

export const EXP_ID = {
  exp40: 'EXP-40',
  exp41: 'EXP-41',
  exp42: 'EXP-42',
  exp43: 'EXP-43',
  exp44: 'EXP-44',
} as const;
export const EXP_OP: Record<keyof typeof EXP_ID, Op> = {
  exp40: 'update',
  exp41: 'point',
  exp42: 'atomic',
  exp43: 'constraint',
  exp44: 'insert',
};

/** 기계 판독 reverse 키(04_experiment_protocol §기계 판독 블록 · 05_data_stores/10 §EXP 연결)에 rep · value를 더한 원시 한 줄 */
export interface Measure {
  metric: string;
  unit: string;
  value: number | null;
  /** 판독 설정 · 머지 전후(EXP-40 · 43) — 없으면 null */
  read: string | null;
  /** 구조 지표(부분 반영 · 경합 위반 · 수용 건수) — 판독기는 중앙값이 아니라 3회 전부를 본다 */
  structural?: true;
  detail?: unknown;
}

export interface RunResult {
  measures: Measure[];
  detail: Record<string, unknown>;
}

export interface Ctx {
  args: RunArgs;
  store: Store;
  runId: string;
  /** 쓰기 · 측정 대상 */
  ch: ClickHouseClient | null;
  /** 별도 판독 커넥션(가시성 폴링) · 계기 조회 */
  chAux: ClickHouseClient | null;
  pg: Pool | null;
  /** 계기(pg_stat_*) · 판독 전용 커넥션 */
  pgAux: Pool | null;
  /** 실패 주입의 전용 커넥션용(EXP-42) */
  pgUrl: string;
  /** production_line 번호 오름차순 — 채움 행 벡터의 line_id(FK)를 다시 만든다 */
  lineIds: number[];
}

export function storeOf(variant: string): Store {
  return variant.startsWith('pg') ? 'postgresql' : 'clickhouse';
}

export function logComment(ctx: Ctx, phase: string): string {
  const a = ctx.args;
  return `oltp:${a.action}:${a.variant}:s${a.scale}:r${a.rep}:${phase}:${ctx.runId}`;
}

export const chTable = (
  db: string,
  t: 'work_order_control' | 'work_order_control_rmt' | 'production_log_control',
) => `${db}.${t}`;

/** 그래뉼 변형 실험 DB(plc 밖 · EXP-41 실행 범위에서만 존재) · 판별 탐침 DB */
export const G256_DB = 'lab_oltp_g256';
export const PROBE_DB = 'lab_oltp_probe';

/**
 * work_order_control DDL — infra/clickhouse/ddl/009와 같은 문(테스트가 대조한다) · granularity만 인자.
 * 그래뉼 변형은 이 문을 granularity 256으로 만든다(05_data_stores/10 §그래뉼 변형 판정 ② — 문 해시를 원시에 남긴다).
 */
export function workOrderControlDdl(db: string, granularity: number): string {
  return `CREATE TABLE IF NOT EXISTS ${db}.work_order_control
(
    order_id      UInt64,
    line_id       UInt32,
    order_no      String,
    product_code  String,
    target_qty    Int32,
    planned_start DateTime64(3, 'Asia/Seoul'),
    planned_end   DateTime64(3, 'Asia/Seoul'),
    status        LowCardinality(String),
    CONSTRAINT c_target_qty CHECK target_qty > 0,
    CONSTRAINT c_planned    CHECK planned_end > planned_start,
    CONSTRAINT c_status     CHECK status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
)
ENGINE = MergeTree
ORDER BY order_id
SETTINGS index_granularity = ${granularity},
         enable_block_number_column = 1,
         enable_block_offset_column = 1`;
}

export function productionLogControlDdl(db: string): string {
  return `CREATE TABLE IF NOT EXISTS ${db}.production_log_control
(
    log_id      UInt64,
    order_id    UInt64,
    recorded_at DateTime64(3, 'Asia/Seoul'),
    good_qty    Int32,
    defect_qty  Int32,
    CONSTRAINT c_good   CHECK good_qty >= 0,
    CONSTRAINT c_defect CHECK defect_qty >= 0
)
ENGINE = MergeTree
ORDER BY (order_id, log_id)`;
}

/** 대조 테이블 컬럼 목록(시스템 컬럼 _block_number · _block_offset 제외) */
export const WO_COLUMNS =
  'order_id, line_id, order_no, product_code, target_qty, planned_start, planned_end, status';
