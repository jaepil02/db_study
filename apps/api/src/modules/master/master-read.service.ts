// MST 조회(S2 — 시드 최소분 · 쓰기 표면은 S4) · MST-07 태그 메타 사본(cache:tagmeta:{tag_id})
// 캐시 계열이라 축출될 수 있다 — 미스면 PostgreSQL에서 채운다(degrade). 사본은 해석이지 값이 아니다(06_pipeline/05 §메타 부착 판정).
import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error';
import { Postgres } from '../../common/postgres/postgres.module';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import {
  hashToTagMeta,
  rowToTagMeta,
  TAG_META_SELECT,
  TAGMETA_TTL_SECONDS,
  type TagMeta,
  tagMetaToHash,
} from './tag-meta';

export const tagMetaKey = (tagId: number) => `cache:tagmeta:${tagId}`;

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
    const cached = await this.cache.hgetallMany(tagIds.map(tagMetaKey));
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

  /** 사본 워밍 — COL-01 기동 로드 · 미스 보충이 부른다. 실패는 래퍼가 삼킨다(캐시 계열 degrade) */
  async warm(m: TagMeta): Promise<void> {
    await this.cache.hsetWithTtl(tagMetaKey(m.tagId), tagMetaToHash(m), TAGMETA_TTL_SECONDS);
  }
}
