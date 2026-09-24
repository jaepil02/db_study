// 실험 콘솔 스위치 표 · 조합 경고 — 정본 docs/08_screen/07_experiment_console.md §스위치 11 표시 · §조합 경고
// "현재" 열은 환경변수 문자열이 아니라 health switches.*.impl · value다(REQ-OBS-11).
import { type HealthBody, implFor, SWITCHES, type SwitchSpec } from './shared';

type SwitchStates = HealthBody['switches'];

export type SwitchRow =
  | {
      kind: 'present';
      spec: SwitchSpec;
      value: string | number;
      impl: string;
      warning: string | null;
      defaultImpl: string;
      /** 주입 구현과 값이 모두 기본값과 같은가 — SW-07은 창 값까지 비교 */
      sameAsDefault: boolean;
    }
  /**
   * 도입 전 스위치 — health가 impl null로 싣거나(포트가 아직 코드에 없다) 키가 없다.
   * "도입 전(단계)" · 기본값과 비교하지 않는다. value는 기동 설정값(있으면)이다.
   */
  | { kind: 'not_introduced'; spec: SwitchSpec; value: string | number | null }
  /** health에 있는데 목록에 없는 스위치 — 숨기지 않고 그대로 보인다 */
  | { kind: 'unknown'; id: string; value: string | number; impl: string | null; warning: string | null };

export function buildSwitchRows(switches: SwitchStates): SwitchRow[] {
  const rows: SwitchRow[] = SWITCHES.map((spec) => {
    const s = switches[spec.id];
    if (!s || s.impl === null) return { kind: 'not_introduced', spec, value: s?.value ?? null };
    const defaultImpl = implFor(spec, spec.defaultValue);
    return {
      kind: 'present',
      spec,
      value: s.value,
      impl: s.impl,
      warning: s.warning,
      defaultImpl,
      sameAsDefault: s.impl === defaultImpl && String(s.value) === String(spec.defaultValue),
    };
  });
  const known = new Set(SWITCHES.map((s) => s.id));
  for (const [id, s] of Object.entries(switches)) {
    if (!known.has(id)) rows.push({ kind: 'unknown', id, value: s.value, impl: s.impl, warning: s.warning });
  }
  return rows;
}

/** 기본값과 다른 스위치 수(공통 셸 실험 조건 배지와 같은 셈) */
export function countNonDefault(rows: readonly SwitchRow[]): number {
  return rows.filter((r) => r.kind === 'present' && !r.sameAsDefault).length;
}

export interface ComboWarning {
  /** 조합 제약 번호(02_features/13 §조합 제약) */
  no: number;
  text: string;
}

/** 조합 제약 9건 — 화면 판정 조건은 "그 스위치가 대안 구현인가"뿐이다. health에 없거나 impl null(도입 전)인 스위치는 판정하지 않는다 */
const COMBO_RULES: readonly { no: number; switchId: string; text: string }[] = [
  {
    no: 1,
    switchId: 'SW-03',
    text: '캐시가 없다 — SW-04 · SW-05 on/off 차이는 0이다 · 이 구성으로 비교하지 않는다',
  },
  { no: 2, switchId: 'SW-01', text: 'Stream 경계가 없다 — 주입 모드 A로만 실험한다(모드 B · C 금지)' },
  {
    no: 3,
    switchId: 'SW-01',
    text: '멱등 수치를 이 구성으로 재지 않는다 — 배치 토큰 재료(엔트리 ID)가 없다',
  },
  { no: 4, switchId: 'SW-09', text: '대조군 적재가 켜졌다 — 목표 ② 처리량 측정과 섞지 않는다' },
  { no: 5, switchId: 'SW-10', text: '데드밴드가 켜졌다 — 처리량 · 행 수 · 압축률 성능 측정에 쓰지 않는다' },
  { no: 6, switchId: 'SW-06', text: '팬아웃 직접 호출 — api 인스턴스 1에서만 성립한다' },
  {
    no: 7,
    switchId: 'SW-02',
    text: 'SW-11 비교를 이 구성으로 재지 않는다 — 최신값 조회가 rt:latest를 읽지 않는다',
  },
  { no: 8, switchId: 'SW-10', text: '데드밴드는 주입 모드 A에서만 돈다 — 모드 B · C · D로 재지 않는다' },
  {
    no: 9,
    switchId: 'SW-11',
    text: 'collector 갱신은 주입 모드 A에서만 돈다 — 모드 B · C · D에서는 최신값을 쓰는 주체가 없다',
  },
];

export function comboWarnings(switches: SwitchStates): ComboWarning[] {
  const out: ComboWarning[] = [];
  for (const rule of COMBO_RULES) {
    const spec = SWITCHES.find((s) => s.id === rule.switchId);
    const cur = switches[rule.switchId];
    if (!spec || !cur || cur.impl === null) continue; // 도입 전(impl null)은 판정하지 않는다
    if (cur.impl !== implFor(spec, spec.defaultValue)) out.push({ no: rule.no, text: rule.text });
  }
  return out;
}

/**
 * 기록 조건 블록 — 측정 기록 템플릿 §조건 표 모양(10_observability/04). 4요소는 health에서 채우고 게이트 칸만 수기(?)로 둔다.
 * 사람이 읽는 표는 "바꾼 것만 명시 · 나머지 기본값"이고, 전수 줄에 스위치 11키 전부(도입 전은 value(도입 전))를 싣는다.
 */
export function recordConditionBlock(health: HealthBody): string {
  const rows = buildSwitchRows(health.switches);
  const run = health.run;
  const changed = rows
    .filter((r): r is Extract<SwitchRow, { kind: 'present' }> => r.kind === 'present' && !r.sameAsDefault)
    .map((r) => `${r.spec.id}=${r.value}`);
  // 전수 줄은 11키를 다 싣는다 — 도입 전 스위치는 value(도입 전)
  const all = rows.map((r) => {
    if (r.kind === 'present') return `${r.spec.id}=${r.value}(${r.impl})`;
    if (r.kind === 'not_introduced') return `${r.spec.id}=${r.value ?? '?'}(도입 전)`;
    return `${r.id}=${r.value}(${r.impl ?? '도입 전'})`;
  });
  const missing = '(없음 — 4요소 누락 · 인용 불가)';
  const profile =
    run.memoryProfile === null
      ? missing
      : `${run.memoryProfile} · ${run.memoryLimitMb === null ? '상한 모름' : `${run.memoryLimitMb} MB`}`;
  return [
    '| 항목 | 값 |',
    '|------|------|',
    `| 커밋 | ${run.commitHash ?? missing} |`,
    `| 프로파일 · 상한 | ${profile} |`,
    `| 용량 티어 | ${run.capacityTier ?? missing} |`,
    `| 스위치 | ${changed.length === 0 ? '전부 기본값' : `${changed.join(' · ')} · 그 외 기본값`} |`,
    `| 스위치 전수(health) | ${all.join(' · ')} |`,
    '| 게이트 | ? |',
  ].join('\n');
}
