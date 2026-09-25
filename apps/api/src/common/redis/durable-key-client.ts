// DurableKeyClient — 봉인 계열(stream · rt · alarm) 래퍼(ADR-13 · 정본 docs/05_data_stores/05_redis_keyspace.md §봉인 표)
// ① TTL 인자를 받지 않는다 ② TTL 명령(EXPIRE · PEXPIRE · EXPIREAT · SETEX · SET EX/PX · HEXPIRE 계열) · KEYS · FLUSH를 노출하지 않는다
// ③ 실패를 삼키지 않고 그대로 던진다 — stream 쓰기 실패는 스풀 전환(S6)의, rt 읽기 실패는 503의 원천이다.
// rt:latest 쓰기는 필드 조건부 쓰기 스크립트 하나로만 한다 — 새 ts ≥ 저장 ts일 때만 바꾼다(06_pipeline/05 §덮어쓰기 순서 역전).
import { DLQ_FIELDS, DlqEntryMeta, type DlqEntryMetaBody } from '@db-study/shared';
import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnections } from './connections';

const SEALED_PREFIXES = ['stream:', 'rt:', 'alarm:'] as const;

function assertSealed(key: string) {
  if (!SEALED_PREFIXES.some((p) => key.startsWith(p))) {
    throw new Error(`DurableKeyClient는 봉인 계열 키만 다룬다 — ${key}`);
  }
}

/** 컨슈머 그룹 적체 — 판정량 = lag + pending(ADR-21 · 01_metrics §컨슈머 랙 판정) · lag가 비면 null */
export interface GroupBacklog {
  lag: number | null;
  pending: number;
}

/** Stream 엔트리 — 필드 하나(p)에 MessagePack 컬럼 배열(06_pipeline/12 §3단계) */
export const STREAM_PAYLOAD_FIELD = 'p';

export interface StreamRecord {
  id: string;
  payload: Buffer;
}

/** XAUTOCLAIM 한 번 — 다음 시작 ID('0-0'이면 PEL을 끝까지 훑었다) · 인수한 엔트리 · Stream에서 이미 지워져 PEL에서 뺀 ID */
export interface AutoClaimResult {
  next: string;
  records: StreamRecord[];
  deleted: string[];
}

/** DLQ 엔트리 하나 = 실패한 원 엔트리 하나(06_pipeline/12 §DLQ 엔트리) */
export interface DlqItem extends DlqEntryMetaBody {
  payload: Buffer;
}

function recordsOf(entries: [Buffer, Buffer[] | null][]): StreamRecord[] {
  const out: StreamRecord[] = [];
  for (const [id, fields] of entries) {
    if (!fields) continue; // Redis 7 전에는 지워진 엔트리가 필드 없이 온다
    let payload: Buffer | null = null;
    for (let i = 0; i + 1 < fields.length; i += 2) {
      if (fields[i]?.toString() === STREAM_PAYLOAD_FIELD) payload = fields[i + 1] as Buffer;
    }
    // p가 없는 엔트리는 빈 페이로드로 넘긴다 — 디코딩이 해독 불가로 격리 · XACK한다(06_pipeline/12 · 검수 I3).
    // 건너뛰면 DLQ · XACK 없이 PEL에 남아 회수마다 다시 버려지고 pending이 0으로 돌아오지 않는다.
    out.push({ id: id.toString(), payload: payload ?? Buffer.alloc(0) });
  }
  return out;
}

/** [tagId, ts(epoch ms), value, quality] */
export type LatestTuple = [number, number, number, number];

/**
 * 필드 조건부 쓰기 — ARGV = tagId, ts, value, quality 반복 · 받아들인 필드만 돌려준다(그것만 ch:rt로 발행한다).
 * 값 모양 "ts,value,quality"(ts는 epoch ms 10진 · value는 10진 문자열) — 05_data_stores/05 §봉인 계열 키.
 */
const CONDITIONAL_WRITE = `
local accepted = {}
for i = 1, #ARGV, 4 do
  local tag = ARGV[i]
  local ts = tonumber(ARGV[i + 1])
  local cur = redis.call('HGET', KEYS[1], tag)
  local ok = true
  if cur then
    local sep = string.find(cur, ',', 1, true)
    local curTs = tonumber(string.sub(cur, 1, sep - 1))
    ok = ts >= curTs
  end
  if ok then
    redis.call('HSET', KEYS[1], tag, ARGV[i + 1] .. ',' .. ARGV[i + 2] .. ',' .. ARGV[i + 3])
    table.insert(accepted, tag)
    table.insert(accepted, ARGV[i + 1])
    table.insert(accepted, ARGV[i + 2])
    table.insert(accepted, ARGV[i + 3])
  end
end
return accepted
`;

function parseXinfoGroups(reply: unknown, group: string): GroupBacklog | null {
  if (!Array.isArray(reply)) return null;
  for (const g of reply as unknown[][]) {
    const m = new Map<string, unknown>();
    for (let i = 0; i + 1 < g.length; i += 2) m.set(String(g[i]), g[i + 1]);
    if (m.get('name') !== group) continue;
    const lag = m.get('lag');
    return {
      lag: lag === null || lag === undefined ? null : Number(lag),
      pending: Number(m.get('pending') ?? 0),
    };
  }
  return null;
}

@Injectable()
export class DurableKeyClient {
  private readonly redis: Redis;

  constructor(conns: RedisConnections) {
    this.redis = conns.command;
    this.redis.defineCommand('rtConditionalWrite', { numberOfKeys: 1, lua: CONDITIONAL_WRITE });
  }

  /**
   * 발행 파이프라인 1회 = XADD MAXLEN ~ + XINFO GROUPS(06_pipeline/02 §발행 · 적체 조회 · 스풀 진입).
   * MAXLEN은 필수 인자다 — 빠진 XADD는 Stream이 maxmemory까지 자란다. 적체는 이번 XADD 뒤의 값이다.
   */
  async xaddWithBacklog(
    stream: string,
    payload: Buffer,
    maxlen: number,
    group: string,
  ): Promise<{ id: string; backlog: GroupBacklog | null }> {
    assertSealed(stream);
    const res = await this.redis
      .pipeline()
      .xadd(stream, 'MAXLEN', '~', maxlen, '*', STREAM_PAYLOAD_FIELD, payload)
      .xinfo('GROUPS', stream)
      .exec();
    if (!res) throw new Error('파이프라인 응답 없음');
    const [xadd, xinfo] = res;
    if (xadd?.[0]) throw xadd[0];
    // 그룹이 아직 없으면(Ingest 기동 전) XINFO가 실패한다 — 발행은 성공이고 적체는 모른다
    const backlog = xinfo && !xinfo[0] ? parseXinfoGroups(xinfo[1], group) : null;
    return { id: String(xadd?.[1]), backlog };
  }

  /**
   * 묶음 XADD — 파이프라인 1회 = XADD × n + XINFO GROUPS 1(모드 B 발행 · 엔트리마다 XINFO를 붙이면 명령 수가 두 배).
   * 결과는 엔트리별 ID 또는 오류 — 한 엔트리 실패(OOM 등)가 나머지의 성공을 지우지 않는다.
   */
  async xaddBatchWithBacklog(
    stream: string,
    payloads: readonly Buffer[],
    maxlen: number,
    group: string,
  ): Promise<{ results: (string | Error)[]; backlog: GroupBacklog | null }> {
    assertSealed(stream);
    const pipe = this.redis.pipeline();
    for (const p of payloads) pipe.xadd(stream, 'MAXLEN', '~', maxlen, '*', STREAM_PAYLOAD_FIELD, p);
    pipe.xinfo('GROUPS', stream);
    const res = await pipe.exec();
    if (!res) throw new Error('파이프라인 응답 없음');
    const results = res.slice(0, payloads.length).map(([err, id]) => (err ? err : String(id)));
    const xinfo = res[payloads.length];
    const backlog = xinfo && !xinfo[0] ? parseXinfoGroups(xinfo[1], group) : null;
    return { results, backlog };
  }

  /** 컨슈머 그룹 보장 — 이미 있으면 그대로(ING-01 기동 · MKSTREAM) */
  async ensureGroup(stream: string, group: string): Promise<void> {
    assertSealed(stream);
    try {
      await this.redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
    } catch (e) {
      if (!(e instanceof Error) || !e.message.includes('BUSYGROUP')) throw e;
    }
  }

  async groupBacklog(stream: string, group: string): Promise<GroupBacklog | null> {
    assertSealed(stream);
    return parseXinfoGroups(await this.redis.xinfo('GROUPS', stream), group);
  }

  /** XREADGROUP — 블로킹 전용 연결로만 부른다(명령 연결을 막지 않는다) */
  async readGroup(
    blocking: Redis,
    stream: string,
    group: string,
    consumer: string,
    count: number,
    blockMs: number,
    /** '>' 새 엔트리 · '0'이나 엔트리 ID는 이 컨슈머의 PEL(그 ID 뒤) — PEL 읽기에서 BLOCK은 무시된다 */
    fromId = '>',
  ): Promise<StreamRecord[]> {
    assertSealed(stream);
    // 페이로드는 이진(MessagePack)이라 Buffer 응답으로 받는다
    const reply = (await blocking.callBuffer(
      'XREADGROUP',
      'GROUP',
      group,
      consumer,
      'COUNT',
      String(count),
      'BLOCK',
      String(blockMs),
      'STREAMS',
      stream,
      fromId,
    )) as [Buffer, [Buffer, Buffer[]][]][] | null;
    if (!reply) return [];
    return reply.flatMap(([, entries]) => recordsOf(entries));
  }

  /**
   * XAUTOCLAIM — idle 기준을 넘긴 PEL을 consumer 앞으로 인수한다(ING-06 · 06_pipeline/03 §회수).
   * 명령 연결로 부른다(블로킹이 아니다). 페이로드가 이진이라 Buffer 응답으로 받는다.
   */
  async autoClaim(
    stream: string,
    group: string,
    consumer: string,
    minIdleMs: number,
    start: string,
    count: number,
  ): Promise<AutoClaimResult> {
    assertSealed(stream);
    const reply = (await this.redis.callBuffer(
      'XAUTOCLAIM',
      stream,
      group,
      consumer,
      String(minIdleMs),
      start,
      'COUNT',
      String(count),
    )) as [Buffer, [Buffer, Buffer[] | null][], Buffer[]?];
    const [next, entries, deleted] = reply;
    return {
      next: next.toString(),
      records: recordsOf(entries ?? []),
      deleted: (deleted ?? []).map((d) => d.toString()),
    };
  }

  /**
   * DLQ 격리 — 원 엔트리마다 XADD MAXLEN ~ 한 번(파이프라인 1회). 필드는 DLQ_FIELDS(원 본문 p · 원 ID · 사유 · 원 배치 토큰).
   * 토큰은 재시도 소진 사유만 싣는다 — 해독 불가는 필드를 두지 않는다. 계약(DlqEntryMeta)과 어긋나면 쓰지 않고 던진다.
   * 하나라도 실패하면 던진다 — 호출자는 XACK하지 않는다(PEL에 남아 회수가 다시 시도한다).
   */
  async appendDlq(stream: string, items: readonly DlqItem[], maxlen: number): Promise<void> {
    assertSealed(stream);
    if (items.length === 0) return;
    const p = this.redis.pipeline();
    for (const it of items) {
      const meta = DlqEntryMeta.parse({
        originId: it.originId,
        reason: it.reason,
        batchToken: it.batchToken,
      });
      const fields: (string | Buffer)[] = [
        DLQ_FIELDS.payload,
        it.payload,
        DLQ_FIELDS.originId,
        meta.originId,
        DLQ_FIELDS.reason,
        meta.reason,
      ];
      if (meta.batchToken) fields.push(DLQ_FIELDS.batchToken, meta.batchToken);
      p.xadd(stream, 'MAXLEN', '~', maxlen, '*', ...fields);
    }
    const res = await p.exec();
    if (!res) throw new Error('파이프라인 응답 없음');
    for (const [err] of res) if (err) throw err;
  }

  async ack(stream: string, group: string, ids: string[]): Promise<number> {
    assertSealed(stream);
    if (ids.length === 0) return 0;
    return this.redis.xack(stream, group, ...ids);
  }

  /** rt:latest:{device_id} 조건부 쓰기 — 받아들인 튜플만 돌려준다 */
  async writeLatestIfNewer(deviceId: number, tuples: LatestTuple[]): Promise<LatestTuple[]> {
    if (tuples.length === 0) return [];
    const key = `rt:latest:${deviceId}`;
    const argv = tuples.flatMap(([tag, ts, value, q]) => [String(tag), String(ts), String(value), String(q)]);
    const r = (await (
      this.redis as unknown as { rtConditionalWrite(k: string, ...a: string[]): Promise<string[]> }
    ).rtConditionalWrite(key, ...argv)) as string[];
    const accepted: LatestTuple[] = [];
    for (let i = 0; i + 3 < r.length; i += 4) {
      accepted.push([Number(r[i]), Number(r[i + 1]), Number(r[i + 2]), Number(r[i + 3])]);
    }
    return accepted;
  }

  /** 설비 전체 최신값 — HGETALL 1회(RLT-01). 접속 불가는 던진다 — 호출자가 503으로 옮긴다 */
  async readLatest(deviceId: number): Promise<Record<string, string>> {
    return this.redis.hgetall(`rt:latest:${deviceId}`);
  }
}

/** "ts,value,quality" 해석 — 형식이 깨진 필드는 null */
export function parseLatestValue(raw: string): { ts: number; value: number; quality: number } | null {
  const [ts, value, quality] = raw.split(',');
  const r = { ts: Number(ts), value: Number(value), quality: Number(quality) };
  return Number.isFinite(r.ts) && Number.isFinite(r.value) && Number.isInteger(r.quality) ? r : null;
}
