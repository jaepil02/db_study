// 모드 D piscina 작업 파일 — 진입점 dist/mode-d.js가 자기 풀(WORKER_POOL_SIZE)로 부른다(Nest 밖 · 공용 풀 tasks.js와 따로).
// 큰 배열은 복사하지 않고 소유권을 넘긴다(인코딩 버퍼 · 상태).
import Piscina from 'piscina';
import { type EncodeResult, type EncodeTask, encodeWindow } from './mode-d-encode';

class Moved {
  constructor(private readonly r: EncodeResult) {}
  get [Piscina.transferableSymbol]() {
    return [this.r.data.buffer, this.r.state.buffer];
  }
  get [Piscina.valueSymbol]() {
    return this.r;
  }
}

export default function encode(task: EncodeTask): unknown {
  const t0 = performance.now();
  const r = encodeWindow(task);
  r.busyMs = performance.now() - t0;
  return Piscina.move(new Moved(r) as unknown as Parameters<typeof Piscina.move>[0]);
}
