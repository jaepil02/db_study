// SIM 주입 계획 파일 — 정본 docs/09_tech_stack/05_tooling_devops.md §SIM 주입 계획 파일 형식 · 06_pipeline/10 §SIM 주입 제어
// JSON 하나 · 이 스키마로 검증 · 실패하면 기동 거부. 종류는 delay · exception 둘뿐(범위 밖 값은 GEN 모드 A가 만든다).
import { z } from 'zod';

/** SIM 포트 대역 — 127.0.0.1:5020~5119(SIM-01) */
export const SIM_PORT_MIN = 5020;
export const SIM_PORT_MAX = 5119;

const Range = z.strictObject({ from: z.number().int(), to: z.number().int() });

const FaultBase = {
  ports: Range,
  registers: z.strictObject({
    start: z.number().int().min(0).max(65535),
    count: z.number().int().min(1).max(65536),
  }),
  startOffsetMs: z.number().int().min(0),
  durationMs: z.number().int().min(1),
};

export const SimFault = z.discriminatedUnion('kind', [
  z.strictObject({ ...FaultBase, kind: z.literal('delay'), delayMs: z.number().int().min(1) }),
  // Modbus 표준 예외 코드 1~11(현행 표준 범위)
  z.strictObject({
    ...FaultBase,
    kind: z.literal('exception'),
    exceptionCode: z.number().int().min(1).max(11),
  }),
]);
export type SimFaultBody = z.infer<typeof SimFault>;

export const SimFaultPlan = z
  .strictObject({ v: z.literal(1), note: z.string().optional(), faults: z.array(SimFault) })
  .superRefine((plan, ctx) => {
    plan.faults.forEach((f, i) => {
      if (f.ports.from > f.ports.to || f.ports.from < SIM_PORT_MIN || f.ports.to > SIM_PORT_MAX)
        ctx.addIssue({
          code: 'custom',
          path: ['faults', i, 'ports'],
          message: `포트 범위는 ${SIM_PORT_MIN}~${SIM_PORT_MAX} 안`,
        });
    });
    // 겹침 — 같은 포트 · 겹치는 레지스터 범위의 시간 창이 겹치면 거부(결과를 어느 주입에 귀속할지 가를 수 없다)
    for (let i = 0; i < plan.faults.length; i++) {
      for (let j = i + 1; j < plan.faults.length; j++) {
        const a = plan.faults[i] as SimFaultBody;
        const b = plan.faults[j] as SimFaultBody;
        const ports = a.ports.from <= b.ports.to && b.ports.from <= a.ports.to;
        const regs =
          a.registers.start < b.registers.start + b.registers.count &&
          b.registers.start < a.registers.start + a.registers.count;
        const time =
          a.startOffsetMs < b.startOffsetMs + b.durationMs &&
          b.startOffsetMs < a.startOffsetMs + a.durationMs;
        if (ports && regs && time)
          ctx.addIssue({
            code: 'custom',
            path: ['faults', j],
            message: `faults[${i}]와 포트 · 레지스터 · 시간 창이 겹친다`,
          });
      }
    }
  });
export type SimFaultPlanBody = z.infer<typeof SimFaultPlan>;
