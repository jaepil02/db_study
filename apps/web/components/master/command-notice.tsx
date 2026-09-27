// 업무 쓰기 명령 경로 띠 — 정본 docs/08_screen/01_standards.md §업무 쓰기 응답 — 명령 경로
// 적용 대기 · 업무 쓰기 503 · 오래 대기 · 만료 · 볼 수 없음을 폼 영역에 보인다 · 재시도는 같은 키(useBizWrite.retry).
// 마스터 · 알람 규칙 · 알람 확인이 함께 쓴다.
import { type BizWriter, commandNotice } from '../../lib/commands';
import { Band } from '../ui/band';
import { Button } from './field';

export function CommandNotice({ writer, prefix }: { writer: BizWriter; prefix?: string }) {
  const n = commandNotice(writer.state);
  if (!n) return null;
  return (
    <div className="flex items-center gap-2" data-command-phase={writer.state.phase}>
      <div className="flex-1">
        <Band tone={n.tone}>
          {prefix ? `${prefix} — ` : ''}
          {n.text}
        </Band>
      </div>
      {n.retry ? (
        <Button variant="outline" onClick={writer.retry}>
          {n.retry}
        </Button>
      ) : null}
    </div>
  );
}
