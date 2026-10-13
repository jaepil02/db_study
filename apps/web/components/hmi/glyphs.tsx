// ⑦ HMI 기호 — 상태 4(모양으로도 가른다 — 색만으로 가르지 않는다)와 데이터 종류 8(색 대신 모양 — 저장소 · 상태 색과 겹치지 않게).
// 24 격자 · Lucide 모양 · 크기는 글자를 따라간다(1em). 장식이라 aria-hidden — 뜻은 옆 글자나 감싼 요소의 이름이 말한다.
import type { TagKind } from '@db-study/shared/src/card-line';
import { STATE_VIEW } from '../../lib/hmi';
import type { PlantDeviceState } from '../../lib/shared';
import { cn } from '../../lib/utils';

interface Shape {
  d: string[];
  /** 면으로 채운다(재생 · 일시 정지 · 정지) — 아니면 선 */
  filled?: true;
}

const STATE_SHAPE: Record<PlantDeviceState, Shape> = {
  running: { d: ['M7 4.5v15l12-7.5z'], filled: true },
  idle: { d: ['M7 5h3.5v14H7z', 'M13.5 5H17v14h-3.5z'], filled: true },
  stopped: { d: ['M6 6h12v12H6z'], filled: true },
  // 끊긴 고리(Lucide unlink)
  offline: {
    d: [
      'm18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71',
      'm5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71',
      'M8 2v3',
      'M2 8h3',
      'M16 22v-3',
      'M22 16h-3',
    ],
  },
};

const KIND_SHAPE: Record<TagKind, Shape> = {
  // 온도계
  TEMP: { d: ['M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z'] },
  // 계기(바늘)
  PRESSURE: { d: ['m12 14 4-4', 'M3.34 19a10 10 0 1 1 17.32 0'] },
  // 겹 화살(빠르기)
  SPEED: { d: ['m6 17 5-5-5-5', 'm13 17 5-5-5-5'] },
  // 번개
  CURRENT: { d: ['M13 2 3 14h9l-1 8 10-12h-9z'] },
  // 떨림 파형
  VIBRATION: { d: ['M2 12h3l2-6 3 12 3-12 3 12 2-6h4'] },
  // 수(#)
  COUNT: { d: ['M4 9h16', 'M4 15h16', 'M10 3 8 21', 'M16 3l-2 18'] },
  // 전원
  STATE: { d: ['M12 2v10', 'M18.4 6.6a9 9 0 1 1-12.77.04'] },
  // 조절 막대(그 밖의 설정값 — 정렬 오차 · 레이저 출력 · 조명 밝기)
  OTHER: { d: ['M4 6h10', 'M18 6h2', 'M4 18h4', 'M12 18h8', 'M16 4v4', 'M10 16v4'] },
};

function Svg({ shape, className, color }: { shape: Shape; className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={shape.filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={shape.filled ? 1 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-[1em] shrink-0', className)}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      {shape.d.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** 상태 기호 — 상태 색(mark)으로 칠한다 */
export function StateGlyph({ state, className }: { state: PlantDeviceState; className?: string }) {
  return <Svg shape={STATE_SHAPE[state]} className={className} color={STATE_VIEW[state].mark} />;
}

/** 데이터 종류 기호 — 글자 색을 따른다(색으로 종류를 가르지 않는다) */
export function KindGlyph({ kind, className }: { kind: TagKind; className?: string }) {
  return <Svg shape={KIND_SHAPE[kind]} className={className} />;
}

/** 전원 기호 — 설비 가동 꺼짐 안내 띠 */
export function PowerGlyph({ className }: { className?: string }) {
  return <Svg shape={KIND_SHAPE.STATE} className={className} />;
}
