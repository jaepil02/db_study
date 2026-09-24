// 스위치 = DI 포트(ADR-08 · 정본 docs/04_architecture/02_module_boundaries.md §스위치 = DI 포트)
// 모듈 초기화가 포트마다 구현 하나를 고르고 여기에 등록한다 — health switches · obs_switch_info는 이 등록에서 거꾸로 읽는다.
// 환경변수 문자열을 옮기지 않는다(REQ-OBS-11): 노출값은 "실제로 주입된 구현"이다.
// health switches는 정본 스위치 전부를 싣는다(07_api/10) — 도입 전 스위치는 value = 기동 설정값 · impl null(주입된 구현이 없어 적을 이름이 없다).
// 기록의 스위치 11키가 비지 않아야 4요소가 성립한다(10_observability/04 BFF 판독 규칙 4). obs_switch_info는 주입된 것만 낸다(impl 레이블이 비지 않게).
import { SWITCHES, type SwitchSpec } from '@db-study/shared';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Gauge } from 'prom-client';
import type { AppConfig, SwitchId } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { appRegistry } from '../metrics/registry';

export interface InjectedSwitch {
  id: string;
  name: string;
  value: string | number;
  impl: string;
  warning: string | null;
}

@Injectable()
export class SwitchRegistry implements OnApplicationBootstrap {
  private readonly log = new Logger('SwitchRegistry');
  private readonly injected = new Map<string, InjectedSwitch>();

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    const self = this;
    new Gauge({
      name: 'obs_switch_info',
      help: '스위치별 실제 주입 구현(값 1)',
      labelNames: ['switch', 'env', 'value', 'impl'],
      registers: [appRegistry],
      collect() {
        this.reset();
        for (const s of self.injected.values()) {
          this.set({ switch: s.id, env: s.name, value: String(s.value), impl: s.impl }, 1);
        }
      },
    });
    new Gauge({
      name: 'obs_switch_warning',
      help: '스위치 경고(SW-01 off의 stream_boundary_bypassed)',
      labelNames: ['switch', 'warning'],
      registers: [appRegistry],
      collect() {
        this.reset();
        for (const s of self.injected.values())
          if (s.warning) this.set({ switch: s.id, warning: s.warning }, 1);
      },
    });
  }

  spec(id: SwitchId): SwitchSpec {
    const s = SWITCHES.find((x) => x.id === id);
    if (!s) throw new Error(`정본에 없는 스위치 — ${id}`);
    return s;
  }

  /** 포트 구현을 고른 자리에서 부른다 — 같은 스위치를 두 번 등록하면 두 모듈이 다른 구현을 고른 결함이다 */
  register(id: SwitchId, value: string | number, impl: string, warning: string | null = null): void {
    const prev = this.injected.get(id);
    if (prev && prev.impl !== impl) {
      throw new Error(`${id} 구현이 둘이다 — ${prev.impl} · ${impl}`);
    }
    this.injected.set(id, { id, name: this.spec(id).env, value, impl, warning });
  }

  snapshot(): Record<string, Omit<InjectedSwitch, 'id' | 'impl'> & { impl: string | null }> {
    const out: Record<string, Omit<InjectedSwitch, 'id' | 'impl'> & { impl: string | null }> = {};
    for (const spec of SWITCHES) {
      const s = this.injected.get(spec.id);
      out[spec.id] = s
        ? { name: s.name, value: s.value, impl: s.impl, warning: s.warning }
        : { name: spec.env, value: this.cfg.switches[spec.id as SwitchId], impl: null, warning: null };
    }
    return out;
  }

  /** 기동 경고 — 도입 전 스위치에 기본값이 아닌 값이 오면 적용되지 않는다는 사실을 남긴다 */
  onApplicationBootstrap() {
    for (const w of this.cfg.switchWarnings) this.log.warn(w);
    for (const spec of SWITCHES) {
      if (this.injected.has(spec.id)) continue;
      const v = this.cfg.switches[spec.id as SwitchId];
      if (String(v) !== String(spec.defaultValue)) {
        this.log.warn(
          `${spec.env}(${spec.id})=${String(v)} — 이 기동에는 ${spec.port} 구현이 없어 적용되지 않는다`,
        );
      }
    }
    for (const s of this.injected.values()) {
      if (s.warning) this.log.warn(`${s.name}(${s.id}) 경고 — ${s.warning}`);
    }
  }
}
