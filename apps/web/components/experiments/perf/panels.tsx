// EXP-PERF 표시 조각 — 결론 카드 · 원리 증거 · 저장 비용 · 조건 표지 · 판독 계수 줄(08_screen/08 §EXP-PERF §요소 · §표시 계약).
// 판독은 lib/perf.ts가 하고 여기는 그리기만 한다. 곡선 · 히트맵의 크기 수치는 참고값이고, 결론 카드 · 음영은 structuralRanges(정본)만 쓴다.
import { formatCrossover, formatExpRange, memoryLimitText, QUERY_LABELS } from '../../../lib/measurements';
import {
  compactNodes,
  expLabel,
  findRange,
  type PerfCounts,
  type PerfRange,
  type PerfView,
  PG_VARIANTS,
  type PgLead,
  postgresLeads,
  type ScanPg,
  type StageExclusion,
  undeterminedMarks,
} from '../../../lib/perf';

const TH = 'border-b border-slate-200 px-2 py-1 font-medium whitespace-nowrap';
const TD = 'border-b border-slate-100 px-2 py-1 whitespace-nowrap tabular-nums';

export const CACHE_LABEL: Record<string, string> = { warm: '웜', cold: '콜드' };
const STORE_SHORT = { clickhouse: 'ClickHouse', postgresql: 'PostgreSQL' } as const;

/** 참고값 배지 문구 — 고정(§표시 계약 참고값 배지) */
export const REFERENCE_BADGE = '참고값 — 편차 기준 초과(구조 판정만 정본)';
export const OBSERVATION_NOTE = '관찰 보조 — 기록 정본 아님';
export const EMPTY_SOURCE = 'EXP-01~05 구조 판정 기록이 아직 없다';
export const NO_RANGE_ROW = '이 쿼리 · 캐시의 구조 판정 행이 없다';
export const NO_STAGE = '단계 기록 없음(scan · 단계 axes)';
/** 한계 표지 3 — 상시(§표시 계약 한계 표지 · 08_screen/07 §대조군 역전 지점 구조 판정 한계와 같은 문장) */
export const LIMIT_MARKS = [
  '① ClickHouse 측정에 trace 로그 쓰기 부하가 포함됐다(clickhouseServerLogLevel)',
  '② 동률 점(ClickHouse client 중앙값 10 ms 미만 · 두 저장소 차 1 ms 미만)은 서버 µs로 판정했고 PostgreSQL 서버 값은 계획 시간을 뺀다(serverTimeAsymmetry) — client만 쓰면 콜드 Q1 · Q2 · Q3 구간이 다르다',
  '③ 콜드는 두 저장소 컨테이너 재기동 직후 1회 근사다(OS 페이지 캐시를 비우지 않았다)',
] as const;

/** 저장소 이름 — PostgreSQL은 변형을 붙인다(I1 · I2는 같은 저장소의 변형) */
const storeName = (store: keyof typeof STORE_SHORT, pgVariant: string) =>
  store === 'postgresql' ? `PostgreSQL ${pgVariant}` : 'ClickHouse';

/** 구조 판정 한 행을 문장으로 — 역전 구간(방향) 또는 역전 없음 — 앞선 쪽 · 범위 */
export function rangeSentence(r: PerfRange): string {
  if (r.crossover !== null)
    return `${formatCrossover(r.crossover)} ${
      r.direction
        ? `${storeName(r.direction.from, r.pgVariant)} → ${storeName(r.direction.to, r.pgVariant)}`
        : '(방향 미상)'
    }`;
  return `역전 없음 — ${storeName(r.winner, r.pgVariant)} 앞섬 · ${formatExpRange(r.range)}`;
}

/** 곡선 머리 문장 — I2 행이 음영의 원천(I1 행은 결론 카드에만) */
export function curveHeadline(r: PerfRange | undefined): string {
  if (!r) return NO_RANGE_ROW;
  if (r.crossover !== null)
    return `역전 구간 ${rangeSentence(r)} — 구조 판정(정본) · 곡선 교차와 어긋나면 음영이 맞다`;
  const [a, b] = r.range;
  return `관측 범위 ${a}~${b} 역전 없음 — 앞선 쪽 ${storeName(r.winner, r.pgVariant)}`;
}

const leadText = (l: PgLead) =>
  `${l.query} ${CACHE_LABEL[l.cache] ?? l.cache} ${l.pgVariant} — ${l.span[0]} ~ ${l.span[1]}행${
    l.kind === 'before-crossover' ? '(역전 전)' : '(역전 없음)'
  }`;

export function ConclusionCard({
  view,
  query,
  cache,
}: {
  view: Pick<PerfView, 'ranges' | 'verdicts' | 'points' | 'source'>;
  query: string;
  cache: string;
}) {
  const rows = PG_VARIANTS.map((v) => ({ v, r: findRange(view.ranges, query, cache, v) }));
  const und = undeterminedMarks(view, query, cache);
  const minExp = view.points.length > 0 ? Math.min(...view.points.map((p) => p.exponent)) : 5;
  const leads = postgresLeads(view.ranges, minExp);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="font-semibold text-slate-800">
          {QUERY_LABELS[query] ?? query} · {CACHE_LABEL[cache] ?? cache}
        </p>
        <p className="text-xs text-slate-500">
          구조 판정(반복 3회 우열 일치) · 기록 {view.source?.record ?? '없음'} structuralRanges · 크기 수치는
          인용하지 않는다
        </p>
      </div>
      {rows.every((x) => !x.r) ? (
        <p className="text-slate-500">{NO_RANGE_ROW}</p>
      ) : (
        <dl className="flex flex-col gap-1">
          {rows.map(({ v, r }) => (
            <div key={v}>
              <dt className="text-xs text-slate-500">{v} 대비</dt>
              <dd className={r?.crossover ? 'font-medium text-red-700' : 'text-slate-700'}>
                {r ? rangeSentence(r) : NO_RANGE_ROW}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-slate-700">
        <span className="text-xs text-slate-500">우열 미정 </span>
        {und.length === 0
          ? '없음'
          : und
              .map((u) => `${expLabel(u.exponent)} ${CACHE_LABEL[cache] ?? cache}(${u.pgVariant})`)
              .join(' · ')}
      </p>
      <div className="border-t border-slate-100 pt-2">
        <p className="text-xs font-semibold text-slate-700">PostgreSQL이 앞서는 경우</p>
        {leads.length === 0 ? (
          <p className="text-xs text-slate-500">구조 판정 행에 PostgreSQL이 앞서는 구간이 없다</p>
        ) : (
          <ul className="list-disc pl-4 text-xs text-slate-700">
            {leads.map((l) => (
              <li key={`${l.query}|${l.cache}|${l.pgVariant}`}>{leadText(l)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`;
const num = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** 결정적 값 · 구조 사실 표지 — 참고값 배지를 달지 않는다(§표시 계약 결정적 값 표지) */
export const factMark = (kind: '결정적 값' | '구조 사실', record: string, status: string) =>
  `${kind} · 기록 ${record} · ${status}`;

const OVER_VISIT = '100%를 넘는 칸은 방문 횟수다 — 같은 블록을 여러 번 읽었다(btree 페이지 재방문 등)';

function PgCells({ pg }: { pg: ScanPg | undefined }) {
  if (!pg)
    return (
      <>
        <td className={TD}>—</td>
        <td className={TD}>—</td>
        <td className={TD}>—</td>
      </>
    );
  const over = pg.bufferRatio !== null && pg.bufferRatio > 1;
  return (
    <>
      <td
        className={`${TD} ${over ? 'cursor-help underline decoration-dotted' : ''}`}
        title={`hit ${num(pg.sharedHitBlocks)} + read ${num(pg.sharedReadBlocks)}블록${over ? ` — ${OVER_VISIT}` : ''}`}
      >
        {pct(pg.bufferRatio)}
      </td>
      <td
        className={`${TD} max-w-72 truncate`}
        title={pg.nodes ? pg.nodes.join(' › ') : '계획 노드 기록 없음'}
      >
        {pg.nodes ? compactNodes(pg.nodes) : <span className="text-slate-400">계획 노드 기록 없음</span>}
      </td>
      <td className={TD}>{num(pg.workersLaunched)}</td>
    </>
  );
}

export function PrincipleTable({
  view,
  exponent,
}: {
  view: Pick<PerfView, 'scan'>;
  exponent: number | null;
}) {
  const s = view.scan.find((x) => x.exponent === exponent);
  if (!s) return <p className="text-xs text-slate-500">{NO_STAGE}</p>;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-slate-500">
        {factMark('구조 사실', s.record, s.status)} · {expLabel(s.exponent)} = {num(s.rows)}행 · 공통 논리
        크기 = 행 × 41 B = {num(s.logicalBytes)} B · 힙 블록 = 같은 기록 Q5 I1 hit + read ={' '}
        {num(s.heapBlocks)}블록 · 캐시 구분 없음(scan에 cache 필드가 없다)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className={TH} rowSpan={2}>
                쿼리
              </th>
              <th className={TH} colSpan={3}>
                ClickHouse
              </th>
              <th className={TH} colSpan={3}>
                PostgreSQL I1
              </th>
              <th className={TH} colSpan={3}>
                PostgreSQL I2
              </th>
              <th className={TH} rowSpan={2}>
                결과 행
              </th>
            </tr>
            <tr>
              <th className={TH}>read_rows</th>
              <th className={TH}>read_rows ÷ 행</th>
              <th className={TH}>read_bytes ÷ 논리</th>
              <th className={TH}>버퍼 ÷ 힙</th>
              <th className={TH}>계획 노드</th>
              <th className={TH}>병렬 작업자</th>
              <th className={TH}>버퍼 ÷ 힙</th>
              <th className={TH}>계획 노드</th>
              <th className={TH}>병렬 작업자</th>
            </tr>
          </thead>
          <tbody>
            {s.queries.map((q) => (
              <tr key={q.query}>
                <td className={TD}>{q.query}</td>
                <td className={TD}>{num(q.ch?.readRows)}</td>
                <td className={TD}>{pct(q.ch ? q.ch.readRows / s.rows : null)}</td>
                <td className={TD}>{pct(q.ch?.readBytesRatio)}</td>
                <PgCells pg={q.pg.I1} />
                <PgCells pg={q.pg.I2} />
                <td className={TD}>
                  {num(q.ch?.resultRows)} / {num(q.pg.I1?.actualRows ?? q.pg.I2?.actualRows)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        버퍼 블록은 hit + read(웜에서 read만 쓰면 0에 가까워져 구조가 사라진다) · {OVER_VISIT} · 결과 행 =
        ClickHouse / PostgreSQL · Q5x(조건 없는 count)는 싣지 않는다
      </p>
    </div>
  );
}

export function StorageTable({ view }: { view: Pick<PerfView, 'storage'> }) {
  if (view.storage.length === 0) return <p className="text-xs text-slate-500">{NO_STAGE}</p>;
  const hasWal = view.storage.some((s) => s.btreeBuildWalBytes !== null);
  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className={TH} rowSpan={2}>
                규모
              </th>
              <th className={TH} colSpan={2}>
                행당 저장 B
              </th>
              <th className={TH} colSpan={2}>
                압축률
              </th>
              <th className={TH} colSpan={3}>
                인덱스 B
              </th>
              <th className={TH} rowSpan={2}>
                PG WAL 증폭
              </th>
              {hasWal ? (
                <th className={TH} rowSpan={2}>
                  btree 생성 WAL B
                </th>
              ) : null}
              <th className={TH} rowSpan={2}>
                표지
              </th>
            </tr>
            <tr>
              <th className={TH}>CH</th>
              <th className={TH}>PG</th>
              <th className={TH}>CH</th>
              <th className={TH}>PG</th>
              <th className={TH}>CH</th>
              <th className={TH}>BRIN</th>
              <th className={TH}>btree</th>
            </tr>
          </thead>
          <tbody>
            {view.storage.map((s) => (
              <tr key={s.record}>
                <td className={TD}>{expLabel(s.exponent)}</td>
                <td className={TD}>{num(s.perRowBytes.ch, 2)}</td>
                <td className={TD}>{num(s.perRowBytes.pg, 2)}</td>
                <td className={TD}>{num(s.compression.ch, 2)}</td>
                <td className={TD}>{num(s.compression.pg, 2)}</td>
                <td className={TD}>{num(s.indexBytes.ch)}</td>
                <td className={TD}>{num(s.indexBytes.brin)}</td>
                <td className={TD}>{num(s.indexBytes.btree)}</td>
                <td className={TD}>{num(s.walAmplification, 2)}</td>
                {hasWal ? <td className={TD}>{num(s.btreeBuildWalBytes)}</td> : null}
                <td className={`${TD} text-slate-500`}>{factMark('결정적 값', s.record, s.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        행당 저장 B = storage_bytes ÷ 행 수 · WAL 증폭은 비율 그대로(PostgreSQL만 — ClickHouse 머지 증폭은
        결정적 값이 아니라 싣지 않는다) · btree 생성 WAL은 I2 인덱스 생성 WAL(적재 WAL 아님)이고 기록 값이
        있을 때만 · 053 정밀화 6점의 axes는 싣지 않는다(원리 증거와 규모 행을 맞춘다)
      </p>
    </div>
  );
}

export function ConditionPanel({ view }: { view: Pick<PerfView, 'source' | 'records'> }) {
  const s = view.source;
  if (!s) return null;
  const commits = [...new Set(view.records.map((r) => `${r.record} ${r.run.commitHash}`))];
  const sw = Object.entries(s.switches)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : String(v)}`)
    .join(' · ');
  const line = (label: string, v: string | null) => (
    <div className="flex gap-2">
      <dt className="w-44 shrink-0 text-slate-500">{label}</dt>
      <dd className="break-all text-slate-700">{v ?? '기록 없음'}</dd>
    </div>
  );
  return (
    <div className="flex flex-col gap-2 text-xs">
      <ul className="flex flex-col gap-0.5 rounded bg-amber-50 px-2 py-1 text-amber-900">
        {LIMIT_MARKS.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <dl className="flex flex-col gap-0.5">
        {line(
          '원천 기록',
          `${s.record} · ${s.status} · 반복 ${s.repeat.runs}회 · 편차 기준 ${s.repeat.threshold}`,
        )}
        {line(
          '4요소',
          `커밋 ${commits.join(' · ')} · 프로파일 ${s.run.memoryProfile} · 티어 ${s.run.capacityTier}`,
        )}
        {line('메모리 상한', memoryLimitText(s.run))}
        {line('스위치', sw)}
        {line('cpuset', s.cpuset)}
        {line('storeResources', s.storeResources)}
        {line('controlMemoryMb', s.controlMemoryMb)}
        {line('clickhouseMaxThreads', s.clickhouseMaxThreads)}
        {line('pgMaxParallelWorkersPerGather', s.pgMaxParallelWorkersPerGather)}
        {line('clickhouseServerLogLevel', s.clickhouseServerLogLevel)}
        {line('tieRule', s.tieRule)}
        {line('serverTimeAsymmetry', s.serverTimeAsymmetry)}
        {line('cacheDefinition', s.cacheDefinition)}
      </dl>
    </div>
  );
}

const EXCLUSION_TEXT: Record<StageExclusion, string> = {
  absent: '파일 없음',
  unreadable: '판독 불가',
  superseded: 'superseded',
  'missing-conditions': '4요소 누락',
};

/** 그리지 않은 점 — median null · unit 아님 + 로그 축이면 0 이하(P6) */
export const undrawnCount = (c: PerfCounts, yLog: boolean) => c.undrawn + (yLog ? c.nonPositive : 0);

export function CountsLine({
  view,
  yLog,
}: {
  view: Pick<PerfView, 'source' | 'stageRecords' | 'unreadableFiles' | 'counts'>;
  yLog: boolean;
}) {
  const c = view.counts;
  const stages =
    view.stageRecords === null
      ? '단계 기록 목록 없음'
      : view.stageRecords.length === 0
        ? '단계 기록 0'
        : view.stageRecords
            .map((s) => (s.excluded ? `${s.record}(${EXCLUSION_TEXT[s.excluded]} — 뺌)` : s.record))
            .join(' · ');
  return (
    <p className="text-xs text-slate-500">
      원천 기록 {view.source?.record ?? '없음'} · 단계 기록 {stages} · 판독 불가 {c.unreadable}
      {view.unreadableFiles.length > 0 ? ` (${view.unreadableFiles.join(' · ')})` : ''} · 4요소 누락{' '}
      {c.missingConditions} · 형식이 어긋난 행 {c.invalidRanges + c.invalidRows} (structuralRanges{' '}
      {c.invalidRanges} · 점 · scan {c.invalidRows}) · 형식이 어긋난 structuralRanges 기록{' '}
      {c.invalidStructural} · 그리지 않은 점 {undrawnCount(c, yLog)}
      {c.duplicatePoints > 0 ? ` · 뒤 기록이 덮은 중복 점 ${c.duplicatePoints}` : ''} · {OBSERVATION_NOTE}
    </p>
  );
}
