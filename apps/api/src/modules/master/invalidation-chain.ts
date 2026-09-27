// 무효화 체인 6단 중 api가 거는 ②③④ — 단계 번호 정본 docs/06_pipeline/07_business_crud.md §무효화 체인 6단(ADR-12)
// ① 커밋은 호출자의 트랜잭션 · ⑤ BFF 무효화는 BFF · ⑥ 브라우저 무효화는 RLT-09가 ch:cacheinv를 중계한다.
// ② ③은 응답 전 · ④는 응답 뒤(재적재가 CRUD 지연 예산을 먹지 않게 — 07_business_crud 판정).
// 체인 실패는 요청을 실패시키지 않는다(REQ-MST-10) — 커밋은 끝났고 진실은 PostgreSQL이다. 계수만 한다.
import { Injectable, Logger } from '@nestjs/common';
import { Counter } from 'prom-client';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { appRegistry } from '../../common/metrics/registry';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { FanoutPublisher } from '../../common/redis/fanout-publisher';
import { noteBizInvalidation } from '../biz/biz-ledger';

const reg = [appRegistry];
export const mstMetrics = {
  cacheDeleteFailures: new Counter({
    name: 'mst_cache_delete_failures_total',
    help: '무효화 체인 ② 삭제 실패',
    labelNames: ['prefix'],
    registers: reg,
  }),
  dictReloads: new Counter({
    name: 'mst_dict_reloads_total',
    help: '체인 ④ Dictionary 재적재 — AC-06 사건',
    labelNames: ['result'],
    registers: reg,
  }),
};

/** 한 쓰기가 무효화할 사본 — 도메인별 적용표(07_business_crud §도메인별 체인 적용) */
export interface ChainTargets {
  /** ② DEL + ③ 발행 — cache:tagmeta:{tag_id} */
  tagIds?: number[];
  /** ② DEL + ③ 발행 — cache:devlist:{site_id} */
  deviceSites?: number[];
  /** ③만 — 지울 사본이 없는 쓰기(modbus_config)가 Collector에 알리는 키 이름 */
  signalOnlySites?: number[];
  /** ④ — tag_master 변경일 때만 */
  reloadDictionary?: boolean;
}

@Injectable()
export class InvalidationChain {
  private readonly log = new Logger('InvalidationChain');

  constructor(
    private readonly cache: CacheKeyClient,
    private readonly fanout: FanoutPublisher,
    private readonly ch: ClickHouse,
  ) {}

  /** ② ③ — 커밋 뒤 · 응답 전. 새 값으로 덮지 않고 지운다(ADR-12) */
  async afterCommit(t: ChainTargets): Promise<void> {
    const t0 = performance.now();
    const keys: string[] = [];
    let deleted = 0;
    for (const id of t.tagIds ?? []) {
      if (await this.cache.delTagMeta(id)) deleted++;
      else mstMetrics.cacheDeleteFailures.inc({ prefix: 'cache:tagmeta' });
      keys.push(`cache:tagmeta:${id}`);
    }
    for (const siteId of t.deviceSites ?? []) {
      if (await this.cache.delDevList(siteId)) deleted++;
      else mstMetrics.cacheDeleteFailures.inc({ prefix: 'cache:devlist' });
      keys.push(`cache:devlist:${siteId}`);
    }
    for (const siteId of t.signalOnlySites ?? []) keys.push(`cache:devlist:${siteId}`);
    const unique = [...new Set(keys)];
    const published = await this.fanout.publishCacheInv(unique);
    // 흐름 요약 trace(업무 명령 범위 안에서만) — ② 지운 키 수 · ③ 발행 여부(키가 없으면 발행하지 않은 것)
    noteBizInvalidation(t0, deleted, unique.length > 0 && published);
    if (t.reloadDictionary) this.reloadAfterResponse();
  }

  /** ④ — 응답을 기다리게 하지 않는다. 완료 시각을 로그로 남긴다(AC-06 Dictionary 층의 사건) */
  private reloadAfterResponse(): void {
    setImmediate(() => {
      const t0 = performance.now();
      this.ch.client
        .command({ query: 'SYSTEM RELOAD DICTIONARY plc.dict_tag' })
        .then(() => {
          mstMetrics.dictReloads.inc({ result: 'ok' });
          this.log.log(
            JSON.stringify({
              event: 'dict_reloaded',
              at: new Date().toISOString(),
              ms: Math.round(performance.now() - t0),
            }),
          );
        })
        .catch((e: Error) => {
          mstMetrics.dictReloads.inc({ result: 'failed' });
          this.log.warn(`dict_tag 재적재 실패 — ${e.message} · LIFETIME 재적재로 수렴한다`);
        });
    });
  }
}
