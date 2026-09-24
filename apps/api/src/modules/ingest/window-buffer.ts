// 창 정렬 배치 — 기전 정본 docs/06_pipeline/03_ingest_batch.md §창 정렬 배치와 결정적 토큰
// 창 k = 엔트리 ID 밀리초(Redis가 XADD를 받은 시각)가 [k × W, (k + 1) × W)에 드는 엔트리 전부 — flusher 시계로 자르지 않는다.
// S2는 시간 트리거(창 폭 W)만이다(ING-02 S2 범위) — 행 수 R · 페이로드 P 분할은 S3에서 더한다.
import type { DecodedEntry } from '../../common/workers/tasks';

/** 창 폭 W — 2계층 조정값 현행 참고 1,000 ms(소유 06_pipeline/03) */
export const WINDOW_MS = 1000;
/**
 * 저부하 창 닫힘 유예 — ⓑ 경로(api 시계가 창 끝 + 유예를 넘고 디코딩 중인 엔트리가 없다).
 * 2계층 · 현행 미정(06_pipeline/03 §미확인 등재) → S2 판정 100 ms: Redis와 api가 같은 VM 시계를 쓰므로 시계 차 여유만 둔다.
 */
export const WINDOW_GRACE_MS = 100;

export interface BatchEntry {
  id: string;
  /** 엔트리 ID의 밀리초 — Stream 체류(6a)의 시작점 */
  idMs: number;
  /** 행 배열 완료 시각(api 시계) — fan-in 대기(6c)의 시작점 */
  decodedAt: number;
  entry: DecodedEntry;
}

export interface ClosedWindow {
  k: number;
  entries: BatchEntry[];
}

export function idMsOf(id: string): number {
  return Number(id.slice(0, id.indexOf('-')));
}

export function windowOf(idMs: number): number {
  return Math.floor(idMs / WINDOW_MS);
}

/** 창 버퍼 — 컨슈머가 인계하고 flusher가 닫힌 창을 가져간다 */
export class WindowBuffer {
  private readonly open = new Map<number, BatchEntry[]>();
  /** 인계를 끝낸 최대 엔트리 ID 밀리초 — 컨슈머 1개(S2)라 워터마크 최솟값 = 이 값 */
  private watermarkMs = 0;

  /** 마지막으로 닫은 창 번호 — 닫힌 창을 다시 열지 않는다 */
  private lastClosedK = Number.NEGATIVE_INFINITY;
  /** 닫힌 창 뒤에 도착한 엔트리 수 — 다음 열린 창으로 넘긴다(같은 k가 두 배치가 되면 창 순서가 뒤집힌다) */
  lateEntries = 0;

  add(e: BatchEntry): void {
    let k = windowOf(e.idMs);
    if (k <= this.lastClosedK) {
      this.lateEntries++;
      k = this.lastClosedK + 1;
    }
    const list = this.open.get(k);
    if (list) list.push(e);
    else this.open.set(k, [e]);
    if (e.idMs > this.watermarkMs) this.watermarkMs = e.idMs;
  }

  /** 받아둔 ID 없이 워터마크만 올린다 — 해독 불가 엔트리도 창 진행에는 참여한다 */
  advance(idMs: number): void {
    if (idMs > this.watermarkMs) this.watermarkMs = idMs;
  }

  get size(): number {
    return this.open.size;
  }

  /**
   * 닫을 수 있는 창을 창 번호 순으로 꺼낸다.
   * ⓐ 워터마크 ≥ 창 끝(고부하) ⓑ 컨슈머가 따라잡았고(caughtUp) 읽기 시작 시각 ≥ 창 끝 + 유예(저부하).
   * ⓑ의 시계는 디코딩 뒤 시각이 아니라 그 읽기를 보낸 시각이다 — COUNT 미만 응답은 호출 전에 XADD된 엔트리를 전부 담으므로
   * 읽기 시작이 창 끝 + 유예를 넘었으면 그 창의 엔트리가 뒤에 올 수 없다. 디코딩 뒤 시각으로 판정하면 디코딩 사이 XADD가 닫힌 창에 늦게 온다.
   */
  takeClosable(readStartMs: number, caughtUp: boolean): ClosedWindow[] {
    const out: ClosedWindow[] = [];
    for (const k of [...this.open.keys()].sort((a, b) => a - b)) {
      const end = (k + 1) * WINDOW_MS;
      const byWatermark = this.watermarkMs >= end;
      const byClock = caughtUp && readStartMs >= end + WINDOW_GRACE_MS;
      if (!byWatermark && !byClock) break; // 창은 순서대로만 닫는다 — 뒤 창이 앞 창을 앞지르지 않는다
      out.push({ k, entries: (this.open.get(k) ?? []).sort((a, b) => cmpId(a.id, b.id)) });
      this.open.delete(k);
      this.lastClosedK = k;
    }
    return out;
  }

  /** 종료 시 남은 창 전부 */
  drainAll(): ClosedWindow[] {
    return this.takeClosable(Number.MAX_SAFE_INTEGER, true);
  }
}

/** 엔트리 ID 비교 — 밀리초 · 순번 두 부분 */
export function cmpId(a: string, b: string): number {
  const [am, as] = a.split('-').map(Number) as [number, number];
  const [bm, bs] = b.split('-').map(Number) as [number, number];
  return am - bm || as - bs;
}

/** 배치 → ClickHouse 행(JSONCompactEachRow 열 순서 = TAG_RAW_COLUMNS) · ts = t0 + dt(epoch ms 정수) */
export const TAG_RAW_COLUMNS = ['ts', 'device_id', 'tag_id', 'value', 'quality', 'scan_seq'] as const;
export type TagRawRow = [number, number, number, number, number, number];

export function rowsOf(w: ClosedWindow): TagRawRow[] {
  const rows: TagRawRow[] = [];
  for (const { entry: e } of w.entries) {
    for (let i = 0; i < e.tg.length; i++) {
      rows.push([e.t0 + (e.dt[i] ?? 0), e.d, e.tg[i] ?? 0, e.va[i] ?? 0, e.q[i] ?? 0, e.s]);
    }
  }
  return rows;
}
