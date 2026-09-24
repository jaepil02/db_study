// APP_ROLE이 기동할 모듈 범위를 고른다 — 배정 정본 docs/04_architecture/02_module_boundaries.md §APP_ROLE 배정
// S1에는 datagen 모듈만 있다. 나머지 도메인 모듈은 그 도입 단계에서 이 표에 더한다.
import { type DynamicModule, Module } from '@nestjs/common';
import type { AppConfig, AppRole } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { DatagenModule } from './modules/datagen/datagen.module';

const ROLE_MODULES: Record<AppRole, DynamicModule['imports']> = {
  all: [DatagenModule],
  api: [],
  worker: [],
  collector: [],
  datagen: [DatagenModule],
};

@Module({})
export class AppModule {
  static forConfig(cfg: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forConfig(cfg), ...(ROLE_MODULES[cfg.appRole] ?? [])],
    };
  }
}
