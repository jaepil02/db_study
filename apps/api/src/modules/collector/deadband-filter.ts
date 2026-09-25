// SW-10 COLLECTOR_DEADBAND — DeadbandFilterPort(정본 docs/04_architecture/02_module_boundaries.md §스위치 = DI 포트)
// 규칙 정본 docs/06_pipeline/02_collect.md §데드밴드 — SW-10 7항목:
// ① abs(eng − 직전 전송값) < deadband면 생략 ② 직전 전송값은 전송한 값만 갱신 ③ 품질이 직전과 다르면 전송
// ④ 직전 전송값이 없으면 전송 ⑤ 기본 off = PassthroughFilter ⑥ 경고 단계 강화는 S6(COL-08) ⑦ 생략 수는 설비 단위 계수(호출자).

export interface DeadbandFilterPort {
  /** 전송하면 true — true일 때만 직전 전송값이 바뀐다 */
  admit(tagId: number, eng: number, quality: number, deadband: number): boolean;
}

export const DEADBAND_FILTER_PORT = Symbol('DEADBAND_FILTER_PORT');

/** SW-10 on — 태그별 tag_master.deadband(공학 단위 절대값) 적용 · 직전 전송값은 프로세스 메모리 */
export class TagDeadbandFilter implements DeadbandFilterPort {
  private readonly lastSent = new Map<number, { eng: number; quality: number }>();

  admit(tagId: number, eng: number, quality: number, deadband: number): boolean {
    const last = this.lastSent.get(tagId);
    if (last && last.quality === quality && Math.abs(eng - last.eng) < deadband) return false;
    this.lastSent.set(tagId, { eng, quality });
    return true;
  }
}

/** SW-10 off(기본) — 변화량과 무관하게 전부 전송한다 */
export class PassthroughFilter implements DeadbandFilterPort {
  admit(): boolean {
    return true;
  }
}
