// 진행 띠의 순수 로직 — 단계 n/m
// 버튼 상태 · 문구 · 종결 띠 · 경과 규칙은 lib/runs.ts(runControls · runBand · runElapsedText)를 그대로 쓴다 — 여기서 다시 만들지 않는다.
import type { RunObjectBody } from '../../lib/shared';

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
