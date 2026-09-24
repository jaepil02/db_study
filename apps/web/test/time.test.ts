// AC-04 웹 표시 절반 — 알려진 epoch 행(기록 010 반복 1의 AC-04 행)을 웹이 Asia/Seoul로 한 번만 변환하는가.
// 기대값은 ClickHouse가 같은 행을 컬럼 시간대(DateTime64(3, 'Asia/Seoul'))로 낸 문자열이다 — 밀리초 오차 0.
// 호스트 시간대와 무관해야 하므로 package.json test:tz가 TZ 3종(Asia/Seoul · UTC · America/New_York)으로 다시 돌린다.
import { describe, expect, it } from 'vitest';
import { formatKst, formatKstIso, toKstOffsetIso } from '../lib/time';

const KNOWN = { epochMs: 1790263007615, clickhouseKst: '2026-09-25 00:16:47.615' };

describe('AC-04 웹 표시 — Asia/Seoul 변환 1회', () => {
  it('API epoch → 웹 표시가 ClickHouse 컬럼 시간대 표기와 같다(ms 오차 0)', () => {
    expect(formatKst(KNOWN.epochMs, true)).toBe(`${KNOWN.clickhouseKst} KST`);
  });

  it('업무 시각 UTC ISO도 같은 규칙 — 두 번 변환하지 않는다', () => {
    expect(formatKstIso(new Date(KNOWN.epochMs).toISOString(), true)).toBe(`${KNOWN.clickhouseKst} KST`);
  });

  it('요청 직렬화 +09:00은 같은 순간을 가리킨다', () => {
    expect(Date.parse(toKstOffsetIso(KNOWN.epochMs))).toBe(KNOWN.epochMs);
  });
});
