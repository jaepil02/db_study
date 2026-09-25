// SIM 주입 계획(SIM-04 · 05) — 제어 정본 docs/06_pipeline/10_datagen_inject.md §SIM 주입 제어 · 형식 docs/09_tech_stack/05_tooling_devops.md §SIM 주입 계획 파일 형식
// 기동 때 한 번 읽는다 · 실행 중 바꾸지 않는다(전환 = 재기동). 검증 규칙 4 — 스키마 · 포트 범위(대역 + 시드된 설비 포트) · 종류별 필수 값 · 겹침.
// 스키마 · 종류별 필수 값 · 겹침 · 대역은 shared SimFaultPlan이, "시드된 설비 포트 안"은 여기서(기동 로드 뒤) 검사한다.
import { readFileSync } from 'node:fs';
import { SimFaultPlan, type SimFaultPlanBody } from '@db-study/shared';

export class SimFaultPlanRejectedError extends Error {}

export type SimFault = SimFaultPlanBody['faults'][number];

/** 계획 파일 읽기 · 스키마 검증 — 실패는 기동 거부(SimFaultPlanRejectedError) */
export function loadFaultPlan(
  path: string,
  read: (p: string) => string = (p) => readFileSync(p, 'utf8'),
): SimFaultPlanBody {
  let json: unknown;
  try {
    json = JSON.parse(read(path));
  } catch (e) {
    throw new SimFaultPlanRejectedError(
      `SIM_FAULT_PLAN ${path} 읽기 실패 — ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const r = SimFaultPlan.safeParse(json);
  if (!r.success) {
    const problems = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new SimFaultPlanRejectedError(`SIM_FAULT_PLAN ${path} 검증 실패 — ${problems.join(' · ')}`);
  }
  return r.data;
}

/**
 * 검증 규칙 "시드된 설비 포트 안" — 계획의 포트 범위에 든 포트가 전부 SIM이 띄울 설비의 포트여야 한다.
 * 없는 설비에 건 주입은 아무 일도 하지 않아 "주입했는데 변화 없음"이 결과로 기록된다(09_tech_stack/05).
 */
export function assertPlanPorts(plan: SimFaultPlanBody, simPorts: ReadonlySet<number>): void {
  const missing: string[] = [];
  plan.faults.forEach((f, i) => {
    for (let p = f.ports.from; p <= f.ports.to; p++)
      if (!simPorts.has(p)) missing.push(`faults[${i}] 포트 ${p}`);
  });
  if (missing.length > 0)
    throw new SimFaultPlanRejectedError(`SIM_FAULT_PLAN — 시드된 설비 포트 밖: ${missing.join(' · ')}`);
}

export type ActiveFault = { kind: 'delay'; delayMs: number } | { kind: 'exception'; exceptionCode: number };

/**
 * 계획의 시간표 — 시작 오프셋은 SIM 기동(포트 기동 완료) 시각 기준 ms다. 겹침은 스키마가 이미 거부했으므로
 * 한 요청에 걸리는 주입은 많아야 하나다. 레지스터 범위는 블록 단위로 걸린다 — 요청 범위와 겹치면 그 요청 전체.
 */
export class FaultSchedule {
  constructor(
    private readonly faults: readonly SimFault[],
    private readonly startedAtMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  static empty(): FaultSchedule {
    return new FaultSchedule([], 0);
  }

  private live(f: SimFault, at: number): boolean {
    const t = at - this.startedAtMs;
    return t >= f.startOffsetMs && t < f.startOffsetMs + f.durationMs;
  }

  /** 포트 port · 레지스터 [start, start + count) 요청에 지금 걸리는 주입 */
  match(port: number, start: number, count: number): ActiveFault | null {
    const at = this.now();
    for (const f of this.faults) {
      if (port < f.ports.from || port > f.ports.to) continue;
      if (start >= f.registers.start + f.registers.count || f.registers.start >= start + count) continue;
      if (!this.live(f, at)) continue;
      return f.kind === 'delay'
        ? { kind: 'delay', delayMs: f.delayMs }
        : { kind: 'exception', exceptionCode: f.exceptionCode };
    }
    return null;
  }

  /** 지금 시간 창 안인 종류 — sim_fault_injection_active{kind} */
  activeKinds(): Set<SimFault['kind']> {
    const at = this.now();
    return new Set(this.faults.filter((f) => this.live(f, at)).map((f) => f.kind));
  }
}
