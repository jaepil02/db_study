// ALM 이벤트 목록(#1) · 확인(#2) — 표면 정본 docs/07_api/07_alarms.md · 캐시 정본 05_data_stores/05 cache:alarmevents
// 생애 축(state)과 확인 축(acked_at)은 다른 필드다 — 필터도 따로 받는다(W1 판정). ACKED는 저장 값이 아니다.
// 확인은 alarm:state를 쓰지 않고 ch:alarm에 싣지 않는다(REQ-ALM-16 · W6 판정 — 전파 신호 없음) · ch:cacheinv도 없다(06_pipeline/07 §도메인별 체인 적용).
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { AlarmEventBody, AlarmEventListParams, ConditionType } from '@db-study/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { Counter } from 'prom-client';
import { ApiError, validationFailed } from '../../../common/http/api-error';
import { appRegistry } from '../../../common/metrics/registry';
import { Postgres } from '../../../common/postgres/postgres.module';
import { ACK_ACTOR_RESOLVER, type AckActorResolver } from './ack-actor';
import { ALARM_CACHE, ALARM_EVENTS_TTL_SECONDS, type AlarmCacheOps, countDeleteFailure } from './alarm-cache';
import { audit, inTx, pgDown } from './alarm-tx';

/** alm_acks_total{result} — ACK 신호 부재 계측의 분모(10_observability/01 · 02 §확인 신호 부재의 계측) · 0으로 초기화(S5 관례) */
export const almAcks = new Counter({
  name: 'alm_acks_total',
  help: '확인(ACK) 요청 결과',
  labelNames: ['result'],
  registers: [appRegistry],
});
almAcks.inc({ result: 'accepted' }, 0);
almAcks.inc({ result: 'rejected' }, 0);

/**
 * 이력 기본 범위 7일(2계층 현행 참고 · 소유 07_api/07) · 열린 · 미확인 필터의 기본 시작 = 보존 창 시작.
 * 보존 창 = pg_partman retention 2년(04_alarm.sql · 08_retention_lifecycle #9)이 남기는 가장 오래된 월 파티션의 시작 —
 * DB 기본 timezone이 Asia/Seoul이라 date_trunc('month')가 파티션 경계(Asia/Seoul 월 1일)와 같다.
 */
const HISTORY_DEFAULT_RANGE = "interval '7 days'";
const RETENTION_START = "date_trunc('month', now() - interval '2 years')";

/** 이벤트 객체 조회 — 규칙 · 태그 조인(tagIsActive false = 판정이 멈춘 열린 알람) · 커서용 UTC µs 문자열 */
const EVENT_SELECT = `SELECT e.event_id, e.rule_id, r.tag_id, t.tag_code, t.tag_name, t.is_active AS tag_is_active,
       r.condition_type, r.severity, e.occurred_at, e.cleared_at, e.trigger_value, e.state, e.acked_by, e.acked_at,
       to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_cursor
  FROM alarm_event e
  JOIN alarm_rule r ON r.rule_id = e.rule_id
  JOIN tag_master t ON t.tag_id = r.tag_id`;

type Row = Record<string, unknown>;
const iso = (v: unknown) =>
  v === null || v === undefined ? null : new Date(v as string | Date).toISOString();

export function rowToEvent(r: Row): AlarmEventBody {
  return {
    eventId: Number(r.event_id),
    ruleId: Number(r.rule_id),
    tagId: Number(r.tag_id),
    tagCode: String(r.tag_code),
    tagName: String(r.tag_name),
    tagIsActive: Boolean(r.tag_is_active),
    conditionType: String(r.condition_type) as ConditionType,
    severity: Number(r.severity),
    occurredAt: iso(r.occurred_at) as string,
    clearedAt: iso(r.cleared_at),
    triggerValue: Number(r.trigger_value),
    state: String(r.state) as AlarmEventBody['state'],
    ackedBy: r.acked_by === null || r.acked_by === undefined ? null : Number(r.acked_by),
    ackedAt: iso(r.acked_at),
  };
}

/** 감사 행 모양 — alarm_event 컬럼(camelCase) · before는 조건부 갱신이 보장한 확인 전 값(acked 두 칸 null) */
function eventAuditImage(r: Row) {
  return {
    eventId: Number(r.event_id),
    ruleId: Number(r.rule_id),
    occurredAt: iso(r.occurred_at),
    clearedAt: iso(r.cleared_at),
    triggerValue: Number(r.trigger_value),
    state: String(r.state),
    ackedBy: r.acked_by === null ? null : Number(r.acked_by),
    ackedAt: iso(r.acked_at),
  };
}

// ── 커서 — 마지막 행의 정렬 키(occurred_at µs · event_id)를 담은 불투명 문자열(07_api/01 §페이지네이션)

export function encodeCursor(occurredCursor: string, eventId: number): string {
  return Buffer.from(JSON.stringify([occurredCursor, eventId])).toString('base64url');
}

export function decodeCursor(s: string): { at: string; id: number } {
  try {
    const v = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as unknown;
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(v[0]) &&
      Number.isSafeInteger(v[1]) &&
      v[1] > 0
    )
      return { at: v[0], id: v[1] };
  } catch {
    // 아래 400
  }
  throw validationFailed([{ path: 'query.cursor', reason: 'format' }]);
}

/** 기본 범위 갈래 — state=ACTIVE 또는 acked=false 포함이면 보존 창 전체(07_api/07 §알람 목록 범위 기본값 판정) */
export function isOpenFilter(q: Pick<AlarmEventListParams, 'state' | 'acked'>): boolean {
  return q.state === 'ACTIVE' || q.acked === 'false';
}

/**
 * 정규화 목록 쿼리 SHA-1 — Hash 필드. 생략한 from · to는 "생략"으로 남긴다(해석한 now를 넣으면 요청마다 필드가 달라 캐시가 무의미하다).
 * 시각은 epoch ms로 — 같은 순간의 다른 오프셋 표기가 한 필드가 된다.
 */
export function eventsCacheField(q: AlarmEventListParams): string {
  const norm = {
    s: q.state ?? null,
    a: q.acked ?? null,
    f: q.from === undefined ? null : Date.parse(q.from),
    t: q.to === undefined ? null : Date.parse(q.to),
    r: q.ruleId ?? null,
    g: q.tagId ?? null,
    v: q.severity ?? null,
    l: q.limit,
    c: q.cursor ?? null,
  };
  return createHash('sha1').update(JSON.stringify(norm)).digest('hex');
}

/** #1 SQL — 범위 조건은 항상 실린다(REQ-ALM-13 · 월 파티션 가지치기) · 정렬 occurred_at DESC · event_id DESC 고정 */
export function buildListSql(q: AlarmEventListParams): { sql: string; args: unknown[] } {
  const args: unknown[] = [q.from ?? null, q.to ?? null];
  const toExpr = 'COALESCE($2::timestamptz, now())';
  const fromDefault = isOpenFilter(q) ? RETENTION_START : `${toExpr} - ${HISTORY_DEFAULT_RANGE}`;
  const where = [`e.occurred_at >= COALESCE($1::timestamptz, ${fromDefault})`, `e.occurred_at < ${toExpr}`];
  const add = (cond: (n: number) => string, v: unknown) => {
    args.push(v);
    where.push(cond(args.length));
  };
  if (q.state) add((n) => `e.state = $${n}`, q.state);
  if (q.acked === 'true') where.push('e.acked_at IS NOT NULL');
  if (q.acked === 'false') where.push('e.acked_at IS NULL');
  if (q.ruleId !== undefined) add((n) => `e.rule_id = $${n}`, q.ruleId);
  if (q.tagId !== undefined) add((n) => `r.tag_id = $${n}`, q.tagId);
  if (q.severity !== undefined) add((n) => `r.severity = $${n}`, q.severity);
  if (q.cursor !== undefined) {
    const c = decodeCursor(q.cursor);
    args.push(c.at, c.id);
    where.push(`(e.occurred_at, e.event_id) < ($${args.length - 1}::timestamptz, $${args.length}::bigint)`);
  }
  args.push(q.limit + 1);
  return {
    sql: `${EVENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY e.occurred_at DESC, e.event_id DESC LIMIT $${args.length}`,
    args,
  };
}

export interface AlarmEventPage {
  items: AlarmEventBody[];
  meta: { nextCursor: string | null; limit: number };
}

@Injectable()
export class AlarmEventsService {
  constructor(
    private readonly pg: Postgres,
    @Inject(ALARM_CACHE) private readonly cache: AlarmCacheOps,
    @Inject(ACK_ACTOR_RESOLVER) private readonly actor: AckActorResolver,
  ) {}

  /** #1 — 사본 우선 · 미스는 PostgreSQL에서 읽고 필드를 채운다(첫 채움 기준 EXPIRE NX). 캐시 실패는 미스와 같다(degrade) */
  async list(q: AlarmEventListParams): Promise<AlarmEventPage> {
    const { sql, args } = buildListSql(q); // 커서 형식 400은 캐시보다 먼저
    const field = eventsCacheField(q);
    const hit = await this.cache.getAlarmEventsPage(field);
    if (hit) {
      try {
        return JSON.parse(gunzipSync(hit).toString('utf8')) as AlarmEventPage;
      } catch {
        // 깨진 사본은 미스로 다룬다
      }
    }
    let rows: Row[];
    try {
      rows = (await this.pg.pool.query(sql, args)).rows as Row[];
    } catch {
      throw pgDown();
    }
    const more = rows.length > q.limit;
    const page = more ? rows.slice(0, q.limit) : rows;
    const last = page[page.length - 1];
    const body: AlarmEventPage = {
      items: page.map(rowToEvent),
      meta: {
        nextCursor: more && last ? encodeCursor(String(last.occurred_cursor), Number(last.event_id)) : null,
        limit: q.limit,
      },
    };
    await this.cache.setAlarmEventsPage(field, gzipSync(JSON.stringify(body)), ALARM_EVENTS_TTL_SECONDS);
    return body;
  }

  /**
   * #2 — 한 트랜잭션: ① 행위자 해석(첫 문장) ② 조건부 갱신 1회 … RETURNING(0행이면 존재 여부로 404 · 409)
   * ③ audit_log(user_id NULL · UPDATE · before · after) → 커밋 → cache:alarmevents 키 하나 DEL.
   * 조건부 갱신이라 해제 확정과 경합해도 CLEARED 행에 확인이 붙지 않고, 두 번째 확인은 409다(REQ-ALM-14).
   */
  async ack(eventId: number): Promise<AlarmEventBody> {
    try {
      const out = await inTx(this.pg, async (c) => {
        const userId = await this.actor.resolve(c);
        const upd = await c.query(
          `UPDATE alarm_event SET acked_by = $1, acked_at = now()
            WHERE event_id = $2 AND state = 'ACTIVE' AND acked_at IS NULL
           RETURNING event_id, rule_id, occurred_at, cleared_at, trigger_value, state, acked_by, acked_at`,
          [userId, eventId],
        );
        const after = upd.rows[0] as Row | undefined;
        if (!after) await this.rejectAck(c, eventId);
        const a = after as Row;
        const image = eventAuditImage(a);
        await audit(c, 'UPDATE', 'alarm_event', eventId, { ...image, ackedBy: null, ackedAt: null }, image);
        const full = await c.query(`${EVENT_SELECT} WHERE e.event_id = $1 AND e.occurred_at = $2`, [
          eventId,
          a.occurred_at,
        ]);
        return {
          result: rowToEvent(full.rows[0] as Row),
          afterCommit: async () => {
            if (!(await this.cache.delAlarmEvents())) countDeleteFailure('cache:alarmevents');
          },
        };
      });
      almAcks.inc({ result: 'accepted' });
      return out;
    } catch (e) {
      almAcks.inc({ result: 'rejected' });
      throw e;
    }
  }

  /** 0행의 두 갈래 — 없는 id 404 · CLEARED 또는 이미 확인된 행 409(CLEARING 중인 열린 행은 여기 오지 않는다) */
  private async rejectAck(c: PoolClient, eventId: number): Promise<never> {
    const r = await c.query('SELECT 1 FROM alarm_event WHERE event_id = $1', [eventId]);
    if ((r.rowCount ?? 0) === 0) throw new ApiError('common.not_found', '알람 이벤트가 없다');
    throw new ApiError('alarms.ack_not_allowed', '해제됐거나 이미 확인된 알람이다');
  }
}
