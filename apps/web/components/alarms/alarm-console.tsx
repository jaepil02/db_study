'use client';
// ALM-CONSOLE — 정본 docs/08_screen/05_alarm_console.md §ALM-CONSOLE
// 요소 7: 탭 · 범위 · 심각도 필터 · 이벤트 목록 · 더 보기 · 확인 버튼 · 실시간 겹침 · 태그 링크 · 규칙 링크.
// 탭은 조회 조건 하나씩(활성 state=ACTIVE · 미확인 acked=false · 이력 범위만) · 쿼리 문자열로 딥링크된다.
// 확인은 다이얼로그 없이 요청하고 응답 뒤 목록을 다시 읽는다 — 낙관적 갱신을 하지 않는다.
// 확인은 업무 쓰기 명령 경로다(08_screen/01 §업무 쓰기 응답) — 202면 확인 버튼 잠금 · 명령 조회로 결말 · 다시 보낼 때는 같은 키.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  type AckOutcome,
  ALARM_EVENTS_TTL_MS,
  type AlarmEvent,
  ackButton,
  ackOutcome,
  ackRequest,
  alarmKeys,
  type ConsoleParams,
  decodeConsoleParams,
  encodeConsoleParams,
  eventListQuery,
  HISTORY_RANGES,
  isOverlaySettled,
  type OverlayItem,
  SEVERITIES,
  severityLabel,
  TABS,
} from '../../lib/alarms';
import { useAlarmOverlay } from '../../lib/alarms-store';
import { ApiError } from '../../lib/api';
import { settle, submitLabel, useBizWrite } from '../../lib/commands';
import { errorText } from '../../lib/error-display';
import { formatKst, formatKstIso } from '../../lib/time';
import { cn } from '../../lib/utils';
import { CommandNotice } from '../master/command-notice';
import { Button, Select } from '../master/field';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useAlarmInvalidate, useEventList, useRules } from './queries';

const SEVERITY_VARIANT = { 1: 'outline', 2: 'warning', 3: 'danger' } as const;

export function SeverityBadge({ severity }: { severity: number }) {
  const v = SEVERITY_VARIANT[severity as 1 | 2 | 3] ?? 'outline';
  return <Badge variant={v}>{severityLabel(severity)}</Badge>;
}

export function AlarmConsole() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = decodeConsoleParams(new URLSearchParams(sp.toString()));
  const setParams = (p: ConsoleParams) => router.replace(`${pathname}?${encodeConsoleParams(p)}`);

  // 이력 범위의 끝 = 조건이 바뀐 순간(분 단위) — 렌더마다 쿼리 키가 바뀌지 않게 조건에만 묶는다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 조건 세 값이 범위의 기준 시각을 다시 잡는 계기다
  const query = useMemo(
    () => eventListQuery(params, Date.now()),
    [params.tab, params.range, params.severity],
  );
  const list = useEventList(query);
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const invalidate = useAlarmInvalidate();

  // ── 실시간 겹침 ──
  const overlay = useAlarmOverlay((s) => s.items);
  const listed = useMemo(() => new Map(rows.map((r) => [r.eventId, r])), [rows]);
  const listUpdatedAt = list.isSuccess ? list.dataUpdatedAt : 0;
  const pending = Object.values(overlay).filter((i) => !isOverlaySettled(i, listed, listUpdatedAt));
  useEffect(() => {
    // 목록에 나타났거나 TTL 경과 뒤 재조회를 거친 겹침 행은 지운다 — 목록이 진실이다
    const settled = Object.values(overlay)
      .filter((i) => isOverlaySettled(i, listed, listUpdatedAt))
      .map((i) => i.eventId);
    if (settled.length > 0) useAlarmOverlay.getState().drop(settled);
  }, [overlay, listed, listUpdatedAt]);
  const nextDue =
    pending.length > 0 ? Math.min(...pending.map((i) => i.receivedAt + ALARM_EVENTS_TTL_MS)) : null;
  useEffect(() => {
    // 겹침 행이 생긴 뒤 목록 캐시 TTL이 지나면 목록을 한 번 다시 읽는다(08_screen/05 §실시간 겹침)
    if (nextDue === null) return;
    const t = setTimeout(() => void invalidate(alarmKeys.events()), Math.max(0, nextDue - Date.now()));
    return () => clearTimeout(t);
  }, [nextDue, invalidate]);

  // ── 확인 ──
  // 확인 명령 하나 — 대기 중이면 확인 버튼을 전부 잠근다(워커가 멈추면 다른 확인도 같은 이유로 대기한다)
  const acker = useBizWrite({ scope: 'alarm:ack' });
  const [acking, setAcking] = useState<number | null>(null);
  const [ackResult, setAckResult] = useState<(AckOutcome & { eventId: number }) | null>(null);
  const finishAck = async (eventId: number, error: unknown) => {
    const outcome = ackOutcome(error);
    // 같은 요청을 재시도하지 않는다 — 200 · 409 · 404는 목록을 다시 읽고(쓴 탭은 서버가 cache:alarmevents를 지웠다) 401 · 403은 제자리
    if (outcome.refetch) await invalidate(alarmKeys.events());
    setAckResult({ ...outcome, eventId });
  };
  const ack = (eventId: number) => {
    setAcking(eventId);
    setAckResult(null);
    void acker.run(ackRequest(eventId), (o) =>
      settle(
        o,
        () => finishAck(eventId, null),
        (e) => finishAck(eventId, e),
      ),
    );
  };

  const empty = list.isSuccess && rows.length === 0;
  // 빈 값 ③ — 규칙 0(S7 첫 기동 · 규칙은 시드하지 않는다) — 목록이 빈 때만 규칙 수를 본다
  const rules = useRules(empty);
  const range = HISTORY_RANGES.find((r) => r.id === params.range);

  return (
    <div className="flex flex-col gap-4">
      {/* 화면 제목은 셸 콘텐츠 머리의 h1이 정본이다 — 여기는 탭 줄만 */}
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setParams({ ...params, tab: t.id })}
              className={cn(
                'rounded px-3 py-1 text-sm',
                params.tab === t.id ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          {params.tab === 'history' ? (
            <span className="flex items-center gap-1">
              발생 시각
              <Select
                aria-label="발생 시각"
                className="w-32"
                value={params.range}
                onChange={(e) => setParams({ ...params, range: e.target.value as ConsoleParams['range'] })}
              >
                {HISTORY_RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </span>
          ) : (
            <span title="활성 · 미확인 탭은 보존 창 전체(서버 기본 범위)를 본다 — 오래 열린 알람이 빠지지 않게">
              발생 시각 — 보존 창 전체
            </span>
          )}
          <span className="flex items-center gap-1">
            심각도
            <Select
              aria-label="심각도"
              className="w-28"
              value={params.severity ?? ''}
              onChange={(e) =>
                setParams({ ...params, severity: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">전체</option>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value} {s.label}
                </option>
              ))}
            </Select>
          </span>
          <Link className="text-slate-500 underline" href="/alarms/rules">
            규칙 관리
          </Link>
        </div>
      </div>

      {pending.length > 0 ? <OverlayLayer items={pending} /> : null}

      <CommandNotice writer={acker} prefix={acking !== null ? `알람 #${acking} 확인` : undefined} />
      {ackResult?.message ? (
        <Band tone={ackResult.tone}>
          알람 #{ackResult.eventId} 확인 — {ackResult.message}
        </Band>
      ) : null}
      {list.isError ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Band tone={list.error instanceof ApiError && list.error.status === 503 ? 'danger' : 'warning'}>
              {errorText(list.error)}
            </Band>
          </div>
          <Button variant="outline" onClick={() => void list.refetch()}>
            다시 조회
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>목록</CardTitle>
          <p className="text-xs text-slate-500">
            발생 · 해제 시각은 판정 행의 측정 시각(KST)이다 · 발생 · 해제 · 다른 운영자의 확인은 목록 캐시
            TTL(30초)만큼 늦게 반영된다 — 그 창은 위 실시간 겹침이 메운다 · 전체 건수는 표시하지 않는다
          </p>
        </CardHeader>
        <CardContent>
          {list.isPending ? (
            <SkeletonRows />
          ) : empty ? (
            <EmptyState
              params={params}
              rangeLabel={range?.label ?? ''}
              ruleCount={rules.data?.length ?? null}
            />
          ) : rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>심각도</TableHead>
                  <TableHead>태그</TableHead>
                  <TableHead>조건 · 규칙</TableHead>
                  <TableHead className="text-right">발생값</TableHead>
                  <TableHead>발생</TableHead>
                  <TableHead>해제</TableHead>
                  <TableHead>확인</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <EventRow
                    key={r.eventId}
                    row={r}
                    clearNotice={overlay[r.eventId]?.clearedTs ?? null}
                    busy={acker.locked}
                    busyLabel={acking === r.eventId ? submitLabel(acker.state, '확인') : '확인'}
                    onAck={() => ack(r.eventId)}
                  />
                ))}
              </TableBody>
            </Table>
          ) : null}
          {list.hasNextPage ? (
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {list.isFetchingNextPage ? '읽는 중…' : '더 보기'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function EventRow({
  row,
  clearNotice,
  busy,
  busyLabel,
  onAck,
}: {
  row: AlarmEvent;
  clearNotice: number | null;
  busy: boolean;
  busyLabel: string;
  onAck: () => void;
}) {
  const b = ackButton(row);
  const tagLabel = row.tagName
    ? `${row.tagName}${row.tagCode ? ` (${row.tagCode})` : ''}`
    : `태그 ${row.tagId}`;
  return (
    <TableRow>
      <TableCell>
        <SeverityBadge severity={row.severity} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <Link className="text-blue-700 hover:underline" href={`/realtime/tag/${row.tagId}`}>
            {tagLabel}
          </Link>
          {!row.tagIsActive ? (
            <span
              className="text-xs text-amber-700"
              title="태그가 꺼져 해소를 관측하지 못한다 — 확인만 할 수 있다"
            >
              태그 비활성 — 판정 중단
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs">{row.conditionType}</span>
          <Link className="text-xs text-slate-500 hover:underline" href={`/alarms/rules/${row.ruleId}`}>
            규칙 #{row.ruleId}
          </Link>
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">{row.triggerValue ?? '—'}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">{formatKstIso(row.occurredAt)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {row.clearedAt ? (
          formatKstIso(row.clearedAt)
        ) : clearNotice !== null ? (
          <Badge variant="success" title="ch:alarm 닫힘 통지를 받았다 — 목록 반영 대기">
            해제 통지 {formatKst(clearNotice)}
          </Badge>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {b.kind === 'enabled' ? (
          <Button disabled={busy} onClick={onAck}>
            {busyLabel}
          </Button>
        ) : b.kind === 'cleared' ? (
          <Button disabled title="해제된 알람">
            해제된 알람
          </Button>
        ) : (
          <span>
            사용자 #{b.ackedBy ?? '?'} · {formatKstIso(b.ackedAt)}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** 겹침 층 — 목록에 아직 없는 통지 · 확인 버튼 없음(확인 대상은 alarm_event 행이다) */
function OverlayLayer({ items }: { items: OverlayItem[] }) {
  const sorted = [...items].sort((a, b) => b.receivedAt - a.receivedAt);
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
      <div className="mb-1 text-xs font-medium text-blue-800">
        실시간 겹침 — 통지는 전달을 보장하지 않는다 · 진실은 아래 목록이다
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {sorted.map((i) => (
          <li key={i.eventId} className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={i.severity} />
            <Link className="text-blue-700 hover:underline" href={`/realtime/tag/${i.tagId}`}>
              태그 {i.tagId}
            </Link>
            <Link className="text-xs text-slate-500 hover:underline" href={`/alarms/rules/${i.ruleId}`}>
              규칙 #{i.ruleId}
            </Link>
            <span className="text-xs text-slate-600">
              알람 #{i.eventId}
              {i.openedTs !== null ? ` · 발생 ${formatKst(i.openedTs)}` : ''}
            </span>
            {i.clearedTs !== null ? (
              <Badge variant="success">해제 {formatKst(i.clearedTs)}</Badge>
            ) : (
              <Badge variant="danger">새 알람</Badge>
            )}
            <span className="text-xs text-slate-500">(목록 반영 대기)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-7 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({
  params,
  rangeLabel,
  ruleCount,
}: {
  params: ConsoleParams;
  rangeLabel: string;
  ruleCount: number | null;
}) {
  if (ruleCount === 0)
    return (
      <p className="text-sm text-slate-600">
        판정 규칙이 없다 — 규칙은 시드하지 않는다.{' '}
        <Link className="text-blue-700 underline" href="/alarms/rules">
          규칙 관리에서 만든다
        </Link>
      </p>
    );
  if (params.tab === 'history')
    return <p className="text-sm text-slate-600">이 범위에 발생한 알람이 없다 — 범위: {rangeLabel}</p>;
  return <p className="text-sm text-slate-600">열린 알람이 없다 (정상 상태)</p>;
}
