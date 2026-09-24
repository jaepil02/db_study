import { Global, Module } from '@nestjs/common';
import { SwitchRegistry } from './switch-registry';

/** 스위치의 물리적 자리(04_architecture/02 §리포지터리 구조 common/ports) */
@Global()
@Module({ providers: [SwitchRegistry], exports: [SwitchRegistry] })
export class PortsModule {}
