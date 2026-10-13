// HMI 개요 — GET /api/v1/plant/overview(계약 PlantOverview · 1초마다 부른다 · 지침서 §C)
// 값: 카드 라인 활성 설비의 rt:latest를 파이프라인 한 번으로 읽는다(Redis만 — ClickHouse를 부르지 않는다).
// 메타(라인 · 설비 · 태그 · 종류): 프로세스 메모리 사본 — PostgreSQL 한 번에 읽고 10초 둔다. 태그 목록은 Redis 사본이 없어(마스터 W5 판정)
// 1초 폴링이 PostgreSQL을 매번 부르지 않게 여기서 들고 있는다. 다시 읽기가 실패하면 마지막 사본을 쓰고, 사본이 아예 없으면 503이다.
import { CARD_SITE, type PlantOverviewBody } from '@db-study/shared';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit, Optional } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error';
import { Postgres } from '../../common/postgres/postgres.module';
import { DurableKeyClient } from '../../common/redis/durable-key-client';
import { tagEmitTally } from '../collector/collector-metrics';
import {
  buildOverview,
  EmitRateMeter,
  metaFromRows,
  type PlantMetaLine,
  type PlantMetaRow,
} from './plant-overview';
import { PlantPowerService } from './plant-power.service';
import { PlantRuntime } from './plant-runtime.service';

/** 메타 사본을 두는 시간 — 마스터 변경(설비 이름 · 태그 추가)이 이 안에 개요에 따라온다 */
export const PLANT_META_TTL_MS = 10_000;

export const PLANT_META_SELECT = `
SELECT l.line_code, l.line_name, d.device_id, d.device_code, d.device_name,
       t.tag_id, t.tag_code, t.tag_name, t.unit, t.data_type, t.scan_rate_ms, t.tag_kind
  FROM site s
  JOIN production_line l ON l.site_id = s.site_id
  JOIN device d ON d.line_id = l.line_id AND d.is_active
  LEFT JOIN tag_master t ON t.device_id = d.device_id AND t.is_active
 WHERE s.site_code = $1
 ORDER BY l.line_code, d.device_id, t.address, t.tag_id`;

@Injectable()
export class PlantOverviewService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('PlantOverview');
  private meta: { at: number; lines: PlantMetaLine[] } | null = null;
  private loading: Promise<PlantMetaLine[]> | null = null;
  private readonly meter = new EmitRateMeter();
  private sampler: NodeJS.Timeout | null = null;
  private warnedSkipped = new Set<string>();

  constructor(
    private readonly pg: Postgres,
    private readonly durable: DurableKeyClient,
    private readonly power: PlantPowerService,
    /** 같은 프로세스에 수집기가 있으면(APP_ROLE all) 실제 발행을 센다 — 없으면(api) nominal */
    @Optional() private readonly runtime?: PlantRuntime,
  ) {}

  /** 수집기가 같은 프로세스에 있으면 요청과 무관하게 발행 누계 표본을 남긴다 — 첫 요청부터 measured(기동 뒤 0.9초부터) */
  onModuleInit(): void {
    if (!this.runtime) return;
    this.meter.sample(Date.now(), tagEmitTally);
    this.sampler = setInterval(
      () => this.meter.sample(Date.now(), tagEmitTally),
      EmitRateMeter.SAMPLE_EVERY_MS,
    );
    this.sampler.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sampler) clearInterval(this.sampler);
    this.sampler = null;
  }

  async overview(nowMs = Date.now()): Promise<PlantOverviewBody> {
    const lines = await this.metaLines(nowMs);
    let power: Awaited<ReturnType<PlantPowerService['read']>>;
    let hashes: Record<string, string>[];
    const ids = lines.flatMap((l) => l.devices.map((d) => d.deviceId));
    try {
      [power, hashes] = await Promise.all([this.power.read(), this.durable.readLatestMany(ids)]);
    } catch {
      throw new ApiError('realtime.latest_unavailable', 'Redis에 접속할 수 없어 설비 지금 값을 읽지 못했다');
    }
    const latest = new Map(ids.map((id, i) => [id, hashes[i] ?? {}]));
    const rates = this.runtime ? this.meter.rates(nowMs, tagEmitTally) : null;
    return buildOverview({
      nowMs,
      power: power.on,
      powerOnAtMs: power.on ? power.changedAtMs : null,
      lines,
      latest,
      rates,
    });
  }

  /** 메타 사본 — 만료면 다시 읽는다(동시 요청은 한 번만 읽는다) · 실패면 마지막 사본 · 사본이 없으면 503 */
  private async metaLines(nowMs: number): Promise<PlantMetaLine[]> {
    if (this.meta && nowMs - this.meta.at < PLANT_META_TTL_MS) return this.meta.lines;
    this.loading ??= this.loadMeta(nowMs).finally(() => {
      this.loading = null;
    });
    try {
      return await this.loading;
    } catch (e) {
      if (this.meta) {
        this.log.warn(
          `메타 다시 읽기 실패 — 마지막 사본을 쓴다: ${e instanceof Error ? e.message : String(e)}`,
        );
        return this.meta.lines;
      }
      throw new ApiError(
        'common.postgres_unavailable',
        'PostgreSQL에 접속할 수 없어 설비 목록을 읽지 못했다',
      );
    }
  }

  private async loadMeta(nowMs: number): Promise<PlantMetaLine[]> {
    const r = await this.pg.pool.query<PlantMetaRow>(PLANT_META_SELECT, [CARD_SITE.code]);
    const { lines, skipped } = metaFromRows(r.rows);
    const fresh = skipped.filter((s) => !this.warnedSkipped.has(s));
    if (fresh.length > 0) {
      this.log.warn(`개요에서 뺀 태그(형식이 FLOAT32 · UINT32 · UINT16 밖) — ${fresh.join(' · ')}`);
      for (const s of fresh) this.warnedSkipped.add(s);
    }
    this.meta = { at: nowMs, lines };
    return lines;
  }
}
