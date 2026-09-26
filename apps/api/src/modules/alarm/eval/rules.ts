// A1 규칙 조회 — 기전 정본 docs/06_pipeline/08_alarm.md §규칙과 상태의 조회 · §비활성 태그 규칙
// 원천: cache:alarmrules(String · 활성 규칙 전체 JSON · TTL 현행 참고 300초 ±20% · 쓰기 주체는 판정기 하나) — 미스면 PostgreSQL로 채운다.
// Redis 실패 → PostgreSQL 직행(캐시 계열 degrade · 채우지 않는다) · PostgreSQL도 불가 → null(그 배치를 판정하지 않는다 · 행은 이미 적재됐다).
// 활성 = enabled ∧ 태그 is_active. JSON 모양은 판정기 내부 사항이다(API는 DEL만 한다 · .omc/s7a-interfaces.md §규칙 원천).
import type { Pool } from 'pg';
import { queryBounded } from './pg-bounded';

export type ConditionType = 'GT' | 'LT' | 'OUT_OF_RANGE' | 'RATE_OF_CHANGE';

export interface AlarmRule {
  ruleId: number;
  tagId: number;
  conditionType: ConditionType;
  threshold: number;
  /** OUT_OF_RANGE만 값이 있다(결합 CHECK) */
  thresholdLow: number | null;
  debounceMs: number;
  severity: number;
  /** RATE_OF_CHANGE 결측 한도 = scan_rate_ms × STALE 배수(06_pipeline/08 §RATE_OF_CHANGE 경계) */
  scanRateMs: number;
}

/**
 * cache:alarmrules 접근 — 캐시 계열 래퍼의 용도 메서드(getAlarmRules · setAlarmRules · TTL 300초 ±20%는 래퍼가 건다)로 잇는다.
 * failed = degrade(타임아웃 · 오류)로 미스가 된 경우 — 그때는 PostgreSQL 직행이고 채우기를 시도하지 않는다.
 */
export interface AlarmRuleCachePort {
  get(): Promise<{ value: string | null; failed: boolean }>;
  set(json: string): Promise<void>;
}

/** 규칙 원천 — PostgreSQL alarm_rule JOIN tag_master(enabled AND is_active) · 던지면 PostgreSQL 불가 */
export interface AlarmRuleDbPort {
  loadActive(): Promise<AlarmRule[]>;
}

export const ACTIVE_RULES_SQL = `
SELECT r.rule_id, r.tag_id, r.condition_type, r.threshold::float8 AS threshold,
       r.threshold_low::float8 AS threshold_low, r.debounce_ms, r.severity, t.scan_rate_ms
  FROM alarm_rule r
  JOIN tag_master t ON t.tag_id = r.tag_id
 WHERE r.enabled AND t.is_active
 ORDER BY r.rule_id`;

export class PostgresAlarmRuleDb implements AlarmRuleDbPort {
  constructor(private readonly pool: Pool) {}
  async loadActive(): Promise<AlarmRule[]> {
    const r = await queryBounded<{
      rule_id: number;
      tag_id: number;
      condition_type: ConditionType;
      threshold: number;
      threshold_low: number | null;
      debounce_ms: number;
      severity: number;
      scan_rate_ms: number;
    }>(this.pool, ACTIVE_RULES_SQL);
    return r.rows.map((x) => ({
      ruleId: Number(x.rule_id),
      tagId: Number(x.tag_id),
      conditionType: x.condition_type,
      threshold: Number(x.threshold),
      thresholdLow: x.threshold_low === null ? null : Number(x.threshold_low),
      debounceMs: Number(x.debounce_ms),
      severity: Number(x.severity),
      scanRateMs: Number(x.scan_rate_ms),
    }));
  }
}

/** 캐시 JSON 해석 — 모양이 깨졌으면 null(미스로 다룬다 · PostgreSQL에서 다시 채운다) */
export function parseRules(json: string): AlarmRule[] | null {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return null;
    for (const r of v as Partial<AlarmRule>[]) {
      if (
        typeof r?.ruleId !== 'number' ||
        typeof r.tagId !== 'number' ||
        typeof r.threshold !== 'number' ||
        typeof r.debounceMs !== 'number' ||
        typeof r.scanRateMs !== 'number'
      )
        return null;
    }
    return v as AlarmRule[];
  } catch {
    return null;
  }
}

export type RuleSourceOutcome = 'hit' | 'miss' | 'cache_failed' | 'db_failed';

export class AlarmRuleSource {
  constructor(
    private readonly cache: AlarmRuleCachePort,
    private readonly db: AlarmRuleDbPort,
    private readonly log: { warn(msg: string): void },
  ) {}

  /** 배치 시작마다 1회 — null이면 그 배치를 판정하지 않는다 */
  async load(): Promise<{ rules: AlarmRule[] | null; outcome: RuleSourceOutcome }> {
    const c = await this.cache.get();
    if (c.value !== null) {
      const rules = parseRules(c.value);
      if (rules) return { rules, outcome: 'hit' };
    }
    let rules: AlarmRule[];
    try {
      rules = await this.db.loadActive();
    } catch (e) {
      this.log.warn(`규칙 조회 실패(PostgreSQL) — ${(e as Error).message} · 이 배치는 판정하지 않는다`);
      return { rules: null, outcome: 'db_failed' };
    }
    // Redis가 실패했으면 채우지 않는다(PostgreSQL 직행) — 미스일 때만 채운다
    if (c.failed) return { rules, outcome: 'cache_failed' };
    await this.cache.set(JSON.stringify(rules));
    return { rules, outcome: 'miss' };
  }
}
