// SW-08 INGEST_IDEMPOTENCY — BatchTokenPort(포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md)
// on = DeterministicBatchToken — 토큰 sha1(첫 엔트리 ID · 끝 엔트리 ID · 행 수)를 insert_deduplication_token으로 싣는다(ING-04 · 06_pipeline/03).
// off = NoBatchToken — 토큰을 싣지 않고 중복 제거를 끈다. ClickHouse 26.8은 토큰 없는 같은 내용도 중복 제거해
// 토큰만 빼면 off의 "재시도 시 중복 행"이 재현되지 않는다(기록 004 · 06_pipeline/03 — S3 판정).
// 끄는 설정은 deduplicate_insert 'disable'이다 — 26.8에서 이 설정(기본 enable)이 insert_deduplicate · async_insert_deduplicate를
// 대체해, insert_deduplicate 0만 주면 무시되고 중복 제거가 그대로 돈다(S3 통합 확인 · system.query_log DuplicatedInsertedBlocks).
import { createHash } from 'node:crypto';
import type { ClickHouseSettings } from '@clickhouse/client';

export const BATCH_TOKEN_PORT = Symbol('BatchTokenPort');

export interface BatchTokenPort {
  readonly implName: 'DeterministicBatchToken' | 'NoBatchToken';
  /** 배치(창 안 조각)의 토큰 — 재시도는 같은 값을 쓴다 · off는 null */
  tokenFor(firstId: string, lastId: string, rows: number): string | null;
  /** 토큰에 딸린 삽입 설정 */
  settings(token: string | null): ClickHouseSettings;
}

/** 토큰식(REQ-GLB-06) — 재료 셋을 '|'로 잇는다(엔트리 ID에 '|'가 없어 재료 경계가 모호하지 않다) */
export function batchToken(firstId: string, lastId: string, rows: number): string {
  return createHash('sha1').update(`${firstId}|${lastId}|${rows}`).digest('hex');
}

export class DeterministicBatchToken implements BatchTokenPort {
  readonly implName = 'DeterministicBatchToken' as const;
  tokenFor(firstId: string, lastId: string, rows: number): string {
    return batchToken(firstId, lastId, rows);
  }
  settings(token: string | null): ClickHouseSettings {
    return token ? { insert_deduplication_token: token } : {};
  }
}

export class NoBatchToken implements BatchTokenPort {
  readonly implName = 'NoBatchToken' as const;
  tokenFor(): null {
    return null;
  }
  settings(): ClickHouseSettings {
    // 클라이언트 1.23의 설정 타입에 deduplicate_insert가 없다(26.8 신설) — 서버는 이름으로 받는다
    return { deduplicate_insert: 'disable' } as ClickHouseSettings;
  }
}

/**
 * 삽입 설정 — 토큰 설정 + 배치 안 C(async_insert 1 · wait_for_async_insert 1 · 코드 경로 동일 · 설정만 · ADR-09 · EXP-34).
 * 대기형(wait 1)이라 응답이 곧 확정이다 — XACK 순서 계약(삽입 성공 뒤에만)이 A안과 같다.
 */
export function insertSettings(
  port: BatchTokenPort,
  token: string | null,
  asyncInsert: boolean,
): ClickHouseSettings {
  return {
    ...port.settings(token),
    ...(asyncInsert ? { async_insert: 1, wait_for_async_insert: 1 } : {}),
  };
}
