// flow 발행 한 초 — 정본 docs/06_pipeline/10_datagen_inject.md §흐름 시연 실행 — flow(대용량 발행) · 판정 .omc/run-fix-rulings.md M3
// 시드 활성 태그 목록 T(길이 L) · 발행 초 s마다 점 i = 0 … pps − 1 · 태그 = T[(i + s × pps) mod L] ·
// ts = 초 시작 + ⌊i ÷ L⌋ × ⌊1000 ÷ ⌈pps ÷ L⌉⌋ ms — (태그 · ts) 중복 없음 · 같은 설비 · 같은 ts는 한 엔트리(엔트리 계약 v1 · quality 9).
// 값은 결정적 정수 산술(perf 생성 식과 같은 모양) — ((tag_id × 7 + 초 × 13) mod 1000) ÷ 10.
// 순수 함수라 worker_threads 작업으로 옮길 수 있다(04_architecture/02 §worker_threads 격리 대상).
import { encodeEntry, QUALITY } from '@db-study/shared';

export interface FlowTag {
  deviceId: number;
  tagId: number;
}

export interface FlowSecondTask {
  /** 시드 활성 태그 목록 — (device_id, tag_id) 오름차순 */
  tags: readonly FlowTag[];
  pps: number;
  /** 발행 초 번호(0부터) */
  second: number;
  /** 그 초의 시작(epoch ms) */
  secondStartMs: number;
}

export interface FlowSecondResult {
  payloads: Buffer[];
  /** 엔트리별 포인트 수(payloads와 같은 순서) */
  points: number[];
  totalPoints: number;
  busyMs: number;
}

/** 점 i의 태그 위치 · ts 오프셋(ms) */
export function flowPoint(
  i: number,
  second: number,
  pps: number,
  L: number,
): { idx: number; offsetMs: number } {
  const reps = Math.ceil(pps / L);
  const step = Math.floor(1000 / reps);
  return { idx: (i + second * pps) % L, offsetMs: Math.floor(i / L) * step };
}

export function flowValue(tagId: number, epochSec: number): number {
  return ((tagId * 7 + epochSec * 13) % 1000) / 10;
}

export function buildFlowSecond(task: FlowSecondTask): FlowSecondResult {
  const t0 = performance.now();
  const L = task.tags.length;
  if (L === 0) throw new Error('시드 활성 태그 없음');
  // 설비 · ts → 엔트리(삽입 순서 유지)
  const groups = new Map<string, { d: number; ts: number; tg: number[]; va: number[] }>();
  const epochSec = Math.floor(task.secondStartMs / 1000);
  for (let i = 0; i < task.pps; i++) {
    const { idx, offsetMs } = flowPoint(i, task.second, task.pps, L);
    const t = task.tags[idx] as FlowTag;
    const ts = task.secondStartMs + offsetMs;
    const key = `${t.deviceId}:${ts}`;
    let g = groups.get(key);
    if (!g) {
      g = { d: t.deviceId, ts, tg: [], va: [] };
      groups.set(key, g);
    }
    g.tg.push(t.tagId);
    g.va.push(flowValue(t.tagId, epochSec));
  }
  const payloads: Buffer[] = [];
  const points: number[] = [];
  for (const g of groups.values()) {
    const n = g.tg.length;
    payloads.push(
      encodeEntry({
        d: g.d,
        s: g.ts,
        t0: g.ts,
        tg: g.tg,
        dt: new Array<number>(n).fill(0),
        va: g.va,
        q: new Array<number>(n).fill(QUALITY.SIMULATED),
      }),
    );
    points.push(n);
  }
  return { payloads, points, totalPoints: task.pps, busyMs: performance.now() - t0 };
}
