// uPlot 시각축 — 정본 docs/08_screen/01_standards.md §시각 표시 "시간대 표기 KST를 붙인다"
// 눈금 변환은 각 차트의 tzDate(Asia/Seoul)가 한 번만 한다 — 이 파일은 축에 시간대 표기만 붙인다.
// 눈금 문자열마다 KST를 붙이면 눈금이 겹치므로 축 이름 한 자리에 둔다.

/** 시각축 이름 — 수동 조회(clickhouse-client) 결과와 대조할 때 기준 시간대를 잃지 않게 */
export const KST_AXIS_LABEL = '시각(KST)';

/** x(시각) 축 옵션 — uPlot.Axis와 호환되는 최소 모양(타입 의존을 두지 않는다) */
export function kstTimeAxis(): { label: string } {
  return { label: KST_AXIS_LABEL };
}
