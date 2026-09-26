import { ExperimentCompare } from '../../../components/experiments/compare';
import { EvidencePanel } from '../../../components/experiments/evidence';

// EXP-COMPARE — 정본 docs/08_screen/07_experiment_console.md §EXP-COMPARE
// 실증 요약(역방향 EXP-40~44 · 스트리밍 EXP-45)은 역전 지점 패널과 같은 BFF 기록 읽기를 쓰는 관찰 보조 패널이다
export default function ComparePage() {
  return (
    <div className="flex flex-col gap-4">
      <ExperimentCompare />
      <EvidencePanel />
    </div>
  );
}
