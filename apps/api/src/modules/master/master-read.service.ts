// MST 조회 — 표면 정본 docs/07_api/04_master.md(#1 · 2 · 3 · 8 · 11 · 16) · MST-07 태그 메타 사본(cache:tagmeta:{tag_id})
// 사이트 · 라인 · 태그 목록은 Redis 사본을 두지 않는다(W5 판정 — BFF가 유일한 목록 사본) · 설비 목록만 cache:devlist:{site_id}.
// 캐시 계열이라 축출될 수 있다 — 미스면 PostgreSQL에서 채운다(degrade). 사본은 해석이지 값이 아니다(06_pipeline/05 §메타 부착 판정).

import type {
  DeviceObjectBody,
  LineObjectBody,
  ModbusConfigBody,
  SiteObjectBody,
  TagObjectBody,
} from '@db-study/shared';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error';
import { Postgres } from '../../common/postgres/postgres.module';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { rowToDevice, rowToLine, rowToModbus, rowToSite } from './master-write.service';
import {
  hashToTagMeta,
  rowToTagMeta,
  TAG_META_SELECT,
  TAGMETA_TTL_SECONDS,
  type TagMeta,
  tagMetaToHash,
} from './tag-meta';

/** cache:devlist:{site_id} TTL — 현행 참고 600초(05_data_stores/05 §TTL 조회 계약) */
export const DEVLIST_TTL_SECONDS = 600;
const PG_DOWN = () => new ApiError('common.postgres_unavailable', 'PostgreSQL에 접속할 수 없다');

@Injectable()
export class MasterReadService {
  constructor(
    private readonly pg: Postgres,
    private readonly cache: CacheKeyClient,
  ) {}

  /** 설비가 마스터에 있는가 — 최신값 404의 기준(REQ-RLT-07). PostgreSQL 불가는 common.postgres_unavailable */
  async deviceExists(deviceId: number): Promise<boolean> {
    try {
      const r = await this.pg.pool.query('SELECT 1 FROM device WHERE device_id = $1', [deviceId]);
      return (r.rowCount ?? 0) > 0;
    } catch {
      throw new ApiError('common.postgres_unavailable', 'PostgreSQL에 접속할 수 없다');
    }
  }

  /** 설비의 태그 메타(활성 · 비활성 전부) — PostgreSQL 원천 */
  async tagsOfDevice(deviceId: number): Promise<TagMeta[]> {
    const r = await this.pg.pool.query(`${TAG_META_SELECT} WHERE device_id = $1 ORDER BY address, tag_id`, [
      deviceId,
    ]);
    return r.rows.map(rowToTagMeta);
  }

  /**
   * 태그 메타 여럿 — 사본 우선 · 미스는 PostgreSQL에서 채우고 워밍한다.
   * PostgreSQL까지 불가면 그 태그는 null(메타 비움 — 호출자가 metaMissing으로 센다)
   */
  async tagMeta(tagIds: number[]): Promise<Map<number, TagMeta | null>> {
    const out = new Map<number, TagMeta | null>();
    const cached = await this.cache.getTagMetaMany(tagIds);
    const missing: number[] = [];
    tagIds.forEach((id, i) => {
      const h = cached[i];
      if (h) out.set(id, hashToTagMeta(id, h));
      else missing.push(id);
    });
    if (missing.length === 0) return out;
    try {
      const r = await this.pg.pool.query(`${TAG_META_SELECT} WHERE tag_id = ANY($1::int[])`, [missing]);
      const found = new Map(r.rows.map((row) => [Number(row.tag_id), rowToTagMeta(row)]));
      for (const id of missing) {
        const m = found.get(id) ?? null;
        out.set(id, m);
        if (m) await this.warm(m);
      }
    } catch {
      for (const id of missing) out.set(id, null);
    }
    return out;
  }

  /**
   * 태그 하나 해석(#2 단일 태그) — 사본 우선 · 미스면 PostgreSQL. 마스터에 없으면 null.
   * tagMeta()와 달리 PostgreSQL 불가를 null로 덮지 않는다 — 값의 자리를 모르면 503이다(07_api/06 §메타 비움과 해석 실패)
   */
  async resolveTag(tagId: number): Promise<TagMeta | null> {
    const [h] = await this.cache.getTagMetaMany([tagId]);
    if (h) return hashToTagMeta(tagId, h);
    let rows: Record<string, unknown>[];
    try {
      rows = (await this.pg.pool.query(`${TAG_META_SELECT} WHERE tag_id = $1`, [tagId])).rows;
    } catch {
      throw PG_DOWN();
    }
    const m = rows[0] ? rowToTagMeta(rows[0]) : null;
    if (m) await this.warm(m);
    return m;
  }

  private async q<T>(sql: string, args: unknown[], map: (r: Record<string, unknown>) => T): Promise<T[]> {
    try {
      return (await this.pg.pool.query(sql, args)).rows.map(map);
    } catch {
      throw PG_DOWN();
    }
  }

  /** #1 사이트 목록 */
  listSites(): Promise<SiteObjectBody[]> {
    return this.q('SELECT site_id, site_code, site_name, timezone FROM site ORDER BY site_id', [], rowToSite);
  }

  /** #11 라인 목록 — siteId 선택 */
  listLines(siteId?: number): Promise<LineObjectBody[]> {
    return siteId === undefined
      ? this.q(
          'SELECT line_id, site_id, line_code, line_name FROM production_line ORDER BY line_id',
          [],
          rowToLine,
        )
      : this.q(
          'SELECT line_id, site_id, line_code, line_name FROM production_line WHERE site_id = $1 ORDER BY line_id',
          [siteId],
          rowToLine,
        );
  }

  /**
   * #2 설비 목록 — 사본(비활성 포함 전부)을 먼저 읽고 includeInactive로 거른다. 미스면 PostgreSQL에서 채워 워밍.
   * PostgreSQL 불가여도 사본이 있으면 200(REQ-MST-14). 없는 사이트는 404.
   */
  async listDevices(siteId: number, includeInactive: boolean): Promise<DeviceObjectBody[]> {
    const cached = await this.cache.getDevList(siteId);
    let all: DeviceObjectBody[];
    if (cached !== null) all = JSON.parse(cached) as DeviceObjectBody[];
    else {
      const site = await this.q('SELECT 1 AS x FROM site WHERE site_id = $1', [siteId], (r) => r);
      if (site.length === 0) throw new ApiError('common.not_found', '사이트가 없다');
      all = await this.q(
        `SELECT d.device_id, d.line_id, d.device_code, d.device_name, d.vendor, d.model, d.is_active
           FROM device d JOIN production_line l USING (line_id) WHERE l.site_id = $1 ORDER BY d.device_id`,
        [siteId],
        rowToDevice,
      );
      await this.cache.setDevList(siteId, JSON.stringify(all), DEVLIST_TTL_SECONDS);
    }
    return includeInactive ? all : all.filter((d) => d.isActive);
  }

  /** #3 태그 목록 — deviceId 필수 · 없는 설비 404 · 사본 없음 */
  async listTags(deviceId: number, includeInactive: boolean): Promise<TagObjectBody[]> {
    if (!(await this.deviceExists(deviceId))) throw new ApiError('common.not_found', '설비가 없다');
    const rows = await this.q(
      `${TAG_META_SELECT} WHERE device_id = $1 ${includeInactive ? '' : 'AND is_active'} ORDER BY address, tag_id`,
      [deviceId],
      rowToTagMeta,
    );
    return rows as TagObjectBody[];
  }

  /** #8 태그 단건 — 사본 우선 · 미스 · 실패면 PostgreSQL · 비활성이어도 200 · 없는 id 404 */
  async getTag(tagId: number): Promise<TagObjectBody> {
    const cached = (await this.cache.getTagMetaMany([tagId]))[0];
    if (cached) return hashToTagMeta(tagId, cached) as TagObjectBody;
    const rows = await this.q(`${TAG_META_SELECT} WHERE tag_id = $1`, [tagId], rowToTagMeta);
    const m = rows[0];
    if (!m) throw new ApiError('common.not_found', '태그가 없다');
    await this.warm(m);
    return m as TagObjectBody;
  }

  /** #16 접속 설정 — 사본 없음(BFF no-store) */
  async getModbusConfig(deviceId: number): Promise<ModbusConfigBody> {
    const rows = await this.q(
      `SELECT host::text AS host, port, unit_id, timeout_ms, retry_count, max_regs_per_request
         FROM modbus_config WHERE device_id = $1`,
      [deviceId],
      rowToModbus,
    );
    const m = rows[0];
    if (!m) throw new ApiError('common.not_found', '설비가 없다');
    return m;
  }

  /** 사본 워밍 — COL-01 기동 로드 · 미스 보충이 부른다. 실패는 래퍼가 삼킨다(캐시 계열 degrade) */
  async warm(m: TagMeta): Promise<void> {
    await this.cache.setTagMeta(m.tagId, tagMetaToHash(m), TAGMETA_TTL_SECONDS);
  }
}
