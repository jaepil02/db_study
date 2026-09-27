// 명령 워커 grp:biz-writer — 워커 역할(APP_ROLE worker · all)에만 싣는다(06_pipeline/07 §적용 단계 — all이어도 스트림을 거친다)
import { Module } from '@nestjs/common';
import { BizApplyModule } from './biz-apply.module';
import { BizWorker } from './biz-worker';

@Module({ imports: [BizApplyModule], providers: [BizWorker] })
export class BizWorkerModule {}
