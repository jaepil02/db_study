// S3 공유 계약 — SIM 주입 계획(09_tech_stack/05 검증 규칙) · DLQ 엔트리(06_pipeline/12)
import { describe, expect, it } from 'vitest';
import { DlqEntryMeta, SimFaultPlan } from '../src';

const delay = {
  ports: { from: 5020, to: 5024 },
  registers: { start: 0, count: 100 },
  kind: 'delay',
  delayMs: 1500,
  startOffsetMs: 60_000,
  durationMs: 120_000,
};
const exception = {
  ports: { from: 5020, to: 5020 },
  registers: { start: 0, count: 50 },
  kind: 'exception',
  exceptionCode: 2,
  startOffsetMs: 240_000,
  durationMs: 60_000,
};

describe('SIM 주입 계획', () => {
  it('문서 견본 모양을 받는다', () => {
    expect(SimFaultPlan.safeParse({ v: 1, note: 'x', faults: [delay, exception] }).success).toBe(true);
  });
  it('모르는 필드 · 종류별 필수 값 누락 · 포트 대역 밖을 거부한다', () => {
    expect(SimFaultPlan.safeParse({ v: 1, faults: [{ ...delay, extra: 1 }] }).success).toBe(false);
    const { delayMs: _d, ...noDelay } = delay;
    expect(SimFaultPlan.safeParse({ v: 1, faults: [noDelay] }).success).toBe(false);
    expect(
      SimFaultPlan.safeParse({ v: 1, faults: [{ ...delay, ports: { from: 5000, to: 5024 } }] }).success,
    ).toBe(false);
  });
  it('같은 포트 · 겹치는 레지스터 · 겹치는 시간 창을 거부한다', () => {
    const overlapping = { ...exception, startOffsetMs: 100_000 };
    expect(SimFaultPlan.safeParse({ v: 1, faults: [delay, overlapping] }).success).toBe(false);
    const otherRegs = { ...overlapping, registers: { start: 200, count: 10 } };
    expect(SimFaultPlan.safeParse({ v: 1, faults: [delay, otherRegs] }).success).toBe(true);
  });
});

describe('DLQ 엔트리 메타', () => {
  it('재시도 소진은 토큰 · 해독 불가는 null', () => {
    expect(
      DlqEntryMeta.safeParse({ originId: '1-0', reason: 'retry_exhausted', batchToken: 'a'.repeat(40) })
        .success,
    ).toBe(true);
    expect(DlqEntryMeta.safeParse({ originId: '1-0', reason: 'undecodable', batchToken: null }).success).toBe(
      true,
    );
    expect(DlqEntryMeta.safeParse({ originId: 'x', reason: 'undecodable', batchToken: null }).success).toBe(
      false,
    );
  });
});
