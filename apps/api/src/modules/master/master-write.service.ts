// MST 쓰기(S4) — 표면 정본 docs/07_api/04_master.md · 체인 정본 06_pipeline/07_business_crud.md
// 쓰기 하나 = 트랜잭션 하나(변경 + audit_log · 감사 실패는 변경 전체 롤백 — REQ-MST-05 · REQ-WRK-08).
// 무인증 기간(S4~S6)의 감사 행위자는 NULL이다(05_data_stores/01 §인계 판정). 인가(ADMIN)는 S7.
// 체인 ②③은 커밋 뒤 · 응답 전(InvalidationChain) · ④는 응답 뒤. 체인 실패는 요청을 실패시키지 않는다(REQ-MST-10).
// 업무 명령 경로(SW-12 stream)에서는 명령 워커가 이 서비스를 부른다 — 원장 APPLIED 행은 COMMIT 직전 같은 트랜잭션(bizBeforeCommit · 06_pipeline/07 §적용 단계 ⑤).
import {
  type DeviceObjectBody,
  type LineObjectBody,
  type ModbusConfigBody,
  type SiteObjectBody,
  TAG_EDITABLE_FIELDS,
  type TagCreate,
  type TagObjectBody,
  type TagPatch,
  type TagReissue,
  tagShapeIssues,
  type ValidationFieldIssue,
} from '@db-study/shared';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ApiError, validationFailed } from '../../common/http/api-error';
import { Postgres } from '../../common/postgres/postgres.module';
import { BizLedgerConflict, bizBeforeCommit, noteBizTx } from '../biz/biz-ledger';
import { type ChainTargets, InvalidationChain } from './invalidation-chain';
import { rowToTagMeta, TAG_META_SELECT, type TagMeta } from './tag-meta';

type Json = Record<string, unknown>;

/** 제약 위반 → 설계된 실패 · 그 밖(접속 · 타임아웃)은 postgres_unavailable */
function mapPgError(e: unknown, fieldOf: (constraint: string) => string): never {
  if (e instanceof ApiError) throw e;
  const err = e as { code?: string; constraint?: string; message?: string };
  const constraint = err.constraint ?? '';
  if (err.code === '23505')
    throw new ApiError('common.duplicate_key', '같은 코드가 이미 있다', { field: fieldOf(constraint) });
  if (err.code === '23503')
    throw validationFailed([{ path: `body.${fieldOf(constraint)}`, reason: 'reference' }]);
  if (err.code === '23514')
    throw validationFailed([{ path: `body.${fieldOf(constraint)}`, reason: 'range' }]);
  throw new ApiError('common.postgres_unavailable', 'PostgreSQL에 접속할 수 없다');
}

/** 제약 이름 → 요청 필드(PostgreSQL 기본 이름 규칙 {table}_{column}_{suffix}) */
function fieldFromConstraint(constraint: string): string {
  const map: [RegExp, string][] = [
    [/tag_master_tag_code/, 'tagCode'],
    [/tag_master_device_id/, 'deviceId'],
    [/device_device_code/, 'deviceCode'],
    [/device_line_id/, 'lineId'],
    [/production_line_site_id_line_code/, 'lineCode'],
    [/production_line_site_id/, 'siteId'],
    [/site_site_code/, 'siteCode'],
  ];
  return map.find(([re]) => re.test(constraint))?.[1] ?? 'unknown';
}

function immutableIssues(body: Json, fields: readonly string[]): ValidationFieldIssue[] {
  return fields
    .filter((f) => body[f] !== undefined)
    .map((f) => ({ path: `body.${f}`, reason: 'immutable' as const }));
}

const SITE_SELECT = 'SELECT site_id, site_code, site_name, timezone FROM site';
const LINE_SELECT = 'SELECT line_id, site_id, line_code, line_name FROM production_line';
const DEVICE_SELECT =
  'SELECT device_id, line_id, device_code, device_name, vendor, model, is_active FROM device';
const MODBUS_SELECT =
  'SELECT host::text AS host, port, unit_id, timeout_ms, retry_count, max_regs_per_request FROM modbus_config';

export const rowToSite = (r: Json): SiteObjectBody => ({
  siteId: Number(r.site_id),
  siteCode: String(r.site_code),
  siteName: String(r.site_name),
  timezone: String(r.timezone),
});
export const rowToLine = (r: Json): LineObjectBody => ({
  lineId: Number(r.line_id),
  siteId: Number(r.site_id),
  lineCode: String(r.line_code),
  lineName: String(r.line_name),
});
export const rowToDevice = (r: Json): DeviceObjectBody => ({
  deviceId: Number(r.device_id),
  lineId: Number(r.line_id),
  deviceCode: String(r.device_code),
  deviceName: String(r.device_name),
  vendor: r.vendor === null ? null : String(r.vendor),
  model: r.model === null ? null : String(r.model),
  isActive: Boolean(r.is_active),
});
export const rowToModbus = (r: Json): ModbusConfigBody => ({
  host: String(r.host).replace(/\/\d+$/, ''),
  port: Number(r.port),
  unitId: Number(r.unit_id),
  timeoutMs: Number(r.timeout_ms),
  retryCount: Number(r.retry_count),
  maxRegsPerRequest: Number(r.max_regs_per_request),
});
export const tagObject = (m: TagMeta): TagObjectBody => m as TagObjectBody;

@Injectable()
export class MasterWriteService {
  constructor(
    private readonly pg: Postgres,
    private readonly chain: InvalidationChain,
  ) {}

  /** 트랜잭션 — 성공하면 결과와 체인 대상을 돌려준다. 체인은 COMMIT 뒤에만 건다(커밋 전에 지우면 옛 값이 다시 채워진다) */
  private async tx<T>(fn: (c: PoolClient) => Promise<{ result: T; chain?: ChainTargets }>): Promise<T> {
    let client: PoolClient;
    try {
      client = await this.pg.pool.connect();
    } catch {
      throw new ApiError('common.postgres_unavailable', 'PostgreSQL에 접속할 수 없다');
    }
    let out: { result: T; chain?: ChainTargets };
    const t0 = performance.now();
    try {
      await client.query('BEGIN');
      out = await fn(client);
      await bizBeforeCommit(client, out.result);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      noteBizTx(t0);
      if (e instanceof BizLedgerConflict) throw e;
      mapPgError(e, fieldFromConstraint);
    } finally {
      client.release();
    }
    noteBizTx(t0);
    if (out.chain) await this.chain.afterCommit(out.chain);
    return out.result;
  }

  /** 감사 — 무인증 기간 행위자 NULL · 물리 DELETE 없음(INSERT · UPDATE만) */
  private async audit(
    c: PoolClient,
    action: 'INSERT' | 'UPDATE',
    table: string,
    key: string | number,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await c.query(
      `INSERT INTO audit_log (user_id, action, target_table, target_key, before_value, after_value)
       VALUES (NULL, $1, $2, $3, $4, $5)`,
      [action, table, String(key), before === null ? null : JSON.stringify(before), JSON.stringify(after)],
    );
  }

  private async lockTag(c: PoolClient, tagId: number): Promise<TagMeta> {
    const r = await c.query(`${TAG_META_SELECT} WHERE tag_id = $1 FOR UPDATE`, [tagId]);
    if (r.rowCount === 0) throw new ApiError('common.not_found', '태그가 없다');
    return rowToTagMeta(r.rows[0]);
  }

  private async readTag(c: PoolClient, tagId: number): Promise<TagMeta> {
    const r = await c.query(`${TAG_META_SELECT} WHERE tag_id = $1`, [tagId]);
    return rowToTagMeta(r.rows[0]);
  }

  private shapeOrThrow(t: TagMeta | TagCreate): void {
    const issues = tagShapeIssues({
      functionCode: t.functionCode,
      dataType: t.dataType,
      wordOrder: t.wordOrder ?? null,
      rangeMin: t.rangeMin ?? null,
      rangeMax: t.rangeMax ?? null,
    });
    if (issues.length)
      throw validationFailed(issues.map((i) => ({ path: `body.${i.path}`, reason: i.reason })));
  }

  // ── 태그

  /** #4 등록 — 설비가 없으면 400 reference(외래 키) · tag_code 중복 409 */
  async createTag(b: TagCreate): Promise<TagObjectBody> {
    this.shapeOrThrow(b);
    return this.tx(async (c) => {
      const r = await c.query(
        `INSERT INTO tag_master (device_id, tag_code, tag_name, function_code, address, data_type, word_order,
                                 scale, offset_value, unit, deadband, scan_rate_ms, range_min, range_max)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING tag_id`,
        [
          b.deviceId,
          b.tagCode,
          b.tagName,
          b.functionCode,
          b.address,
          b.dataType,
          b.wordOrder,
          b.scale,
          b.offsetValue,
          b.unit,
          b.deadband,
          b.scanRateMs,
          b.rangeMin,
          b.rangeMax,
        ],
      );
      const tag = await this.readTag(c, Number(r.rows[0].tag_id));
      await this.audit(c, 'INSERT', 'tag_master', tag.tagId, null, tag);
      return { result: tagObject(tag), chain: { tagIds: [tag.tagId], reloadDictionary: true } };
    });
  }

  /** #5 수정 — 불변 400 · 스케일이 현재와 다르면 409 · 실제로 바뀐 필드가 없으면 감사 · 체인 없음 */
  async patchTag(tagId: number, b: TagPatch): Promise<TagObjectBody> {
    const imm = immutableIssues(b as Json, ['tagId', 'deviceId', 'isActive']);
    if (imm.length) throw validationFailed(imm);
    return this.tx(async (c) => {
      const cur = await this.lockTag(c, tagId);
      if (
        (b.scale !== undefined && b.scale !== cur.scale) ||
        (b.offsetValue !== undefined && b.offsetValue !== cur.offsetValue)
      )
        throw new ApiError('master.scale_change_forbidden', '변환식이 바뀌면 새 태그를 발급한다', {
          tagId,
          reissue: `/api/v1/tags/${tagId}/reissue`,
        });
      const next: TagMeta = { ...cur };
      const changed: string[] = [];
      for (const f of TAG_EDITABLE_FIELDS) {
        const v = (b as Json)[f];
        if (v !== undefined && v !== (cur as unknown as Json)[f]) {
          (next as unknown as Json)[f] = v;
          changed.push(f);
        }
      }
      this.shapeOrThrow(next);
      if (changed.length === 0) return { result: tagObject(cur) };
      const col: Record<string, string> = {
        tagCode: 'tag_code',
        tagName: 'tag_name',
        unit: 'unit',
        deadband: 'deadband',
        scanRateMs: 'scan_rate_ms',
        rangeMin: 'range_min',
        rangeMax: 'range_max',
        functionCode: 'function_code',
        address: 'address',
        dataType: 'data_type',
        wordOrder: 'word_order',
      };
      const sets = changed.map((f, i) => `${col[f]} = $${i + 2}`).join(', ');
      await c.query(`UPDATE tag_master SET ${sets} WHERE tag_id = $1`, [
        tagId,
        ...changed.map((f) => (next as unknown as Json)[f]),
      ]);
      const after = await this.readTag(c, tagId);
      await this.audit(c, 'UPDATE', 'tag_master', tagId, cur, after);
      return { result: tagObject(after), chain: { tagIds: [tagId], reloadDictionary: true } };
    });
  }

  /** #6 논리 삭제 — 이미 비활성이면 변경 · 감사 · 체인 없이 200 */
  deactivateTag(tagId: number): Promise<TagObjectBody> {
    return this.tx(async (c) => {
      const cur = await this.lockTag(c, tagId);
      if (!cur.isActive) return { result: tagObject(cur) };
      await c.query('UPDATE tag_master SET is_active = false WHERE tag_id = $1', [tagId]);
      const after = await this.readTag(c, tagId);
      await this.audit(c, 'UPDATE', 'tag_master', tagId, cur, after);
      return { result: tagObject(after), chain: { tagIds: [tagId], reloadDictionary: true } };
    });
  }

  /** #7 새 태그 발급 — 한 트랜잭션(발급 · 이전 비활성 · 이력 · 감사 2행) · 원천이 비활성이면 409 */
  reissueTag(
    tagId: number,
    b: TagReissue,
  ): Promise<{ newTag: TagObjectBody; oldTagId: number; historyId: number }> {
    return this.tx(async (c) => {
      const old = await this.lockTag(c, tagId);
      if (!old.isActive)
        throw new ApiError('master.reissue_source_inactive', '이미 대체된 태그에서 발급하지 않는다', {
          tagId,
        });
      const scale = b.scale ?? old.scale;
      const offsetValue = b.offsetValue ?? old.offsetValue;
      if (scale === old.scale && offsetValue === old.offsetValue)
        throw validationFailed([{ path: 'body.scale', reason: 'range' }]);
      const n: TagMeta = {
        ...old,
        tagCode: b.newTagCode,
        tagName: b.tagName ?? old.tagName,
        unit: b.unit ?? old.unit,
        deadband: b.deadband ?? old.deadband,
        scanRateMs: b.scanRateMs ?? old.scanRateMs,
        rangeMin: b.rangeMin !== undefined ? b.rangeMin : old.rangeMin,
        rangeMax: b.rangeMax !== undefined ? b.rangeMax : old.rangeMax,
        functionCode: b.functionCode ?? old.functionCode,
        address: b.address ?? old.address,
        dataType: b.dataType ?? old.dataType,
        wordOrder: b.wordOrder !== undefined ? b.wordOrder : old.wordOrder,
        scale,
        offsetValue,
        isActive: true,
      };
      this.shapeOrThrow(n);
      const r = await c.query(
        `INSERT INTO tag_master (device_id, tag_code, tag_name, function_code, address, data_type, word_order,
                                 scale, offset_value, unit, deadband, scan_rate_ms, range_min, range_max)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING tag_id`,
        [
          n.deviceId,
          n.tagCode,
          n.tagName,
          n.functionCode,
          n.address,
          n.dataType,
          n.wordOrder,
          n.scale,
          n.offsetValue,
          n.unit,
          n.deadband,
          n.scanRateMs,
          n.rangeMin,
          n.rangeMax,
        ],
      );
      const newId = Number(r.rows[0].tag_id);
      await c.query('UPDATE tag_master SET is_active = false WHERE tag_id = $1', [tagId]);
      const h = await c.query(
        `INSERT INTO tag_master_history (old_tag_id, new_tag_id, old_scale, old_offset_value, new_scale, new_offset_value, changed_by, reason)
         VALUES ($1,$2,$3,$4,$5,$6,NULL,$7) RETURNING history_id`,
        [tagId, newId, old.scale, old.offsetValue, scale, offsetValue, b.reason ?? null],
      );
      const newTag = await this.readTag(c, newId);
      const oldAfter = await this.readTag(c, tagId);
      await this.audit(c, 'INSERT', 'tag_master', newId, null, newTag);
      await this.audit(c, 'UPDATE', 'tag_master', tagId, old, oldAfter);
      return {
        result: { newTag: tagObject(newTag), oldTagId: tagId, historyId: Number(h.rows[0].history_id) },
        chain: { tagIds: [newId, tagId], reloadDictionary: true },
      };
    });
  }

  // ── 사이트 · 라인 — Redis 사본 없음(② ③ 없음 · ⑤만) · 감사는 한다

  createSite(b: { siteCode: string; siteName: string }): Promise<SiteObjectBody> {
    return this.tx(async (c) => {
      const r = await c.query(
        `INSERT INTO site (site_code, site_name) VALUES ($1, $2) RETURNING site_id, site_code, site_name, timezone`,
        [b.siteCode, b.siteName],
      );
      const site = rowToSite(r.rows[0]);
      await this.audit(c, 'INSERT', 'site', site.siteId, null, site);
      return { result: site };
    });
  }

  async patchSite(siteId: number, b: Json): Promise<SiteObjectBody> {
    const imm = immutableIssues(b, ['siteId', 'timezone']);
    if (imm.length) throw validationFailed(imm);
    return this.tx(async (c) => {
      const cur = await c.query(`${SITE_SELECT} WHERE site_id = $1 FOR UPDATE`, [siteId]);
      if (cur.rowCount === 0) throw new ApiError('common.not_found', '사이트가 없다');
      const before = rowToSite(cur.rows[0]);
      const next = {
        ...before,
        siteCode: (b.siteCode as string) ?? before.siteCode,
        siteName: (b.siteName as string) ?? before.siteName,
      };
      if (next.siteCode === before.siteCode && next.siteName === before.siteName) return { result: before };
      const r = await c.query(
        `UPDATE site SET site_code = $2, site_name = $3 WHERE site_id = $1 RETURNING site_id, site_code, site_name, timezone`,
        [siteId, next.siteCode, next.siteName],
      );
      const after = rowToSite(r.rows[0]);
      await this.audit(c, 'UPDATE', 'site', siteId, before, after);
      return { result: after };
    });
  }

  createLine(b: { siteId: number; lineCode: string; lineName: string }): Promise<LineObjectBody> {
    return this.tx(async (c) => {
      const r = await c.query(
        `INSERT INTO production_line (site_id, line_code, line_name) VALUES ($1, $2, $3)
         RETURNING line_id, site_id, line_code, line_name`,
        [b.siteId, b.lineCode, b.lineName],
      );
      const line = rowToLine(r.rows[0]);
      await this.audit(c, 'INSERT', 'production_line', line.lineId, null, line);
      return { result: line };
    });
  }

  async patchLine(lineId: number, b: Json): Promise<LineObjectBody> {
    const imm = immutableIssues(b, ['lineId', 'siteId']);
    if (imm.length) throw validationFailed(imm);
    return this.tx(async (c) => {
      const cur = await c.query(`${LINE_SELECT} WHERE line_id = $1 FOR UPDATE`, [lineId]);
      if (cur.rowCount === 0) throw new ApiError('common.not_found', '라인이 없다');
      const before = rowToLine(cur.rows[0]);
      const next = {
        ...before,
        lineCode: (b.lineCode as string) ?? before.lineCode,
        lineName: (b.lineName as string) ?? before.lineName,
      };
      if (next.lineCode === before.lineCode && next.lineName === before.lineName) return { result: before };
      const r = await c.query(
        `UPDATE production_line SET line_code = $2, line_name = $3 WHERE line_id = $1
         RETURNING line_id, site_id, line_code, line_name`,
        [lineId, next.lineCode, next.lineName],
      );
      const after = rowToLine(r.rows[0]);
      await this.audit(c, 'UPDATE', 'production_line', lineId, before, after);
      return { result: after };
    });
  }

  // ── 설비 · 접속 설정 — 체인 ② ③ cache:devlist:{site_id} · 접속 설정은 ③만

  private async siteOfLine(c: PoolClient, lineId: number): Promise<number> {
    const r = await c.query('SELECT site_id FROM production_line WHERE line_id = $1', [lineId]);
    if (r.rowCount === 0) throw validationFailed([{ path: 'body.lineId', reason: 'reference' }]);
    return Number(r.rows[0].site_id);
  }

  /** #14 등록 — 설비와 접속 설정은 1:1 · 한 트랜잭션(둘로 가르면 설정 없는 설비가 커밋된다) */
  createDevice(b: {
    lineId: number;
    deviceCode: string;
    deviceName: string;
    vendor: string | null;
    model: string | null;
    modbusConfig: ModbusConfigBody;
  }): Promise<DeviceObjectBody & { modbusConfig: ModbusConfigBody }> {
    return this.tx(async (c) => {
      const siteId = await this.siteOfLine(c, b.lineId);
      const r = await c.query(
        `INSERT INTO device (line_id, device_code, device_name, vendor, model) VALUES ($1,$2,$3,$4,$5)
         RETURNING device_id, line_id, device_code, device_name, vendor, model, is_active`,
        [b.lineId, b.deviceCode, b.deviceName, b.vendor, b.model],
      );
      const device = rowToDevice(r.rows[0]);
      const m = b.modbusConfig;
      const mr = await c.query(
        `INSERT INTO modbus_config (device_id, host, port, unit_id, timeout_ms, retry_count, max_regs_per_request)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING host::text AS host, port, unit_id, timeout_ms, retry_count, max_regs_per_request`,
        [device.deviceId, m.host, m.port, m.unitId, m.timeoutMs, m.retryCount, m.maxRegsPerRequest],
      );
      const modbusConfig = rowToModbus(mr.rows[0]);
      await this.audit(c, 'INSERT', 'device', device.deviceId, null, device);
      await this.audit(c, 'INSERT', 'modbus_config', device.deviceId, null, modbusConfig);
      return { result: { ...device, modbusConfig }, chain: { deviceSites: [siteId] } };
    });
  }

  /** #15 수정 · 비활성화 · 재활성화(설비는 폴링 여부일 뿐이라 되살릴 수 있다) */
  async patchDevice(deviceId: number, b: Json): Promise<DeviceObjectBody> {
    const imm = immutableIssues(b, ['deviceId', 'lineId']);
    if (imm.length) throw validationFailed(imm);
    return this.tx(async (c) => {
      const cur = await c.query(`${DEVICE_SELECT} WHERE device_id = $1 FOR UPDATE`, [deviceId]);
      if (cur.rowCount === 0) throw new ApiError('common.not_found', '설비가 없다');
      const before = rowToDevice(cur.rows[0]);
      const next: DeviceObjectBody = {
        ...before,
        deviceCode: (b.deviceCode as string | undefined) ?? before.deviceCode,
        deviceName: (b.deviceName as string | undefined) ?? before.deviceName,
        vendor: b.vendor !== undefined ? (b.vendor as string | null) : before.vendor,
        model: b.model !== undefined ? (b.model as string | null) : before.model,
        isActive: (b.isActive as boolean | undefined) ?? before.isActive,
      };
      if (JSON.stringify(next) === JSON.stringify(before)) return { result: before };
      const r = await c.query(
        `UPDATE device SET device_code = $2, device_name = $3, vendor = $4, model = $5, is_active = $6
          WHERE device_id = $1 RETURNING device_id, line_id, device_code, device_name, vendor, model, is_active`,
        [deviceId, next.deviceCode, next.deviceName, next.vendor, next.model, next.isActive],
      );
      const after = rowToDevice(r.rows[0]);
      await this.audit(c, 'UPDATE', 'device', deviceId, before, after);
      const siteId = await this.siteOfLine(c, before.lineId);
      return { result: after, chain: { deviceSites: [siteId] } };
    });
  }

  /** #17 접속 설정 교체 — 지울 사본은 없고 ③만(Collector가 그 설비를 다시 읽는다) */
  putModbusConfig(deviceId: number, m: ModbusConfigBody): Promise<ModbusConfigBody> {
    return this.tx(async (c) => {
      const cur = await c.query(`${MODBUS_SELECT} WHERE device_id = $1 FOR UPDATE`, [deviceId]);
      if (cur.rowCount === 0) throw new ApiError('common.not_found', '설비가 없다');
      const before = rowToModbus(cur.rows[0]);
      if (JSON.stringify(before) === JSON.stringify(m)) return { result: before };
      const r = await c.query(
        `UPDATE modbus_config SET host = $2, port = $3, unit_id = $4, timeout_ms = $5, retry_count = $6,
                max_regs_per_request = $7 WHERE device_id = $1
         RETURNING host::text AS host, port, unit_id, timeout_ms, retry_count, max_regs_per_request`,
        [deviceId, m.host, m.port, m.unitId, m.timeoutMs, m.retryCount, m.maxRegsPerRequest],
      );
      const after = rowToModbus(r.rows[0]);
      await this.audit(c, 'UPDATE', 'modbus_config', deviceId, before, after);
      const site = await c.query(
        'SELECT l.site_id FROM device d JOIN production_line l USING (line_id) WHERE d.device_id = $1',
        [deviceId],
      );
      return { result: after, chain: { signalOnlySites: [Number(site.rows[0].site_id)] } };
    });
  }
}
