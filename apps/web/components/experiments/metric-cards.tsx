// 메트릭 요약 카드 — 정본 08_screen/07 §요소(앱 · 파이프라인 요약 · 저장소 요약 · 키 계열별 메모리 · E2E 지연 게이지).
// 가장 중요한 단일 지표(컨슈머 랙)를 첫 자리에, 백프레셔 단계를 그 옆에 둔다 — 랙이 오르는데 단계가 정상이면 판정량과 랙의 산출식 차이를 의심할 자리다.
// 화면 수치는 순간값이며 4요소가 없다 — 측정 기록이 아니다(08_screen/07). 계열이 없으면 "이 단계에서 아직 계측하지 않는다"(§상태 4행 빈 값 ①).
import type { ReactNode } from 'react';
import { backpressureStageName, type ConsoleSummary } from '../../lib/metrics-parser';
import { formatKst } from '../../lib/time';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';

const NOT_YET = '이 단계에서 아직 계측하지 않는다';

/** 봉인 계열(TTL · 축출 없음) — 키 계열별 메모리 막대 색을 가른다(05_data_stores/05 봉인 표) */
const SEALED_PREFIXES = new Set(['stream', 'rt', 'alarm']);

function ms(sec: number | null): string {
  return sec === null ? '—' : `${(sec * 1000).toFixed(1)} ms`;
}
function int(v: number | null): string {
  return v === null ? '—' : Math.round(v).toLocaleString('ko-KR');
}
function bytes(v: number | null): string {
  if (v === null) return '—';
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} GiB`;
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MiB`;
  if (v >= 1024) return `${(v / 1024).toFixed(1)} KiB`;
  return `${v} B`;
}
function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}

function MetricCard({
  title,
  fetchedAt,
  note,
  children,
}: {
  title: string;
  fetchedAt: number | null;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl tabular-nums">{children}</CardContent>
      <CardFooter>
        {fetchedAt === null ? '—' : `조회 ${formatKst(fetchedAt, true)}`}
        {note ? <> · {note}</> : null} · 순간값 · 4요소 없음 — 기록 정본 아님
      </CardFooter>
    </Card>
  );
}

/** 작은 이름 — 값 줄 */
function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function stageVariant(stage: number): 'success' | 'warning' | 'danger' | 'outline' {
  if (stage === 0) return 'success';
  if (stage === 1 || stage === 2) return 'warning';
  if (stage === 3) return 'danger';
  return 'outline';
}

export interface DerivedRates {
  /** 생성기 pps — 모드 A~D 누적 합의 두 폴링 사이 차 */
  genPps: number | null;
  /** 조회 캐시 히트율 — tsq_cache_requests_total 두 폴링 사이 차 */
  hitRatio: number | null;
}

export function MetricCards({
  summary,
  fetchedAt,
  derived,
  failed,
  lastSuccessAt,
}: {
  summary: ConsoleSummary | null;
  fetchedAt: number | null;
  derived: DerivedRates;
  failed: boolean;
  lastSuccessAt: number;
}) {
  const pending = <div className="h-8 animate-pulse rounded bg-slate-100" />;
  const notYet = <span className="text-sm text-slate-500">{NOT_YET}</span>;
  const nextPoll = <span className="text-sm text-slate-500">다음 폴링에서 계산</span>;
  /** 로딩(카드 자리만) · 미계측 · 값 */
  const cell = <T,>(v: T | null | undefined, render: (x: T) => ReactNode) =>
    summary === null ? pending : v === null || v === undefined ? notYet : render(v);
  const s = summary;

  return (
    <div className="flex flex-col gap-4">
      {failed && (
        <Band>
          메트릭을 읽지 못했다{lastSuccessAt > 0 && ` — 마지막 성공 ${formatKst(lastSuccessAt, true)}`}
        </Band>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-700">앱 · 파이프라인 메트릭 요약</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="컨슈머 랙(consumer_lag)" fetchedAt={fetchedAt}>
            {cell(s?.consumerLag, (v) => `${int(v)} 엔트리`)}
          </MetricCard>
          <MetricCard title="백프레셔 단계(backpressure_stage)" fetchedAt={fetchedAt}>
            {cell(s?.backpressure, (list) => (
              <div className="flex flex-col gap-1 text-sm">
                {list.map((b) => (
                  <div key={b.publisher} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{b.publisher}</span>
                    <Badge variant={stageVariant(b.stage)}>{backpressureStageName(b.stage)}</Badge>
                  </div>
                ))}
              </div>
            ))}
          </MetricCard>
          <MetricCard title="미확인 적체(그룹 lag + pending)" fetchedAt={fetchedAt}>
            {cell(s?.unacked, (u) => (
              <Rows
                rows={[
                  ['그룹 lag(ing_group_lag)', int(u.groupLag)],
                  ['pending(ing_group_pending)', int(u.pending)],
                  [
                    'lag 산출 불가',
                    u.lagUnknown ? (
                      <Badge key="v" variant="warning">
                        직전 값 유지 중
                      </Badge>
                    ) : (
                      '아님'
                    ),
                  ],
                  [
                    '트리밍된 미확인(stream_trimmed_unacked)',
                    s?.trimmedUnacked === null || s?.trimmedUnacked === undefined ? (
                      <span key="v" className="text-xs text-slate-500">
                        {NOT_YET}
                      </span>
                    ) : (
                      <span key="v" className={cn(s.trimmedUnacked > 0 && 'font-semibold text-red-700')}>
                        {int(s.trimmedUnacked)}
                      </span>
                    ),
                  ],
                ]}
              />
            ))}
          </MetricCard>
          <MetricCard title="스풀(spool_*)" fetchedAt={fetchedAt}>
            {cell(s?.spool, (sp) => (
              <Rows
                rows={[
                  [
                    '스풀 전환',
                    sp.active === null ? (
                      '—'
                    ) : sp.active ? (
                      <Badge key="v" variant="danger">
                        켜짐
                      </Badge>
                    ) : (
                      '꺼짐'
                    ),
                  ],
                  ['스풀 크기', bytes(sp.bytes)],
                  ['재발행 속도', sp.drainRate === null ? '—' : `${int(sp.drainRate)} 엔트리/초`],
                ]}
              />
            ))}
          </MetricCard>
          <MetricCard title="DLQ(dlq_count)" fetchedAt={fetchedAt} note="기동 이후 누적">
            {cell(s?.dlq, (d) => (
              <div className="flex flex-col">
                <span>{int(d.total)} 엔트리</span>
                <span className="text-xs text-slate-500">
                  {Object.entries(d.byReason)
                    .map(([k, v]) => `${k} ${int(v)}`)
                    .join(' · ')}
                </span>
              </div>
            ))}
          </MetricCard>
          <MetricCard
            title="조회 캐시 히트율(tsq_cache_requests_total)"
            fetchedAt={fetchedAt}
            note="두 폴링 사이"
          >
            {cell(s?.cacheRequests, (c) => (
              <div className="flex flex-col">
                {derived.hitRatio === null ? nextPoll : <span>{pct(derived.hitRatio)}</span>}
                <span className="text-xs text-slate-500">
                  누적 hit {int(c.hit)} · miss {int(c.miss)} · error {int(c.error)}
                </span>
              </div>
            ))}
          </MetricCard>
          <MetricCard
            title="생성기 pps(gen_points_generated_total)"
            fetchedAt={fetchedAt}
            note="두 폴링 사이"
          >
            {cell(s?.genPointsByMode, (g) => (
              <div className="flex flex-col">
                {derived.genPps === null ? (
                  nextPoll
                ) : (
                  <span>{Math.round(derived.genPps).toLocaleString('ko-KR')} 점/초</span>
                )}
                <span className="text-xs text-slate-500">
                  누적{' '}
                  {Object.entries(g)
                    .map(([k, v]) => `모드 ${k} ${int(v)}`)
                    .join(' · ')}
                </span>
              </div>
            ))}
          </MetricCard>
          <MetricCard title="모드 C 거절 수(datagen.stream_full)" fetchedAt={fetchedAt} note="기동 이후 누적">
            {cell(s?.modeCRejections, (v) => `${int(v)} 건`)}
          </MetricCard>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-700">E2E 지연 게이지</h2>
        <MetricCard title="E2E 지연(e2e_latency)" fetchedAt={fetchedAt}>
          {cell(s?.e2e, (e) => (
            <div className="grid grid-cols-3 gap-2 text-base">
              <span>p50 {ms(e.p50)}</span>
              <span>p95 {ms(e.p95)}</span>
              <span>p99 {ms(e.p99)}</span>
              {e.rows !== null && (
                <span className="col-span-3 text-xs text-slate-500">창의 행 수 {e.rows}</span>
              )}
            </div>
          ))}
        </MetricCard>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-700">저장소 메트릭 요약(OBS-02)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StoreCard title="PostgreSQL" summary={s} store="postgres" fetchedAt={fetchedAt}>
            {cell(s?.stores.postgres, (p) => (
              <Rows
                rows={[
                  [
                    '연결(pg_connections)',
                    p.connections === null
                      ? '—'
                      : `${int(p.connections.total)} (${Object.entries(p.connections.byState)
                          .map(([k, v]) => `${k} ${int(v)}`)
                          .join(' · ')})`,
                  ],
                  ['느린 쿼리 — 평균 1위 문형', ms(p.slowestMeanSec)],
                  ['락 대기', int(p.lockWaits)],
                  ['버퍼 적중률', pct(p.bufferHitRatio)],
                  ['커밋 누적', int(p.xactCommitTotal)],
                ]}
              />
            ))}
          </StoreCard>
          <StoreCard title="ClickHouse" summary={s} store="clickhouse" fetchedAt={fetchedAt}>
            {cell(s?.stores.clickhouse, (c) => (
              <Rows
                rows={[
                  [
                    '활성 파트(ch_active_parts)',
                    c.activeParts === null
                      ? '—'
                      : `${int(c.activeParts.total)}${
                          c.activeParts.byTable.tag_raw !== undefined
                            ? ` (tag_raw ${int(c.activeParts.byTable.tag_raw)})`
                            : ''
                        }`,
                  ],
                  ['진행 중 머지', int(c.mergesRunning)],
                  ['쿼리 p95(직전 수집 창)', ms(c.queryP95Sec)],
                  ['메모리 추적', bytes(c.memoryTrackingBytes)],
                  [
                    '디스크 여유',
                    c.diskFreeBytes === null
                      ? '—'
                      : `${bytes(c.diskFreeBytes)}${c.diskTotalBytes ? ` / ${bytes(c.diskTotalBytes)}` : ''}`,
                  ],
                ]}
              />
            ))}
          </StoreCard>
          <StoreCard title="Redis" summary={s} store="redis" fetchedAt={fetchedAt}>
            {cell(s?.stores.redis, (r) => (
              <Rows
                rows={[
                  [
                    '사용 메모리 / 상한',
                    `${bytes(r.usedMemoryBytes)}${r.maxMemoryBytes ? ` / ${bytes(r.maxMemoryBytes)}` : ''}`,
                  ],
                  ['축출 누적', int(r.evictedKeysTotal)],
                  ['명령/초', int(r.opsPerSec)],
                  [
                    'Stream 길이(적체 판정 아님)',
                    r.streamLength === null
                      ? '—'
                      : Object.entries(r.streamLength)
                          .map(([k, v]) => `${k} ${int(v)}`)
                          .join(' · '),
                  ],
                ]}
              />
            ))}
          </StoreCard>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-700">키 계열별 메모리(OBS-03)</h2>
        <MetricCard title="접두별 점유(redis_prefix_memory_bytes · 표본 추정)" fetchedAt={fetchedAt}>
          {cell(s?.keyMemory, (km) => (
            <KeyMemoryBars km={km} />
          ))}
        </MetricCard>
      </section>
    </div>
  );
}

function StoreCard({
  title,
  summary,
  store,
  fetchedAt,
  children,
}: {
  title: string;
  summary: ConsoleSummary | null;
  store: 'postgres' | 'clickhouse' | 'redis';
  fetchedAt: number | null;
  children: ReactNode;
}) {
  const c = summary?.collect[store];
  // 수집 시각 = 표시값의 나이(obs_collect_last_success_timestamp_seconds) · 수집 실패는 그 계열만 빈다(REQ-OBS-03)
  const note =
    c && (c.lastSuccessSec !== null || c.errorsTotal) ? (
      <>
        {c.lastSuccessSec !== null ? `수집 ${formatKst(c.lastSuccessSec * 1000, true)}` : '수집 성공 없음'}
        {c.errorsTotal ? <span className="text-red-700"> · 수집 실패 누적 {int(c.errorsTotal)}</span> : null}
      </>
    ) : undefined;
  return (
    <MetricCard title={title} fetchedAt={fetchedAt} note={note}>
      {children}
    </MetricCard>
  );
}

function KeyMemoryBars({ km }: { km: Record<string, number> }) {
  const entries = Object.entries(km).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="flex flex-col gap-1 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[4rem_1fr_5rem] items-center gap-2">
          <span>{k}</span>
          <div className="h-2 rounded bg-slate-100">
            <div
              className={cn('h-2 rounded', SEALED_PREFIXES.has(k) ? 'bg-slate-700' : 'bg-sky-400')}
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
          <span className="text-right">{bytes(v)}</span>
        </div>
      ))}
      <span className="text-slate-500">
        진한 막대 = 봉인 계열(stream · rt · alarm) · 옅은 막대 = 캐시 계열
      </span>
    </div>
  );
}
