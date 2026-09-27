// 대조군 역전 지점 패널의 구조 판정 역전 구간 표 — 정본 08_screen/07 §대조군 역전 지점(계약 "구조 판정 역전 구간" · "구조 판정 원천 선택" · "구조 판정 한계").
// 원천은 structuralRanges(반복 3회 모두 같은 쪽이 앞선 점만으로 정한 구간)다. 폐기 기록이어도 구조 사실은 보이되, 시간 점 · 쿼리 시간 값은 싣지 않는다.
// 표시만 한다 — 판독은 lib/measurements.ts(readMeasurements().structural)가 한다.
import {
  formatCrossover,
  formatExpRange,
  memoryLimitText,
  QUERY_LABELS,
  type Store,
  type StructuralSource,
} from '../../lib/measurements';

export const STORE_LABEL: Record<Store, string> = {
  postgresql: 'PostgreSQL 대조군',
  clickhouse: 'ClickHouse',
};

const CACHE_LABEL: Record<string, string> = { cold: '콜드', warm: '웜' };

export const STRUCTURAL_LIMIT =
  '동률 점(ClickHouse client 중앙값 10 ms 미만 · 두 저장소 차 1 ms 미만)은 서버 µs로 판정했다 — client만 쓰면 콜드 구간이 달라진다(기록 053 한계)';

/** 4요소 툴팁(title 속성 · 평문) — 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 11종 */
export function conditionText(s: Pick<StructuralSource, 'record' | 'run' | 'switches'>): string {
  const sw = Object.entries(s.switches)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : String(v)}`);
  return [
    `기록 ${s.record} · 커밋 ${s.run.commitHash}`,
    `프로파일 ${s.run.memoryProfile} · ${memoryLimitText(s.run)} · 티어 ${s.run.capacityTier}`,
    sw.join(' · '),
  ].join('\n');
}

const TH = 'border-b border-slate-200 px-2 py-1 font-medium';
const TD = 'border-b border-slate-100 px-2 py-1';

export function StructuralRangesTable({ source }: { source: StructuralSource }) {
  const tip = conditionText(source);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-semibold text-slate-700">구조 판정 역전 구간</span>
        <span className="cursor-help text-xs text-slate-500 underline decoration-dotted" title={tip}>
          원천 기록 {source.record}
        </span>
      </div>
      <p className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
        {source.status} 기록의 구조 사실 — 반복 3회 우열 일치(04 §구조 판정) · 크기 수치는 인용하지 않는다
      </p>
      {source.ranges.length === 0 ? (
        <p className="text-xs text-slate-500">원천 기록의 structuralRanges에 판독 가능한 행이 없다</p>
      ) : (
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className={TH}>쿼리</th>
              <th className={TH}>캐시</th>
              <th className={TH}>PG 변형</th>
              <th className={TH}>역전 구간</th>
              <th className={TH}>우열 미정 점</th>
            </tr>
          </thead>
          <tbody>
            {source.ranges.map((r) => (
              <tr key={`${r.query}|${r.cache}|${r.pgVariant}`} title={tip}>
                <td className={TD}>{QUERY_LABELS[r.query] ?? r.query}</td>
                <td className={TD}>{CACHE_LABEL[r.cache] ?? r.cache}</td>
                <td className={TD}>{r.pgVariant}</td>
                <td className={TD}>
                  {r.crossover !== null ? (
                    <span className="font-medium text-red-700">
                      {formatCrossover(r.crossover)}
                      {r.direction
                        ? ` · ${STORE_LABEL[r.direction.from]} → ${STORE_LABEL[r.direction.to]}`
                        : ''}
                    </span>
                  ) : (
                    `역전 없음 — ${STORE_LABEL[r.winner]} 앞섬 · ${formatExpRange(r.range)}`
                  )}
                </td>
                <td className={TD}>{r.undetermined.length > 0 ? r.undetermined.join(' · ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-slate-500">
        한계 — {STRUCTURAL_LIMIT}
        {` · 형식이 어긋난 행 ${source.invalidRanges}`}
      </p>
    </div>
  );
}
