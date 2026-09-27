// 업무 쓰기 명령 경로 띠 — 정본 docs/08_screen/01_standards.md §업무 쓰기 응답 — 명령 경로
// 적용 대기 · 업무 쓰기 503 · 오래 대기 · 만료 · 볼 수 없음을 폼 영역에 보인다 · 재시도는 같은 키(useBizWrite.retry).
// 503 재시도 버튼은 백오프(연속 실패마다 1 · 2 · 4초 …) 뒤에 켜진다(§에러 코드별 사용자 표시 "백오프 뒤 재시도 버튼").
// 마스터 · 알람 규칙 · 알람 확인이 함께 쓴다.
import { useEffect, useState } from 'react';
import { type BizWriter, commandNotice } from '../../lib/commands';
import { Band } from '../ui/band';
import { Button } from './field';

/** 재시도가 켜지는 시각까지 남은 ms — 0이면 켜졌다. 그 시각에 한 번 다시 그린다 */
function useWaitUntil(at: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === undefined) return;
    const left = at - Date.now();
    setNow(Date.now());
    if (left <= 0) return;
    // 타이머가 벽시계보다 이르게 울리거나 벽시계가 뒤로 가도 켜지게 — 울린 순간을 at 이상으로 본다(한 번만 건다)
    const t = setTimeout(() => setNow(Math.max(Date.now(), at)), left);
    return () => clearTimeout(t);
  }, [at]);
  return at === undefined ? 0 : Math.max(0, at - now);
}

export function CommandNotice({ writer, prefix }: { writer: BizWriter; prefix?: string }) {
  const n = commandNotice(writer.state);
  const wait = useWaitUntil(writer.state.phase === 'retryable' ? writer.state.retryAt : undefined);
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
        <Button variant="outline" disabled={wait > 0} onClick={writer.retry}>
          {n.retry}
        </Button>
      ) : null}
    </div>
  );
}
