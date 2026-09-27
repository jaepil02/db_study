'use client';
// 설비 전체 최신값 표 — 정본 docs/08_screen/03_realtime_dashboard.md 요소 표 · 상태 4행
import { judgeFreshness, sparkPath } from '../../lib/latest';
import { useRealtimeStore } from '../../lib/realtime-store';
import { QUALITY } from '../../lib/shared';
import { formatAge, formatKst } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { isBadQuality, QualityCell } from './quality';

const SKELETON_ROWS = 8;

export interface LatestTableProps {
  loading: boolean;
  /** 503 중 — 마지막 값을 흐리게 유지하고 그 값의 측정 시각을 보인다 */
  dimmed: boolean;
  selected: readonly number[];
  maxSelected: number;
  onToggle(tagId: number): void;
}

export function LatestTable({ loading, dimmed, selected, maxSelected, onToggle }: LatestTableProps) {
  const order = useRealtimeStore((s) => s.order);
  const latest = useRealtimeStore((s) => s.latest);
  const meta = useRealtimeStore((s) => s.meta);
  const offsetMs = useRealtimeStore((s) => s.offsetMs);
  const buffers = useRealtimeStore((s) => s.buffers);
  // 버퍼 내용이 바뀌면(프레임 · 과거 채움) 추세 열을 다시 그린다 — 버퍼 참조는 고정이라 seq로 안다
  useRealtimeStore((s) => s.seq);
  const now = useNow(1000);

  const selectedSet = new Set(selected);
  const showSkeleton = loading && order.length === 0;

  return (
    <Table className={cn(dimmed && 'opacity-50')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">트렌드</TableHead>
          <TableHead>태그명</TableHead>
          <TableHead className="text-right">값</TableHead>
          <TableHead>단위</TableHead>
          <TableHead>품질</TableHead>
          <TableHead>측정 시각(KST)</TableHead>
          <TableHead className="w-20">추세</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {showSkeleton &&
          Array.from({ length: SKELETON_ROWS }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 자리표시 행은 순서 외 식별자가 없다
            <TableRow key={i}>
              {Array.from({ length: 7 }, (_, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 자리표시 칸
                <TableCell key={j}>
                  <div className="h-4 animate-pulse rounded bg-slate-100" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        {order.map((tagId) => {
          const v = latest[tagId];
          const m = meta[tagId];
          if (!v) return null;
          const freshness = judgeFreshness(v, m?.staleAfterMs ?? null, now, offsetMs);
          const metaMissing = m !== undefined && m.tagName === null;
          const checked = selectedSet.has(tagId);
          return (
            <TableRow key={tagId}>
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`트렌드에 ${m?.tagName ?? tagId} 표시`}
                  checked={checked}
                  disabled={!checked && selected.length >= maxSelected}
                  onChange={() => onToggle(tagId)}
                />
              </TableCell>
              <TableCell>
                {metaMissing || m === undefined ? (
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">tag {tagId}</span>
                    {metaMissing && <Badge variant="outline">메타 없음</Badge>}
                  </span>
                ) : (
                  <span title={m.tagCode ?? undefined}>{m.tagName}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {isBadQuality(v.quality)
                  ? '—'
                  : v.value.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}
                {v.quality === QUALITY.SIMULATED && (
                  <span className="ml-1 text-[10px] text-slate-400">SIM</span>
                )}
              </TableCell>
              <TableCell className="text-slate-500">{m?.unit ?? ''}</TableCell>
              <TableCell>
                <QualityCell quality={v.quality} freshness={freshness} />
              </TableCell>
              <TableCell
                className="tabular-nums text-slate-600"
                title={`${formatKst(v.ts, true)} · epoch ${v.ts}`}
              >
                {formatKst(v.ts)}
                {freshness.kind === 'unjudged' && (
                  <span className="ml-2 text-xs text-slate-400">값의 나이 {formatAge(freshness.ageMs)}</span>
                )}
              </TableCell>
              <TableCell>
                <Spark
                  views={buffers.get(tagId)?.views() ?? null}
                  bad={isBadQuality(v.quality)}
                  stale={freshness.kind === 'stale'}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const SPARK_W = 64;
const SPARK_H = 16;

/** 추세 열 — 링 버퍼 마지막 구간의 작은 선(별도 조회 없음) · 통신 이상이면 ╳ · STALE이면 흐린 선 */
function Spark({
  views,
  bad,
  stale,
}: {
  views: [Float64Array, Float64Array] | null;
  bad: boolean;
  stale: boolean;
}) {
  if (bad) return <span className="text-red-500">╳</span>;
  const d = views ? sparkPath(views[0], views[1], SPARK_W, SPARK_H) : null;
  if (d === null) return <span className="text-slate-300">—</span>;
  return (
    <svg width={SPARK_W} height={SPARK_H} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke={stale ? '#cbd5e1' : '#2563eb'} strokeWidth={1.25} />
    </svg>
  );
}
