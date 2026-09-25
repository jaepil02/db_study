// SW-11 LATEST_VALUE_WRITER — LatestValueWritePort(포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md)
// ingest = IngestLatestValueWriter — ClickHouse 삽입 성공 · XACK 뒤 rt:latest 조건부 쓰기 → 받아들인 필드만 ch:rt 발행(ING-08).
// collector = CollectorLatestValueWriter는 S6이다 — S3는 collector 값이 와도 ingest를 주입하고 경고한다(SW-01 off 방식과 같다).
import { DurableKeyClient, type LatestTuple } from '../../common/redis/durable-key-client';
import { FanoutPublisher } from '../../common/redis/fanout-publisher';
import { ingestMetrics as m } from './ingest.metrics';
import type { BatchEntry } from './window-buffer';

export const LATEST_VALUE_WRITE_PORT = Symbol('LatestValueWritePort');

export interface LatestValueWritePort {
  readonly implName: 'IngestLatestValueWriter';
  /** 확정된(XACK된) 배치의 엔트리 — 실패는 삼키고 로그로 남긴다(적재는 이미 확정됐다) */
  write(entries: readonly BatchEntry[]): Promise<void>;
}

/** 설비별 · 태그별 가장 새 ts의 튜플 — 한 배치 안에서 먼저 접는다(조건부 쓰기 스크립트 인자를 줄인다) */
export function latestByDevice(entries: readonly BatchEntry[]): Map<number, Map<number, LatestTuple>> {
  const byDevice = new Map<number, Map<number, LatestTuple>>();
  for (const { entry: e } of entries) {
    let tags = byDevice.get(e.d);
    if (!tags) {
      tags = new Map();
      byDevice.set(e.d, tags);
    }
    for (let i = 0; i < e.tg.length; i++) {
      const tag = e.tg[i] as number;
      const ts = e.t0 + (e.dt[i] ?? 0);
      const prev = tags.get(tag);
      if (!prev || ts >= prev[1]) tags.set(tag, [tag, ts, e.va[i] ?? 0, e.q[i] ?? 0]);
    }
  }
  return byDevice;
}

export class IngestLatestValueWriter implements LatestValueWritePort {
  readonly implName = 'IngestLatestValueWriter' as const;

  constructor(
    private readonly durable: DurableKeyClient,
    private readonly fanout: FanoutPublisher,
    private readonly warn: (msg: string) => void,
  ) {}

  async write(entries: readonly BatchEntry[]): Promise<void> {
    for (const [deviceId, tags] of latestByDevice(entries)) {
      try {
        const accepted = await this.durable.writeLatestIfNewer(deviceId, [...tags.values()]);
        m.latestUpdates.inc({ writer: 'ingest' }, accepted.length);
        await this.fanout.publishRt(deviceId, accepted);
      } catch (e) {
        // 최신값만 멈춘다 — 적재는 이미 확정됐다(06_pipeline/02 §발행 · 적체 조회 표의 rt:latest 행과 같은 결)
        this.warn(`rt:latest 쓰기 실패 — 설비 ${deviceId} · ${(e as Error).message}`);
      }
    }
  }
}
