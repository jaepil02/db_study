import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service';

/** ING — Stream 소비 · 창 정렬 배치 · tag_raw 삽입 · XACK · 최신값 갱신(ING-01 · 02 · 03 · 08 — S2) */
@Module({ providers: [IngestService] })
export class IngestModule {}
