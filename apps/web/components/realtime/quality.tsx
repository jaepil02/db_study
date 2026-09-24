// 품질 열 — 정본 docs/08_screen/03_realtime_dashboard.md 상태 4행 정상
// 5 STALE은 경고 색 · 2 · 4는 값 대신 표지 · 9 SIMULATED는 값 옆 작은 표기
import type { Freshness } from '../../lib/latest';
import { QUALITY } from '../../lib/shared';
import { formatAge } from '../../lib/time';
import { Badge } from '../ui/badge';

const NAMES: Record<number, string> = {
  [QUALITY.GOOD]: 'GOOD',
  [QUALITY.UNCERTAIN]: 'UNCERTAIN',
  [QUALITY.BAD_COMM]: 'BAD_COMM',
  [QUALITY.BAD_TIMEOUT]: 'BAD_TIMEOUT',
  [QUALITY.BAD_RANGE]: 'BAD_RANGE',
  [QUALITY.STALE]: 'STALE',
  [QUALITY.SIMULATED]: 'SIMULATED',
};

export function isBadQuality(q: number): boolean {
  return q === QUALITY.BAD_COMM || q === QUALITY.BAD_RANGE || q === QUALITY.BAD_TIMEOUT;
}

export function QualityCell({ quality, freshness }: { quality: number; freshness: Freshness }) {
  if (freshness.kind === 'stale') {
    return (
      <Badge
        variant="warning"
        title={freshness.by === 'server' ? '서버 판정(quality 5)' : '화면 판정(staleAfterMs 초과)'}
      >
        STALE ⚠ 마지막 측정 {formatAge(freshness.ageMs)} 전
      </Badge>
    );
  }
  if (isBadQuality(quality)) return <Badge variant="danger">{NAMES[quality]} ✕</Badge>;
  const name = NAMES[quality] ?? `q${quality}`;
  return <Badge variant={quality === QUALITY.GOOD ? 'success' : 'outline'}>{name}</Badge>;
}
