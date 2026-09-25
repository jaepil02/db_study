// Redis 연결 — 명령 연결 · 구독 연결 · 블로킹 전용 연결을 가른다(09_tech_stack/02 §데이터 평면 라이브러리 ioredis 행)
// 블로킹 읽기(XREADGROUP BLOCK)와 명령이 한 연결을 쓰면 캐시 조회가 블록 시간만큼 줄을 선다.
// 모듈은 이 연결을 직접 쓰지 않는다 — 키 계열별 래퍼 3종만 쓴다(ADR-13 · 05_data_stores/05 §키 계열별 래퍼 강제).
import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { type AppConfig, requireStoreUrl } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';

/**
 * 명령 연결 조정값 — 오프라인 큐를 끈다: 접속이 끊긴 동안의 명령을 쌓아 두면 최신값 표면이 503 대신 무기한 대기한다
 * (REQ-RLT-06 · 05_data_stores/05 §실패 전략 rt 읽기 행). 명령 시간 제한은 health 저장소 타임아웃과 같은 1,000 ms(07_api/10).
 */
const COMMAND_OPTIONS: RedisOptions = {
  enableOfflineQueue: false,
  commandTimeout: 1000,
  maxRetriesPerRequest: 1,
};

@Injectable()
export class RedisConnections implements OnApplicationShutdown {
  private readonly log = new Logger('RedisConnections');
  private readonly url: string;
  readonly command: Redis;
  private subscriber: Redis | null = null;
  private readonly extra: Redis[] = [];

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.url = requireStoreUrl(cfg, 'redisUrl');
    this.command = new Redis(this.url, { ...COMMAND_OPTIONS, connectionName: 'api-command' });
    this.command.on('error', (e) => this.log.warn(`명령 연결 오류 — ${e.message}`));
  }

  /** 구독 전용 연결 — 구독 상태의 연결은 일반 명령을 받지 않는다 */
  subscriberConnection(): Redis {
    if (!this.subscriber) {
      this.subscriber = new Redis(this.url, { connectionName: 'api-subscriber', maxRetriesPerRequest: null });
      this.subscriber.on('error', (e) => this.log.warn(`구독 연결 오류 — ${e.message}`));
    }
    return this.subscriber;
  }

  /** 블로킹 읽기 전용 연결 — 컨슈머마다 하나(명령 시간 제한 없음 · 블록 시간이 제한이다) */
  blockingConnection(name: string): Redis {
    const c = new Redis(this.url, { connectionName: name, maxRetriesPerRequest: null });
    c.on('error', (e) => this.log.warn(`${name} 연결 오류 — ${e.message}`));
    this.extra.push(c);
    return c;
  }

  /** 기동 시 명령 연결이 준비될 때까지 기다린다 — 오프라인 큐가 없어 준비 전 명령은 즉시 실패한다 */
  async ready(timeoutMs = 30_000): Promise<void> {
    if (this.command.status === 'ready') return;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Redis 명령 연결 준비 시간 초과')), timeoutMs);
      this.command.once('ready', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  /** 연결 정리는 종료 훅 마지막 단계 — Ingest 드레인(beforeApplicationShutdown)이 끝난 뒤다 */
  async onApplicationShutdown() {
    const all = [this.command, ...this.extra, ...(this.subscriber ? [this.subscriber] : [])];
    await Promise.allSettled(all.map((c) => c.quit()));
  }
}
