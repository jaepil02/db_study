// 업무 명령 계열(워커 쪽) — 이름 정본 docs/10_observability/01_metrics_catalog.md biz_* · 계측 지점 02_instrumentation §업무 명령 적용 · 랙
// biz_commands_total은 계수 주체가 둘이다(워커 = applied · rejected · expired · failed · api = timeout · unavailable) — 레지스트리 등록은 여기 한 번이고
// api 쪽(biz-api.metrics.ts)은 이 객체를 import해 올린다(같은 이름을 두 번 만들면 등록이 실패한다).
import { BIZ_KINDS } from '@db-study/shared';
import { Counter, Gauge, Histogram } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';

const reg = [appRegistry];

/** biz_commands_total result 6값 — 워커 4 + api 2 */
export const BIZ_COMMAND_RESULTS = [
  'applied',
  'rejected',
  'expired',
  'failed',
  'timeout',
  'unavailable',
] as const;
export type BizCommandResult = (typeof BIZ_COMMAND_RESULTS)[number];

export const bizMetrics = {
  // 모듈 로드 순서와 무관하게 한 번만 등록한다 — api 쪽(biz-api.metrics.ts)도 같은 가드로 같은 객체를 쓴다
  commands:
    (appRegistry.getSingleMetric('biz_commands_total') as Counter<'kind' | 'result'> | undefined) ??
    new Counter({
      name: 'biz_commands_total',
      help: '업무 명령의 결말 — 워커 종결 4값 · api timeout · unavailable(한 명령이 두 번 셀 수 있다)',
      labelNames: ['kind', 'result'] as const,
      registers: reg,
    }),
  apply: new Histogram({
    name: 'biz_apply_seconds',
    help: '워커 적용 — BEGIN부터 COMMIT(또는 롤백)까지',
    labelNames: ['kind'] as const,
    buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: reg,
  }),
  streamLag: new Gauge({
    name: 'biz_stream_lag',
    help: 'stream:biz:cmd grp:biz-writer 미확인 적체 — lag + pending',
    registers: reg,
  }),
  duplicates: new Counter({
    name: 'biz_duplicates_total',
    help: '원장에 이미 있는 cmdId — 적용 없이 저장된 결과를 다시 낸 수',
    labelNames: ['kind'] as const,
    registers: reg,
  }),
};

// 닫힌 레이블 값마다 0으로 시작한다(S5 관례) — kind 14 × result 6 · 적용 · 중복은 kind 14
for (const kind of BIZ_KINDS) {
  for (const result of BIZ_COMMAND_RESULTS) bizMetrics.commands.inc({ kind, result }, 0);
  bizMetrics.duplicates.inc({ kind }, 0);
}
