// COL — 설비 가동을 켜면 설비마다 폴러 하나(연결 1 · 스캔 그룹마다 루프 1)를 띄우고 끄면 모두 멈춘다(plant/plant-runtime · D-16)
// 실행 중 마스터 변경 반영(S4 — 06_pipeline/02 §실행 중 마스터 변경 반영): ch:cacheinv 구독 → 키의 설비만 다시 읽는다.
// 반영 단위는 설비 · 시점은 다음 스캔 사이클 경계(폴러 stop이 진행 중 사이클을 끝낸 뒤 새 정의로 다시 띄운다).
// Redis 재연결 뒤에는 전 설비를 한 번 다시 읽는다(끊긴 동안의 신호는 다시 오지 않는다).
// 위상: 기존 설비는 기동 때 위상을 유지하고, 새로 붙는 설비는 (n + 0.5) ÷ (n + 1) 칸에 둔다(재위상 없음 — S4 판정).
// SIM · 모드 A는 기동 1회 로드 그대로다 — 새 모의 설비의 서버 · 레지스터 갱신은 재기동에 붙는다(S4 판정).
// 설비 가동이 꺼져 있으면 폴러가 없다 — 마스터 변경 재로드 · 재연결 대조도 빈손이다(직접 보내 보기는 stream에 직접 XADD).
// ch:cacheinv 구독은 처음 켤 때 한 번 하고 끝까지 둔다 — 꺼진 동안 온 신호는 다시 켤 때 수집 정의를 통째로 다시 읽어 메운다(refresh).
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnections } from '../../common/redis/connections';
import type { GroupBacklog } from '../../common/redis/durable-key-client';
import type { DeviceDef } from './collect-definition';
import { CollectDefinitionService } from './collect-definition.service';
import { pointsEmitted } from './collector-metrics';
import { DEADBAND_FILTER_PORT, type DeadbandFilterPort } from './deadband-filter';
import { DevicePoller } from './device-poller';
import { POINT_BUFFER_PORT, type PointBufferPort } from './point-buffer.port';

@Injectable()
export class CollectorService implements OnModuleDestroy {
  private readonly log = new Logger('Collector');
  private readonly pollers = new Map<number, DevicePoller>();
  /** 설비별 시작 위상 몫 — 재로드가 같은 위상으로 다시 띄운다 */
  private readonly fractions = new Map<number, number>();
  private stopped = false;
  private subscriber: Redis | null = null;
  /** 재로드 직렬화 — 두 신호가 같은 설비를 동시에 바꾸지 않게 */
  private reloadChain: Promise<void> = Promise.resolve();
  /** 폴러가 돌고 있는가(설비 가동 켜짐) — 거짓이면 재로드 · 재연결 대조가 빈손이다 */
  private ready = false;
  /** 설비별 마지막 scan_seq — 껐다 켜도 설비 안 단조 증가를 지킨다(06_pipeline/12 §3단계 s) */
  private readonly lastSeqs = new Map<number, number>();

  constructor(
    private readonly definitions: CollectDefinitionService,
    @Inject(POINT_BUFFER_PORT) private readonly buffer: PointBufferPort,
    @Inject(DEADBAND_FILTER_PORT) private readonly filter: DeadbandFilterPort,
    private readonly redis: RedisConnections,
  ) {}

  /**
   * 폴링 시작(설비 가동 켬) — SIM 포트 · 모드 A가 먼저 선 뒤 부른다(plant-runtime이 순서를 지킨다) · 이미 돌고 있으면 그대로.
   * 마스터 변경 재로드와 같은 사슬에서 돈다 — 재로드 도중에 켜고 끄는 일이 겹치지 않는다.
   * 도중에 한 설비에서 던지면 이번에 띄운 폴러를 모두 멈추고 다시 던진다 — 반쯤 켜진 채 ready false로 남아 끄기가 못 멈추는 일이 없게(r5 L7).
   */
  start(defs: readonly DeviceDef[]): Promise<void> {
    return this.enqueueSync(async () => {
      if (this.stopped || this.ready) return;
      const polled = defs.filter((def) => {
        if (def.groups.length > 0) return true;
        this.log.warn(`설비 ${def.deviceId}(${def.deviceCode}) — 폴링할 태그 없음 · 루프를 띄우지 않는다`);
        return false;
      });
      const firstStart = this.fractions.size === 0;
      try {
        this.startPollers(polled, firstStart);
      } catch (e) {
        await this.stopPollers();
        throw e;
      }
      this.ready = true;
      this.log.log(`수집 시작 — 설비 ${this.pollers.size}`);
      if (!this.subscriber) this.subscribeInvalidation();
    });
  }

  private startPollers(polled: readonly DeviceDef[], firstStart: boolean): void {
    polled.forEach((def, i) => {
      // 시작 위상 = 벽시계 주기 격자 + 설비별 균등 오프셋((i + 0.5) × 주기 ÷ N) — 설비들의 발행이 창 안에 고르게 퍼지고
      // 기동마다 같은 위상이 된다. 0.5칸은 모드 A 생성기의 격자(k = floor(now ÷ 주기)) 갱신 순간과 겹치지 않게 비킨다.
      // 스캔 그룹이 여럿이면 설비 몫 (i + 0.5) ÷ N을 그룹마다 자기 주기에 곱한다(DevicePoller phaseFraction).
      // 다시 켤 때는 처음 켤 때 정한 몫을 그대로 쓴다 — 껐다 켜도 같은 위상이다(새 설비만 새 몫).
      let fraction = this.fractions.get(def.deviceId);
      if (fraction === undefined) {
        fraction = firstStart ? (i + 0.5) / polled.length : this.nextFraction();
        this.fractions.set(def.deviceId, fraction);
      }
      const p = new DevicePoller(def, this.buffer, undefined, fraction, this.filter);
      p.continueSeqFrom(this.lastSeqs.get(def.deviceId) ?? 0);
      this.pollers.set(def.deviceId, p);
      p.start();
    });
  }

  /** 폴러 전부 정지 · 비우기 — 설비별 scan_seq는 다음 켤 때 이어 센다 */
  private async stopPollers(): Promise<number> {
    const n = this.pollers.size;
    await Promise.all(
      [...this.pollers.entries()].map(async ([id, p]) => {
        await p.stop();
        this.lastSeqs.set(id, p.lastSeq);
      }),
    );
    this.pollers.clear();
    return n;
  }

  /**
   * 폴링 정지(설비 가동 끔) — 진행 중 사이클은 끊는다 · 이미 멈춰 있으면 그대로.
   * ready와 무관하게 남은 폴러를 비운다 — 켜기가 중간에 실패해 폴러가 남은 경우에도 끄기가 멈춘다(r5 L7).
   */
  stop(): Promise<void> {
    return this.enqueueSync(async () => {
      if (!this.ready && this.pollers.size === 0) return;
      this.ready = false;
      const n = await this.stopPollers();
      this.log.log(`수집 정지 — 설비 ${n}`);
    });
  }

  /** 새 설비의 위상 몫 — (n + 0.5) ÷ (n + 1)(재위상 없음 · S4 판정) */
  private nextFraction(): number {
    const n = this.fractions.size;
    return (n + 0.5) / (n + 1);
  }

  private subscribeInvalidation(): void {
    const sub = this.redis.subscriberConnection();
    this.subscriber = sub;
    sub.on('message', (channel: string, message: string) => {
      if (channel !== 'ch:cacheinv') return;
      let keys: string[];
      try {
        keys = JSON.parse(message) as string[];
      } catch {
        return;
      }
      this.enqueue(async () => this.reload(await this.definitions.devicesOfKeys(keys), 'signal'));
    });
    // 재연결(ready 재발생) — 끊긴 동안 놓친 신호를 전수 대조로 메운다.
    // 구독 연결은 게이트웨이와 한 연결이라(role all) 이미 ready일 수 있다 — 그때는 다음 ready부터가 재연결이다
    let first = sub.status !== 'ready';
    sub.on('ready', () => {
      if (first) {
        first = false;
        return;
      }
      this.enqueue(async () => {
        const ids = new Set([...(await this.definitions.activeDeviceIds()), ...this.pollers.keys()]);
        await this.reload([...ids], 'reconnect');
      });
    });
    sub.subscribe('ch:cacheinv').catch((e: Error) => this.log.warn(`ch:cacheinv 구독 실패 — ${e.message}`));
  }

  private enqueue(fn: () => Promise<void>): void {
    this.reloadChain = this.reloadChain
      .then(fn)
      .catch((e: Error) =>
        this.log.warn(`마스터 변경 재로드 실패 — ${e.message} · 다음 신호 · 재연결 대조가 메운다`),
      );
  }

  /** 같은 사슬 · 끝을 기다릴 수 있는 판 — 켜기 · 끄기용(실패는 호출자에게 던진다) */
  private enqueueSync(fn: () => Promise<void>): Promise<void> {
    const p = this.reloadChain.then(fn);
    this.reloadChain = p.catch(() => undefined);
    return p;
  }

  /** 설비 단위 교체 — 진행 중 사이클을 끝낸 뒤(사이클 경계 정지) 새 정의로 다시 띄운다 · scan_seq는 이어 센다 · 꺼졌거나 태그가 없으면 멈춘다 */
  private async reload(deviceIds: number[], cause: 'signal' | 'reconnect'): Promise<void> {
    if (this.stopped || !this.ready || deviceIds.length === 0) return;
    const defs = await this.definitions.loadDevices(deviceIds);
    for (const [id, def] of defs) {
      if (this.stopped) return;
      const old = this.pollers.get(id);
      let lastSeq = 0;
      if (old) {
        await old.stopAtBoundary();
        lastSeq = old.lastSeq;
        this.pollers.delete(id);
      }
      if (!def || def.groups.length === 0) {
        if (old) this.log.log(`설비 ${id} — 폴링에서 뺀다(${cause} · 비활성 또는 활성 태그 없음)`);
        continue;
      }
      let fraction = this.fractions.get(id);
      if (fraction === undefined) {
        fraction = this.nextFraction();
        this.fractions.set(id, fraction);
      }
      const p = new DevicePoller(def, this.buffer, undefined, fraction, this.filter);
      p.continueSeqFrom(lastSeq);
      this.pollers.set(id, p);
      p.start();
      this.log.log(`설비 ${id} — 수집 정의 재로드(${cause}) · 태그 ${def.tags.length}`);
    }
  }

  async onModuleDestroy() {
    await this.stop().catch(() => undefined);
    this.stopped = true;
    await this.reloadChain;
    await this.subscriber?.unsubscribe('ch:cacheinv').catch(() => undefined);
    await Promise.all([...this.pollers.values()].map((p) => p.stop()));
    // 정지 시점 발행 누계 — 프로세스가 끝나면 /metrics로 읽을 수 없다. AC-01 모드 A 분모를 정지 뒤 대조에 넘긴다
    const total = (await pointsEmitted.get()).values.reduce((a, v) => a + v.value, 0);
    this.log.log(`수집 정지 — points_emitted 누계 ${total}`);
  }

  /** 설비별 마지막 적체 — 보관값(백프레셔 단계 반응은 S6) */
  lastBacklog(deviceId: number): GroupBacklog | null {
    return this.pollers.get(deviceId)?.lastBacklog ?? null;
  }

  /** 지금 돌고 있는 설비 폴러 수 — 설비 가동이 꺼져 있으면 0 */
  pollerCount(): number {
    return this.pollers.size;
  }
}
