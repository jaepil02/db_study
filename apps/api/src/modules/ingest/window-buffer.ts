// 창 정렬 배치 — 기전 정본 docs/06_pipeline/03_ingest_batch.md §창 정렬 배치와 결정적 토큰
// 창 k = 엔트리 ID 밀리초(Redis가 XADD를 받은 시각)가 [k × W, (k + 1) × W)에 드는 엔트리 전부 — flusher 시계로 자르지 않는다.
// 창 안은 ID 오름차순 누적 행 수가 R(또는 본문 바이트가 P)에 닿는 자리에서 자른다(S3 — ING-02 행 수 · 페이로드 트리거).
// 창 닫힘: ⓐ 모든 컨슈머의 인계 워터마크 최솟값 ≥ 창 끝(고부하) ⓑ 시계가 창 끝 + 유예를 넘었고 디코딩 중인 엔트리가 없다(저부하).
// 회수분(XAUTOCLAIM)은 회수 커서가 창 끝을 지나야 닫힌다 — 창의 일부만 회수된 채 닫으면 나머지가 별도 배치가 되어 토큰이 달라진다.
import type { DecodedEntry } from '../../common/workers/tasks';

/** 창 폭 W — 2계층 조정값 현행 참고 1,000 ms(소유 06_pipeline/03) · 배치 안별 값은 INGEST_BATCH_PLANS(A · C 1,000 · B 5,000) */
export const WINDOW_MS = 1000;
/**
 * 저부하 창 닫힘 유예 — ⓑ 경로(api 시계가 창 끝 + 유예를 넘고 디코딩 중인 엔트리가 없다).
 * 2계층 · 현행 참고 100 ms(S2 판정 · 06_pipeline/03 §창 정렬 배치): Redis와 api가 같은 VM 시계를 쓰므로 시계 차 여유만 둔다.
 */
export const WINDOW_GRACE_MS = 100;

export interface BatchEntry {
  id: string;
  /** 엔트리 ID의 밀리초 — Stream 체류(6a)의 시작점 */
  idMs: number;
  /** 행 배열 완료 시각(api 시계) — fan-in 대기(6c)의 시작점 */
  decodedAt: number;
  entry: DecodedEntry;
  /** 원 본문(MessagePack 바이트) — 재시도 소진 시 DLQ에 그대로 싣는다(06_pipeline/12 §DLQ 엔트리) */
  payload?: Buffer;
  /** JSONCompactEachRow 본문 바이트(압축 전) — 페이로드 트리거 P의 재료 · 버퍼가 처음 받을 때 채운다 */
  bytes?: number;
}

export interface ClosedWindow {
  k: number;
  entries: BatchEntry[];
}

/** 배치 하나 = 창 안 조각 하나 — 토큰 재료는 첫 · 끝 엔트리 ID와 행 수뿐이다(k · seq는 로그용) */
export interface Piece {
  k: number;
  /** 창 안 조각 순번(0부터) — 회수 창은 회수분 안에서 다시 센다 */
  seq: number;
  recovered: boolean;
  /** ID 오름차순 */
  entries: BatchEntry[];
  rows: number;
  bytes: number;
}

export interface SplitLimits {
  /** 행 트리거 R — 현행 참고 50,000 */
  maxRows: number;
  /** 페이로드 트리거 P(압축 전 본문 바이트) — 현행 참고 32 MB */
  maxBytes: number;
}

export function idMsOf(id: string): number {
  return Number(id.slice(0, id.indexOf('-')));
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

export function rowsOf(w: { entries: readonly BatchEntry[] }): TagRawRow[] {
  const rows: TagRawRow[] = [];
  for (const { entry: e } of w.entries) {
    for (let i = 0; i < e.tg.length; i++) {
      rows.push([e.t0 + (e.dt[i] ?? 0), e.d, e.tg[i] ?? 0, e.va[i] ?? 0, e.q[i] ?? 0, e.s]);
    }
  }
  return rows;
}

/** JSON 수 표기의 길이 — 유한하지 않은 값은 JSON.stringify가 null로 쓴다 */
function numLen(n: number): number {
  return Number.isFinite(n) ? String(n).length : 4;
}

/**
 * 엔트리 하나가 JSONCompactEachRow 본문에서 차지하는 바이트 — 행마다 "[ts,d,tag,value,q,s]\n".
 * 엔트리 내용만의 함수라 결정적이다(같은 엔트리 → 같은 바이트 → 같은 P 분할).
 */
export function entryBytes(be: BatchEntry): number {
  if (be.bytes !== undefined) return be.bytes;
  const e = be.entry;
  const fixed = 8 + numLen(e.d) + numLen(e.s); // '[' · 쉼표 5 · ']' · 개행
  let bytes = 0;
  for (let i = 0; i < e.tg.length; i++) {
    bytes +=
      fixed +
      numLen(e.t0 + (e.dt[i] ?? 0)) +
      numLen(e.tg[i] ?? 0) +
      numLen(e.va[i] ?? 0) +
      numLen(e.q[i] ?? 0);
  }
  be.bytes = bytes;
  return bytes;
}

/**
 * ID 순 엔트리를 R · P에 닿는 자리에서 자른다 — 결정적 분할(06_pipeline/03 §창 정렬 배치).
 * 엔트리는 쪼개지 않는다(XACK 단위가 엔트리다) — 엔트리 하나가 상한을 넘으면 그 엔트리 혼자 한 조각이다.
 * final이 아니면 마지막 조각은 뒤에 엔트리가 더 붙을 수 있어 확정하지 않고 rest로 돌려준다 — 조각은 "다음 엔트리가 넘치게 하는 자리"에서만 확정된다.
 * 그래서 앞 조각을 먼저 내보내도(창이 닫히기 전 확정 접두) 창이 닫힌 뒤 통째로 자른 것과 경계가 같다.
 */
export function splitPieces(
  sorted: readonly BatchEntry[],
  limits: SplitLimits,
  final: boolean,
): { pieces: BatchEntry[][]; rest: BatchEntry[] } {
  const pieces: BatchEntry[][] = [];
  let cur: BatchEntry[] = [];
  let rows = 0;
  let bytes = 0;
  for (const e of sorted) {
    const r = e.entry.tg.length;
    const b = entryBytes(e);
    if (cur.length > 0 && (rows + r > limits.maxRows || bytes + b > limits.maxBytes)) {
      pieces.push(cur);
      cur = [];
      rows = 0;
      bytes = 0;
    }
    cur.push(e);
    rows += r;
    bytes += b;
  }
  if (final && cur.length > 0) {
    pieces.push(cur);
    cur = [];
  }
  return { pieces, rest: cur };
}

interface ConsumerMark {
  /** 인계를 끝낸 최대 엔트리 ID 밀리초 */
  watermarkMs: number;
  /** COUNT 미만 응답(Stream 꼬리까지 읽음)을 받은 마지막 읽기의 시작 시각 — ⓑ의 시계 */
  drainedFromMs: number;
  /** 읽기를 멈추고 쥔 엔트리도 없다(보유 상한 정지 · 종료) — 따라잡은 것으로 본다 */
  idle: boolean;
}

export interface WindowBufferOptions {
  windowMs?: number;
  graceMs?: number;
  limits?: SplitLimits;
  /** 인계하는 컨슈머 이름 전부 — 워터마크 최솟값의 대상(없으면 컨슈머 1개) */
  consumers?: readonly string[];
}

const NO_LIMIT: SplitLimits = { maxRows: Number.POSITIVE_INFINITY, maxBytes: Number.POSITIVE_INFINITY };

/** 창 버퍼 — 컨슈머 N이 인계하고 flusher가 확정된 조각을 가져간다(구성 요소 표의 창 버퍼 1) */
export class WindowBuffer {
  readonly windowMs: number;
  readonly graceMs: number;
  private readonly limits: SplitLimits;
  private readonly marks = new Map<string, ConsumerMark>();
  private readonly defaultConsumer: string;

  /** 열린 창 — 아직 조각으로 내보내지 않은 엔트리 */
  private readonly open = new Map<number, BatchEntry[]>();
  private readonly nextSeq = new Map<number, number>();
  /** 창 안에서 마지막으로 내보낸 엔트리 ID — 이보다 작은 ID가 뒤에 오면 늦은 엔트리다 */
  private readonly lastEmitted = new Map<number, string>();
  /** 마지막으로 닫은 창 번호 — 닫힌 창을 다시 열지 않는다 */
  private lastClosedK = Number.NEGATIVE_INFINITY;
  /** 닫힌 창(또는 내보낸 접두) 뒤에 도착한 엔트리 수 — 다음 창으로 넘긴다(같은 k가 두 배치가 되면 창 순서가 뒤집힌다) */
  lateEntries = 0;

  /** 회수 창 — 이미 닫힌 창의 회수분(XAUTOCLAIM) */
  private readonly recovered = new Map<number, BatchEntry[]>();
  private readonly recoveredSeq = new Map<number, number>();
  /** 진행 중인 회수 스캔의 커서(밀리초) — null이면 스캔이 없다(회수 창은 모두 닫힐 수 있다) */
  private reclaimCursorMs: number | null = null;

  /** 조립 중(내보내지 않은) 행 수 — 보유 상한의 창 버퍼 칸 셈 */
  private rowsHeld = 0;

  constructor(opts: WindowBufferOptions = {}) {
    this.windowMs = opts.windowMs ?? WINDOW_MS;
    this.graceMs = opts.graceMs ?? WINDOW_GRACE_MS;
    this.limits = opts.limits ?? NO_LIMIT;
    const names = opts.consumers && opts.consumers.length > 0 ? opts.consumers : ['default'];
    for (const n of names) {
      this.marks.set(n, {
        watermarkMs: Number.NEGATIVE_INFINITY,
        drainedFromMs: Number.NEGATIVE_INFINITY,
        idle: false,
      });
    }
    this.defaultConsumer = names[0] as string;
  }

  windowOf(idMs: number): number {
    return Math.floor(idMs / this.windowMs);
  }

  private mark(consumer: string): ConsumerMark {
    const m = this.marks.get(consumer);
    if (!m) throw new Error(`창 버퍼에 등록되지 않은 컨슈머 — ${consumer}`);
    return m;
  }

  /** ④ 인계 — 컨슈머가 디코딩을 끝낸 엔트리 하나 */
  add(e: BatchEntry, consumer = this.defaultConsumer): void {
    this.place(e);
    this.advance(e.idMs, consumer);
  }

  private place(e: BatchEntry): void {
    let k = this.windowOf(e.idMs);
    if (k <= this.lastClosedK) {
      this.lateEntries++;
      k = this.lastClosedK + 1;
    } else {
      const last = this.lastEmitted.get(k);
      if (last !== undefined && cmpId(e.id, last) < 0) this.lateEntries++; // 창 안 남은 조각으로 간다
    }
    const list = this.open.get(k);
    if (list) list.push(e);
    else this.open.set(k, [e]);
    this.rowsHeld += e.entry.tg.length;
  }

  /** 받아둔 ID 없이 워터마크만 올린다 — 해독 불가 엔트리도 창 진행에는 참여한다 */
  advance(idMs: number, consumer = this.defaultConsumer): void {
    const m = this.mark(consumer);
    if (idMs > m.watermarkMs) m.watermarkMs = idMs;
  }

  /**
   * '>' 읽기가 COUNT 미만을 돌려줬다 — 그 읽기가 서버에 닿은 순간 미배달 엔트리를 전부 가져갔으므로,
   * 이 컨슈머가 뒤에 받을 엔트리는 그 뒤 XADD된 것(ID 밀리초 ≥ 읽기 시작 − 시계 차)이다. 인계를 끝낸 뒤에 부른다.
   */
  markDrained(consumer: string, readStartMs: number): void {
    const m = this.mark(consumer);
    if (readStartMs > m.drainedFromMs) m.drainedFromMs = readStartMs;
  }

  /** 대기 — 읽기를 멈췄고 쥔 엔트리가 없다. 대기 중인 컨슈머는 따라잡은 것으로 본다(06_pipeline/03 ⓐ) */
  setIdle(consumer: string, idle: boolean): void {
    this.mark(consumer).idle = idle;
  }

  /**
   * 확정 경계(밀리초) — 이보다 작은 ID 밀리초의 엔트리는 더 오지 않는다.
   * 컨슈머별 하한 = max(워터마크 ⓐ, 꼬리까지 읽은 읽기 시작 − 유예 ⓑ) · 대기 컨슈머는 인계 전체 최댓값(따라잡음)이다.
   * 대기 컨슈머가 뒤에 받을 엔트리는 지금까지 배달된 모든 엔트리보다 뒤 ID라 전체 최댓값이 그 하한이다.
   * 경계 = 컨슈머 하한의 최솟값(워터마크 최솟값 규칙). 창은 경계 ≥ 창 끝이면 닫힌다.
   */
  finalBoundMs(): number {
    let globalMax = Number.NEGATIVE_INFINITY;
    for (const m of this.marks.values()) if (m.watermarkMs > globalMax) globalMax = m.watermarkMs;
    let bound = Number.POSITIVE_INFINITY;
    for (const m of this.marks.values()) {
      const lower = m.idle ? globalMax : Math.max(m.watermarkMs, m.drainedFromMs - this.graceMs);
      if (lower < bound) bound = lower;
    }
    return bound;
  }

  get size(): number {
    return this.open.size;
  }

  /** 조립 중 행 수(열린 창 + 회수 창) — 보유 상한 셈의 원천 */
  get assemblingRows(): number {
    return this.rowsHeld;
  }

  /**
   * ⑤ 배치 확정 — 내보낼 수 있는 조각을 창 번호 · ID 순으로 꺼낸다.
   * 닫힌 창은 통째로 자르고, 열린 첫 창은 확정 접두(ID 밀리초 < 경계)에서 완성된 조각만 먼저 내보낸다 —
   * R보다 큰 창(M+ · L)을 창 버퍼 한 칸에 쥐지 않기 위해서다. 경계가 같은 규칙이라 조각은 창이 닫힌 뒤 자른 것과 같다.
   */
  takePieces(): Piece[] {
    const out: Piece[] = [];
    const bound = this.finalBoundMs();
    for (const k of [...this.open.keys()].sort((a, b) => a - b)) {
      const end = (k + 1) * this.windowMs;
      const entries = (this.open.get(k) ?? []).sort((a, b) => cmpId(a.id, b.id));
      if (bound >= end) {
        this.emit(out, k, splitPieces(entries, this.limits, true).pieces, false);
        this.open.delete(k);
        this.nextSeq.delete(k);
        this.lastEmitted.delete(k);
        this.lastClosedK = k;
        continue;
      }
      // 창은 순서대로만 닫는다 — 경계가 이 창 안에 있으면 뒤 창에는 확정 엔트리가 없다
      let n = 0;
      while (n < entries.length && (entries[n] as BatchEntry).idMs < bound) n++;
      const { pieces, rest } = splitPieces(entries.slice(0, n), this.limits, false);
      if (pieces.length > 0) {
        this.emit(out, k, pieces, false);
        const lastPiece = pieces[pieces.length - 1] as BatchEntry[];
        this.lastEmitted.set(k, (lastPiece[lastPiece.length - 1] as BatchEntry).id);
        this.open.set(k, [...rest, ...entries.slice(n)]);
      }
      break;
    }
    out.push(...this.takeRecovered());
    return out;
  }

  private emit(out: Piece[], k: number, pieces: BatchEntry[][], recovered: boolean): void {
    const seqs = recovered ? this.recoveredSeq : this.nextSeq;
    for (const entries of pieces) {
      const seq = seqs.get(k) ?? 0;
      seqs.set(k, seq + 1);
      let rows = 0;
      let bytes = 0;
      for (const e of entries) {
        rows += e.entry.tg.length;
        bytes += entryBytes(e);
      }
      this.rowsHeld -= rows;
      out.push({ k, seq, recovered, entries, rows, bytes });
    }
  }

  /** ⑨ 회수분 인계 — 이미 닫힌 창이면 회수 창으로, 아직 열린(또는 미래) 창이면 일반 인계와 같은 창으로 */
  addRecovered(e: BatchEntry): void {
    const k = this.windowOf(e.idMs);
    if (k > this.lastClosedK) {
      this.place(e); // 워터마크는 올리지 않는다 — 회수자는 인계 컨슈머가 아니다
      return;
    }
    const list = this.recovered.get(k);
    if (list) list.push(e);
    else this.recovered.set(k, [e]);
    this.rowsHeld += e.entry.tg.length;
  }

  /**
   * 회수 스캔 커서 — XAUTOCLAIM의 다음 시작 ID 밀리초(스캔 시작은 0) · null은 스캔 끝(0-0).
   * 커서보다 작은 ID의 PEL은 이번 스캔에서 이미 훑었다 — 회수 창은 커서가 창 끝을 지나야 닫힌다.
   */
  setReclaimCursor(ms: number | null): void {
    this.reclaimCursorMs = ms;
  }

  /**
   * 회수 스캔이 끝나지 못하고 종료할 때 — 회수 창을 내보내지 않고 버린다(엔트리는 XACK되지 않아 인수자의 PEL에 남는다).
   * 일부만 회수된 창을 닫으면 조각 경계가 달라져 토큰이 흔들린다 — 재기동 뒤 인수자가 자기 PEL을 ID 0부터 다시 읽는다.
   */
  discardRecovered(): string[] {
    const ids: string[] = [];
    for (const list of this.recovered.values()) {
      for (const e of list) {
        ids.push(e.id);
        this.rowsHeld -= e.entry.tg.length;
      }
    }
    this.recovered.clear();
    this.recoveredSeq.clear();
    this.reclaimCursorMs = null;
    return ids;
  }

  private takeRecovered(): Piece[] {
    const out: Piece[] = [];
    const bound = this.reclaimCursorMs ?? Number.POSITIVE_INFINITY;
    for (const k of [...this.recovered.keys()].sort((a, b) => a - b)) {
      const end = (k + 1) * this.windowMs;
      const entries = (this.recovered.get(k) ?? []).sort((a, b) => cmpId(a.id, b.id));
      if (bound < end) {
        // 회수 창의 확정 접두 선배출 — XAUTOCLAIM은 ID 순으로 훑어 커서 미만은 확정이다. 이것이 없으면 2R 이상 쌓인
        // 회수 창이 보유 상한을 채워 회수(다음 페이지)와 컨슈머가 서로를 기다린다(검수 D2). 경계 규칙이 같아 조각은 같다.
        let n = 0;
        while (n < entries.length && (entries[n] as BatchEntry).idMs < bound) n++;
        const { pieces, rest } = splitPieces(entries.slice(0, n), this.limits, false);
        if (pieces.length > 0) {
          this.emit(out, k, pieces, true);
          this.recovered.set(k, [...rest, ...entries.slice(n)]);
        }
        break;
      }
      this.emit(out, k, splitPieces(entries, this.limits, true).pieces, true);
      this.recovered.delete(k);
      this.recoveredSeq.delete(k);
    }
    return out;
  }

  /** 종료 드레인 — 모든 열린 창 · 회수 창을 닫고 자른다(회수 스캔은 먼저 끝나 있어야 한다) */
  drainPieces(): Piece[] {
    for (const m of this.marks.values()) {
      m.idle = true;
      m.watermarkMs = Number.POSITIVE_INFINITY;
    }
    this.reclaimCursorMs = null;
    return this.takePieces();
  }

  /**
   * S2 호환 — 닫을 수 있는 창을 통째로(분할 없이) 꺼낸다. caughtUp이면 기본 컨슈머가 readStartMs에 꼬리까지 읽은 것이다.
   * ⓑ의 시계는 디코딩 뒤 시각이 아니라 그 읽기를 보낸 시각이다 — COUNT 미만 응답은 호출 전에 XADD된 엔트리를 전부 담는다.
   */
  takeClosable(readStartMs: number, caughtUp: boolean): ClosedWindow[] {
    if (caughtUp) this.markDrained(this.defaultConsumer, readStartMs);
    const bound = this.finalBoundMs();
    const out: ClosedWindow[] = [];
    for (const k of [...this.open.keys()].sort((a, b) => a - b)) {
      if (bound < (k + 1) * this.windowMs) break;
      const entries = (this.open.get(k) ?? []).sort((a, b) => cmpId(a.id, b.id));
      for (const e of entries) this.rowsHeld -= e.entry.tg.length;
      out.push({ k, entries });
      this.open.delete(k);
      this.nextSeq.delete(k);
      this.lastEmitted.delete(k);
      this.lastClosedK = k;
    }
    return out;
  }

  /** S2 호환 — 종료 시 남은 창 전부(분할 없이) */
  drainAll(): ClosedWindow[] {
    return this.takeClosable(Number.MAX_SAFE_INTEGER, true);
  }
}
