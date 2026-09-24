// ClickHouse HTTP 클라이언트(8123 전용) — 09_tech_stack/02 §데이터 평면 라이브러리 @clickhouse/client 행
// 요청 압축 zstd(Node 22.15 이상 · 클라이언트 1.23 지원 확인) — 어느 압축으로 돌았는지는 기동 로그와 기록 조건에 남긴다.
// 사용자 입력은 전부 파라미터 바인딩({name:Type})으로 넘긴다 — 문자열 연결로 SQL을 만들지 않는다(REQ-GLB-24).
import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { Global, Inject, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type AppConfig, requireStoreUrls } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';

export const CLICKHOUSE_REQUEST_COMPRESSION = 'zstd' as const;

@Injectable()
export class ClickHouse implements OnApplicationShutdown {
  readonly client: ClickHouseClient;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    const url = new URL(requireStoreUrls(cfg).clickhouseUrl);
    const database = url.pathname.replace(/^\//, '') || 'plc';
    this.client = createClient({
      url: `${url.protocol}//${url.host}`,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      compression: { request: { codec: CLICKHOUSE_REQUEST_COMPRESSION }, response: false },
      request_timeout: 10_000,
    });
    new Logger('ClickHouse').log(`요청 압축 ${CLICKHOUSE_REQUEST_COMPRESSION} · database ${database}`);
  }

  /** 연결 정리는 종료 훅 마지막 단계 — Ingest 드레인(beforeApplicationShutdown)이 끝난 뒤다 */
  async onApplicationShutdown() {
    await this.client.close();
  }
}

@Global()
@Module({ providers: [ClickHouse], exports: [ClickHouse] })
export class ClickHouseModule {}
