import Link from 'next/link';
import { ExperimentConsole } from '../../components/experiments/console';

// EXP-CONSOLE — 정본 docs/08_screen/07_experiment_console.md · 전환 절차 ⑤에서 EXP-COMPARE로
export default function ExperimentsPage() {
  return (
    <div className="flex flex-col gap-3">
      <Link href="/experiments/compare" className="self-end text-sm text-blue-700 underline">
        실험 비교(EXP-COMPARE)
      </Link>
      <ExperimentConsole />
    </div>
  );
}
