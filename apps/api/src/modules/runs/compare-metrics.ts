// 직접 비교의 계측 읽기(프로세스 안) — 같은 배치를 받은 두 싱크의 시간 · COPY 실패를 실행 앞뒤 차분으로 잰다(기록 045의 방법)
// 원천: insert_duration(ClickHouse 삽입 · 구간 #7) · ing_control_copy_seconds(PostgreSQL COPY) · ing_control_copy_failures_total ·
// rows_inserted(tag_raw에 쓰인 행). 누적 히스토그램을 그대로 읽으면 앞 실행의 표본이 섞이므로 버킷 차를 쓴다.
// 분위수는 칸 안 선형 보간이다 — 표본이 한 칸에 몰리면 칸의 50% · 95% 지점이 나온다(해상도 = 칸 폭 · 기록 045 한계 절).
// 이 계열은 적재(IngestModule)와 같은 프로세스에 있을 때만 움직인다 — APP_ROLE all(로컬 기본). api · worker로 나누면 표본 0이다.
import { Gauge } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';
import { ingestMetrics as m } from '../ingest/ingest.metrics';

export interface HistSnapshot {
  /** 누적 버킷 — [le(초), 누적 수] · le 오름차순(+Inf 포함) */
  buckets: [number, number][];
  count: number;
  sum: number;
}

export interface CompareMeterSnapshot {
  insert: HistSnapshot;
  copy: HistSnapshot;
  copyFailures: number;
  rowsInserted: number;
  copyRows: number;
}

type MetricGet = Awaited<ReturnType<typeof m.insertDuration.get>>;

export function histOf(g: MetricGet): HistSnapshot {
  const buckets: [number, number][] = [];
  let count = 0;
  let sum = 0;
  for (const v of g.values) {
    const name = (v as { metricName?: string }).metricName ?? '';
    if (name.endsWith('_bucket')) {
      const le = v.labels.le;
      buckets.push([le === '+Inf' ? Number.POSITIVE_INFINITY : Number(le), v.value]);
    } else if (name.endsWith('_count')) count = v.value;
    else if (name.endsWith('_sum')) sum = v.value;
  }
  buckets.sort((a, b) => a[0] - b[0]);
  return { buckets, count, sum };
}

async function counterValue(c: { get(): Promise<{ values: { value: number }[] }> }): Promise<number> {
  return (await c.get()).values.reduce((a, v) => a + v.value, 0);
}

export async function meterSnapshot(): Promise<CompareMeterSnapshot> {
  return {
    insert: histOf(await m.insertDuration.get()),
    copy: histOf(await m.controlCopySeconds.get()),
    copyFailures: await counterValue(m.controlCopyFailures),
    rowsInserted: await counterValue(m.rowsInserted),
    copyRows: await counterValue(m.controlCopyRows),
  };
}

/** 두 스냅샷의 차 — 같은 le끼리 뺀다 */
export function histDiff(a: HistSnapshot, b: HistSnapshot): HistSnapshot {
  const prev = new Map(a.buckets.map(([le, n]) => [le, n]));
  return {
    buckets: b.buckets.map(([le, n]) => [le, n - (prev.get(le) ?? 0)]),
    count: b.count - a.count,
    sum: b.sum - a.sum,
  };
}

/** 분위수(초) — 누적 버킷에서 칸 안 선형 보간 · 표본 0이면 null · +Inf 칸이면 아래 경계 */
export function histQuantile(h: HistSnapshot, q: number): number | null {
  if (h.count <= 0) return null;
  const rank = q * h.count;
  let prevLe = 0;
  let prevN = 0;
  for (const [le, n] of h.buckets) {
    if (n >= rank) {
      if (!Number.isFinite(le)) return prevLe;
      const inBucket = n - prevN;
      if (inBucket <= 0) return le;
      return prevLe + (le - prevLe) * ((rank - prevN) / inBucket);
    }
    prevLe = le;
    prevN = n;
  }
  return prevLe;
}

/** 초 → ms(0.01 반올림) · null 유지 */
export function toMs(sec: number | null): number | null {
  return sec === null ? null : Math.round(sec * 100_000) / 100;
}

/**
 * backpressure_stage{publisher} — 발행자가 판정한 백프레셔 단계(01_metrics_catalog). 직접 비교 발행은 publisher compare로 낸다
 * (모드 B 실행기와 함께 gen_b가 사라졌다 · D-16). 실행이 끝나면 0(정상)으로 되돌린다.
 */
export const backpressureStage =
  (appRegistry.getSingleMetric('backpressure_stage') as Gauge<'publisher'> | undefined) ??
  new Gauge({
    name: 'backpressure_stage',
    help: '발행 경로별 백프레셔 단계(0 정상 · 1 주의 · 2 경고 · 3 위험 · 4 복구)',
    labelNames: ['publisher'],
    registers: [appRegistry],
  });
