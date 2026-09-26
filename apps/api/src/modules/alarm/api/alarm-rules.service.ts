// ALM 규칙 조회(#3) · 등록(#4) · 수정(#5) — 표면 정본 docs/07_api/07_alarms.md §#3 · #4 · #5 · 체인 정본 06_pipeline/07
// 조회는 cache:alarmrules를 읽지 않는다 — 그 키는 판정기용 활성 규칙만 담는다(관리 화면은 비활성 규칙도 본다).
// 쓰기 = 트랜잭션(변경 + audit_log user_id NULL) → 커밋 → ② DEL cache:alarmrules → ③ ch:cacheinv. DELETE 표면 없음(REQ-ALM-01).
// 인가(ENGINEER)는 인증 도입(S7 ②) 뒤다 — 그 전에는 무인증 · 역할 검사 없음(07_api/07 §인증 전 확인 행위자 판정).

import {
  type AlarmRuleBody,
  type AlarmRuleCreate,
  type AlarmRulePatch,
  type ConditionType,
  RULE_EDITABLE_FIELDS,
  RULE_IMMUTABLE_FIELDS,
  ruleShapeIssues,
} from '@db-study/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ApiError, validationFailed } from '../../../common/http/api-error';
import { Postgres } from '../../../common/postgres/postgres.module';
import { FanoutPublisher } from '../../../common/redis/fanout-publisher';
import { ALARM_CACHE, type AlarmCacheOps, countDeleteFailure } from './alarm-cache';
import { audit, inTx, pgDown } from './alarm-tx';

type Row = Record<string, unknown>;

export const RULE_SELECT =
  'SELECT rule_id, tag_id, condition_type, threshold, threshold_low, debounce_ms, severity, enabled FROM alarm_rule';

/** numeric → 수(07_api/01 §수치 직렬화 — 마스터 numeric은 Float64로 표현) */
export function rowToRule(r: Row): AlarmRuleBody {
  return {
    ruleId: Number(r.rule_id),
    tagId: Number(r.tag_id),
    conditionType: String(r.condition_type) as ConditionType,
    threshold: Number(r.threshold),
    thresholdLow: r.threshold_low === null || r.threshold_low === undefined ? null : Number(r.threshold_low),
    debounceMs: Number(r.debounce_ms),
    severity: Number(r.severity),
    enabled: Boolean(r.enabled),
  };
}

const COLUMN: Record<(typeof RULE_EDITABLE_FIELDS)[number], string> = {
  threshold: 'threshold',
  thresholdLow: 'threshold_low',
  debounceMs: 'debounce_ms',
  severity: 'severity',
  enabled: 'enabled',
};

function shapeOrThrow(r: Pick<AlarmRuleBody, 'conditionType' | 'threshold' | 'thresholdLow'>): void {
  const issues = ruleShapeIssues(r);
  if (issues.length)
    throw validationFailed(issues.map((i) => ({ path: `body.${i.path}`, reason: i.reason })));
}

@Injectable()
export class AlarmRulesService {
  constructor(
    private readonly pg: Postgres,
    @Inject(ALARM_CACHE) private readonly cache: AlarmCacheOps,
    private readonly fanout: FanoutPublisher,
  ) {}

  /** #3 — 페이지 없음 · rule_id 오름차순 */
  async list(f: { tagId?: number; enabled?: 'true' | 'false' }): Promise<AlarmRuleBody[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (f.tagId !== undefined) {
      args.push(f.tagId);
      where.push(`tag_id = $${args.length}`);
    }
    if (f.enabled !== undefined) {
      args.push(f.enabled === 'true');
      where.push(`enabled = $${args.length}`);
    }
    try {
      const r = await this.pg.pool.query(
        `${RULE_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY rule_id`,
        args,
      );
      return r.rows.map(rowToRule);
    } catch {
      throw pgDown();
    }
  }

  /** #4 — 형식 → 활성 태그(FOR SHARE로 동시 비활성화를 막는다) → INSERT → 감사 → 커밋 → 체인 ② ③ */
  async create(b: AlarmRuleCreate): Promise<AlarmRuleBody> {
    shapeOrThrow(b);
    return inTx(this.pg, async (c) => {
      await this.requireActiveTag(c, b.tagId);
      const r = await c.query(
        `INSERT INTO alarm_rule (tag_id, condition_type, threshold, threshold_low, debounce_ms, severity, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING rule_id, tag_id, condition_type, threshold, threshold_low, debounce_ms, severity, enabled`,
        [b.tagId, b.conditionType, b.threshold, b.thresholdLow, b.debounceMs, b.severity, b.enabled],
      );
      const rule = rowToRule(r.rows[0] as Row);
      await audit(c, 'INSERT', 'alarm_rule', rule.ruleId, null, rule);
      return { result: rule, afterCommit: () => this.invalidate() };
    });
  }

  /**
   * #5 — 불변 3은 트랜잭션 전에 400 immutable · 없는 규칙 404 · 결합 규칙은 현재 값과 합쳐 판정 ·
   * 결과가 활성(enabled)인데 태그가 비활성이면 400 reference(끄는 수정은 허용 — 규칙을 끄는 수단이 막히면 안 된다) ·
   * 실제로 바뀐 필드가 없으면 감사 · 체인 없이 현재 값(자연 멱등 — 07_api/01 §멱등).
   */
  async patch(ruleId: number, b: AlarmRulePatch): Promise<AlarmRuleBody> {
    const imm = RULE_IMMUTABLE_FIELDS.filter((f) => b[f] !== undefined).map((f) => ({
      path: `body.${f}`,
      reason: 'immutable' as const,
    }));
    if (imm.length) throw validationFailed(imm);
    return inTx(this.pg, async (c) => {
      const cur = await c.query(`${RULE_SELECT} WHERE rule_id = $1 FOR UPDATE`, [ruleId]);
      if (cur.rowCount === 0) throw new ApiError('common.not_found', '알람 규칙이 없다');
      const before = rowToRule(cur.rows[0] as Row);
      const next: AlarmRuleBody = { ...before };
      const changed: (typeof RULE_EDITABLE_FIELDS)[number][] = [];
      for (const f of RULE_EDITABLE_FIELDS) {
        const v = b[f];
        if (v !== undefined && v !== before[f]) {
          (next as unknown as Record<string, unknown>)[f] = v;
          changed.push(f);
        }
      }
      shapeOrThrow(next);
      if (changed.length === 0) return { result: before };
      if (next.enabled) await this.requireActiveTag(c, next.tagId);
      const sets = changed.map((f, i) => `${COLUMN[f]} = $${i + 2}`).join(', ');
      const r = await c.query(
        `UPDATE alarm_rule SET ${sets} WHERE rule_id = $1
         RETURNING rule_id, tag_id, condition_type, threshold, threshold_low, debounce_ms, severity, enabled`,
        [ruleId, ...changed.map((f) => next[f])],
      );
      const after = rowToRule(r.rows[0] as Row);
      await audit(c, 'UPDATE', 'alarm_rule', ruleId, before, after);
      return { result: after, afterCommit: () => this.invalidate() };
    });
  }

  /** 판정기는 대상 태그가 비활성인 규칙을 활성으로 보지 않는다 — 등록되자마자 영원히 판정되지 않는 규칙을 막는다(07_api/07 §#3 · #4 · #5) */
  private async requireActiveTag(c: PoolClient, tagId: number): Promise<void> {
    const t = await c.query('SELECT is_active FROM tag_master WHERE tag_id = $1 FOR SHARE', [tagId]);
    if (t.rowCount === 0 || !(t.rows[0] as Row).is_active)
      throw validationFailed([{ path: 'body.tagId', reason: 'reference' }]);
  }

  /** 체인 ② ③ — 커밋 뒤 · 응답 전. 실패는 요청을 실패시키지 않는다(커밋은 끝났고 진실은 PostgreSQL · TTL 300초가 상한) */
  private async invalidate(): Promise<void> {
    if (!(await this.cache.delAlarmRules())) countDeleteFailure('cache:alarmrules');
    await this.fanout.publishCacheInv(['cache:alarmrules']);
  }
}
