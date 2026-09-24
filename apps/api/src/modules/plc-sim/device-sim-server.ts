// SIM-01 · 02 — 설비 하나의 Modbus TCP 서버(jsmodbus) · holding 레지스터 Buffer(16비트 빅엔디안 워드)
// 값을 만들지 않는다 — Buffer 갱신은 GEN 모드 A가 프로세스 안 호출로 한다(REQ-SIM-06).
import { createServer, type Server, type Socket } from 'node:net';
import { server as modbusServer } from 'jsmodbus';

/** 컨테이너 루프백에만 바인드한다 — Compose ports에 싣지 않고 호스트에서도 닿지 않는다(REQ-SIM-01) */
export const SIM_BIND_HOST = '127.0.0.1';

export class DeviceSimServer {
  /** holding 레지스터 — 워드 i = 바이트 2i · 2i+1(빅엔디안) */
  readonly holding: Buffer;
  private readonly net: Server;
  private readonly sockets = new Set<Socket>();

  constructor(registerCount: number) {
    this.holding = Buffer.alloc(Math.max(1, registerCount) * 2);
    this.net = createServer();
    this.net.on('connection', (s) => {
      this.sockets.add(s);
      s.on('close', () => this.sockets.delete(s));
    });
    // S2 응답 범위는 FC03(holding)이다 — FC04(input) 응답은 S3
    new modbusServer.TCP(this.net, { holding: this.holding });
  }

  /** 바인드 — 성공하면 실제 포트(0을 주면 임의 포트) · 실패(포트 충돌 등)는 거절 */
  listen(port: number, host = SIM_BIND_HOST): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (e: Error) => reject(e);
      this.net.once('error', onError);
      this.net.listen(port, host, () => {
        this.net.off('error', onError);
        const addr = this.net.address();
        resolve(typeof addr === 'object' && addr ? addr.port : port);
      });
    });
  }

  close(): Promise<void> {
    for (const s of this.sockets) s.destroy();
    return new Promise((resolve) => {
      if (!this.net.listening) return resolve();
      this.net.close(() => resolve());
    });
  }
}
