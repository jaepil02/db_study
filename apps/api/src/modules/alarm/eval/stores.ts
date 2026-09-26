// 판정기의 저장소 구현 — ⑤ PostgreSQL alarm_event(진실) · ⑧ ClickHouse alarm_eval(판정 전수)
// 정본 docs/05_data_stores/01_postgresql_schema.md §alarm_event · 03_clickhouse_schema.md §alarm_eval · 06_pipeline/08 §부분 실패.
// 판정 · 확정 · 해제의 시스템 쓰기는 감사하지 않는다(REQ-ALM-15). 시각은 행 ts(epoch ms)를 timestamptz로 옮긴다.
import type { ClickHouseClient } from '@clickhouse/client';
import type { Pool } from 'pg';
import type { BatchTokenPort } from '../../ingest/batch-token.port';
import { ALARM_EVAL_COLUMNS, type AlarmEvalRow, type ConfirmPort } from './judge';
import { queryBounded } from './pg-bounded';
import type { AlarmRule } from './rules';

/**
 * 열기 — 같은 rule_id의 열린 행(state ACTIVE)이 있으면 INSERT하지 않고 그 event_id를 돌려준다.
 * 커밋 뒤 alarm:state 쓰기가 실패한 뒤의 재판정이 같은 알람을 두 번 열지 않게 하는 강제 주체다
 * (PostgreSQL 층에 "규칙당 열린 행 1" 부분 유일 인덱스가 없다 — 파티션 키 제약 · 한계 등재 #9). 판정기가 하나라 경합이 없다.
 */
export const OPEN_SQL = `
WITH cur AS (
  SELECT event_id FROM alarm_event
   WHERE rule_id = $1 AND state = 'ACTIVE'
   ORDER BY occurred_at DESC LIMIT 1
), ins AS (
  INSERT INTO alarm_event (rule_id, occurred_at, trigger_value, state)
  SELECT $1, to_timestamp($2::float8 / 1000), $3, 'ACTIVE'
   WHERE NOT EXISTS (SELECT 1 FROM cur)
  RETURNING event_id
)
SELECT event_id, true AS inserted FROM ins
UNION ALL
SELECT event_id, false AS inserted FROM cur`;

/** 닫기 — 열린 행만(acked_by · acked_at 유지) · 0행이면 이미 닫혔다(재시도) · event_id를 모르면 규칙의 열린 행 */
export const CLOSE_SQL = `
UPDATE alarm_event
   SET state = 'CLEARED', cleared_at = to_timestamp($3::float8 / 1000)
 WHERE state = 'ACTIVE' AND rule_id = $2 AND ($1::bigint IS NULL OR event_id = $1)`;

export const ACKED_SQL = 'SELECT acked_at IS NOT NULL AS acked FROM alarm_event WHERE event_id = $1';

export const OPEN_COUNTS_SQL = `
SELECT r.severity, count(*)::int AS n
  FROM alarm_event e JOIN alarm_rule r ON r.rule_id = e.rule_id
 WHERE e.state = 'ACTIVE'
 GROUP BY r.severity`;

export class PostgresAlarmConfirm implements ConfirmPort {
  constructor(
    private readonly pool: Pool,
    private readonly log: { warn(msg: string): void },
  ) {}

  async open(rule: AlarmRule, ts: number, value: number): Promise<{ eventId: number; inserted: boolean }> {
    const r = await queryBounded<{ event_id: string; inserted: boolean }>(this.pool, OPEN_SQL, [
      rule.ruleId,
      ts,
      value,
    ]);
    const row = r.rows[0];
    if (!row) throw new Error('열기 응답 없음');
    return { eventId: Number(row.event_id), inserted: row.inserted };
  }

  async close(rule: AlarmRule, eventId: number | null, ts: number): Promise<boolean> {
    const r = await queryBounded(this.pool, CLOSE_SQL, [eventId, rule.ruleId, ts]);
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * 실패는 로그 뒤 던진다 — 판정이 확인 안 된 것으로 보고(CLEARING 디바운스를 타 해제가 늦어질 뿐 · 06_pipeline/08 §ACK와 alarm:state)
   * 그 배치의 나머지 확정 · acked 조회를 멈춘다(BatchHalt)
   */
  async acked(eventId: number): Promise<boolean> {
    try {
      const r = await queryBounded<{ acked: boolean }>(this.pool, ACKED_SQL, [eventId]);
      return r.rows[0]?.acked === true;
    } catch (e) {
      this.log.warn(
        `acked_at 조회 실패(event ${eventId}) — ${(e as Error).message} · 확인 안 된 것으로 보고 이 배치 확정을 멈춘다`,
      );
      throw e;
    }
  }

  /** 기동 시 alm_active_alarms 초기값 — 심각도별 열린 행 수 */
  async openCounts(): Promise<{ severity: number; n: number }[]> {
    const r = await this.pool.query<{ severity: number; n: number }>(OPEN_COUNTS_SQL);
    return r.rows.map((x) => ({ severity: Number(x.severity), n: Number(x.n) }));
  }
}

/** alarm_eval INSERT — 원 배치 토큰 · 토큰 설정은 SW-08 구현(BatchTokenPort)의 것을 그대로 쓴다 */
export class ClickHouseAlarmEvalSink {
  constructor(
    private readonly client: ClickHouseClient,
    private readonly tokens: BatchTokenPort,
  ) {}

  async insert(rows: AlarmEvalRow[], token: string | null): Promise<void> {
    await this.client.insert({
      table: 'alarm_eval',
      values: rows,
      format: 'JSONCompactEachRow',
      columns: [...ALARM_EVAL_COLUMNS] as [string, ...string[]],
      clickhouse_settings: this.tokens.settings(token),
    });
  }
}
