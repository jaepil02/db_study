// piscina 작업 파일 — 신호 벡터 생성 + 대량 MessagePack 인코딩(격리 대상 · ADR-25)
// 결과의 큰 배열은 복사하지 않고 소유권을 넘긴다(09_tech_stack/02 §워커 풀 — 전달 형식)
import Piscina from 'piscina';
import { generateWindow, type WindowResult, type WindowTask } from './signal/window';

class MovedResult {
  constructor(private readonly r: WindowResult) {}
  get [Piscina.transferableSymbol]() {
    return [this.r.payload.buffer, this.r.offsets.buffer, this.r.state.buffer, this.r.pointsByProfile.buffer];
  }
  get [Piscina.valueSymbol]() {
    return this.r;
  }
}

export default function run(task: WindowTask): unknown {
  const t0 = performance.now();
  const r = generateWindow(task);
  r.busyMs = performance.now() - t0; // 워커 사용률의 분자 — 작업 실행 시간
  // piscina 타입 선언의 전송 심볼이 unique symbol이 아니어서 캐스트한다(런타임 계약은 같다)
  return Piscina.move(new MovedResult(r) as unknown as Parameters<typeof Piscina.move>[0]);
}
