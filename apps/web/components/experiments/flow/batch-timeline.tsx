'use client';
// 배치 타임라인 — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW 요소 배치 타임라인
// 최근 20배치 가로 누적 막대(단계 6 · null 단계는 자리 없음) · 막대 끝 행 수 · 배치 번호 순 · 번호가 건너뛰면 "N배치 병합으로 생략" 틈 표지 · 툴팁 전 필드.
// ECharts 보조 차트(08_screen/01 §차트 표준 — EXP-FLOW 배치 타임라인).
import { useMemo } from 'react';
import { BATCH_STAGES, type TimelineEntry } from '../../../lib/flow';
import { formatKst } from '../../../lib/time';
import { type ChartOption, EChart } from '../echart';

/** 단계 6 색 — 순서가 곧 ⑧ 단계 순서 */
const STAGE_COLORS = ['#94a3b8', '#a78bfa', '#0284c7', '#f59e0b', '#10b981', '#ef4444'];

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

function ms(v: number | null): string {
  return v === null ? '—(없음)' : `${v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} ms`;
}

function tooltipHtml(e: TimelineEntry): string {
  if (e.kind === 'gap') {
    return `${esc(e.source)} — #${e.afterSeq} 과 #${e.beforeSeq} 사이 ${e.skipped}배치 병합으로 생략<br/>점은 만들지 않는다 · 합계 · 간선 굵기는 totals에서 계산`;
  }
  const b = e.batch;
  const lines = [
    `<b>#${b.seq}</b> · ${esc(b.source)} · ${esc(formatKst(b.at, true))}`,
    `행 ${b.rows.toLocaleString('ko-KR')} · CH 행 ${b.chRows.toLocaleString('ko-KR')} · 재시도 ${b.retries} · 격리 ${b.dlqEntries}`,
    ...BATCH_STAGES.map((s) => `${s.label} ${ms(b.stages[s.key])}`),
    `대조군 ${b.controlCopy ? `${b.controlCopy.rows.toLocaleString('ko-KR')}행 · ${b.controlCopy.ok ? '성공' : '실패'}` : 'null(SW-09 off)'}`,
    `최신값 ${b.latestWrites === null ? 'null(SW-11 collector)' : `${b.latestWrites.toLocaleString('ko-KR')} 필드`}`,
    `알람 ${b.alarm ? `판정 ${b.alarm.judgedRows.toLocaleString('ko-KR')}행 · 열림 ${b.alarm.opened} · 닫힘 ${b.alarm.closed}` : 'null(인계 없음)'}`,
    `스트림 ${b.stream ? `길이 ${b.stream.length.toLocaleString('ko-KR')} · 랙 ${b.stream.lag ?? '—'}` : 'null(SW-01 대안)'}`,
  ];
  return lines.join('<br/>');
}

export function BatchTimeline({ entries }: { entries: readonly TimelineEntry[] }) {
  const option = useMemo<ChartOption>(() => {
    const labels = entries.map((e) =>
      e.kind === 'batch' ? `#${e.batch.seq}` : `— ${e.skipped}배치 병합으로 생략 —`,
    );
    return {
      animation: false,
      grid: { left: 150, right: 90, top: 28, bottom: 24 },
      legend: { top: 0, data: BATCH_STAGES.map((s) => s.label) },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: (params: unknown) => {
          const first = (Array.isArray(params) ? params[0] : params) as { dataIndex?: number } | undefined;
          const e = first?.dataIndex === undefined ? undefined : entries[first.dataIndex];
          return e ? tooltipHtml(e) : '';
        },
      },
      xAxis: { type: 'value', name: 'ms', axisLabel: { fontSize: 10 } },
      yAxis: {
        type: 'category',
        inverse: true, // 위에서 아래로 배치 번호 순(오래된 것이 위)
        data: labels,
        axisLabel: { fontSize: 10 },
      },
      series: [
        ...BATCH_STAGES.map((s, i) => ({
          type: 'bar' as const,
          name: s.label,
          stack: 'stages',
          barMaxWidth: 12,
          itemStyle: { color: STAGE_COLORS[i] },
          // null 단계는 자리 없음 — 막대 조각을 그리지 않는다
          data: entries.map((e) => (e.kind === 'batch' ? e.batch.stages[s.key] : null)),
        })),
        {
          // 막대 끝 행 수 — 폭 0 조각의 오른쪽 라벨
          type: 'bar' as const,
          name: '행 수',
          stack: 'stages',
          data: entries.map((e) => (e.kind === 'batch' ? 0 : null)),
          itemStyle: { color: 'transparent' },
          tooltip: { show: false },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: '#475569',
            formatter: (p: { dataIndex: number }) => {
              const e = entries[p.dataIndex];
              return e?.kind === 'batch' ? `${e.batch.rows.toLocaleString('ko-KR')}행` : '';
            },
          },
        },
      ],
    };
  }, [entries]);

  return <EChart option={option} className="h-[440px] w-full" />;
}
