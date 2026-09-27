'use client';
// 업무 명령 목록 — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW 요소 업무 명령 목록
// 최근 20건 · 시각(KST · 밀리초) · kind · 결과(ok · ✕ 도메인 오류 코드 · ⚠ common.postgres_unavailable · expired) · 멱등 재적용 ·
// 단계 ms 넷(적용 단계 순서) · 무효화 키 수 · ch:cacheinv 발행 여부 · 발행 주체(role — biz-writer · api-direct).
import { BIZ_STAGES, bizOutcome, DUPLICATE_MARK, OUTCOME_MARK } from '../../../lib/flow';
import type { FlowBizSummaryBody } from '../../../lib/shared';
import { formatKst } from '../../../lib/time';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';

function ms(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

function Result({ b }: { b: FlowBizSummaryBody }) {
  const o = bizOutcome(b.result);
  if (o === 'ok') return <Badge variant="success">ok</Badge>;
  if (o === 'expired') return <Badge variant="outline">{OUTCOME_MARK.expired} expired</Badge>;
  if (o === 'failed')
    return (
      <Badge
        variant="warning"
        title="PostgreSQL 불가 — 적용 여부를 확정하지 못했다(원장 행 없음) · 도메인 거절 아님"
      >
        {OUTCOME_MARK.failed} {b.result}
      </Badge>
    );
  return (
    <Badge variant="danger" title="도메인 거절(REJECTED)">
      {OUTCOME_MARK.rejected} {b.result}
    </Badge>
  );
}

export function BizList({ items }: { items: readonly FlowBizSummaryBody[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">이 구독 뒤 업무 명령 없음 — 적재와 무관한 정상</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>시각</TableHead>
          <TableHead>kind</TableHead>
          <TableHead>결과</TableHead>
          <TableHead>재적용</TableHead>
          {BIZ_STAGES.map((s) => (
            <TableHead key={s.key} className="text-right">
              {s.label} ms
            </TableHead>
          ))}
          <TableHead className="text-right">무효화 키</TableHead>
          <TableHead>ch:cacheinv</TableHead>
          <TableHead>발행 주체</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((b) => (
          <TableRow key={`${b.source}|${b.role}|${b.seq}|${b.at}`}>
            <TableCell className="whitespace-nowrap tabular-nums">{formatKst(b.at, true)}</TableCell>
            <TableCell className="font-mono text-xs">{b.kind}</TableCell>
            <TableCell>
              <Result b={b} />
            </TableCell>
            <TableCell>{b.duplicate ? DUPLICATE_MARK : ''}</TableCell>
            {BIZ_STAGES.map((s) => (
              <TableCell key={s.key} className="text-right tabular-nums">
                {ms(b.stages[s.key])}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums">{b.invalidatedKeys}</TableCell>
            <TableCell>{b.cacheinv ? '발행' : '—'}</TableCell>
            <TableCell>
              {b.role === 'api-direct' ? (
                <Badge variant="warning">api-direct</Badge>
              ) : (
                <Badge variant="outline">biz-writer</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
