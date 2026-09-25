// 모드 C(GEN-07) — 게이트 404 · 본문 검증 400 · 적체 검사 503 · 부분 수용 503 details.acceptedEntries · 202(07_api/09 #1)
// 표면은 Nest + Fastify 앱을 저장소 없이 띄워 inject로 부른다 — Redis는 BulkPublisher 가짜로 대신한다.
import 'reflect-metadata';
import { BULK_MAX_BODY_BYTES, BULK_MAX_ENTRIES, decodeEntry, ErrorEnvelope, QUALITY } from '@db-study/shared';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiExceptionFilter } from '../src/common/http/exception-filter';
import type { GroupBacklog } from '../src/common/redis/durable-key-client';
import { loadConfig, STREAM_MAXLEN } from '../src/config/app-config';
import { BackpressureGate, STAGE, thresholdsFor } from '../src/modules/datagen/mode-b/backpressure-gate';
import { BULK_INGESTOR, BulkIngestController } from '../src/modules/datagen/mode-c/bulk-ingest.controller';
import { BulkIngestor, type BulkPublisher } from '../src/modules/datagen/mode-c/bulk-ingestor';
import { bulkIngestorFor } from '../src/modules/datagen/mode-c/mode-c.module';

const MAXLEN = STREAM_MAXLEN.load; // 위험 임계 180,000 · 주의 20,000

class FakePublisher implements BulkPublisher {
  backlog: GroupBacklog | null = { lag: 0, pending: 0 };
  checkFails = false;
  /** n번째(0부터) 엔트리부터 실패 — null이면 전부 성공 */
  failFrom: number | null = null;
  pipelineThrows = false;
  added: Buffer[] = [];
  checks = 0;
  pipelines = 0;

  async groupBacklog(): Promise<GroupBacklog | null> {
    this.checks += 1;
    if (this.checkFails) throw new Error('연결 끊김');
    return this.backlog;
  }
  async xaddBatchWithBacklog(_s: string, payloads: readonly Buffer[]) {
    this.pipelines += 1;
    if (this.pipelineThrows) throw new Error('연결 끊김');
    const results = payloads.map((p, i) => {
      if (this.failFrom !== null && i >= this.failFrom) return new Error('OOM command not allowed');
      this.added.push(p);
      return `${Date.now()}-${i}`;
    });
    return { results, backlog: this.backlog };
  }
}

function entry(deviceId: number, scanSeq: number, n = 3) {
  return {
    deviceId,
    scanSeq,
    t0: 1_758_675_600_000,
    tagIds: Array.from({ length: n }, (_, i) => 3401 + i),
    dt: Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : 0)),
    values: Array.from({ length: n }, (_, i) => 72.4 + i),
    quality: Array.from({ length: n }, () => 9),
  };
}

let app: NestFastifyApplication | null = null;
afterEach(async () => {
  await app?.close();
  app = null;
});

async function boot(ingestor: BulkIngestor | null) {
  @Module({
    controllers: [BulkIngestController],
    providers: [{ provide: BULK_INGESTOR, useValue: ingestor }],
  })
  class TestModule {}
  app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), { logger: false });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const fastify = app.getHttpAdapter().getInstance();
  return (payload: unknown, raw?: string) =>
    fastify.inject({
      method: 'POST',
      url: '/api/v1/ingest/bulk',
      headers: { 'content-type': 'application/json' },
      payload: raw ?? JSON.stringify(payload),
    });
}

function withPublisher() {
  const pub = new FakePublisher();
  const ingestor = new BulkIngestor(pub, new BackpressureGate(thresholdsFor(MAXLEN)), MAXLEN);
  return { pub, ingestor };
}

describe('게이트(① · DATAGEN_BULK_ENABLED)', () => {
  const env = { WORKER_POOL_SIZE: '1', MEMORY_PROFILE: 'load' };

  it("'true'가 아니면 주입기를 만들지 않는다 — 기본 · false · 오타 전부 꺼짐", () => {
    for (const v of [undefined, 'false', 'TRUE', '1', 'yes']) {
      const cfg = loadConfig({ ...env, ...(v === undefined ? {} : { DATAGEN_BULK_ENABLED: v }) });
      expect(cfg.datagenBulkEnabled).toBe(false);
      expect(bulkIngestorFor(cfg, new FakePublisher() as never)).toBeNull();
    }
  });

  it("'true'면 주입기 · 임계는 MAXLEN 비율(모드 B와 같다)", () => {
    const cfg = loadConfig({ ...env, DATAGEN_BULK_ENABLED: 'true' });
    const ing = bulkIngestorFor(cfg, new FakePublisher() as never);
    expect(ing?.gate.thresholds).toEqual({ caution: 20_000, warning: 100_000, danger: 180_000 });
  });

  it("'true' + MEMORY_PROFILE 없음 · SW-01 off는 기동 거부", () => {
    expect(() =>
      bulkIngestorFor(loadConfig({ WORKER_POOL_SIZE: '1', DATAGEN_BULK_ENABLED: 'true' }), {} as never),
    ).toThrow(/MEMORY_PROFILE/);
    expect(() =>
      bulkIngestorFor(
        loadConfig({ ...env, DATAGEN_BULK_ENABLED: 'true', REDIS_STREAM_BUFFER: 'off' }),
        {} as never,
      ),
    ).toThrow(/SW-01/);
  });

  it('꺼진 표면은 404 datagen.bulk_disabled — 본문을 보지 않는다', async () => {
    const post = await boot(null);
    const r = await post({ junk: true });
    expect(r.statusCode).toBe(404);
    expect(ErrorEnvelope.parse(r.json()).error.code).toBe('datagen.bulk_disabled');
  });
});

describe('본문 검증(③ · 400 common.validation_failed)', () => {
  const bad: [string, unknown][] = [
    ['v 없음', { entries: [entry(1, 1)] }],
    ['v 2', { v: 2, entries: [entry(1, 1)] }],
    ['entries 0개', { v: 1, entries: [] }],
    ['길이 불일치', { v: 1, entries: [{ ...entry(1, 1), dt: [0, 0] }] }],
    ['dt 음수', { v: 1, entries: [{ ...entry(1, 1), dt: [0, -1, 0] }] }],
    ['quality 0', { v: 1, entries: [{ ...entry(1, 1), quality: [9, 0, 9] }] }],
    ['min(dt) ≠ 0', { v: 1, entries: [{ ...entry(1, 1), dt: [1, 2, 3] }] }],
    ['모르는 필드', { v: 1, entries: [{ ...entry(1, 1), extra: 1 }] }],
    [
      '엔트리 상한 초과',
      { v: 1, entries: Array.from({ length: BULK_MAX_ENTRIES + 1 }, (_, i) => entry(1, i, 1)) },
    ],
  ];
  for (const [name, body] of bad) {
    it(name, async () => {
      const { pub, ingestor } = withPublisher();
      const post = await boot(ingestor);
      const r = await post(body);
      expect(r.statusCode).toBe(400);
      expect(ErrorEnvelope.parse(r.json()).error.code).toBe('common.validation_failed');
      expect(pub.checks + pub.pipelines).toBe(0); // 검증 전에는 Redis를 부르지 않는다
    });
  }

  it('JSON이 아닌 본문 · 본문 크기 상한(1 MiB) 초과도 400 봉투', async () => {
    const { pub, ingestor } = withPublisher();
    const post = await boot(ingestor);
    const r1 = await post(null, '{"v":1,');
    expect(r1.statusCode).toBe(400);
    expect(ErrorEnvelope.parse(r1.json()).error.code).toBe('common.validation_failed');
    const big = JSON.stringify({ v: 1, entries: [entry(1, 1)], pad: 'x'.repeat(BULK_MAX_BODY_BYTES) });
    const r2 = await post(null, big);
    expect(r2.statusCode).toBe(400);
    expect(ErrorEnvelope.parse(r2.json()).error.code).toBe('common.validation_failed');
    expect(pub.checks + pub.pipelines).toBe(0);
  });

  it('엔트리 태그 상한(500) 초과 · 1 MiB 안의 거대 배열도 500이 아니라 400(검수 #7)', async () => {
    const { pub, ingestor } = withPublisher();
    const post = await boot(ingestor);
    const n = 130_000; // 전개 인자 Math.min(...)이 RangeError를 내던 크기 — 본문은 1 MiB 안
    const zeros = new Array(n).fill(0);
    const body = JSON.stringify({
      v: 1,
      entries: [
        {
          deviceId: 1,
          scanSeq: 1,
          t0: 1,
          tagIds: zeros,
          dt: zeros,
          values: zeros,
          quality: new Array(n).fill(9),
        },
      ],
    });
    expect(Buffer.byteLength(body)).toBeLessThan(BULK_MAX_BODY_BYTES);
    const r = await post(null, body);
    expect(r.statusCode).toBe(400);
    expect(ErrorEnvelope.parse(r.json()).error.code).toBe('common.validation_failed');
    expect(pub.checks + pub.pipelines).toBe(0);
  });
});

describe('적체 검사(④) · XADD(⑤) · 응답(⑥)', () => {
  it('202 — 엔트리 하나 = XADD 하나 · 계약 변환(필드 이름 · MessagePack) · 요청당 검사 1회 · 파이프라인 1회', async () => {
    const { pub, ingestor } = withPublisher();
    const post = await boot(ingestor);
    const r = await post({ v: 1, entries: [entry(12, 884201), entry(13, 884201, 2)] });
    expect(r.statusCode).toBe(202);
    expect(r.json()).toEqual({ acceptedEntries: 2, acceptedRows: 5 });
    expect(pub.checks).toBe(1);
    expect(pub.pipelines).toBe(1);
    const e0 = decodeEntry(pub.added[0] as Buffer) as Record<string, unknown>;
    expect(e0).toMatchObject({ v: 1, d: 12, tg: [3401, 3402, 3403], dt: [0, 0, 1], q: [9, 9, 9] });
    expect(Number(e0.s)).toBe(884201);
    expect(Number(e0.t0)).toBe(1_758_675_600_000);
    expect(QUALITY.SIMULATED).toBe(9);
  });

  it('위험(적체 > 위험 임계)이면 503 stream_full · acceptedEntries 0 · XADD 없음', async () => {
    const { pub, ingestor } = withPublisher();
    pub.backlog = { lag: 170_000, pending: 10_001 };
    const post = await boot(ingestor);
    const r = await post({ v: 1, entries: [entry(1, 1)] });
    expect(r.statusCode).toBe(503);
    const e = ErrorEnvelope.parse(r.json());
    expect(e.error.code).toBe('datagen.stream_full');
    expect(e.error.details).toEqual({ acceptedEntries: 0 });
    expect(pub.pipelines).toBe(0);
    expect(ingestor.gate.stage).toBe(STAGE.DANGER);
  });

  it('위험은 주의 임계 아래에서 풀린다(모드 B와 같은 재개 기준) · lag가 비면 직전 단계 유지', async () => {
    const { pub, ingestor } = withPublisher();
    const post = await boot(ingestor);
    pub.backlog = { lag: 180_001, pending: 0 };
    expect((await post({ v: 1, entries: [entry(1, 1)] })).statusCode).toBe(503);
    pub.backlog = { lag: 50_000, pending: 0 }; // 경고 대역 — 위험에서는 아직 못 풀린다
    expect((await post({ v: 1, entries: [entry(1, 2)] })).statusCode).toBe(503);
    pub.backlog = { lag: null, pending: 0 };
    expect((await post({ v: 1, entries: [entry(1, 3)] })).statusCode).toBe(503);
    pub.backlog = { lag: 19_999, pending: 0 };
    expect((await post({ v: 1, entries: [entry(1, 4)] })).statusCode).toBe(202);
  });

  it('도중 실패 — 503 · details.acceptedEntries = 성공 수 · 이후 위험 단계', async () => {
    const { pub, ingestor } = withPublisher();
    pub.failFrom = 2;
    const post = await boot(ingestor);
    const r = await post({ v: 1, entries: [entry(1, 1), entry(1, 2), entry(1, 3), entry(1, 4)] });
    expect(r.statusCode).toBe(503);
    const e = ErrorEnvelope.parse(r.json());
    expect(e.error.code).toBe('datagen.stream_full');
    expect(e.error.details).toEqual({ acceptedEntries: 2 });
    expect(pub.added).toHaveLength(2);
    expect(ingestor.gate.stage).toBe(STAGE.DANGER);
  });

  it('파이프라인 자체 실패 · 적체 조회 실패 — 503 acceptedEntries 0', async () => {
    const a = withPublisher();
    a.pub.pipelineThrows = true;
    const postA = await boot(a.ingestor);
    const ra = await postA({ v: 1, entries: [entry(1, 1)] });
    expect(ra.statusCode).toBe(503);
    expect(ra.json().error.details).toEqual({ acceptedEntries: 0 });
    await app?.close();
    app = null;
    const b = withPublisher();
    b.pub.checkFails = true;
    const postB = await boot(b.ingestor);
    const rb = await postB({ v: 1, entries: [entry(1, 1)] });
    expect(rb.statusCode).toBe(503);
    expect(rb.json().error.details).toEqual({ acceptedEntries: 0 });
    expect(b.pub.pipelines).toBe(0);
  });
});
