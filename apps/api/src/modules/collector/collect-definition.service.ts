// COL-01 기동 로드 — 정본 docs/06_pipeline/02_collect.md §기동 로드 — PostgreSQL 태그 목록 선조회
// ① 설비 · 접속 설정 ② 활성 태그(PostgreSQL 직접) ③ cache:tagmeta 워밍(실패 무시) ④ 스캔 그룹 · 요청 블록 계산.
// PostgreSQL이 불가면 폴링을 시작하지 않고 재시도한다 — 캐시 사본으로 대신 기동하지 않는다(B형).
// 실행 중 마스터 변경 반영(S4)은 CollectorService가 ch:cacheinv로 받아 loadDevices로 설비 단위 재로드한다.
import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Postgres } from '../../common/postgres/postgres.module';
import { MasterReadService } from '../master/master-read.service';
import { rowToTagMeta, TAG_META_SELECT } from '../master/tag-meta';
import { buildDeviceDefs, type DeviceDef, type DeviceRow } from './collect-definition';
import { colReady } from './collector-metrics';

/**
 * 기동 로드 재시도 간격 — 정본에 값이 없다. Compose가 postgres healthy 뒤에 api를 띄우므로(REQ-TEC-03)
 * 이 경로는 비정상 기동에서만 탄다. 1초면 PostgreSQL 복구 뒤 폴링 시작이 1초 안에 따라오고,
 * 실패 로그가 초당 1줄이라 로그를 덮지 않는다.
 */
export const LOAD_RETRY_MS = 1000;

const DEVICE_SELECT = `
SELECT d.device_id, d.device_code, host(m.host) AS host, m.port, m.unit_id, m.timeout_ms, m.retry_count,
       m.max_regs_per_request
  FROM device d JOIN modbus_config m ON m.device_id = d.device_id
 WHERE d.is_active = $1
 ORDER BY d.device_id`;

function rowToDevice(r: Record<string, unknown>): DeviceRow {
  return {
    deviceId: Number(r.device_id),
    deviceCode: String(r.device_code),
    host: String(r.host),
    port: Number(r.port),
    unitId: Number(r.unit_id),
    timeoutMs: Number(r.timeout_ms),
    retryCount: Number(r.retry_count),
    maxRegsPerRequest: Number(r.max_regs_per_request),
  };
}

@Injectable()
export class CollectDefinitionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('CollectDefinition');
  private resolveLoaded!: (defs: DeviceDef[]) => void;
  private readonly loaded = new Promise<DeviceDef[]>((r) => {
    this.resolveLoaded = r;
  });
  private stopped = false;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly pg: Postgres,
    private readonly master: MasterReadService,
  ) {}

  /** 기동 로드가 끝나면 풀리는 수집 정의 — SIM · 모드 A · COL이 같은 결과를 기다린다 */
  whenLoaded(): Promise<DeviceDef[]> {
    return this.loaded;
  }

  // 기동을 막지 않는다 — 로드가 재시도 중이어도 조회 표면은 뜨고 col_ready 0으로 미준비가 드러난다
  onApplicationBootstrap() {
    void this.attempt();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private async attempt(): Promise<void> {
    if (this.stopped) return;
    try {
      const defs = await this.load();
      colReady.set(1);
      const tags = defs.reduce((n, d) => n + d.tags.length, 0);
      this.log.log(`기동 로드 완료 — 설비 ${defs.length} · 태그 ${tags}`);
      this.resolveLoaded(defs);
    } catch (e) {
      this.log.warn(
        `기동 로드 실패 — ${LOAD_RETRY_MS} ms 뒤 재시도: ${e instanceof Error ? e.message : String(e)}`,
      );
      this.retryTimer = setTimeout(() => void this.attempt(), LOAD_RETRY_MS);
    }
  }

  /**
   * 무효화 신호의 키 이름 → 영향 설비(06_pipeline/02 §실행 중 마스터 변경 반영)
   * cache:tagmeta:{tag_id}면 그 태그의 설비 · cache:devlist:{site_id}면 그 사이트의 설비 전부(비활성 포함 — 꺼진 설비도 폴링에서 빼야 한다)
   */
  async devicesOfKeys(keys: string[]): Promise<number[]> {
    const tagIds = keys.flatMap((k) => (k.startsWith('cache:tagmeta:') ? [Number(k.slice(14))] : []));
    const siteIds = keys.flatMap((k) => (k.startsWith('cache:devlist:') ? [Number(k.slice(14))] : []));
    const out = new Set<number>();
    if (tagIds.length) {
      const r = await this.pg.pool.query(
        'SELECT DISTINCT device_id FROM tag_master WHERE tag_id = ANY($1::int[])',
        [tagIds],
      );
      for (const row of r.rows) out.add(Number(row.device_id));
    }
    if (siteIds.length) {
      const r = await this.pg.pool.query(
        'SELECT d.device_id FROM device d JOIN production_line l USING (line_id) WHERE l.site_id = ANY($1::int[])',
        [siteIds],
      );
      for (const row of r.rows) out.add(Number(row.device_id));
    }
    return [...out];
  }

  /** 설비 단위 재로드 — 활성 설비 · 활성 태그만. 꺼졌거나 없으면 null(폴링에서 뺀다) */
  async loadDevices(deviceIds: number[]): Promise<Map<number, DeviceDef | null>> {
    const out = new Map<number, DeviceDef | null>(deviceIds.map((id) => [id, null]));
    if (deviceIds.length === 0) return out;
    const dr = await this.pg.pool.query(
      DEVICE_SELECT.replace(
        'WHERE d.is_active = $1',
        'WHERE d.is_active = $1 AND d.device_id = ANY($2::int[])',
      ),
      [true, deviceIds],
    );
    const devices = dr.rows.map(rowToDevice);
    const tr = await this.pg.pool.query(
      `${TAG_META_SELECT} WHERE device_id = ANY($1::int[]) AND is_active = $2 ORDER BY device_id, address, tag_id`,
      [devices.map((d) => d.deviceId), true],
    );
    const tags = tr.rows.map(rowToTagMeta);
    await Promise.all(tags.map((t) => this.master.warm(t)));
    for (const def of buildDeviceDefs(devices, tags, (m) => this.log.warn(m))) out.set(def.deviceId, def);
    return out;
  }

  /** 전 활성 설비 id — Redis 재연결 뒤 전수 대조용 */
  async activeDeviceIds(): Promise<number[]> {
    const r = await this.pg.pool.query('SELECT device_id FROM device WHERE is_active');
    return r.rows.map((row) => Number(row.device_id));
  }

  private async load(): Promise<DeviceDef[]> {
    const dr = await this.pg.pool.query(DEVICE_SELECT, [true]);
    const devices = dr.rows.map(rowToDevice);
    const ids = devices.map((d) => d.deviceId);
    // 인덱스 (device_id, is_active)를 타는 조건 — 설비마다 왕복하지 않고 한 번에 읽는다
    const tr = await this.pg.pool.query(
      `${TAG_META_SELECT} WHERE device_id = ANY($1::int[]) AND is_active = $2 ORDER BY device_id, address, tag_id`,
      [ids, true],
    );
    const tags = tr.rows.map(rowToTagMeta);
    // ③ 워밍 — 실패는 래퍼가 삼킨다(캐시 계열 degrade). 폴링은 메모리 사본을 쓴다
    await Promise.all(tags.map((t) => this.master.warm(t)));
    return buildDeviceDefs(devices, tags, (m) => this.log.warn(m));
  }
}
