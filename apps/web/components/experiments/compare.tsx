'use client';
// EXP-COMPARE — 정본 docs/08_screen/07_experiment_console.md §EXP-COMPARE (요소 6 · 비교 성립 조건 6 · 상태 4행)
// 측정 창은 브라우저 저장소에만 둔다 — 어디에도 쓰지 않는다. 폴링하지 않는다(캡처는 사람이 누를 때 두 번).
// 대조군 역전 지점 차트(S5)는 crossover.tsx — BFF 기록 읽기(/bff/measurements) · ECharts · 기록이 없으면 빈 상태 문구.
import { useEffect, useMemo, useState } from 'react';
import {
  type Capture,
  COMPARE_METRICS,
  conditionKey,
  deviation,
  groupByCondition,
  judgeComparability,
  type MeasureWindow,
  median,
  pairedSwitches,
} from '../../lib/compare';
import { COMPARE_WINDOWS_PER_CONDITION } from '../../lib/config';
import type { MetricSample } from '../../lib/metrics-parser';
import { HealthResponse, SWITCHES } from '../../lib/shared';
import { formatKst } from '../../lib/time';
import { Button, Select } from '../master/field';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CrossoverPanel } from './crossover';

const STORE_KEY = 'db_study.compare.windows';

function load(): MeasureWindow[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as MeasureWindow[]) : [];
  } catch {
    return [];
  }
}
function save(ws: MeasureWindow[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(ws));
  } catch {
    // 저장소가 가득 차면 이 탭에만 남는다
  }
}

/** 캡처 — 두 표면 응답이 모두 와야 창 경계를 확정한다 */
async function capture(): Promise<Capture> {
  const [h, m] = await Promise.all([
    fetch('/bff/health', { cache: 'no-store' }),
    fetch('/bff/metrics?view=window', { cache: 'no-store' }),
  ]);
  if (!m.ok) throw new Error(`metrics HTTP ${m.status}`);
  // health 503도 같은 본문(저장소별 상태)이다 — 스위치 · 4요소는 그대로 읽는다
  const health = HealthResponse.parse(await h.json());
  const body = (await m.json()) as { fetchedAt: number; samples: MetricSample[] };
  return { atMs: body.fetchedAt, health, samples: body.samples };
}

const shortCond = (k: string) =>
  k
    .split('|')
    .filter((p) => {
      const [id] = p.split('=');
      const spec = SWITCHES.find((s) => s.id === id);
      return spec && !p.includes('도입 전');
    })
    .join(' · ');

const fmt = (v: number | null) =>
  v === null ? '—' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4);

export function ExperimentCompare() {
  const [windows, setWindows] = useState<MeasureWindow[]>([]);
  const [open, setOpen] = useState<Capture | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => setWindows(load()), []);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const groups = useMemo(() => groupByCondition(windows), [windows]);
  const keys = [...groups.keys()];
  const [aKey, setA] = useState<string | null>(null);
  const [bKey, setB] = useState<string | null>(null);
  const ka = aKey && groups.has(aKey) ? aKey : (keys[0] ?? null);
  const kb = bKey && groups.has(bKey) ? bKey : (keys.find((k) => k !== ka) ?? null);
  const A = ka ? (groups.get(ka) ?? []) : [];
  const B = kb ? (groups.get(kb) ?? []) : [];
  const verdict = judgeComparability(A, B, COMPARE_WINDOWS_PER_CONDITION);
  const pairs = pairedSwitches(windows);

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      setOpen(await capture());
    } catch (e) {
      setErr(`캡처 실패 — 다시 캡처 (${String(e)})`);
    } finally {
      setBusy(false);
    }
  };
  const end = async () => {
    if (!open) return;
    setBusy(true);
    setErr(null);
    try {
      const c = await capture();
      const key = conditionKey(open.health);
      const same = windows.filter((w) => conditionKey(w.start.health) === key);
      // 조건당 창 최대 3 — 넘치면 가장 오래된 창을 밀어낸다
      const kept =
        same.length >= COMPARE_WINDOWS_PER_CONDITION ? windows.filter((w) => w !== same[0]) : windows;
      const next = [...kept, { id: `${open.atMs}`, start: open, end: c }];
      setWindows(next);
      save(next);
      setOpen(null);
    } catch (e) {
      setErr(`캡처 실패 — 그 창을 버린다 · 다시 캡처 (${String(e)})`);
      setOpen(null);
    } finally {
      setBusy(false);
    }
  };
  const remove = (id: string) => {
    const next = windows.filter((w) => w.id !== id);
    setWindows(next);
    save(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>측정 창</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Button onClick={start} disabled={busy || open !== null}>
              창 시작 캡처
            </Button>
            <Button onClick={end} disabled={busy || open === null}>
              창 끝 캡처
            </Button>
            {open ? (
              <span className="text-slate-600">
                진행 {Math.floor((now - open.atMs) / 1000)}초 · 시작 {formatKst(open.atMs, true)}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {err ? <Band>{err}</Band> : null}
          {windows.length === 0 ? (
            <p className="text-sm text-slate-500">창 시작 캡처로 측정을 시작한다</p>
          ) : (
            <div className="flex flex-col gap-2 text-xs">
              {keys.map((k) => (
                <div key={k} className="rounded border border-slate-200 p-2">
                  <div className="mb-1 font-medium">
                    {shortCond(k)} · 창 {groups.get(k)?.length}/{COMPARE_WINDOWS_PER_CONDITION}
                  </div>
                  {(groups.get(k) ?? []).map((w) => (
                    <div key={w.id} className="flex gap-2 text-slate-600">
                      <span>
                        {formatKst(w.start.atMs, true)} ~ {formatKst(w.end.atMs, true)}
                      </span>
                      <button type="button" className="text-red-600" onClick={() => remove(w.id)}>
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>비교 가능성</CardTitle>
          <div className="flex gap-2 text-xs">
            <Select value={ka ?? ''} onChange={(e) => setA(e.target.value)}>
              {keys.map((k) => (
                <option key={k} value={k}>
                  A: {shortCond(k).slice(0, 80)}
                </option>
              ))}
            </Select>
            <Select value={kb ?? ''} onChange={(e) => setB(e.target.value)}>
              {keys.map((k) => (
                <option key={k} value={k}>
                  B: {shortCond(k).slice(0, 80)}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {keys.length < 2 ? (
            <p className="text-sm text-slate-500">비교할 두 번째 조건이 없다 · 전환 절차로 스위치를 바꾼다</p>
          ) : verdict.ok ? (
            <Badge variant="success" className="self-start">
              성립 — 다른 스위치 {verdict.target} 하나 · 재기동 없음 · 편차 기준 이내
            </Badge>
          ) : (
            <ul className="list-disc pl-5 text-sm text-amber-800">
              {verdict.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {verdict.target ? <CompareTable target={verdict.target} a={A} b={B} ok={verdict.ok} /> : null}
        </CardContent>
      </Card>

      <CrossoverPanel />

      <Card>
        <CardContent className="text-sm">
          이 브라우저의 쌍 현황 — on/off 두 조건이 모두 있는 스위치 {pairs.length}/{SWITCHES.length}
          {pairs.length > 0 ? ` (${pairs.join(' · ')})` : ''}
        </CardContent>
        <CardFooter>관찰 보조 — 기록 정본 아님(AC-43의 증거는 docs/measurements 기록이다)</CardFooter>
      </Card>
    </div>
  );
}

function CompareTable({
  target,
  a,
  b,
  ok,
}: {
  target: string;
  a: MeasureWindow[];
  b: MeasureWindow[];
  ok: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>지표({target} 측정 대상)</TableHead>
          <TableHead>A 중앙값</TableHead>
          <TableHead>B 중앙값</TableHead>
          <TableHead>비(B/A)</TableHead>
          <TableHead>창별 편차 A · B</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(COMPARE_METRICS[target] ?? []).map((m) => {
          const va = a.map((w) => m.value(w)).filter((v): v is number => v !== null);
          const vb = b.map((w) => m.value(w)).filter((v): v is number => v !== null);
          const ma = median(va);
          const mb = median(vb);
          const da = deviation(va);
          const db = deviation(vb);
          return (
            <TableRow key={m.label}>
              <TableCell>{m.label}</TableCell>
              <TableCell>{fmt(ma)}</TableCell>
              <TableCell>{fmt(mb)}</TableCell>
              <TableCell>{ok && ma && mb !== null ? (mb / ma).toFixed(2) : '—'}</TableCell>
              <TableCell>
                {da === null ? '—' : `${(da * 100).toFixed(0)}%`} ·{' '}
                {db === null ? '—' : `${(db * 100).toFixed(0)}%`}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
