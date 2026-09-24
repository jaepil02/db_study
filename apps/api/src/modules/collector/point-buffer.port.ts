// SW-01 발행 포트(정본 docs/02_features/13_switch_matrix.md SW-01 · 02_features/03 §스위치가 교체하는 것)
// on = RedisStreamBuffer(stream:plc:raw) · off = InProcessQueueBuffer(Ingest 직접 호출 · 실험 전용 — S6).
// 자리: 포트 인터페이스의 정본 자리는 common/ports(리드 소유)다 — S2는 수집 폴더에 두고 옮길 것을 제안한다.
import type { GroupBacklog } from '../../common/redis/durable-key-client';

export interface PublishResult {
  /** 이번 발행 뒤 grp:ingest 적체 — 백프레셔 1차 신호의 원천(ADR-21) · 모르면 null */
  backlog: GroupBacklog | null;
}

export interface PointBufferPort {
  /** 엔트리 하나(설비 × 스캔 사이클)를 발행한다 — 실패는 삼키지 않고 던진다 */
  publish(payload: Buffer): Promise<PublishResult>;
}

export const POINT_BUFFER_PORT = Symbol('POINT_BUFFER_PORT');
