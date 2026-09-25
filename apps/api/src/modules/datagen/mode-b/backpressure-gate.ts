// 모드 B 적체 검사 — 기전 정본 docs/06_pipeline/10_datagen_inject.md §모드 B 적체 검사 · 임계 정본 docs/04_architecture/06_backpressure_failure.md
// 판정량 = grp:ingest의 lag + pending(미확인 적체 — XLEN이 아니다 · ADR-21).
// 임계 = MAXLEN 비율 셋(주의 10% · 경고 50% · 위험 90%) — 발행 경로 셋이 같은 임계를 쓴다.
// 위험(적체 > 위험 임계 또는 XADD 실패)이면 발행을 멈추고, 적체 < 주의 임계로 내려오면 재개한다(위험의 하강 기준 · ADR-23).
// 주의 · 경고의 반응(컨슈머 증설 · 데드밴드 강화)은 모드 B에 없다 — 단계는 게이지로만 낸다.
import type { GroupBacklog } from '../../../common/redis/durable-key-client';

/** 백프레셔 단계 값(01_metrics_catalog §레이블 stage) — 모드 B는 스풀이 없어 복구(4)를 쓰지 않는다 */
export const STAGE = { NORMAL: 0, CAUTION: 1, WARNING: 2, DANGER: 3, RECOVERY: 4 } as const;
export type Stage = (typeof STAGE)[keyof typeof STAGE];

/** 임계 비율(현행 · 세 프로파일 공통) — 04_architecture/06 §프로파일별 임계 */
export const THRESHOLD_RATIOS = { caution: 0.1, warning: 0.5, danger: 0.9 } as const;

export interface Thresholds {
  caution: number;
  warning: number;
  danger: number;
}

/** MAXLEN에서 임계 셋 — 주의 < 경고 < 위험 < MAXLEN이 성립하지 않으면 기동 거절(§임계 조회 계약) */
export function thresholdsFor(maxlen: number): Thresholds {
  const t = {
    caution: Math.round(maxlen * THRESHOLD_RATIOS.caution),
    warning: Math.round(maxlen * THRESHOLD_RATIOS.warning),
    danger: Math.round(maxlen * THRESHOLD_RATIOS.danger),
  };
  if (!(t.caution > 0 && t.caution < t.warning && t.warning < t.danger && t.danger < maxlen))
    throw new Error(
      `임계 모순 — 주의 ${t.caution} < 경고 ${t.warning} < 위험 ${t.danger} < MAXLEN ${maxlen} 불성립`,
    );
  return t;
}

/** 적체 대역 단계(위험 이력 없이) — 정상 < 주의 ≤ … < 경고 ≤ … ≤ 위험 < 위험 */
export function bandStage(backlog: number, t: Thresholds): Stage {
  if (backlog > t.danger) return STAGE.DANGER;
  if (backlog >= t.warning) return STAGE.WARNING;
  if (backlog >= t.caution) return STAGE.CAUTION;
  return STAGE.NORMAL;
}

export class BackpressureGate {
  private current: Stage = STAGE.NORMAL;

  constructor(readonly thresholds: Thresholds) {}

  get stage(): Stage {
    return this.current;
  }

  /** 발행을 멈춰야 하는가 — 직전 파이프라인이 준 단계가 위험 */
  get halted(): boolean {
    return this.current === STAGE.DANGER;
  }

  /**
   * 적체 응답 하나 반영. lag가 비면(스트림 중간 삭제 등) · 그룹 조회가 실패하면 직전 단계를 유지한다(ADR-21).
   * 위험에서는 적체가 주의 임계 아래로 와야 풀린다 — 위험 임계 바로 아래 재개는 발행 · 중단이 번갈아 든다.
   * 주의 · 경고의 하강 히스테리시스(폭 · 유지 시간)는 S6 미정이라 대역을 그대로 따른다 — 모드 B에는 그 단계의 반응이 없다.
   */
  observe(b: GroupBacklog | null): Stage {
    if (!b || b.lag === null) return this.current;
    const backlog = b.lag + b.pending;
    if (this.current === STAGE.DANGER) {
      if (backlog < this.thresholds.caution) this.current = STAGE.NORMAL;
      return this.current;
    }
    this.current = bandStage(backlog, this.thresholds);
    return this.current;
  }

  /** XADD 실패(OOM · 연결 끊김) — 위험으로 간주한다 */
  xaddFailed(): Stage {
    this.current = STAGE.DANGER;
    return this.current;
  }
}
