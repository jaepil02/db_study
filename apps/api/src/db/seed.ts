// seed — 마스터 시드(S2 범위: 사이트 · 라인 · 설비 · 접속 설정 · 태그). 계정 · 역할 시드는 AUT 테이블이 생기는 단계(S7)다.
// 실행: docker compose run --rm api node dist/db/seed.js --tier S | --slice s2 (task seed)
// 빈 볼륨 전용 · 한 트랜잭션 — 두 번 시드한 볼륨은 tag_id 공간이 달라 같은 시드의 두 실험이 다른 태그를 본다(09_tooling §Taskfile 작업).
// 시드는 감사하지 않는다 — 사람이 쓰기 표면으로 일으킨 변경이 아니다(REQ-WRK-07).
import { CAPACITY_TIER_NAMES, type CapacityTier } from '@db-study/shared';
import { Client } from 'pg';
import { type SeedTarget, seedDevices, seedPlan } from './seed-plan';

function target(argv: string[]): SeedTarget {
  const t = argv.indexOf('--tier');
  const s = argv.indexOf('--slice');
  if (t >= 0 && s < 0) {
    const tier = argv[t + 1] as CapacityTier;
    if (!CAPACITY_TIER_NAMES.includes(tier)) throw new Error(`--tier ${String(tier)} — S · M · M+ · L`);
    return { kind: 'tier', tier };
  }
  if (s >= 0 && t < 0 && argv[s + 1] === 's2') return { kind: 'slice' };
  throw new Error('사용: seed --tier <S|M|M+|L> | --slice s2');
}

async function main() {
  const plan = seedPlan(target(process.argv));
  const devices = seedDevices(plan);
  const pg = new Client({ connectionString: process.env.POSTGRES_URL });
  await pg.connect();
  try {
    await pg.query('BEGIN');
    const used = await pg.query('SELECT (SELECT count(*) FROM site) + (SELECT count(*) FROM device) AS n');
    if (Number(used.rows[0]?.n) > 0)
      throw new Error('마스터가 비어 있지 않다 — 빈 볼륨 전용(task restore로 빈 상태를 되돌린다)');
    const site = await pg.query(
      `INSERT INTO site (site_code, site_name) VALUES ('SITE-001', '시뮬레이션 사이트') RETURNING site_id`,
    );
    const line = await pg.query(
      `INSERT INTO production_line (site_id, line_code, line_name) VALUES ($1, 'LINE-001', '시뮬레이션 라인') RETURNING line_id`,
      [site.rows[0].site_id],
    );
    let tagCount = 0;
    for (const d of devices) {
      const dev = await pg.query(
        'INSERT INTO device (line_id, device_code, device_name) VALUES ($1, $2, $3) RETURNING device_id',
        [line.rows[0].line_id, d.deviceCode, d.deviceName],
      );
      const deviceId = dev.rows[0].device_id;
      // 루프백 host = 시뮬레이션 설비 → 정상 값에 SIMULATED(9) · 타임아웃 3초는 원본 현행(06_pipeline/02 §미확인 등재)
      await pg.query(
        `INSERT INTO modbus_config (device_id, host, port, unit_id, timeout_ms, retry_count, max_regs_per_request)
         VALUES ($1, '127.0.0.1', $2, 1, 3000, 0, 125)`,
        [deviceId, d.port],
      );
      for (const t of d.tags) {
        await pg.query(
          `INSERT INTO tag_master (device_id, tag_code, tag_name, function_code, address, data_type, word_order,
                                   scale, offset_value, unit, deadband, scan_rate_ms)
           VALUES ($1, $2, $3, 3, $4, 'FLOAT32', 'ABCD', 1, 0, '', 0, $5)`,
          [deviceId, t.tagCode, t.tagName, t.address, plan.scanRateMs],
        );
        tagCount++;
      }
    }
    await pg.query('COMMIT');
    process.stdout.write(`seed 완료 — ${plan.label} · 설비 ${devices.length} · 태그 ${tagCount}\n`);
  } catch (e) {
    await pg.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  process.stderr.write(`seed 실패 — ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
