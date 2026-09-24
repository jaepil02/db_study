// OBS-04 E2E 지연 게이지 — ClickHouse 주기 쿼리(SQL 정본 docs/10_observability/02_instrumentation.md §E2E 지연 SQL 게이지)
// 두 컬럼의 차(ingested_at − ts) 외의 방법으로 계산하지 않는다(REQ-OBS-05). 창 최근 5분 · 주기 = 수집 주기 15초(01_metrics §조정값).
// 스크레이프 때 조회하지 않는다 — 스크레이프 빈도가 저장소 부하를 바꾸지 않게(07_api/10 #2).
import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { e2eLatency, e2eLatencyRows } from './obs.metrics';

export const COLLECT_INTERVAL_MS = 15_000;

@Injectable()
export class E2eGaugeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('E2eGaugeService');
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly ch: ClickHouse) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.collect(), COLLECT_INTERVAL_MS);
    void this.collect();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async collect(): Promise<void> {
    try {
      const rs = await this.ch.client.query({
        query: `SELECT
                  quantile(0.50)(dateDiff('millisecond', ts, ingested_at)) AS p50_ms,
                  quantile(0.95)(dateDiff('millisecond', ts, ingested_at)) AS p95_ms,
                  quantile(0.99)(dateDiff('millisecond', ts, ingested_at)) AS p99_ms,
                  count() AS rows
                FROM plc.tag_raw
                WHERE ts > now() - INTERVAL 5 MINUTE`,
        format: 'JSONEachRow',
      });
      const [r] = await rs.json<{ p50_ms: number; p95_ms: number; p99_ms: number; rows: string }>();
      const rows = Number(r?.rows ?? 0);
      e2eLatencyRows.set(rows);
      e2eLatency.reset();
      if (r && rows > 0) {
        e2eLatency.set({ quantile: '0.5' }, r.p50_ms / 1000);
        e2eLatency.set({ quantile: '0.95' }, r.p95_ms / 1000);
        e2eLatency.set({ quantile: '0.99' }, r.p99_ms / 1000);
      }
    } catch (e) {
      // 한 계열 수집 실패는 그 계열만 비운다 · /metrics 자체는 200(07_api/10 #2 부분 실패)
      e2eLatency.reset();
      this.log.warn(`E2E 게이지 수집 실패 — ${(e as Error).message}`);
    }
  }
}
