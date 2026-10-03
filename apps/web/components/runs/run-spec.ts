// 실행 조작부 · 진행 띠의 순수 로직 — 매개변수 정의(쉬운 말 라벨) · 요청 본문 · 단계 n/m
// 버튼 상태 · 문구 · 종결 띠 · 경과 규칙은 lib/runs.ts(runControls · runBand · runElapsedText · flowProgress)를 그대로 쓴다 — 여기서 다시 만들지 않는다.
import { rowsWords } from '../../lib/perf';
import { largeRunWarning } from '../../lib/runs';
import {
  FLOW_BIZ_PER_SEC,
  FLOW_DURATION_SEC,
  FLOW_PPS,
  FLOW_READS_PER_SEC,
  PERF_MAX_EXPONENTS,
  RUN_DEFAULTS,
  type RunObjectBody,
} from '../../lib/shared';

export interface RunParamDef {
  key: string;
  label: string;
  values: readonly number[];
  defaultValue: number;
  text: (v: number) => string;
  /** 선택지 옆 경고 문구 — 없으면 null */
  warn?: (v: number) => string | null;
}

export const PERF_PARAM_DEFS: readonly RunParamDef[] = [
  {
    key: 'maxExponent',
    label: '어디까지',
    values: PERF_MAX_EXPONENTS,
    defaultValue: RUN_DEFAULTS.perf.maxExponent,
    text: rowsWords,
    warn: largeRunWarning,
  },
];

export const FLOW_PARAM_DEFS: readonly RunParamDef[] = [
  {
    key: 'pps',
    label: '센서 데이터(초당)',
    values: FLOW_PPS,
    defaultValue: RUN_DEFAULTS.flow.pps,
    text: (v) => v.toLocaleString('ko-KR'),
  },
  {
    key: 'durationSec',
    label: '보내는 시간',
    values: FLOW_DURATION_SEC,
    defaultValue: RUN_DEFAULTS.flow.durationSec,
    text: (v) => `${v}초`,
  },
  {
    key: 'bizPerSec',
    label: '업무 요청(초당)',
    values: FLOW_BIZ_PER_SEC,
    defaultValue: RUN_DEFAULTS.flow.bizPerSec,
    text: (v) => `${v}/초`,
  },
  // 조회 섞기(설계 §9.1) — 센서 시계열 · 센서 지금 값 · 업무 목록 조회를 초당 이만큼(0이면 보내지 않는다)
  {
    key: 'readsPerSec',
    label: '조회 요청(초당)',
    values: FLOW_READS_PER_SEC,
    defaultValue: RUN_DEFAULTS.flow.readsPerSec,
    text: (v) => (v === 0 ? '안 보냄' : `${v}/초`),
  },
];

export const defaultParams = (defs: readonly RunParamDef[]): Record<string, number> =>
  Object.fromEntries(defs.map((d) => [d.key, d.defaultValue]));

/** 고른 값 → 요청 params — 정의에 없는 키는 버리고 · 선택지에 없는 값은 기본값으로 되돌린다(서버 화이트리스트와 같은 닫힌 집합) */
export function buildRunParams(
  defs: readonly RunParamDef[],
  chosen: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    defs.map((d) => {
      const v = chosen[d.key];
      return [d.key, v !== undefined && d.values.includes(v) ? v : d.defaultValue];
    }),
  );
}

/** 고른 값에 걸린 경고 문구 모음(매개변수 순서) */
export function paramWarnings(defs: readonly RunParamDef[], chosen: Record<string, number>): string[] {
  return defs.flatMap((d) => {
    const v = chosen[d.key];
    const w = v === undefined ? null : (d.warn?.(v) ?? null);
    return w ? [w] : [];
  });
}

export interface StageProgress {
  /** 지금 단계 번호(1부터) — 완료면 total · 실패 · 중단이면 멈춘 단계의 위치 */
  n: number;
  total: number;
  /** 지금 단계 라벨(진행 중 · 멈춘 단계) — 완료면 null */
  label: string | null;
  /** 0~1 단계 기준 비율(끝난 단계 ÷ 전체) */
  ratio: number;
}

/**
 * 단계 n/m — 진행 띠 · 실행 단계 서랍 요약이 같은 세는 법을 쓴다.
 * 진행 중이면 running 단계(없으면 첫 대기 단계) · 완료면 m/m · 실패 · 중단이면 failed · stopped 단계의 위치(정리 단계가 뒤에서 돌아도 멈춘 자리).
 * 실패 · 중단인데 그런 단계가 없으면(정리 중 실패 등) 마지막으로 돈 단계의 위치.
 */
export function stageProgress(run: Pick<RunObjectBody, 'steps' | 'status'>): StageProgress {
  const total = run.steps.length;
  const finished = run.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const ratio = total === 0 ? 0 : finished / total;
  const at = (i: number): StageProgress => ({ n: i + 1, total, label: run.steps[i]?.label ?? null, ratio });
  if (run.status === 'completed') return { n: total, total, label: null, ratio };
  if (run.status === 'failed' || run.status === 'stopped') {
    const halted = run.steps.findIndex((s) => s.status === 'failed' || s.status === 'stopped');
    if (halted >= 0) return at(halted);
    const ran = run.steps.findLastIndex((s) => s.status !== 'pending' && s.status !== 'skipped');
    return ran >= 0 ? at(ran) : { n: 0, total, label: null, ratio };
  }
  const idx = run.steps.findIndex((s) => s.status === 'running');
  const pend = idx >= 0 ? idx : run.steps.findIndex((s) => s.status === 'pending');
  return pend >= 0 ? at(pend) : { n: total, total, label: null, ratio };
}
