// PostgreSQL in-process 풀(ADR-19) — 풀 크기 현행 참고 20(값 정본 docs/05_data_stores/02_postgresql_constraints.md §커넥션)
// 요청마다 새 커넥션을 만들지 않는다. 대조군 전용 커넥션(SW-09)은 S3에서 따로 둔다.
import { Global, Inject, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { type AppConfig, requireStoreUrls } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';

export const PG_POOL_MAX = 20;

@Injectable()
export class Postgres implements OnApplicationShutdown {
  readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.pool = new Pool({
      connectionString: requireStoreUrls(cfg).postgresUrl,
      max: PG_POOL_MAX,
      connectionTimeoutMillis: 1000,
      application_name: 'db_study-api',
    });
    // 유휴 연결의 오류는 풀이 버린다 — 잡지 않으면 프로세스가 죽는다
    this.pool.on('error', (e) => new Logger('Postgres').warn(`풀 유휴 연결 오류 — ${e.message}`));
  }

  /** 연결 정리는 종료 훅 마지막 단계 — Ingest 드레인(beforeApplicationShutdown)이 끝난 뒤다 */
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({ providers: [Postgres], exports: [Postgres] })
export class PostgresModule {}
