// 설비 가동 적용 — 수집기 역할(APP_ROLE all · collector)이 1초마다 ctl:plant:power를 읽어 SIM 포트 · 모드 A 틱 · 폴링 루프를 켜고 끈다(D-16 결정 3).
// 켜기 순서: 수집 정의(처음은 기동 로드 · 다시 켤 때는 다시 읽기) → SIM 포트 → 모드 A 틱 → 폴링. 끄기는 그 역순(폴링 → 틱 → 포트).
// 전환은 한 번에 하나 — 전환 중에 온 읽기는 건너뛰고 다음 읽기가 다시 맞춘다(겹친 전환 안전 · 세 서비스의 start · stop도 각자 멱등).
// 기동 때 키를 지운다 — 이번 기동은 기동 기본값(SENSOR_AUTOGEN)부터 시작한다(재기동하면 저절로 쌓이지 않게 · 사용자 결정 2026-10-03 유지).
import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { RedisConnections } from '../../common/redis/connections';
import { CollectDefinitionService } from '../collector/collect-definition.service';
import { CollectorService } from '../collector/collector.service';
import { ModeAService } from '../datagen/mode-a/mode-a.service';
import { PlcSimService } from '../plc-sim/plc-sim.service';
import { PlantPowerService } from './plant-power.service';

/** 설비 가동 키를 읽는 간격 — 스위치를 누른 뒤 1초 안에 포트 · 폴링이 따라온다(지침서 §B) */
export const PLANT_POWER_POLL_MS = 1000;

@Injectable()
export class PlantRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('PlantRuntime');
  private timer: NodeJS.Timeout | null = null;
  private applied = false;
  private everStarted = false;
  private busy = false;
  private destroyed = false;
  /** 읽기 실패 경고는 상태가 바뀔 때만 — 1초마다 같은 경고를 쌓지 않는다 */
  private readFailing = false;

  constructor(
    private readonly power: PlantPowerService,
    private readonly definitions: CollectDefinitionService,
    private readonly sim: PlcSimService,
    private readonly modeA: ModeAService,
    private readonly collector: CollectorService,
    private readonly redis: RedisConnections,
  ) {}

  // 기동을 막지 않는다 — Redis 준비를 기다리는 동안에도 표면은 뜬다
  onApplicationBootstrap() {
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      await this.redis.ready();
      await this.power.resetToDefault();
    } catch (e) {
      this.log.warn(
        `설비 가동 키 초기화 실패 — 남아 있던 상태를 따른다: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (this.destroyed) return;
    this.log.log(`설비 가동 기동 기본값 ${this.power.defaultOn() ? '켜짐' : '꺼짐'}(SENSOR_AUTOGEN)`);
    await this.reconcile();
    if (!this.destroyed) this.timer = setInterval(() => void this.reconcile(), PLANT_POWER_POLL_MS);
  }

  /** 한 번 맞추기 — 원하는 상태(키 · 기본값)와 적용 상태가 다르면 전환한다. 시험이 직접 부른다 */
  async reconcile(): Promise<void> {
    if (this.busy || this.destroyed) return;
    this.busy = true;
    try {
      let want: boolean;
      try {
        want = await this.power.isOn();
        if (this.readFailing) this.log.log('설비 가동 키 읽기 복구');
        this.readFailing = false;
      } catch (e) {
        if (!this.readFailing)
          this.log.warn(
            `설비 가동 키 읽기 실패 — 지금 상태(${this.applied ? '켜짐' : '꺼짐'})를 유지한다: ${e instanceof Error ? e.message : String(e)}`,
          );
        this.readFailing = true;
        return;
      }
      if (want === this.applied) return;
      if (want) await this.turnOn();
      else await this.turnOff();
    } catch (e) {
      this.log.warn(
        `설비 가동 전환 실패 — 다음 읽기에서 다시 맞춘다: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.busy = false;
    }
  }

  /** 켜기 — 도중에 실패하면 앞서 켠 것(포트 · 틱 · 폴러)을 되돌린 뒤 던진다(반쯤 켜진 채 끄기가 못 멈추지 않게 · r5 L7) */
  private async turnOn(): Promise<void> {
    const defs = this.everStarted ? await this.definitions.refresh() : await this.definitions.whenLoaded();
    if (this.destroyed) return;
    try {
      await this.sim.start(defs);
      this.modeA.start(defs);
      await this.collector.start(defs);
    } catch (e) {
      await this.turnOff().catch(() => undefined);
      throw e;
    }
    this.applied = true;
    this.everStarted = true;
    this.log.log(
      `설비 가동 켜짐 — 포트 ${this.sim.serverCount()} · 폴러 ${this.collector.pollerCount()} · 틱 ${this.modeA.ticking() ? '돎' : '없음'}`,
    );
  }

  private async turnOff(): Promise<void> {
    await this.collector.stop();
    this.modeA.stop();
    await this.sim.stop();
    this.applied = false;
    this.log.log('설비 가동 꺼짐 — 폴링 · 틱 · 포트 정지');
  }

  async onModuleDestroy() {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** 이 프로세스가 지금 센서 데이터를 만들고 있는가 — health run.sensorAutogen(실효값) · HMI 개요(measured 기준) */
  running(): boolean {
    return this.applied;
  }
}
