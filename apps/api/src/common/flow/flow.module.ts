// 흐름 요약 발행기 — 저장소를 쓰는 역할 전부(ingest 워커 · 명령 워커 · SW-12 direct api)가 주입받는다
import { Global, Module } from '@nestjs/common';
import { FlowPublisher } from './flow-publisher';

@Global()
@Module({ providers: [FlowPublisher], exports: [FlowPublisher] })
export class FlowModule {}
