// EXP-FLOW 실행 패널 조각 — 진행 막대 · 결과 표(08_screen/08 §EXP-FLOW §요소 진행 막대 · 결과 표 행)
// 진행 막대 = publish 단계 경과 ÷ durationSec(넘으면 100%) · 드레인 중이면 채운 채 "드레인 — 적체 복귀 대기(상한 30초)".
import { flowProgress, LIVE_MARK } from '../../lib/runs';
import type { RunObjectBody } from '../../lib/shared';

const int = (v: number) => v.toLocaleString('ko-KR');

export function FlowProgressBar({
  run,
  receivedAt,
  now,
}: {
  run: RunObjectBody;
  receivedAt: number;
  now: number;
}) {
  const p = flowProgress(run, receivedAt, now);
  if (!p) return null;
  const pct = Math.round(p.ratio * 100);
  return (
    <div data-testid="run-progress" className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
      <span className="text-slate-500">진행</span>
      <div
        role="progressbar"
        aria-label="발행 진행"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2.5 w-48 overflow-hidden rounded bg-slate-100"
      >
        <div className="h-full bg-sky-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-700">{pct}%</span>
      <span className="text-slate-500">
        ({p.elapsedSec}초 / {p.durationSec}초)
      </span>
      {p.draining ? <span className="text-amber-700">드레인 — 적체 복귀 대기(상한 30초)</span> : null}
      <span className="text-slate-600">보낸 포인트 {int(p.pointsSent)}</span>
      <span className="text-slate-600">엔트리 {int(p.entriesSent)}</span>
      <span className="text-slate-600">명령 {int(p.commandsSent)}</span>
      <span className="text-slate-600">백프레셔 정지 {int(p.backpressurePauses)}</span>
    </div>
  );
}

const FIELDS = [
  ['pointsSent', '보낸 포인트'],
  ['entriesSent', '엔트리'],
  ['commandsSent', '명령'],
  ['commandsOk', '명령 성공'],
  ['commandsPending', '명령 대기(202)'],
  ['commandsFailed', '명령 실패'],
  ['backpressurePauses', '백프레셔 정지'],
  ['drainMs', '드레인 ms'],
] as const;

/** result 한 행 — 수치 8 · 머리에 라이브 표지 */
export function FlowResultTable({ run }: { run: RunObjectBody }) {
  const r = run.result as Record<string, number | null> | null;
  if (!r || 'scales' in r) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-slate-500">{LIVE_MARK}</p>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              {FIELDS.map(([k, label]) => (
                <th
                  key={k}
                  className="border-b border-slate-200 px-2 py-1 text-left font-medium whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {FIELDS.map(([k]) => {
                const v = r[k];
                return (
                  <td key={k} className="px-2 py-1 tabular-nums whitespace-nowrap">
                    {typeof v === 'number' ? int(v) : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
