// 스위치 판정 · 조합 경고 — 두 화면의 각주(요약 · 마우스 올림 툴팁)가 쓴다(측정 조건 서랍 · 스위치 비교 화면은 폐지 — D-14 · D-15)
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

/** 기본값과 다른 스위치 수(각주 요약의 셈) */
export function countNonDefault(rows: readonly SwitchRow[]): number {
  return rows.filter((r) => r.kind === 'present' && !r.sameAsDefault).length;
}

export interface ComboWarning {
  /** 조합 제약 번호(02_features/13 §조합 제약) */
  no: number;
  text: string;
}

/**
 * 조합 제약 경고 9건(#1~#9) — 화면 판정 조건은 "그 스위치가 대안 구현인가"뿐이다. health에 없거나 impl null(도입 전)인 스위치는 판정하지 않는다.
 * #10(SW-12 stream + 워커 역할 없음)은 판정하지 않는다 — 조건이 기본값이라 경고로 띄우면 모든 기동에서 떠 다른 경고가 묻힌다.
 */
const COMBO_RULES: readonly { no: number; switchId: string; text: string }[] = [
  {
    no: 1,
    switchId: 'SW-03',
    text: '캐시가 없어요 — SW-04 · SW-05 on/off 차이가 0이라 이 구성으로는 비교하지 않아요',
  },
  { no: 2, switchId: 'SW-01', text: 'Stream 경계가 없어요 — 주입 모드 A로만 실험해요(모드 B · C는 안 돼요)' },
  {
    no: 3,
    switchId: 'SW-01',
    text: '멱등 수치는 이 구성으로 재지 않아요 — 배치 토큰 재료(엔트리 ID)가 없어요',
  },
  { no: 4, switchId: 'SW-09', text: '대조군 적재가 켜졌어요 — 목표 ② 처리량 측정과 섞지 않아요' },
  {
    no: 5,
    switchId: 'SW-10',
    text: '데드밴드가 켜졌어요 — 처리량 · 행 수 · 압축률 성능 측정에는 쓰지 않아요',
  },
  { no: 6, switchId: 'SW-06', text: '팬아웃 직접 호출이에요 — api 인스턴스가 1개일 때만 성립해요' },
  {
    no: 7,
    switchId: 'SW-02',
    text: 'SW-11 비교는 이 구성으로 재지 않아요 — 최신값 조회가 rt:latest를 읽지 않아요',
  },
  { no: 8, switchId: 'SW-10', text: '데드밴드는 주입 모드 A에서만 돌아요 — 모드 B · C · D로는 재지 않아요' },
  {
    no: 9,
    switchId: 'SW-11',
    text: 'collector 갱신은 주입 모드 A에서만 돌아요 — 모드 B · C · D에서는 최신값을 쓰는 주체가 없어요',
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
 * 구성 요약 한 줄 — 기본값과 다른 스위치 수 · 내려간 저장소 수(0이 아닐 때만) · 쉬운 존댓말(D-15).
 * health 응답 전이면 "읽는 중이에요", 실패면 "구성을 읽지 못했어요".
 */
export function conditionsSummary(health: HealthBody | null, failed: boolean): string {
  if (!health) return failed ? '구성을 읽지 못했어요' : '읽는 중이에요';
  const n = countNonDefault(buildSwitchRows(health.switches));
  const down = Object.values(health.stores).filter((c) => c.status === 'down').length;
  const parts = [n === 0 ? '스위치는 전부 기본값이에요' : `기본값과 다른 스위치 ${n}개`];
  if (down > 0) parts.push(`내려간 저장소 ${down}개`);
  return parts.join(' · ');
}

/**
 * 각주 툴팁(마우스 올림) — 기본값과 다른 스위치(코드는 툴팁에만 · 설계 §4 용어표) · 조합 경고 · 저장소 상태(OBS-05 · OBS-06).
 * health 응답 전이면 "구성을 읽는 중이에요", 실패면 "구성을 읽지 못했어요"(쉬운 존댓말 — D-15).
 */
export function healthTip(health: HealthBody | null, failed: boolean): string {
  if (!health) return failed ? '구성을 읽지 못했어요' : '구성을 읽는 중이에요';
  const changed = buildSwitchRows(health.switches)
    .filter((r): r is Extract<SwitchRow, { kind: 'present' }> => r.kind === 'present' && !r.sameAsDefault)
    .map((r) => `${r.spec.id}=${r.value}`);
  const stores = Object.entries(health.stores)
    .map(([k, c]) => `${k} ${c.status}`)
    .join(' · ');
  return [
    `스위치: ${changed.length === 0 ? '전부 기본값' : changed.join(' · ')}`,
    ...comboWarnings(health.switches).map((w) => `조합 경고 #${w.no} — ${w.text}`),
    `저장소: ${stores}`,
  ].join('\n');
}
