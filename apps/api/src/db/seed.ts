// seed — 마스터 시드(사이트 · 라인 · 설비 · 접속 설정 · 태그) — 카드 라인(로컬 기본 · 설비 30 · 태그 129) 또는 S2 슬라이스(설비 1 · 태그 8).
// 실행: docker compose run --rm api node dist/db/seed.js [--card-line | --slice s2] [--deadband <값>] [--range <min>,<max>] (task seed)
// 대상 인자가 없으면 카드 라인이다. --range는 슬라이스 전용 — 카드 라인은 템플릿(packages/shared/src/card-line.ts)의 태그별 범위를 쓴다.
// 빈 볼륨 전용 · 한 트랜잭션 — 두 번 시드한 볼륨은 tag_id 공간이 달라 같은 시드의 두 실행이 다른 태그를 본다(09_tooling §Taskfile 작업).
// 티어 시드 · 계정 · 역할 시드는 D-16(2026-10-11)에서 측정 도구 · 로그인과 함께 삭제했다.

import { createClient } from '@clickhouse/client';
import { Client } from 'pg';
import {
  assertSeedOptionsFor,
  describeScanRates,
  describeSeedOptions,
  parseSeedOptions,
  parseSeedTarget,
  seedLayout,
} from './seed-plan';

/**
 * 적용 순서 ⑨ — 시드 직후 dict_tag를 즉시 적재한다(09_migrations_seed §저장소 간 적용 순서).
 * 없으면 첫 조회가 LIFETIME(300~600초) 동안 빈 사전을 보고 태그명이 비어 나온다.
 */
async function reloadDictionary() {
  const u = new URL(process.env.CLICKHOUSE_URL ?? '');
  if (!u.host) throw new Error('CLICKHOUSE_URL 없음 — 사전 재적재 불가');
  const ch = createClient({
    url: `${u.protocol}//${u.host}`,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  });
  try {
    await ch.command({ query: 'SYSTEM RELOAD DICTIONARY plc.dict_tag' });
    process.stdout.write('dict_tag 재적재 완료\n');
  } finally {
    await ch.close();
  }
}

async function main() {
  const target = parseSeedTarget(process.argv);
  const opts = parseSeedOptions(process.argv);
  assertSeedOptionsFor(target, opts);
  const layout = seedLayout(target);
  const pg = new Client({ connectionString: process.env.POSTGRES_URL });
  await pg.connect();
  let deviceCount = 0;
  let tagCount = 0;
  try {
    await pg.query('BEGIN');
    const used = await pg.query('SELECT (SELECT count(*) FROM site) + (SELECT count(*) FROM device) AS n');
    if (Number(used.rows[0]?.n) > 0)
      throw new Error('마스터가 비어 있지 않다 — 빈 볼륨 전용(볼륨을 비우고 migrate부터 다시 한다)');
    const site = await pg.query('INSERT INTO site (site_code, site_name) VALUES ($1, $2) RETURNING site_id', [
      layout.site.code,
      layout.site.name,
    ]);
    for (const l of layout.lines) {
      const line = await pg.query(
        'INSERT INTO production_line (site_id, line_code, line_name) VALUES ($1, $2, $3) RETURNING line_id',
        [site.rows[0].site_id, l.lineCode, l.lineName],
      );
      for (const d of l.devices) {
        const dev = await pg.query(
          `INSERT INTO device (line_id, device_code, device_name, vendor, model)
           VALUES ($1, $2, $3, $4, $5) RETURNING device_id`,
          [line.rows[0].line_id, d.deviceCode, d.deviceName, d.vendor, d.model],
        );
        const deviceId = dev.rows[0].device_id;
        deviceCount++;
        // 루프백 host = 시뮬레이션 설비 → 정상 값에 SIMULATED(9) · 타임아웃 3초는 원본 현행(06_pipeline/02 §미확인 등재)
        await pg.query(
          `INSERT INTO modbus_config (device_id, host, port, unit_id, timeout_ms, retry_count, max_regs_per_request)
           VALUES ($1, '127.0.0.1', $2, 1, 3000, 0, 125)`,
          [deviceId, d.port],
        );
        for (const t of d.tags) {
          await pg.query(
            `INSERT INTO tag_master (device_id, tag_code, tag_name, function_code, address, data_type, word_order,
                                     scale, offset_value, unit, deadband, scan_rate_ms, range_min, range_max, tag_kind)
             VALUES ($1, $2, $3, 3, $4, $5, $6, 1, 0, $7, $8, $9, $10, $11, $12)`,
            [
              deviceId,
              t.tagCode,
              t.tagName,
              t.address,
              t.dataType,
              t.wordOrder,
              t.unit,
              opts.deadband,
              t.scanRateMs,
              opts.range?.min ?? t.rangeMin,
              opts.range?.max ?? t.rangeMax,
              t.tagKind,
            ],
          );
          tagCount++;
        }
      }
    }
    await pg.query('COMMIT');
    process.stdout.write(
      `seed 완료 — ${layout.label} · 설비 ${deviceCount} · 태그 ${tagCount} · ${describeSeedOptions(opts, layout)} · scan_rate_ms ${describeScanRates(layout)}\n`,
    );
  } catch (e) {
    await pg.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await pg.end();
  }
  // ⑨는 커밋 뒤라 시드 실패와 가른다 — 여기서 실패해도 시드는 들어갔고 재실행은 "빈 볼륨 아님"으로 거부된다(검수 I5).
  // 사전은 LIFETIME(300~600초) 안에 스스로 다시 읽으므로 수동 재적재 명령만 알린다.
  try {
    await reloadDictionary();
  } catch (e) {
    process.stderr.write(
      `시드는 커밋됐다 · dict_tag 재적재 실패 — ${e instanceof Error ? e.message : String(e)} · ClickHouse가 뜬 뒤 SYSTEM RELOAD DICTIONARY plc.dict_tag를 실행하거나 LIFETIME을 기다린다\n`,
    );
    process.exitCode = 2;
  }
}

main().catch((e) => {
  process.stderr.write(`seed 실패 — ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
