'use client';
// 저장소 누적 카드 3 — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW 데이터 원천(ClickHouse · PostgreSQL · Redis 카드 · 수집 나이)
// 메트릭 이름은 10_observability/01_metrics_catalog.md 등재 이름만 쓴다. 5초 폴링 · 값마다 수집 나이(obs_collect_last_success_timestamp_seconds).
// 행당 바이트의 분모는 테이블 전체 행 수 계열(ch_parts_rows · pg_table_live_tuples)이다 — 누적 삽입 수가 아니다.
// 적체 판정은 consumer_lag · biz_stream_lag다 — redis_stream_length는 길이로만 보인다(ADR-21).
import type { ReactNode } from 'react';
import {
  compressionRatio,
  type FlowMetricRates,
  type FlowMetrics,
  type FlowStore,
  perRowBytes,
} from '../../../lib/flow';
import { backpressureStageName } from '../../../lib/metrics-parser';
import { formatAge, formatKst } from '../../../lib/time';
import { Band } from '../../ui/band';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../ui/card';

const NO_ROWS = '행 수 계측 없음';

function bytes(v: number | null): string {
  if (v === null) return '—';
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} GiB`;
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MiB`;
  if (v >= 1024) return `${(v / 1024).toFixed(1)} KiB`;
  return `${Math.round(v)} B`;
}
function int(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : Math.round(v).toLocaleString('ko-KR');
}
function perSec(v: number | null | undefined, unit = ''): string {
  if (v === null || v === undefined) return '—';
  const n = v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1);
  return `${n}${unit}/초`;
}
function rowB(v: number | null): string {
  return v === null ? NO_ROWS : `${v.toFixed(1)} B`;
}

function Rows({ rows }: { rows: [string, ReactNode, string?][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
      {rows.map(([k, v, title]) => (
        <div key={k} className="contents" title={title}>
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function StoreCard({
  title,
  store,
  data,
  now,
  children,
}: {
  title: string;
  store: FlowStore;
  data: FlowCardsProps;
  now: number;
  children: ReactNode;
}) {
  const at = data.metrics?.collectedAt[store] ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2">
          <span>{title}</span>
          <span className="text-xs font-normal text-slate-500">
            {at === null ? '수집 나이 —' : `수집 ${formatAge(now - at * 1000)} 전`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data.failed && (
          <Band>
            메트릭을 읽지 못했다
            {data.lastSuccessAt > 0 && ` — 마지막 성공 ${formatKst(data.lastSuccessAt, true)}`}
          </Band>
        )}
        {data.metrics ? children : <div className="h-40 animate-pulse rounded bg-slate-100" />}
      </CardContent>
      <CardFooter>
        {data.fetchedAt === null ? '—' : `조회 ${formatKst(data.fetchedAt, true)}`} · 5초 폴링 · 순간값 — 기록
        정본 아님
      </CardFooter>
    </Card>
  );
}

export interface FlowCardsProps {
  metrics: FlowMetrics | null;
  rates: FlowMetricRates | null;
  fetchedAt: number | null;
  failed: boolean;
  lastSuccessAt: number;
}

export function StoreCards(props: FlowCardsProps & { now: number }) {
  const { metrics: m, rates: r, now } = props;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <StoreCard title="ClickHouse" store="clickhouse" data={props} now={now}>
        {m && (
          <>
            {Object.entries(m.clickhouse.tables)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([t, v]) => (
                <div key={t}>
                  <div className="text-xs font-medium text-slate-700">{t}</div>
                  <Rows
                    rows={[
                      ['디스크', bytes(v.bytesOnDisk)],
                      [
                        '압축률',
                        compressionRatio(v) === null ? '—' : `×${(compressionRatio(v) as number).toFixed(1)}`,
                      ],
                      [
                        '행당',
                        rowB(perRowBytes(v.bytesOnDisk, v.rows)),
                        'ch_parts_bytes_on_disk ÷ ch_parts_rows(활성 파트 행 합 — 머지 전 중복 포함)',
                      ],
                      ['활성 파트', int(v.activeParts)],
                      ['새 파트', perSec(r?.chNewPartsPerSec[t])],
                    ]}
                  />
                </div>
              ))}
            <Rows
              rows={[
                [
                  '삽입 행 누적(CH)',
                  int(m.clickhouse.insertedRowsTotal),
                  'ch_inserted_rows_total — 기동 이후 누적',
                ],
                ['tag_raw 쓴 행 누적', int(m.clickhouse.rowsInserted), 'rows_inserted'],
                [
                  'alarm_eval 쓴 행 누적',
                  int(m.clickhouse.alarmEvalRowsInserted),
                  'alm_eval_rows_inserted_total',
                ],
              ]}
            />
          </>
        )}
      </StoreCard>

      <StoreCard title="PostgreSQL" store="postgres" data={props} now={now}>
        {m && (
          <>
            {Object.entries(m.postgres.tables)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([t, v]) => {
                const size =
                  v.heapBytes === null && v.indexBytes === null
                    ? null
                    : (v.heapBytes ?? 0) + (v.indexBytes ?? 0);
                return (
                  <div key={t}>
                    <div className="text-xs font-medium text-slate-700">{t}</div>
                    <Rows
                      rows={[
                        ['크기', `${bytes(size)}(힙 ${bytes(v.heapBytes)} · 인덱스 ${bytes(v.indexBytes)})`],
                        [
                          '행당',
                          rowB(perRowBytes(size, v.liveTuples)),
                          'pg_relation_size_bytes(힙 + 인덱스) ÷ pg_table_live_tuples — 통계 추정치 · ANALYZE 시점에 따라 늦다',
                        ],
                        ['데드 튜플', int(v.deadTuples)],
                      ]}
                    />
                  </div>
                );
              })}
            <Rows
              rows={[
                [
                  'WAL',
                  perSec(r?.walBytesPerSec === null || !r ? null : r.walBytesPerSec / 1024, ' KiB'),
                  'pg_wal_bytes_total 두 폴링 차',
                ],
                ['커밋', perSec(r?.commitsPerSec), 'pg_xact_commit_total 두 폴링 차'],
                [
                  '열린 알람',
                  m.postgres.activeAlarms
                    ? Object.entries(m.postgres.activeAlarms)
                        .map(([s, n]) => `${s} ${int(n)}`)
                        .join(' · ')
                    : '—',
                ],
              ]}
            />
          </>
        )}
      </StoreCard>

      <StoreCard title="Redis" store="redis" data={props} now={now}>
        {m && (
          <>
            <Rows
              rows={[
                ['메모리', `${bytes(m.redis.usedMemoryBytes)} / ${bytes(m.redis.maxMemoryBytes)}`],
                [
                  '컨슈머 랙(적체)',
                  int(m.redis.consumerLag),
                  'consumer_lag — 그룹 lag + pending · 적체 판정은 이것',
                ],
                [
                  '명령 랙(적체)',
                  int(m.redis.bizStreamLag),
                  'biz_stream_lag — grp:biz-writer 미확인 적체 · XLEN 아님',
                ],
                ...Object.entries(m.redis.streamLength ?? {}).map(
                  ([s, n]) =>
                    [`${s} 길이`, int(n), 'redis_stream_length — 길이만 · 적체 판정 금지'] as [
                      string,
                      string,
                      string,
                    ],
                ),
                ...Object.entries(m.redis.backpressure ?? {}).map(
                  ([p, st]) => [`백프레셔 ${p}`, backpressureStageName(st)] as [string, string],
                ),
                ...Object.entries(r?.latestUpdatesPerSec ?? {}).map(
                  ([wr, v]) => [`최신값 갱신 ${wr}`, perSec(v)] as [string, string],
                ),
              ]}
            />
            {m.redis.bizCommands && (
              <div title="biz_commands_total — api(timeout · unavailable)와 워커(종결 4값)가 한 명령을 두 번 셀 수 있다 · 화면 명령 수는 flow totals">
                <div className="text-xs font-medium text-slate-700">업무 명령 결과(초당)</div>
                <Rows
                  rows={Object.entries(m.redis.bizCommands)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([res]) => [res, perSec(r?.bizCommandsPerSec[res])] as [string, string])}
                />
              </div>
            )}
            {m.redis.prefixMemory && (
              <div>
                <div className="text-xs font-medium text-slate-700">접두별 메모리</div>
                <Rows
                  rows={Object.entries(m.redis.prefixMemory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([p, v]) => [p, bytes(v)] as [string, string])}
                />
              </div>
            )}
          </>
        )}
      </StoreCard>
    </div>
  );
}
