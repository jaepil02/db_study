import { Module } from '@nestjs/common';
import { InvalidationChain } from './invalidation-chain';
import { MasterReadService } from './master-read.service';
import { MasterWriteService } from './master-write.service';

/** MST — S2는 시드 최소분 조회와 태그 메타 사본(MST-07)만. 쓰기 표면 · 무효화 체인은 S4 */
@Module({ providers: [MasterReadService], exports: [MasterReadService] })
export class MasterModule {}

/**
 * MST 쓰기 서비스 · 무효화 체인 ②③④ — 컨트롤러 없음. 표면(MasterApiModule · api · all)과
 * 업무 명령 적용(BizApplyModule — 명령 워커 · SW-12 direct)이 함께 쓴다(06_pipeline/07 §업무 명령 경로).
 */
@Module({
  providers: [MasterWriteService, InvalidationChain],
  exports: [MasterWriteService, InvalidationChain],
})
export class MasterWriteModule {}
