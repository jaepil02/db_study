// TSQ-09 원시 내보내기 — 정본 docs/07_api/05_timeseries.md #2 · 06_pipeline/06 §원시 내보내기
// ClickHouse FORMAT 응답을 그대로 중계한다(애플리케이션 직렬화 없음) · 해상도를 줄이지 않고 캐시하지 않는다.
// 완결 = 종결 청크 · 도중 실패 = 종결 청크 없이 연결을 끊는다(본문 표지 없음 — §내보내기 스트림 중단 종료 표지 판정).
// 인가(ENGINEER) · 내보내기 등급 레이트 리밋은 S7.
import type { Readable } from 'node:stream';
import { distinctTagIds, TIMESERIES_TAG_LIMIT, type TimeseriesExport } from '@db-study/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Counter } from 'prom-client';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { ApiError } from '../../common/http/api-error';
import { appRegistry } from '../../common/metrics/registry';

const aborted = new Counter({
  name: 'tsq_export_aborted_total',
  help: '원시 내보내기 도중 중단',
  registers: [appRegistry],
});

const FORMAT = { csv: 'CSVWithNames', parquet: 'Parquet' } as const;
export const EXPORT_CONTENT_TYPE = {
  csv: 'text/csv; charset=utf-8',
  parquet: 'application/vnd.apache.parquet',
} as const;

@Injectable()
export class TimeseriesExportService {
  private readonly log = new Logger('TimeseriesExport');
  constructor(private readonly ch: ClickHouse) {}

  /** 시작 전 실패(태그 상한 · ClickHouse 불가)는 에러 봉투 — 상태 줄이 나가기 전이다 */
  async open(q: TimeseriesExport): Promise<{ stream: Readable; onAbort: () => void }> {
    const tagIds = distinctTagIds(q.tagIds);
    if (tagIds.length > TIMESERIES_TAG_LIMIT)
      throw new ApiError('timeseries.too_many_tags', `tagIds는 ${TIMESERIES_TAG_LIMIT}개 이하여야 한다`, {
        limit: TIMESERIES_TAG_LIMIT,
        received: tagIds.length,
      });
    try {
      // 원시 열 그대로 — ingested_at · scan_seq는 싣지 않는다 · 태그명은 #8로 따로 읽는다
      const r = await this.ch.client.exec({
        // 열 이름 ts를 그대로 내므로 조건 · 정렬은 원 열(tag_raw.ts)로 한정한다 — ClickHouse 별칭은 WHERE에서도 보여
        // 한정하지 않으면 정수 ms 별칭과 비교해 0행이 된다(S4 통합에서 발견)
        query: `SELECT toUnixTimestamp64Milli(tag_raw.ts) AS ts, device_id, tag_id, value, quality
                  FROM plc.tag_raw
                 WHERE tag_id IN {tags:Array(UInt32)}
                   AND tag_raw.ts >= fromUnixTimestamp64Milli({from:Int64}) AND tag_raw.ts < fromUnixTimestamp64Milli({to:Int64})
                 ORDER BY tag_id, tag_raw.ts
                 FORMAT ${FORMAT[q.format]}`,
        query_params: { tags: tagIds, from: Date.parse(q.from), to: Date.parse(q.to) },
      });
      return {
        stream: r.stream as Readable,
        onAbort: () => {
          aborted.inc();
          this.log.warn(`내보내기 도중 중단 — query_id ${r.query_id}`);
        },
      };
    } catch {
      throw new ApiError('timeseries.clickhouse_unavailable', 'ClickHouse에 접속할 수 없다');
    }
  }
}
