'use client';
// EXP-COMPARE 실증 요약 패널 — 역방향 대조(EXP-40~44) · 스트리밍 동시 적재(EXP-45) · 원리 대응.
// 정방향(EXP-01~05 역전 지점)은 crossover.tsx가 그린다. 이 패널은 같은 BFF 기록 읽기(/bff/measurements의 evidence)를 쓰고
// 대조군 역전 지점 표시 계약(08_screen/07 §대조군 역전 지점 — 4요소 툴팁 · 4요소 없는 점 제외 · 판독 불가 N건 · 상태 4행)을 그대로 따른다.
// 설계 정본 05_data_stores/10 §역방향 대조 — 업무 워크로드 · §스트리밍 동시 적재 — EXP-45. 화면 수치는 기록 값을 그릴 뿐이다 — 정본은 기록 파일이다.
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  type EvidenceRef,
  type EvidenceResult,
  PRINCIPLES,
  principleEvidence,
  REVERSE_X,
  type ReverseExp,
  type ReverseRow,
  reverseBars,
  STREAM_EXP,
  STREAM_QUANTILES,
  type StreamJudgement,
  type StreamQuantile,
  type StreamRow,
  streamJudgement,
  streamSeries,
  structuralGrid,
  structuralVerdict,
  toSeconds,
} from '../../lib/evidence';
import { formatRows, type Store } from '../../lib/measurements';
import { formatKst } from '../../lib/time';
import { Button, Select } from '../master/field';
import { Band } from '../ui/band';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { type ChartOption, EChart } from './echart';

const EMPTY = 'EXP-40~45 기록이 아직 없다';
const STORE_LABEL: Record<Store, string> = { postgresql: 'PostgreSQL', clickhouse: 'ClickHouse' };
// 역전 지점 패널과 같은 저장소 색 계열 — 변형은 같은 계열의 명도로 가른다
const SHADES: Record<Store, string[]> = {
  postgresql: ['#2563eb', '#60a5fa', '#1e3a8a', '#93c5fd'],
  clickhouse: ['#d97706', '#f59e0b', '#92400e', '#fbbf24', '#b45309', '#fcd34d'],
};

const EXP_TITLE: Record<ReverseExp, string> = {
  'EXP-40': 'EXP-40 상태 전이 갱신 — 변형별 갱신 지연 · 가시성 · 물리 비용',
  'EXP-41': 'EXP-41 PK 점조회 — 동시성 × 그래뉼',
  'EXP-42': 'EXP-42 원자성 · 동시 갱신 — 구조 판정',
  'EXP-43': 'EXP-43 무결성 제약 — 수용 건수(구조) · FINAL 비용(분포)',
  'EXP-44': 'EXP-44 단건 고빈도 삽입 — 요청률별',
};
const X_NAME = { scale: '업무 규모(work_order 행)', concurrency: '동시성', rate: '요청률(req/s)' } as const;

type Body = { readAt: number; evidence: EvidenceResult };

async function fetchRecords(): Promise<Body> {
  const res = await fetch('/bff/measurements', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as Partial<Body>;
  if (!body.evidence) throw new Error('응답에 evidence가 없다');
  return body as Body;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** 4요소 줄 — 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태(11종 전부) */
function conditionText(p: EvidenceRef): string[] {
  const sw = Object.entries(p.switches)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : String(v)}`);
  return [
    `기록 ${p.record} · 커밋 ${p.run.commitHash}`,
    `프로파일 ${p.run.memoryProfile} · ${p.run.memoryLimitMb} MB · 티어 ${p.run.capacityTier}`,
    sw.slice(0, 6).join(' · '),
    sw.slice(6).join(' · '),
  ];
}
const conditionHtml = (p: EvidenceRef) => conditionText(p).map(esc).join('<br/>');

function fmt(v: number | null): string {
  if (v === null) return '—';
  const a = Math.abs(v);
  return a >= 100 ? v.toFixed(0) : a >= 1 ? v.toFixed(2) : a === 0 ? '0' : v.toPrecision(3);
}

function colorFor(store: Store, i: number): string {
  const s = SHADES[store];
  return s[i % s.length] as string;
}

// ── 분포 막대(EXP-40 · 41 · 43 FINAL 비용 · 44) ──

function barOption(
  model: ReturnType<typeof reverseBars>,
  xKind: keyof typeof X_NAME,
  yLog: boolean,
): ChartOption {
  const perStore = { postgresql: 0, clickhouse: 0 };
  const xLabel = (v: number) =>
    xKind === 'scale' ? `${formatRows(v)}행` : xKind === 'rate' ? `${v} req/s` : `동시성 ${v}`;
  return {
    animation: false,
    grid: { left: 72, right: 24, top: 56, bottom: 40 },
    legend: { top: 0, type: 'plain' },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p || p.seriesIndex === undefined || p.dataIndex === undefined) return '';
        const r = model.series[p.seriesIndex]?.cells[p.dataIndex];
        if (!r) return '';
        return [
          `<b>${esc(model.series[p.seriesIndex]?.label ?? '')}</b> · ${esc(xLabel(model.x[p.dataIndex] as number))}`,
          `${esc(r.metric)} 중앙값 ${fmt(r.median)} ${esc(r.unit)} · 3회 ${r.values.map(fmt).join(' · ')}`,
          conditionHtml(r),
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: model.x.map(xLabel),
      name: X_NAME[xKind],
      nameLocation: 'middle',
      nameGap: 26,
    },
    yAxis: { type: yLog ? 'log' : 'value', name: `중앙값(${model.unit})` },
    series: model.series.map((s) => ({
      name: s.label,
      type: 'bar' as const,
      color: colorFor(s.store, perStore[s.store]++),
      // 중앙값 없는 칸(예: 상한 안 미관측)은 막대를 그리지 않는다 — 0으로 그리면 "비용 0"으로 읽힌다
      data: s.cells.map((r) => (r && r.median !== null && (!yLog || r.median > 0) ? r.median : null)),
    })),
  };
}

function ReverseBarCard({ exp, rows }: { exp: ReverseExp; rows: ReverseRow[] }) {
  const own = useMemo(() => rows.filter((r) => r.exp === exp && !r.structural), [rows, exp]);
  const metrics = useMemo(() => [...new Set(own.map((r) => r.metric))].sort(), [own]);
  const scales = useMemo(() => [...new Set(own.map((r) => r.scale))].sort((a, b) => a - b), [own]);
  const xKind = REVERSE_X[exp];
  const [metricSel, setMetric] = useState<string | null>(null);
  const [scaleSel, setScale] = useState<number | null>(null);
  const [yLog, setYLog] = useState(false);
  const metric = metricSel && metrics.includes(metricSel) ? metricSel : (metrics[0] ?? null);
  const scale =
    scaleSel !== null && scales.includes(scaleSel) ? scaleSel : (scales[scales.length - 1] ?? null);
  const model = useMemo(
    () => (metric ? reverseBars(rows, { exp, metric, scale: xKind === 'scale' ? null : scale }) : null),
    [rows, exp, metric, scale, xKind],
  );
  const opt = useMemo(() => (model ? barOption(model, xKind, yLog) : null), [model, xKind, yLog]);
  // 그리지 않은 칸 — 중앙값 없음 + 로그 축에서 0 이하(로그 축에 놓을 수 없다 · 조용히 빼지 않는다)
  const noMedian = model
    ? model.series.reduce(
        (n, s) => n + s.cells.filter((r) => r && r.median !== null && yLog && r.median <= 0).length,
        model.noMedian,
      )
    : 0;
  if (own.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded border border-slate-200 p-3" data-exp={exp}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-700">{EXP_TITLE[exp]}</span>
        <Select value={metric ?? ''} onChange={(e) => setMetric(e.target.value)} aria-label={`${exp} 지표`}>
          {metrics.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        {xKind !== 'scale' && scales.length > 0 ? (
          <Select
            value={String(scale ?? '')}
            onChange={(e) => setScale(Number(e.target.value))}
            aria-label={`${exp} 업무 규모`}
          >
            {scales.map((s) => (
              <option key={s} value={s}>
                업무 규모 {formatRows(s)}행
              </option>
            ))}
          </Select>
        ) : null}
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={yLog} onChange={(e) => setYLog(e.target.checked)} />
          세로 로그 축
        </label>
      </div>
      {model && opt && model.series.length > 0 ? (
        <>
          <EChart option={opt} className="h-72 w-full" />
          {noMedian > 0 ? (
            <p className="text-xs text-amber-700">
              그리지 않은 칸 {noMedian} — 중앙값 없음(예: 상한 안 미관측) 또는 로그 축에서 0 이하 · 툴팁 없음
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-slate-500">이 선택에 해당하는 행이 없다</p>
      )}
    </div>
  );
}

// ── 구조 판정 그리드(EXP-42 · 43) ──

function StructuralCard({ exp, rows }: { exp: ReverseExp; rows: ReverseRow[] }) {
  const grid = useMemo(() => structuralGrid(rows, exp), [rows, exp]);
  if (grid.rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded border border-slate-200 p-3" data-exp={exp}>
      <span className="text-xs font-semibold text-slate-700">{EXP_TITLE[exp]} — 3회 전부</span>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="border-b border-slate-200 px-2 py-1 font-medium">저장소 · 변형 · 업무 규모</th>
              {grid.cases.map((c) => (
                <th key={c} className="border-b border-slate-200 px-2 py-1 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.label}>
                <td className="border-b border-slate-100 px-2 py-1 whitespace-nowrap">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full"
                    style={{ background: SHADES[row.store][0] }}
                  />
                  {row.label}
                </td>
                {row.cells.map((r, i) => (
                  <StructuralCell key={grid.cases[i]} r={r} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        ✓ 3회 같은 값(재현) — 합격 · 불합격 판정이 아니다(분포가 없어 중앙값을 쓰지 않는다) · ✕ 반복마다
        다름(최소~최대) · 3회 미만은 판정하지 않는다 · 0이 아닌 칸은 강조 — 칸에 마우스를 두면 4요소
      </p>
    </div>
  );
}

function StructuralCell({ r }: { r: ReverseRow | null }) {
  if (!r) return <td className="border-b border-slate-100 px-2 py-1 text-slate-300">—</td>;
  const v = structuralVerdict(r.values);
  const nonZero = r.values.some((x) => x !== null && x !== 0);
  return (
    <td
      className={`border-b border-slate-100 px-2 py-1 whitespace-nowrap ${nonZero ? 'bg-amber-50 text-amber-900' : ''}`}
      title={[`${r.metric} (${r.unit})`, ...conditionText(r)].join('\n')}
    >
      <span className="tabular-nums">{r.values.map(fmt).join(' · ')}</span>{' '}
      {v.kind === 'consistent' ? (
        <span
          className="font-semibold text-slate-600"
          title="3회 같은 값(재현) — 합격 · 불합격 판정이 아니다"
        >
          ✓
        </span>
      ) : v.kind === 'varies' ? (
        <span className="font-semibold text-red-700">
          ✕ {fmt(v.min)}~{fmt(v.max)}
        </span>
      ) : (
        <span className="text-slate-500">3회 미만({v.present})</span>
      )}
    </td>
  );
}

// ── EXP-45 계단별 두 싱크 ──

function judgementText(store: Store, j: StreamJudgement): string {
  const th = (sec: number | null) =>
    sec === null ? '기준(COPY 타임아웃) 기재 없음 — 실패 계단만 판정' : `기준 ${fmt(sec)} s`;
  switch (j.kind) {
    case 'crossed':
      return `${STORE_LABEL[store]} — ${j.pps.toLocaleString('ko-KR')} pps에서 ${
        j.reason === 'failure' ? '첫 실패' : 'p95가 기준을 넘음'
      } · ${th(j.thresholdSec)}`;
    case 'none':
      return `${STORE_LABEL[store]} — 관측 범위(~${j.maxPps.toLocaleString('ko-KR')} pps) 안에서 넘지 않음 · ${th(j.thresholdSec)}`;
    case 'noThreshold':
      return `${STORE_LABEL[store]} — 기준(창 폭 W) 기재 없음 — 판정하지 않음(관측 ~${j.maxPps.toLocaleString('ko-KR')} pps)`;
    default:
      return `${STORE_LABEL[store]} — 판정할 계단 없음`;
  }
}

/** 그릴 점 — 초로 환산한 중앙값. 중앙값 없음 · 시간 단위 아님 · 로그 축의 0 이하는 null(그리지 않고 센다) */
function plotSec(r: StreamRow, yLog: boolean): number | null {
  if (r.median === null) return null;
  const sec = toSeconds(r.median, r.unit);
  return sec === null || (yLog && sec <= 0) ? null : sec;
}

function streamOption(
  series: ReturnType<typeof streamSeries>,
  judge: Record<Store, StreamJudgement>,
  quantile: StreamQuantile,
  yLog: boolean,
): ChartOption {
  // 툴팁 색인도 이 배열을 쓴다
  const plotted = series.map((s) => s.steps.filter((r) => plotSec(r, yLog) !== null));
  return {
    animation: false,
    grid: { left: 72, right: 24, top: 40, bottom: 48 },
    legend: { top: 0 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p || p.seriesIndex === undefined || p.dataIndex === undefined) return '';
        const st = plotted[p.seriesIndex]?.[p.dataIndex];
        if (!st) return '';
        return [
          `<b>${esc(STORE_LABEL[st.store])}</b> · ${st.pps.toLocaleString('ko-KR')} pps`,
          `${esc(st.metric)} 중앙값 ${fmt(st.median)} ${esc(st.unit)} · 3회 ${st.values.map(fmt).join(' · ')}`,
          st.judged
            ? `실패 ${st.failures.length ? st.failures.map(fmt).join(' · ') : '기재 없음'}`
            : '판정 제외 계단(무효 · 실패 기재 없음)',
          conditionHtml(st),
        ].join('<br/>');
      },
    },
    xAxis: { type: 'value', name: '계단(pps)', nameLocation: 'middle', nameGap: 28, scale: true },
    yAxis: { type: yLog ? 'log' : 'value', name: `${quantile} 중앙값(s)` },
    series: series.map((s, si) => {
      const j = judge[s.store];
      return {
        name: `${STORE_LABEL[s.store]}${s.metric ? ` · ${s.metric}` : ''}`,
        type: 'line' as const,
        color: SHADES[s.store][0],
        symbolSize: 9,
        data: (plotted[si] ?? []).map((r) => ({
          value: [r.pps, plotSec(r, yLog) as number],
          // 판정 제외 계단은 마름모 · 실패가 있는 계단은 속이 빈 점
          symbol: !r.judged
            ? 'diamond'
            : r.failures.some((f) => f !== null && f > 0)
              ? 'emptyCircle'
              : 'circle',
        })),
        // 판정 점은 선택한 분위수와 무관하게 p95로 정한다 — 두 선에 저장소별로 하나씩
        ...(j.kind === 'crossed'
          ? {
              markLine: {
                symbol: 'none',
                silent: true,
                lineStyle: { type: 'dashed' as const, color: SHADES[s.store][0] },
                label: {
                  formatter: `${s.store === 'postgresql' ? 'PG' : 'CH'} 판정 점 ${j.pps.toLocaleString('ko-KR')}`,
                  color: SHADES[s.store][0],
                },
                data: [{ xAxis: j.pps }],
              },
            }
          : {}),
      };
    }),
  };
}

function StreamCard({ rows }: { rows: StreamRow[] }) {
  const [quantile, setQuantile] = useState<StreamQuantile>('p95');
  const [yLog, setYLog] = useState(false);
  const series = useMemo(() => streamSeries(rows, quantile), [rows, quantile]);
  const judge = useMemo(
    () => ({
      postgresql: streamJudgement(rows, 'postgresql'),
      clickhouse: streamJudgement(rows, 'clickhouse'),
    }),
    [rows],
  );
  const opt = useMemo(() => streamOption(series, judge, quantile, yLog), [series, judge, quantile, yLog]);
  const unplotted = series.reduce((n, s) => n + s.steps.filter((r) => plotSec(r, yLog) === null).length, 0);
  const excludedSteps = new Set(rows.filter((r) => !r.judged).map((r) => `${r.store}|${r.pps}`)).size;
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded border border-slate-200 p-3" data-exp={STREAM_EXP}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-700">EXP-45 스트리밍 동시 적재 — 계단별 두 싱크</span>
        <Select
          value={quantile}
          onChange={(e) => setQuantile(e.target.value as StreamQuantile)}
          aria-label="EXP-45 분위수"
        >
          {STREAM_QUANTILES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={yLog} onChange={(e) => setYLog(e.target.checked)} />
          세로 로그 축
        </label>
      </div>
      <ul className="text-xs font-medium text-slate-700">
        <li>{judgementText('postgresql', judge.postgresql)}</li>
        <li>{judgementText('clickhouse', judge.clickhouse)}</li>
      </ul>
      <EChart option={opt} className="h-72 w-full" />
      {unplotted > 0 || series.some((s) => s.metric === null) ? (
        <p className="text-xs text-amber-700">
          {unplotted > 0
            ? `그리지 않은 계단 ${unplotted} — 중앙값 없음 · 시간 단위 아님 또는 로그 축에서 0 이하 · 툴팁 없음`
            : ''}
          {series
            .filter((s) => s.metric === null)
            .map((s) => `${unplotted > 0 ? ' · ' : ''}${STORE_LABEL[s.store]} ${quantile} 지표 없음`)
            .join('')}
        </p>
      ) : null}
      {excludedSteps > 0 ? (
        <p className="text-xs text-slate-500">
          판정 제외 계단 {excludedSteps}(저장소 × pps) — 행 valid false 또는 실패 기재 없음(재기동 · 생성기
          포화 등)
        </p>
      ) : null}
      <p className="text-xs text-slate-500">
        선 = 저장소별로 이름 끝이 고른 분위수인 지표(3회 중앙값 · 초 환산) · 판정 점은 분위수 선택과 무관하게
        p95 — PostgreSQL COPY p95가 COPY 타임아웃을 넘거나 첫 실패가 난 계단 · ClickHouse 삽입 p95가 창 폭 W를
        넘은 계단(실패는 판정 점이 아니다) · 속이 빈 점 = 실패가 있는 계단 · 마름모 = 판정 제외 계단 ·
        EXP-23(부하 실험 프로파일 모드 B 계단)과 겹쳐 그리지 않는다
      </p>
    </div>
  );
}

// ── 원리 대응 ──

function PrincipleGrid({ d }: { d: EvidenceResult }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-700">원리 대응 — 관측 → 원인 구조</span>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="border-b border-slate-200 px-2 py-1 font-medium">관측(EXP)</th>
              <th className="border-b border-slate-200 px-2 py-1 font-medium">기록 값</th>
              <th className="border-b border-slate-200 px-2 py-1 font-medium">PostgreSQL 구조</th>
              <th className="border-b border-slate-200 px-2 py-1 font-medium">ClickHouse 구조</th>
              <th className="border-b border-slate-200 px-2 py-1 font-medium">관측이 가리키는 것</th>
            </tr>
          </thead>
          <tbody>
            {PRINCIPLES.map((p) => {
              const ev = principleEvidence(d, p);
              return (
                <tr key={p.observation} className="align-top">
                  <td className="border-b border-slate-100 px-2 py-1 font-medium whitespace-nowrap">
                    {p.observation}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1">
                    {ev.records.length === 0 ? (
                      <span className="text-slate-400">기록 없음</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-500">기록 {ev.records.join(' · ')}</span>
                        {ev.lines.map((l) => (
                          <span key={l} className="tabular-nums">
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 text-slate-600">{p.postgresql}</td>
                  <td className="border-b border-slate-100 px-2 py-1 text-slate-600">{p.clickhouse}</td>
                  <td className="border-b border-slate-100 px-2 py-1">{p.question}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        구조 열의 출처 docs/05_data_stores/10_olap_vs_rdb_control.md §원리 대응(구조 사실) · 기록 값 열은
        판독한 기록에서 계산한다(분포 — 가장 큰 업무 규모의 저장소별 중앙값 범위 · 구조 — 3회 일치 칸 수)
      </p>
    </div>
  );
}

function Counts({ d }: { d: EvidenceResult }) {
  const c = d.counts;
  return (
    <p className="text-xs text-slate-500">
      기록 파일 {c.files} · 역방향 기록 {c.reverse} · 스트리밍 기록 {c.stream} · 판독 불가 기록 {c.unreadable}
      {d.unreadableFiles.length > 0 ? ` (${d.unreadableFiles.join(' · ')})` : ''} · 4요소 누락{' '}
      {c.missingConditions} · 폐기 · 정정 제외 {c.excludedStatus} · 편차 기준 초과 제외 {c.excludedDeviation}{' '}
      · 형식이 어긋난 행 {c.invalidRows}
      {c.duplicateRows > 0 ? ` · 뒤 기록이 덮은 중복 행 ${c.duplicateRows}` : ''}
    </p>
  );
}

export function EvidencePanel() {
  const q = useQuery({
    queryKey: ['bff', 'measurements', 'evidence'],
    queryFn: fetchRecords,
    staleTime: 0,
    retry: false,
  });
  const body = q.data;
  const d = body?.evidence;
  const empty = !!d && d.reverse.length === 0 && d.stream.length === 0;

  return (
    <Card data-panel="evidence">
      <CardHeader>
        <CardTitle>실증 요약 — 역방향 대조(EXP-40~44) · 스트리밍 동시 적재(EXP-45)</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>업무 데이터를 고정하고 저장소를 바꾼 결과 · 정방향(시계열 역전 지점)은 위 패널</span>
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            새로고침
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {q.isError ? (
          <Band>
            기록을 읽지 못했다 ({String(q.error)})
            {q.dataUpdatedAt > 0 ? ' — 이전 판독 결과를 그대로 보인다' : ''}
          </Band>
        ) : null}
        {q.isPending ? (
          <div className="h-80 animate-pulse rounded bg-slate-100" />
        ) : !d ? null : (
          <>
            {empty ? (
              <p className="text-slate-500">{EMPTY}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <ReverseBarCard exp="EXP-40" rows={d.reverse} />
                <ReverseBarCard exp="EXP-41" rows={d.reverse} />
                <StructuralCard exp="EXP-42" rows={d.reverse} />
                <StructuralCard exp="EXP-43" rows={d.reverse} />
                <ReverseBarCard exp="EXP-43" rows={d.reverse} />
                <ReverseBarCard exp="EXP-44" rows={d.reverse} />
                <StreamCard rows={d.stream} />
              </div>
            )}
            <PrincipleGrid d={d} />
            <Counts d={d} />
          </>
        )}
      </CardContent>
      <CardFooter>
        원천 docs/measurements(BFF 읽기 전용){body ? ` · 판독 ${formatKst(body.readAt, true)}` : ''} · 4요소
        없는 기록 · 폐기 기록은 그리지 않는다 · 분포 지표는 3회 중앙값 · 구조 지표는 3회 전부 · 관찰 보조 —
        기록 정본 아님
      </CardFooter>
    </Card>
  );
}
