// OBS-05 · 06 health — 정본 docs/07_api/10_metrics.md #1
// 세 저장소를 병렬로 실제 왕복하고 저장소마다 독립 타임아웃(현행 참고 1,000 ms · 소유 07_api/10) — 전체 시간은 가장 긴 타임아웃을 넘지 않는다.
// 확인 연결: PostgreSQL 앱 풀 · ClickHouse 앱 HTTP 클라이언트 · Redis 명령 연결(구독 연결이 아니다).
import type { HealthBody, StoreCheckResult } from '@db-study/shared';
import { Inject, Injectable } from '@nestjs/common';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { Postgres } from '../../common/postgres/postgres.module';
import { RedisConnections } from '../../common/redis/connections';
import { type AppConfig, runInfo } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';

export const STORE_CHECK_TIMEOUT_MS = 1000;

class CheckTimeout extends Error {}

async function check(fn: () => Promise<unknown>): Promise<StoreCheckResult> {
  const t0 = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new CheckTimeout()), STORE_CHECK_TIMEOUT_MS);
      }),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - t0), error: null };
  } catch (e) {
    // 원문 오류 메시지를 싣지 않는다 — 드라이버 문자열에 접속 문자열 · 호스트 · 사용자가 섞인다(REQ-OBS-10)
    const msg = e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ''}` : '';
    const error =
      e instanceof CheckTimeout ? 'timeout' : /ECONNREFUSED|refused/i.test(msg) ? 'refused' : 'error';
    return { status: 'down', latencyMs: null, error };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly pg: Postgres,
    private readonly ch: ClickHouse,
    private readonly redis: RedisConnections,
    private readonly switches: SwitchRegistry,
  ) {}

  async check(): Promise<{ httpStatus: 200 | 503; body: HealthBody }> {
    const checkedAt = new Date().toISOString();
    const [postgres, clickhouse, redis] = await Promise.all([
      check(() => this.pg.pool.query('SELECT 1')),
      check(async () => (await this.ch.client.query({ query: 'SELECT 1', format: 'JSONEachRow' })).json()),
      check(() => this.redis.command.ping()),
    ]);
    const ok = [postgres, clickhouse, redis].every((s) => s.status === 'up');
    return {
      httpStatus: ok ? 200 : 503,
      body: {
        status: ok ? 'ok' : 'degraded',
        checkedAt,
        stores: { postgres, clickhouse, redis },
        switches: this.switches.snapshot(),
        run: runInfo(this.cfg).run,
      },
    };
  }
}
