// 모드 C 부하 주입 표면 — 정본 docs/07_api/09_datagen.md #1 POST /api/v1/ingest/bulk(본문 9필드 · 6단계 · 202)
// 본문은 Stream 엔트리 계약(06_pipeline/12 §3단계)의 JSON 표현이다 — 표면은 필드 이름 · 인코딩만 바꿔 엔트리 하나를 XADD 하나로 옮긴다.
import { z } from 'zod';
import { STREAM_SCHEMA_VERSION } from '../stream-entry';

const INT32_MAX = 2_147_483_647;
const UINT32_MAX = 4_294_967_295;
const uint32 = z.number().int().min(0).max(UINT32_MAX);
const uint64Safe = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** 요청당 엔트리 상한 — 2계층 · 현행 참고(S5 판정 8 · EXP-37 계단이 확정) · 소유 07_api/09 */
export const BULK_MAX_ENTRIES = 1000;
/** 엔트리 하나의 태그 상한 — 엔트리 = 설비 하나의 시점 하나라 설비당 태그 최대(L 500 · 04_architecture/07)를 넘을 수 없다 */
export const BULK_MAX_TAGS_PER_ENTRY = 500;
/** 본문 크기 상한 — 2계층 · 현행 참고(S5 판정 8) */
export const BULK_MAX_BODY_BYTES = 1024 * 1024;

export const BulkEntry = z
  .strictObject({
    deviceId: uint32,
    scanSeq: uint64Safe,
    t0: uint64Safe,
    tagIds: z.array(uint32).min(1).max(BULK_MAX_TAGS_PER_ENTRY),
    // 음수 dt는 입구에서 거절한다(표면은 발행자 결함을 막을 수 있는 유일한 발행자 — 07_api/09)
    dt: z.array(z.number().int().min(0).max(INT32_MAX)),
    values: z.array(z.number().refine(Number.isFinite, '유한 값이어야 한다')),
    // HTTP로 들어온 값은 전부 생성 데이터 — SIMULATED(9)만 받는다(REQ-GEN-02 · REQ-GLB-18)
    quality: z.array(z.literal(9)),
  })
  .superRefine((e, ctx) => {
    const n = e.tagIds.length;
    if (e.dt.length !== n || e.values.length !== n || e.quality.length !== n) {
      ctx.addIssue({ code: 'custom', message: 'tagIds · dt · values · quality 길이가 같아야 한다' });
      return;
    }
    // 최솟값은 루프로 — 전개 인자(Math.min(...))는 배열이 크면 RangeError를 던져 400이 500이 된다(검수 #7)
    let min = Number.POSITIVE_INFINITY;
    for (const d of e.dt) if (d < min) min = d;
    if (min !== 0) {
      ctx.addIssue({ code: 'custom', message: 't0는 엔트리 안 ts의 최솟값이어야 한다 — min(dt) = 0' });
    }
  });
export type BulkEntry = z.infer<typeof BulkEntry>;

export const BulkIngestRequest = z.strictObject({
  v: z.literal(STREAM_SCHEMA_VERSION),
  entries: z.array(BulkEntry).min(1).max(BULK_MAX_ENTRIES),
});
export type BulkIngestRequest = z.infer<typeof BulkIngestRequest>;

/** 202 응답 — 표면은 버퍼에 넣었을 뿐 저장하지 않았다 */
export const BulkIngestAccepted = z.strictObject({
  acceptedEntries: z.number().int().min(0),
  acceptedRows: z.number().int().min(0),
});
export type BulkIngestAccepted = z.infer<typeof BulkIngestAccepted>;
