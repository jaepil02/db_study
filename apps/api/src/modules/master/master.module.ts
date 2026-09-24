import { Module } from '@nestjs/common';
import { MasterReadService } from './master-read.service';

/** MST — S2는 시드 최소분 조회와 태그 메타 사본(MST-07)만. 쓰기 표면 · 무효화 체인은 S4 */
@Module({ providers: [MasterReadService], exports: [MasterReadService] })
export class MasterModule {}
