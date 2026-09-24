import { describe, expect, it } from 'vitest';
import { parsePrometheusText, ratePerSecond, summarizeS2 } from '../lib/metrics-parser';

const TEXT = `# HELP consumer_lag 그룹 lag + pending
# TYPE consumer_lag gauge
consumer_lag 42
# TYPE e2e_latency gauge
e2e_latency{quantile="0.5"} 0.012
e2e_latency{quantile="0.95"} 0.034
e2e_latency{quantile="0.99"} 0.05
e2e_latency_rows 1200
# TYPE gen_points_generated_total counter
gen_points_generated_total{mode="A",profile="SINE"} 1000
gen_points_generated_total{mode="A",profile="RAMP"} 500
gen_points_generated_total{mode="standalone",profile="SINE"} 99999
obs_switch_info{switch="SW-02",env="REDIS_LATEST_CACHE",value="on",impl="RedisLatestValueReader"} 1
weird_label{a="x\\"y\\\\z\\n",b=",}"} 3 1758675600000
nan_metric NaN
inf_metric +Inf
broken{a="x" 1
`;

describe('parsePrometheusText', () => {
  const samples = parsePrometheusText(TEXT);

  it('주석을 건너뛰고 이름 · 레이블 · 값을 읽는다', () => {
    expect(samples.find((s) => s.name === 'consumer_lag')?.value).toBe(42);
    const sw = samples.find((s) => s.name === 'obs_switch_info');
    expect(sw?.labels).toEqual({
      switch: 'SW-02',
      env: 'REDIS_LATEST_CACHE',
      value: 'on',
      impl: 'RedisLatestValueReader',
    });
  });

  it('레이블 이스케이프 · 타임스탬프 · 특수 값', () => {
    const w = samples.find((s) => s.name === 'weird_label');
    expect(w?.labels).toEqual({ a: 'x"y\\z\n', b: ',}' });
    expect(w?.value).toBe(3);
    expect(Number.isNaN(samples.find((s) => s.name === 'nan_metric')?.value)).toBe(true);
    expect(samples.find((s) => s.name === 'inf_metric')?.value).toBe(Number.POSITIVE_INFINITY);
  });

  it('형식이 깨진 줄은 건너뛴다', () => {
    expect(samples.find((s) => s.name === 'broken')).toBeUndefined();
  });
});

describe('summarizeS2', () => {
  it('S2 3계열 요약 — 생성기는 모드 A만 합한다', () => {
    expect(summarizeS2(parsePrometheusText(TEXT))).toEqual({
      consumerLag: 42,
      e2e: { p50: 0.012, p95: 0.034, p99: 0.05, rows: 1200 },
      genPointsModeA: 1500,
    });
  });

  it('계열이 없으면 null(이 단계에서 아직 계측하지 않는다)', () => {
    expect(summarizeS2([])).toEqual({ consumerLag: null, e2e: null, genPointsModeA: null });
  });
});

describe('ratePerSecond', () => {
  it('두 폴링 사이 차 ÷ 경과 초', () => {
    expect(ratePerSecond({ value: 1000, atMs: 0 }, { value: 16_000, atMs: 15_000 })).toBe(1000);
  });

  it('누적값 감소(재기동)나 첫 표본이면 계산하지 않는다', () => {
    expect(ratePerSecond({ value: 1000, atMs: 0 }, { value: 10, atMs: 15_000 })).toBeNull();
    expect(ratePerSecond(null, { value: 10, atMs: 15_000 })).toBeNull();
  });
});
