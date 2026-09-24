'use client';
// 실시간 트렌드(uPlot) — 정본 docs/08_screen/03_realtime_dashboard.md · 08_screen/01 §차트 표준
// 태그마다 ts가 달라 한 x열로 맞추지 않는다 — uPlot mode 2(시리즈별 [x, y])로 링 버퍼 뷰를 그대로 넘긴다.
// 합치기(uPlot.join)는 프레임마다 새 배열을 만들어 링 버퍼를 둔 이유(GC 억제)가 사라진다.
import { useEffect, useRef } from 'react';
import type uPlot from 'uplot';
import { TREND_WINDOW_MS } from '../../lib/config';
import { useRealtimeStore } from '../../lib/realtime-store';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4b5563'];
const HEIGHT = 280;

export interface TrendChartProps {
  tagIds: readonly number[];
  labels: Readonly<Record<number, string>>;
}

export function TrendChart({ tagIds, labels }: TrendChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const raf = useRef<number | null>(null);
  const labelKey = tagIds.map((id) => `${id}:${labels[id] ?? ''}`).join('|');

  // 선택 태그 · 라벨이 바뀌면 차트를 다시 만든다 — 값 갱신은 아래 seq 구독이 setData로 한다
  // biome-ignore lint/correctness/useExhaustiveDependencies: labelKey가 tagIds · labels의 내용 비교 키다
  useEffect(() => {
    const el = host.current;
    // mode 2는 시리즈 1의 x 패싯을 기준 축으로 읽는다 — 태그 0개면 만들지 않는다(빈 상태는 화면 문구가 맡는다)
    if (!el || tagIds.length === 0) return;
    let disposed = false;
    let ro: ResizeObserver | null = null;
    void import('uplot').then(({ default: UPlot }) => {
      if (disposed) return;
      const { buffers } = useRealtimeStore.getState();
      const opts: uPlot.Options = {
        mode: 2,
        width: el.clientWidth,
        height: HEIGHT,
        ms: 1, // ts는 epoch ms
        // 축 눈금도 Asia/Seoul로 한 번만 변환한다
        tzDate: (ts) => UPlot.tzDate(new Date(ts), 'Asia/Seoul'),
        scales: {
          x: {
            time: true,
            // 창 = 최근 5분 — 추정 서버 현재 기준으로 민다
            range: () => {
              const end = Date.now() + useRealtimeStore.getState().offsetMs;
              return [end - TREND_WINDOW_MS, end];
            },
          },
          y: { auto: true },
        },
        legend: { show: true, live: false },
        cursor: { drag: { x: false, y: false } },
        series: [
          {},
          ...tagIds.map((id, i) => ({
            label: labels[id] ?? `tag ${id}`,
            stroke: COLORS[i % COLORS.length] as string,
            width: 1.5,
            paths: UPlot.paths.linear?.(),
            points: { show: false },
            facets: [
              { scale: 'x', auto: false, sorted: 1 as const },
              { scale: 'y', auto: true },
            ],
          })),
        ],
      };
      const data = [null, ...tagIds.map((id) => viewsOf(buffers, id))] as unknown as uPlot.AlignedData;
      plot.current = new UPlot(opts, data, el);
      ro = new ResizeObserver(() => plot.current?.setSize({ width: el.clientWidth, height: HEIGHT }));
      ro.observe(el);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
  }, [labelKey]);

  // 버퍼 변경 → 다음 애니메이션 프레임에 한 번만 다시 그린다(프레임 폭증 시에도 화면 갱신은 rAF 주기).
  // 프레임이 멈춰도(STALE) 창은 흐르므로 1초마다 한 번 더 그린다.
  useEffect(() => {
    const schedule = () => {
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const u = plot.current;
        if (!u) return;
        const { buffers } = useRealtimeStore.getState();
        const data = [null, ...tagIds.map((id) => viewsOf(buffers, id))] as unknown as uPlot.AlignedData;
        u.setData(data, true);
      });
    };
    const unsubscribe = useRealtimeStore.subscribe((s, prev) => {
      if (s.seq !== prev.seq) schedule();
    });
    const tick = setInterval(schedule, 1000);
    return () => {
      unsubscribe();
      clearInterval(tick);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [tagIds]);

  return <div ref={host} className="w-full" style={{ minHeight: HEIGHT }} />;
}

const EMPTY: [Float64Array, Float64Array] = [new Float64Array(0), new Float64Array(0)];

function viewsOf(buffers: ReadonlyMap<number, { views(): [Float64Array, Float64Array] }>, id: number) {
  return buffers.get(id)?.views() ?? EMPTY;
}
