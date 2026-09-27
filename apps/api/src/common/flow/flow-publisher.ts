// 흐름 요약 발행기(EXP-FLOW) — 정본 docs/07_api/11_websocket.md §흐름 이벤트 — flow · 발행 조건
// 계약(리드 소유 · 시그니처): 호출자는 요약 재료만 넘기고 기다리지 않는다(발행은 비동기 · 실패는 계수 · 삼킴).
// 표지 cache:flow:subscribed를 최대 5초 간격으로 확인해 기억한다 — 없거나 읽기 실패면 요약을 만들지도 내지도 않는다.
// source · seq(역할별 1부터) · at · startedAt · totals는 발행기가 채운다. 구현 소유: 흐름 쪽 팀원.
// 표지 확인은 타이머 하나가 한다 — 배치 · 명령 경로에서 Redis를 읽지 않는다(배치마다 읽으면 표지 확인이 새 왕복이 된다).
// seq · totals는 만든 요약만 센다 — 표지가 없는 동안은 재료를 만들지 않으므로 "기동 이후"는 "기동 이후 낸 요약"이다.
import { hostname } from 'node:os';
import {
  FLOW_MARKER_CHECK_MS,
  type FlowBatchSummaryBody,
  type FlowBizSummaryBody,
  type FlowRole,
} from '@db-study/shared';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { CacheKeyClient } from '../redis/cache-key-client';
import { FanoutPublisher } from '../redis/fanout-publisher';

/** 배치 요약 재료 — 발행기가 event · source · role · seq · at를 채운다 */
export type FlowBatchInput = Omit<FlowBatchSummaryBody, 'event' | 'source' | 'role' | 'seq' | 'at'>;
/** 업무 요약 재료 — role은 호출자가 정한다(워커 biz-writer · SW-12 direct api-direct) */
export type FlowBizInput = Omit<FlowBizSummaryBody, 'event' | 'source' | 'seq' | 'at'>;

/** 업무 요약 result의 failed 코드 — PostgreSQL 불가(원장 행 없이 결과 키만) · 도메인 거절과 따로 센다 */
const FAILED_RESULT = 'common.postgres_unavailable';

/** 인스턴스 식별 — 역할 · 호스트(컨테이너면 컨테이너 ID) */
export function flowSource(appRole: string): string {
  return `${appRole}@${hostname()}`;
}

function ingestTotals() {
  return {
    batches: 0,
    rows: 0,
    chRows: 0,
    dlqEntries: 0,
    controlCopyRows: 0,
    judgedRows: 0,
    opened: 0,
    closed: 0,
    latestWrites: 0,
  };
}

function bizTotals() {
  return { commands: 0, applied: 0, rejected: 0, expired: 0, failed: 0, duplicates: 0 };
}

@Injectable()
export class FlowPublisher implements OnApplicationBootstrap, OnModuleDestroy {
  readonly source: string;
  readonly startedAt = Date.now();
  /** 마지막 표지 확인값 — 기동 직후 첫 확인 전에는 없음으로 본다 */
  private on = false;
  private checking = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly seq: Record<FlowRole, number> = { ingest: 0, 'biz-writer': 0, 'api-direct': 0 };
  private readonly ingest = ingestTotals();
  private readonly biz: Record<'biz-writer' | 'api-direct', ReturnType<typeof bizTotals>> = {
    'biz-writer': bizTotals(),
    'api-direct': bizTotals(),
  };

  constructor(
    private readonly cache: CacheKeyClient,
    private readonly fanout: FanoutPublisher,
    @Optional() @Inject(APP_CONFIG) cfg: AppConfig | null = null,
  ) {
    this.source = flowSource(cfg?.appRole ?? 'all');
  }

  onApplicationBootstrap() {
    void this.check();
    this.timer = setInterval(() => void this.check(), FLOW_MARKER_CHECK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 표지 확인 1회 — 읽기 실패(Redis 불가 · 타임아웃)는 없음으로 본다(관찰 보조 채널이 불확실하면 측정 쪽을 지킨다) */
  async check(): Promise<boolean> {
    if (this.checking) return this.on;
    this.checking = true;
    try {
      const r = await this.cache.getFlowSubscribed();
      this.on = !r.failed && r.present;
    } catch {
      this.on = false;
    } finally {
      this.checking = false;
    }
    return this.on;
  }

  /** 표지가 있는가(마지막 확인값 · 확인 주기 5초) — 호출자가 요약 재료를 만들지 말지 고를 때 쓴다(배치마다 Redis 왕복 없음) */
  enabled(): boolean {
    return this.on;
  }

  /** 배치 1건 — 표지 없으면 무시 */
  publishBatch(input: FlowBatchInput): void {
    if (!this.on) return;
    const t = this.ingest;
    t.batches++;
    t.rows += input.rows;
    t.chRows += input.chRows;
    t.dlqEntries += input.dlqEntries;
    if (input.controlCopy?.ok) t.controlCopyRows += input.controlCopy.rows;
    if (input.alarm) {
      t.judgedRows += input.alarm.judgedRows;
      t.opened += input.alarm.opened;
      t.closed += input.alarm.closed;
    }
    t.latestWrites += input.latestWrites ?? 0;
    void this.fanout.publishFlow({
      event: 'batch',
      source: this.source,
      role: 'ingest',
      seq: ++this.seq.ingest,
      at: Date.now(),
      ...input,
      startedAt: this.startedAt,
      totals: { ...t },
    });
  }

  /** 업무 명령 1건 — 결과 알림 뒤에 부른다 · 표지 없으면 무시 */
  publishBiz(input: FlowBizInput): void {
    if (!this.on) return;
    const t = this.biz[input.role];
    t.commands++;
    if (input.result === 'ok') t.applied++;
    else if (input.result === 'expired') t.expired++;
    else if (input.result === FAILED_RESULT) t.failed++;
    else t.rejected++;
    if (input.duplicate) t.duplicates++;
    void this.fanout.publishFlow({
      event: 'biz',
      source: this.source,
      seq: ++this.seq[input.role],
      at: Date.now(),
      ...input,
      startedAt: this.startedAt,
      totals: { ...t },
    });
  }
}
