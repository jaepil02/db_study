// 저장소 3점 — up · down · latencyMs · health HTTP 200 · 503 · 조회 시각(KST 밀리초)
import { type HealthBody, STORE_NAMES } from '../../lib/shared';
import { formatKst } from '../../lib/time';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

const LABEL = { postgres: 'PostgreSQL', clickhouse: 'ClickHouse', redis: 'Redis' } as const;

export function StoreStatus({
  health,
  httpStatus,
  fetchedAt,
}: {
  health: HealthBody;
  httpStatus: number;
  fetchedAt: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {STORE_NAMES.map((name) => {
        const s = health.stores[name];
        const up = s.status === 'up';
        return (
          <span key={name} className="flex items-center gap-1.5">
            <span
              className={cn('inline-block h-2.5 w-2.5 rounded-full', up ? 'bg-emerald-500' : 'bg-red-500')}
            />
            {LABEL[name]}
            <span className="tabular-nums text-slate-500">
              {up ? `${s.latencyMs} ms` : `down · ${s.error}`}
            </span>
          </span>
        );
      })}
      <Badge variant={httpStatus === 200 ? 'success' : 'danger'}>
        health {httpStatus} · {health.status}
      </Badge>
      <span className="tabular-nums text-xs text-slate-500">조회 {formatKst(fetchedAt, true)}</span>
    </div>
  );
}
