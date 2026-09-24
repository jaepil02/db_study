import { Global, Module } from '@nestjs/common';
import { type AppConfig, loadConfig } from './app-config';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** 설정은 기동 시 1회 — 모듈 초기화 전에 읽어 DI로 나눈다 */
@Global()
@Module({})
export class ConfigModule {
  static forConfig(cfg: AppConfig = loadConfig()) {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: cfg }],
      exports: [APP_CONFIG],
    };
  }
}
