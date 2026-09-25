// 모드 C 부하 주입(GEN-07) — 처리 ④ 적체 검사 1회 · ⑤ 파이프라인 XADD · ⑥ 202 요약(정본 docs/07_api/09_datagen.md #1 · 06_pipeline/10 §모드 C 표면)
// 판정량 · 임계는 모드 B · Collector와 같다 — 그룹 lag + pending(XLEN이 아니다 · ADR-21) · MAXLEN × 90% 초과면 위험(04_architecture/06).
// 표면은 받은 순간 Stream에 넣고 끝난다 — XADD 뒤의 적재 결과를 기다리지 않는다(REQ-GEN-09).
import { type BulkIngestAccepted, type BulkIngestRequest, encodeEntry } from '@db-study/shared';
import { Gauge } from 'prom-client';
import { ApiError } from '../../../common/http/api-error';
import { appRegistry } from '../../../common/metrics/registry';
import type { GroupBacklog } from '../../../common/redis/durable-key-client';
import { INGEST_GROUP, RAW_STREAM } from '../../collector/redis-stream-buffer';
import type { BackpressureGate } from '../mode-b/backpressure-gate';

/** 발행 경로별 단계 게이지 — 모드 B와 같은 계열(publisher 레이블만 다르다) · 같은 이름을 두 번 등록하지 않는다 */
export function backpressureStageGauge(): Gauge<'publisher'> {
  return (
    (appRegistry.getSingleMetric('backpressure_stage') as Gauge<'publisher'> | undefined) ??
    new Gauge({
      name: 'backpressure_stage',
      help: '발행 경로별 백프레셔 단계(0 정상 · 1 주의 · 2 경고 · 3 위험 · 4 복구)',
      labelNames: ['publisher'],
      registers: [appRegistry],
    })
  );
}

export const MODE_C_PUBLISHER = 'gen_c';

/** DurableKeyClient 중 모드 C가 쓰는 부분 */
export interface BulkPublisher {
  groupBacklog(stream: string, group: string): Promise<GroupBacklog | null>;
  xaddBatchWithBacklog(
    stream: string,
    payloads: readonly Buffer[],
    maxlen: number,
    group: string,
  ): Promise<{ results: (string | Error)[]; backlog: GroupBacklog | null }>;
}

function streamFull(acceptedEntries: number, why: string): ApiError {
  return new ApiError('datagen.stream_full', `Stream 적체 위험 단계 — ${why}`, { acceptedEntries });
}

/** 엔트리 계약 변환 — 필드 이름 · 인코딩(JSON → MessagePack)만 바꾼다(REQ-GLB-21) */
export function toStreamPayload(e: BulkIngestRequest['entries'][number]): Buffer {
  return encodeEntry({
    d: e.deviceId,
    s: e.scanSeq,
    t0: e.t0,
    tg: e.tagIds,
    dt: e.dt,
    va: e.values,
    q: e.quality,
  });
}

export class BulkIngestor {
  private readonly stage = backpressureStageGauge();

  constructor(
    private readonly publisher: BulkPublisher,
    readonly gate: BackpressureGate,
    private readonly maxlen: number,
  ) {
    this.stage.set({ publisher: MODE_C_PUBLISHER }, gate.stage);
  }

  /** 검증을 통과한 본문 하나 — ④ → ⑤ → ⑥. 거절은 ApiError(datagen.stream_full · details.acceptedEntries)로 던진다 */
  async ingest(req: BulkIngestRequest): Promise<BulkIngestAccepted> {
    // ④ 요청 단위 적체 검사 1회 — 조회 실패(연결 끊김)는 XADD 실패와 같이 위험으로 본다
    let backlog: GroupBacklog | null;
    try {
      backlog = await this.publisher.groupBacklog(RAW_STREAM, INGEST_GROUP);
    } catch {
      this.set(this.gate.xaddFailed());
      throw streamFull(0, '적체 조회 실패');
    }
    this.set(this.gate.observe(backlog)); // lag가 비면 직전 단계 유지(ADR-21) · 위험은 주의 임계 아래에서 풀린다
    if (this.gate.halted) throw streamFull(0, `미확인 적체 > 위험 임계 ${this.gate.thresholds.danger}`);

    // ⑤ 엔트리마다 XADD MAXLEN ~ — 파이프라인 1회(묶음 XADD × n + XINFO GROUPS 1)
    const payloads = req.entries.map(toStreamPayload);
    let results: (string | Error)[];
    let after: GroupBacklog | null = null;
    try {
      const r = await this.publisher.xaddBatchWithBacklog(RAW_STREAM, payloads, this.maxlen, INGEST_GROUP);
      results = r.results;
      after = r.backlog;
    } catch (e) {
      results = payloads.map(() => (e instanceof Error ? e : new Error(String(e))));
    }
    let acceptedEntries = 0;
    let acceptedRows = 0;
    results.forEach((r, i) => {
      if (r instanceof Error) return;
      acceptedEntries += 1;
      acceptedRows += req.entries[i]?.tagIds.length ?? 0;
    });
    if (acceptedEntries < payloads.length) {
      // 도중 실패 — 앞 엔트리는 이미 Stream에 있다 · 부하 도구는 재전송하지 않는다(07_api/09 §부분 수용)
      this.set(this.gate.xaddFailed());
      throw streamFull(acceptedEntries, `XADD 실패 ${payloads.length - acceptedEntries}건`);
    }
    this.set(this.gate.observe(after)); // 이번 XADD 뒤 적체 — 다음 요청 전 게이지
    // ⑥ 202 — 버퍼에 넣었을 뿐 저장하지 않았다
    return { acceptedEntries, acceptedRows };
  }

  private set(stage: number): void {
    this.stage.set({ publisher: MODE_C_PUBLISHER }, stage);
  }
}
