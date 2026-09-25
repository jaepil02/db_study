// GEN 표면 #1 POST /api/v1/ingest/bulk(정본 docs/07_api/09_datagen.md) — 처리 ① 게이트 · ③ 본문 검증 → BulkIngestor(④~⑥)
// ② 인증 · 레이트 리밋은 S7이다(S5 모드 C 측정은 무인증). 설계된 거절의 계수는 HTTP 계층(http_designed_rejections_total)이 센다.
import { type BulkIngestAccepted, BulkIngestRequest } from '@db-study/shared';
import { Body, Controller, Header, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiError, parseOrThrow } from '../../../common/http/api-error';
import type { BulkIngestor } from './bulk-ingestor';

export const BULK_INGESTOR = Symbol('BulkIngestor');

@Controller('api/v1/ingest')
export class BulkIngestController {
  constructor(@Inject(BULK_INGESTOR) private readonly ingestor: BulkIngestor | null) {}

  @Post('bulk')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  bulk(@Body() body: unknown): Promise<BulkIngestAccepted> {
    // ① 게이트 — 꺼져 있으면 표면이 없는 것과 같다(404 · 403은 역할 오해 · 503은 재시도 폭주를 부른다)
    if (!this.ingestor)
      throw new ApiError(
        'datagen.bulk_disabled',
        '부하 주입 표면이 꺼져 있다 — DATAGEN_BULK_ENABLED=true로 재기동',
      );
    // ③ 본문 검증 — 필드 · 길이 일치 · dt 0 이상 · quality 9 · 엔트리 상한(본문 크기 상한은 HTTP 계층 1 MiB)
    return this.ingestor.ingest(parseOrThrow(BulkIngestRequest, body, 'body'));
  }
}
