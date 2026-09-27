'use client';
// 사이트 · 라인 · 설비 선택기 — 정본 docs/08_screen/03_realtime_dashboard.md 요소 표(MST-01 · MST-02 조회 · BFF 경유)
// 목록을 BFF로 읽고 선택하면 경로를 바꾼다 · 비활성 설비는 목록 끝에 흐리게 · 설비 0이면 "등록된 설비가 없다"와 ADM-MASTER 링크.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorText } from '../../lib/error-display';
import { orderDevices } from '../../lib/realtime-nav';
import { Select } from '../master/field';
import { useDevices, useLines, useSites } from '../master/queries';
import { Band } from '../ui/band';

export function DevicePicker({ deviceId }: { deviceId: number | null }) {
  const router = useRouter();
  const sites = useSites();
  const [siteSel, setSite] = useState<number | null>(null);
  const siteId = siteSel ?? sites.data?.[0]?.siteId ?? null;
  const lines = useLines(siteId ?? 0);
  const devices = useDevices(siteId, true);
  const current = devices.data?.find((d) => d.deviceId === deviceId) ?? null;
  // 라인 기본값 — 보고 있는 설비의 라인 · 모르면 전체
  const [lineSel, setLine] = useState<number | 'all' | null>(null);
  const lineId = lineSel === 'all' ? null : (lineSel ?? current?.lineId ?? null);
  const list = orderDevices(devices.data ?? [], lineId);
  const err = sites.error ?? lines.error ?? devices.error;

  if (sites.isSuccess && sites.data.length === 0) return <NoDevices />;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-panel="device-picker">
      <Select
        aria-label="사이트"
        className="w-auto"
        value={siteId ?? ''}
        onChange={(e) => {
          setSite(Number(e.target.value));
          setLine(null);
        }}
      >
        {sites.isPending ? <option value="">사이트 읽는 중</option> : null}
        {(sites.data ?? []).map((s) => (
          <option key={s.siteId} value={s.siteId}>
            {s.siteName}
          </option>
        ))}
      </Select>
      <Select
        aria-label="라인"
        className="w-auto"
        value={lineId ?? 'all'}
        onChange={(e) => setLine(e.target.value === 'all' ? 'all' : Number(e.target.value))}
      >
        <option value="all">라인 전체</option>
        {(lines.data ?? []).map((l) => (
          <option key={l.lineId} value={l.lineId}>
            {l.lineName}
          </option>
        ))}
      </Select>
      <Select
        aria-label="설비"
        className="w-auto"
        value={deviceId !== null && list.some((d) => d.deviceId === deviceId) ? deviceId : ''}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v > 0) router.push(`/realtime/${v}`);
        }}
      >
        <option value="">
          {devices.isPending ? '설비 읽는 중' : deviceId !== null ? `설비 ${deviceId}` : '설비를 고른다'}
        </option>
        {list.map((d) => (
          <option key={d.deviceId} value={d.deviceId} className={d.isActive ? '' : 'text-slate-400'}>
            {d.deviceName}
            {d.isActive ? '' : ' (비활성)'}
          </option>
        ))}
      </Select>
      {devices.isSuccess && devices.data.length === 0 ? <NoDevices /> : null}
      {err ? <Band tone="warning">설비 목록 — {errorText(err)}</Band> : null}
    </div>
  );
}

function NoDevices() {
  return (
    <p className="text-xs text-slate-500" data-panel="device-picker">
      등록된 설비가 없다 —{' '}
      <Link className="text-blue-700 underline" href="/admin/master">
        마스터 관리에서 등록한다
      </Link>
    </p>
  );
}
