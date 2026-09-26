// ALM 판정 이력 분석(#6) — 표면 정본 docs/07_api/07_alarms.md §#6 · 저장 정본 05_data_stores/03 §alarm_eval
// ClickHouse alarm_eval 범위 스캔 — 롤업이 없어 매 요청 집계한다 · 캐시하지 않는다(키 공간에 판정 이력 사본 키가 없다).
// 평균을 내지 않고 min · max 쌍만 낸다 — 평균은 임계값 근처의 순간 초과를 지운다(REQ-ALM-17).
// 사용자 입력은 파라미터 바인딩으로만 넘긴다 — 버킷 폭 · 필터 열은 고정 목록에서 고른다(REQ-GLB-24).
import {
  type AlarmEvalParams,
  type AlarmEvalResponseBody,
  type AlarmRuleBody,
  EVAL_COLUMNS,
  type EvalInterval,
} from '@db-study/shared';
import { Injectable } from '@nestjs/common';
import { ClickHouse } from '../../../common/clickhouse/clickhouse.module';
import { ApiError } from '../../../common/http/api-error';
import { Postgres } from '../../../common/postgres/postgres.module';
import { RULE_SELECT, rowToRule } from './alarm-rules.service';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** 버킷 폭 — raw는 예상 포인트 계산용 판정 주기(05_timeseries와 같은 1,000 ms 가정 · timeseries/resolution RAW_PERIOD_MS) */
const PERIOD_MS: Record<EvalInterval, number> = { raw: 1000, '1m': MIN, '1h': HOUR };
const LADDER: EvalInterval[] = ['raw', '1m', '1h'];

/** 범위 길이로 고르고 버킷 수가 maxPoints를 넘으면 한 단계 상향 — 1h가 끝이다(그 초과 해상도가 표면에 없다) */
export function chooseEvalInterval(rangeMs: number, maxPoints: number): EvalInterval {
  let i = rangeMs <= HOUR ? 0 : rangeMs <= 7 * DAY ? 1 : 2;
  while (i < LADDER.length - 1 && Math.ceil(rangeMs / PERIOD_MS[LADDER[i] as EvalInterval]) > maxPoints) i++;
  return LADDER[i] as EvalInterval;
}

export function buildEvalSql(interval: EvalInterval, by: 'rule' | 'tag'): string {
  const filter = by === 'rule' ? 'rule_id = {id:UInt32}' : 'tag_id = {id:UInt32}';
  const range = 'ts >= fromUnixTimestamp64Milli({from:Int64}) AND ts < fromUnixTimestamp64Milli({to:Int64})';
  if (interval === 'raw')
    return `SELECT rule_id, tag_id, toUnixTimestamp64Milli(ts) AS ts_ms, value AS vmin, value AS vmax,
                   breached AS breaches, 1 AS evals
              FROM plc.alarm_eval
             WHERE ${filter} AND ${range}
             ORDER BY rule_id, tag_id, ts_ms`;
  // epoch 정렬 버킷 — 1분 · 1시간은 KST 오프셋(+9시간)의 약수라 KST 경계와 같다
  return `SELECT rule_id, tag_id, intDiv(toUnixTimestamp64Milli(ts), {bucket:Int64}) * {bucket:Int64} AS ts_ms,
                 min(value) AS vmin, max(value) AS vmax, sum(breached) AS breaches, count() AS evals
            FROM plc.alarm_eval
           WHERE ${filter} AND ${range}
           GROUP BY rule_id, tag_id, ts_ms
           ORDER BY rule_id, tag_id, ts_ms`;
}

@Injectable()
export class AlarmEvalsService {
  constructor(
    private readonly ch: ClickHouse,
    private readonly pg: Postgres,
  ) {}

  async query(q: AlarmEvalParams): Promise<AlarmEvalResponseBody> {
    const fromMs = Date.parse(q.from);
    const toMs = Date.parse(q.to);
    const interval = chooseEvalInterval(toMs - fromMs, q.maxPoints);
    const by = q.ruleId !== undefined ? 'rule' : 'tag';
    const id = (q.ruleId ?? q.tagId) as number;
    let rows: Record<string, number | string>[];
    try {
      const rs = await this.ch.client.query({
        query: buildEvalSql(interval, by),
        query_params: {
          id,
          from: fromMs,
          to: toMs,
          ...(interval === 'raw' ? {} : { bucket: PERIOD_MS[interval] }),
        },
        format: 'JSONEachRow',
      });
      rows = await rs.json();
    } catch {
      throw new ApiError('alarms.eval_store_unavailable', 'ClickHouse에 접속할 수 없다');
    }
    const series = new Map<string, AlarmEvalResponseBody['series'][number]>();
    for (const r of rows) {
      const ruleId = Number(r.rule_id);
      const tagId = Number(r.tag_id);
      const k = `${ruleId}:${tagId}`;
      let s = series.get(k);
      if (!s) {
        s = { ruleId, tagId, points: [] };
        series.set(k, s);
      }
      s.points.push([Number(r.ts_ms), Number(r.vmin), Number(r.vmax), Number(r.breaches), Number(r.evals)]);
    }
    const out = [...series.values()];
    return {
      meta: {
        interval,
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        columns: EVAL_COLUMNS,
        pointCount: out.reduce((n, s) => n + s.points.length, 0),
        rule: await this.currentRule(q),
      },
      series: out,
    };
  }

  /**
   * meta.rule — 현재 규칙(과거 구간의 임계값은 audit_log에서 읽는다). ruleId 요청은 그 규칙 · tagId 요청은 그 태그의 규칙이
   * 하나일 때만 그 규칙(여럿이면 한 객체로 고를 수 없어 null). PostgreSQL 불가는 분석을 막지 않는다 — null(#6 실패 목록에 PG가 없다).
   */
  private async currentRule(q: AlarmEvalParams): Promise<AlarmRuleBody | null> {
    try {
      const r =
        q.ruleId !== undefined
          ? await this.pg.pool.query(`${RULE_SELECT} WHERE rule_id = $1`, [q.ruleId])
          : await this.pg.pool.query(`${RULE_SELECT} WHERE tag_id = $1 LIMIT 2`, [q.tagId]);
      return r.rows.length === 1 ? rowToRule(r.rows[0]) : null;
    } catch {
      return null;
    }
  }
}
