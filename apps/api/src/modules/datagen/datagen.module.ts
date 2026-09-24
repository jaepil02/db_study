import { Module } from '@nestjs/common';
import { DatagenService } from './datagen.service';

/** GEN — 데이터 평면 · 소유 테이블 없음. S1은 신호 생성 · 인코딩 · 단독 처리량 실측만 둔다 */
@Module({ providers: [DatagenService], exports: [DatagenService] })
export class DatagenModule {}
