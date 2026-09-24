import { Module } from '@nestjs/common';
import { DatagenService } from './datagen.service';

/** GEN — 데이터 평면 · 소유 테이블 없음. S1 신호 생성 · 단독 처리량 · S2 모드 A 레지스터 갱신(collector 역할에서) */
@Module({ providers: [DatagenService], exports: [DatagenService] })
export class DatagenModule {}
