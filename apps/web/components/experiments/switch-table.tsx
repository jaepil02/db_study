// 스위치 표 — packages/shared SWITCHES를 행으로. health.switches에 있으면 현재 주입 구현과 기본값 비교 · 없으면 "도입 전(단계)"
import type { SwitchRow } from '../../lib/switches';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

function fmt(v: string | number, kind: string): string {
  return kind === 'ms' ? `${v} ms` : String(v);
}

export function SwitchTable({ rows }: { rows: readonly SwitchRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>환경변수</TableHead>
          <TableHead>기본값</TableHead>
          <TableHead>주입 구현(현재)</TableHead>
          <TableHead>값</TableHead>
          <TableHead>기본값과 같은가</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          if (r.kind === 'not_introduced') {
            return (
              <TableRow key={r.spec.id} className="text-slate-400">
                <TableCell>{r.spec.id}</TableCell>
                <TableCell className="font-mono text-xs">{r.spec.env}</TableCell>
                <TableCell>{fmt(r.spec.defaultValue, r.spec.kind)}</TableCell>
                <TableCell>도입 전(단계)</TableCell>
                <TableCell>{r.value === null ? '—' : fmt(r.value, r.spec.kind)}</TableCell>
                <TableCell>—</TableCell>
              </TableRow>
            );
          }
          if (r.kind === 'unknown') {
            return (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell colSpan={2}>표에 없는 스위치</TableCell>
                <TableCell className="font-mono text-xs">{r.impl ?? '도입 전'}</TableCell>
                <TableCell>{String(r.value)}</TableCell>
                <TableCell>—</TableCell>
              </TableRow>
            );
          }
          const sw01Bypass = r.spec.id === 'SW-01' && r.impl !== r.defaultImpl;
          return (
            <TableRow key={r.spec.id} className={r.sameAsDefault ? undefined : 'bg-amber-50'}>
              <TableCell>{r.spec.id}</TableCell>
              <TableCell className="font-mono text-xs">{r.spec.env}</TableCell>
              <TableCell>{fmt(r.spec.defaultValue, r.spec.kind)}</TableCell>
              <TableCell className="font-mono text-xs">
                {r.impl}
                {r.spec.kind === 'ms' ? `(${r.value} ms)` : ''}
                {sw01Bypass && (
                  <span className="mt-1 block font-sans text-red-600">
                    실험 전용 · 정상 경로 아님{r.warning ? ` (${r.warning})` : ''}
                  </span>
                )}
              </TableCell>
              <TableCell>{fmt(r.value, r.spec.kind)}</TableCell>
              <TableCell>
                {r.sameAsDefault ? (
                  <Badge variant="success">✓</Badge>
                ) : (
                  <Badge variant="danger">✕ 다름</Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
