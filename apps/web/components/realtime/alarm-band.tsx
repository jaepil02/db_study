'use client';
// 활성 알람 띠 — 정본 docs/08_screen/03_realtime_dashboard.md 요소 표(RLT-08) · §갱신과 값 병합 "알람 띠는 저장하지 않는다"
// ch:alarm 푸시(공통 셸이 띠 전용 세션 목록에 싣는다 — lib/alarm-band)에서 이 설비 태그의 열림 · 닫힘만 띄운다 · 누르면 ALM-CONSOLE.
// 띠는 이 세션에서 받은 통지만 보인다 — Pub/Sub은 전달을 보장하지 않으므로 진실은 ALM-CONSOLE 목록이다.
// 콘솔 겹침 층과 따로 든다 — 콘솔이 목록에 반영된 행을 지우거나 재연결이 겹침을 비워도 띠의 통지는 남는다.
import Link from 'next/link';
import { useMemo } from 'react';
import { bandState, useAlarmBandStore } from '../../lib/alarm-band';
import { type OverlayItem, severityLabel } from '../../lib/alarms';
import { useRealtimeStore } from '../../lib/realtime-store';
import { formatKst } from '../../lib/time';
import { Badge } from '../ui/badge';

const SEVERITY_VARIANT = { 1: 'outline', 2: 'warning', 3: 'danger' } as const;

/**
 * tagsKnown — 이 설비의 태그 목록(최신값 응답 메타)을 읽었는가 · down — 통지 경로 끊김(WS 연결 아님 · 실시간 저장소 503).
 * 08_screen/03 §장애 시 보이는 것 — Redis 중단이면 띠는 "끊김"이다(메타가 비어 "없음"으로 보이지 않게).
 */
export function AlarmBand({ tagsKnown, down }: { tagsKnown: boolean; down: boolean }) {
  const items = useAlarmBandStore((s) => s.items);
  const meta = useRealtimeStore((s) => s.meta);
  const order = useRealtimeStore((s) => s.order);
  // 가르는 집합 = 표의 태그(order) ∪ 메타 키 — 메타만 쓰면 REST가 503 밖 오류로 실패하고 프레임만 올 때 "없음"으로 거짓 표시된다.
  // 둘 다 비면(설비 전환 직후 · 응답 전) 모른다(null) — "없음"이라 말하지 않는다
  const tagIds = useMemo(() => {
    if (!tagsKnown) return null;
    const ids = new Set<number>([...order, ...Object.keys(meta).map(Number)]);
    return ids.size > 0 ? ids : null;
  }, [tagsKnown, meta, order]);
  const st = bandState(items, tagIds, down);
  const rows = st.kind === 'items' || st.kind === 'down' ? st.items : [];
  const consoleLink = (
    <Link className="text-blue-700 underline" href="/alarms">
      알람 콘솔로
    </Link>
  );
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
      data-panel="alarm-band"
      data-band-state={st.kind}
    >
      {st.kind === 'down' && (
        <span className="text-xs text-amber-700">
          알람 통지 끊김 — 새 통지를 받지 못한다
          {st.tagsKnown ? '' : ' · 설비 태그 목록을 읽지 못해 받은 통지를 이 설비로 가를 수 없다'} · 진실은{' '}
          {consoleLink}
        </span>
      )}
      {st.kind === 'unknown' && (
        <span className="text-xs text-slate-500">
          설비 태그 목록을 아직 읽지 못해 이 세션에서 받은 통지 {st.received}건을 이 설비로 가를 수 없다 ·{' '}
          {consoleLink}
        </span>
      )}
      {st.kind === 'none' && (
        <span className="text-xs text-slate-500">
          이 세션에서 받은 이 설비의 알람 통지 없음 — 통지는 전달을 보장하지 않는다 · {consoleLink}
        </span>
      )}
      {rows.map((i) => (
        <BandRow key={i.eventId} item={i} tagName={meta[i.tagId]?.tagName ?? null} />
      ))}
    </div>
  );
}

function BandRow({ item: i, tagName }: { item: OverlayItem; tagName: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={i.clearedTs === null ? 'text-red-600' : 'text-emerald-600'}>●</span>
      <Badge variant={SEVERITY_VARIANT[i.severity as 1 | 2 | 3] ?? 'outline'}>
        {severityLabel(i.severity)}
      </Badge>
      <span>{tagName ?? `tag ${i.tagId}`}</span>
      <span className="text-xs text-slate-600">
        {i.openedTs !== null ? `발생 ${formatKst(i.openedTs)}` : ''}
        {i.clearedTs !== null ? ` · 해제 ${formatKst(i.clearedTs)}` : ''}
      </span>
      <Link className="ml-auto text-xs text-blue-700 underline" href="/alarms">
        알람 콘솔로
      </Link>
    </div>
  );
}
