// SIM-01 · 02 · 04 · 05 — 설비 하나의 Modbus TCP 서버(jsmodbus) · holding(FC03) · input(FC04) 레지스터 Buffer(16비트 빅엔디안 워드)
// 값을 만들지 않는다 — Buffer 갱신은 GEN 모드 A가 프로세스 안 호출로 한다(REQ-SIM-06).
// 응답은 이 클래스가 직접 만든다(jsmodbus는 영역 Buffer가 없으면 read* 이벤트로 넘긴다) — 지연 · 예외 주입이 요청 단위로 끼어들 자리다.
import { createServer, type Server, type Socket } from 'node:net';
import { server as modbusServer } from 'jsmodbus';
import type { ActiveFault } from './fault-plan';

/** 컨테이너 루프백에만 바인드한다 — Compose ports에 싣지 않고 호스트에서도 닿지 않는다(REQ-SIM-01) */
export const SIM_BIND_HOST = '127.0.0.1';

/** FC03 · FC04 요청당 상한 — 넘으면 예외 3(ILLEGAL DATA VALUE)으로 응답한다(06_pipeline/02 §폴링 계약 요청당 상한 행) */
export const SIM_MAX_REGS_PER_REQUEST = 125;

/** Modbus 표준 예외 코드 */
export const MODBUS_EXCEPTION = { ILLEGAL_DATA_ADDRESS: 2, ILLEGAL_DATA_VALUE: 3 } as const;

export interface DeviceSimOptions {
  holdingWords: number;
  inputWords?: number;
  /** 요청(레지스터 범위)에 지금 걸리는 주입 — 없으면 주입 없음 */
  faultFor?: (start: number, count: number) => ActiveFault | null;
}

/** jsmodbus 요청 중 쓰는 부분 — MBAP 머리(id · protocol · unitId) + 읽기 본문(fc · start · count) */
interface ReadRequest {
  id: number;
  protocol: number;
  unitId: number;
  body: { fc: number; start: number; count: number };
}

/** MBAP 머리 + PDU — 길이 필드 = unit 1바이트 + PDU */
function frame(req: ReadRequest, pdu: Buffer): Buffer {
  const head = Buffer.alloc(7);
  head.writeUInt16BE(req.id, 0);
  head.writeUInt16BE(req.protocol, 2);
  head.writeUInt16BE(pdu.length + 1, 4);
  head.writeUInt8(req.unitId, 6);
  return Buffer.concat([head, pdu]);
}

function exceptionPdu(fc: number, code: number): Buffer {
  return Buffer.from([fc | 0x80, code]);
}

export class DeviceSimServer {
  /** holding 레지스터(FC03) — 워드 i = 바이트 2i · 2i+1(빅엔디안) */
  readonly holding: Buffer;
  /** input 레지스터(FC04) — 같은 모양 */
  readonly input: Buffer;
  private readonly net: Server;
  private readonly sockets = new Set<Socket>();
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly faultFor: DeviceSimOptions['faultFor'];
  /** 받은 연결 누계 — "설비당 연결 1" 계약의 확인 자리 */
  accepted = 0;

  constructor(opts: DeviceSimOptions | number) {
    const o = typeof opts === 'number' ? { holdingWords: opts } : opts;
    this.holding = Buffer.alloc(Math.max(1, o.holdingWords) * 2);
    this.input = Buffer.alloc(Math.max(1, o.inputWords ?? 0) * 2);
    this.faultFor = o.faultFor;
    this.net = createServer();
    this.net.on('connection', (s) => {
      this.accepted += 1;
      this.sockets.add(s);
      s.on('close', () => this.sockets.delete(s));
      // 클라이언트 쪽 끊김(ECONNRESET 등) — 연결 하나의 일이다. 리스너가 없으면 프로세스 전체가 죽는다
      s.on('error', () => undefined);
    });
    // 영역 Buffer를 넘기지 않는다(undefined로 기본 1024바이트를 덮는다) — 읽기는 아래 이벤트에서 응답한다.
    // Coil · Discrete Input은 SIM 책임 밖이다(REQ-SIM-04 · 05 · FC01 · FC02 시드 금지).
    const srv = new modbusServer.TCP(this.net, {
      holding: undefined,
      input: undefined,
    } as unknown as ConstructorParameters<typeof modbusServer.TCP>[1]);
    srv.on('readHoldingRegisters', (req, cb) =>
      this.respond(req as unknown as ReadRequest, this.holding, cb),
    );
    srv.on('readInputRegisters', (req, cb) => this.respond(req as unknown as ReadRequest, this.input, cb));
  }

  private respond(req: ReadRequest, area: Buffer, cb: (b: Buffer) => void): void {
    const { fc, start, count } = req.body;
    const send = (pdu: Buffer) => cb(frame(req, pdu));
    // 요청 자체의 거절(상한 · 영역 밖)이 주입보다 앞선다 — 주입은 정상 요청에만 건다
    let refusal: number | null = null;
    if (count < 1 || count > SIM_MAX_REGS_PER_REQUEST) refusal = MODBUS_EXCEPTION.ILLEGAL_DATA_VALUE;
    else if ((start + count) * 2 > area.length) refusal = MODBUS_EXCEPTION.ILLEGAL_DATA_ADDRESS;
    const fault = refusal === null ? (this.faultFor?.(start, count) ?? null) : null;
    if (fault?.kind === 'exception') refusal = fault.exceptionCode;
    if (refusal !== null) {
      send(exceptionPdu(fc, refusal));
      return;
    }
    // 값은 응답을 보내는 순간의 Buffer다 — 지연 주입이면 늦어진 만큼 새 값일 수 있다(실장비의 늦은 응답과 같다)
    const answer = () => {
      const data = area.subarray(start * 2, (start + count) * 2);
      send(Buffer.concat([Buffer.from([fc, data.length]), data]));
    };
    if (fault?.kind === 'delay') {
      const t = setTimeout(() => {
        this.timers.delete(t);
        answer();
      }, fault.delayMs);
      this.timers.add(t);
      return;
    }
    answer();
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
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const s of this.sockets) s.destroy();
    return new Promise((resolve) => {
      if (!this.net.listening) return resolve();
      this.net.close(() => resolve());
    });
  }
}
