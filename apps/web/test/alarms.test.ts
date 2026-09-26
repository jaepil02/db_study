// S7 ① 알람 화면 순수 로직 — 프레임 파싱(07_api/11) · 확인 판정 · 결과별 표시 · 목록 범위 기본값(07_api/07) · 겹침 정리 · 규칙 폼 검증 · 분석 열(08_screen/05)
import { describe, expect, it } from 'vitest';
import {
  type AlarmEvent,
  type AlarmRule,
  ackButton,
  ackOutcome,
  applyAlarmFrame,
  decodeConsoleParams,
  EMPTY_RULE_FORM,
  EVAL_BUCKET_MS,
  encodeConsoleParams,
  evalColumns,
  eventListQuery,
  isOverlaySettled,
  parseAlarmFrame,
  parseEvaluations,
  parseEventPage,
  parseRuleList,
  rulePatchBody,
  serverFieldErrors,
  thresholdLines,
  validateRuleForm,
} from '../lib/alarms';
import { ApiError } from '../lib/api';
import { actionsForSignal } from '../lib/cache-signal';

const NOW = Date.parse('2026-09-26T03:00:30.000Z'); // 12:00:30 KST

const event = (over: Partial<AlarmEvent> = {}): AlarmEvent => ({
  eventId: 10,
  ruleId: 2,
  tagId: 7,
  tagCode: 'T-7',
  tagName: '온도-1',
  tagIsActive: true,
  conditionType: 'GT',
  severity: 3,
  occurredAt: '2026-09-26T01:12:40.000Z',
  clearedAt: null,
  triggerValue: 81.2,
  state: 'ACTIVE',
  ackedBy: null,
  ackedAt: null,
  ...over,
});

describe('alarm 프레임 파싱(07_api/11 §메시지 봉투)', () => {
  const frame = {
    type: 'alarm',
    eventId: 10,
    ruleId: 2,
    tagId: 7,
    transition: 'OPENED',
    ts: 1_758_850_360_000,
    severity: 3,
  };
  it('필드 6 + type — 열림 · 닫힘', () => {
    expect(parseAlarmFrame(JSON.stringify(frame))).toEqual({
      eventId: 10,
      ruleId: 2,
      tagId: 7,
      transition: 'OPENED',
      ts: 1_758_850_360_000,
      severity: 3,
    });
    expect(parseAlarmFrame(JSON.stringify({ ...frame, transition: 'CLEARED' }))?.transition).toBe('CLEARED');
  });
  it('다른 type · 모르는 전이 · 정수 아님 · 계약 밖 필드 · JSON 아님은 버린다', () => {
    expect(parseAlarmFrame(JSON.stringify({ type: 'cacheinv', keys: [] }))).toBeNull();
    expect(parseAlarmFrame(JSON.stringify({ ...frame, transition: 'ACKED' }))).toBeNull();
    expect(parseAlarmFrame(JSON.stringify({ ...frame, eventId: 1.5 }))).toBeNull();
    expect(parseAlarmFrame(JSON.stringify({ ...frame, extra: 1 }))).toBeNull();
    expect(parseAlarmFrame('{')).toBeNull();
  });
});

describe('목록 범위 기본값(07_api/07 §알람 목록 범위 기본값 판정)', () => {
  it('활성 · 미확인은 from · to를 싣지 않는다 — 서버 기본(보존 창 시작 ~ 현재)', () => {
    expect(eventListQuery({ tab: 'active', range: '7d', severity: null }, NOW)).toEqual({ state: 'ACTIVE' });
    expect(eventListQuery({ tab: 'unacked', range: '30d', severity: 3 }, NOW)).toEqual({
      acked: 'false',
      severity: '3',
    });
  });
  it('이력만 범위 — 기본 7일 · 끝은 분 단위로 내린 현재 · +09:00 ISO', () => {
    const p = decodeConsoleParams(new URLSearchParams('tab=history'));
    expect(p).toEqual({ tab: 'history', range: '7d', severity: null });
    expect(eventListQuery(p, NOW)).toEqual({
      from: '2026-09-19T12:00:00.000+09:00',
      to: '2026-09-26T12:00:00.000+09:00',
    });
  });
  it('딥링크 쿼리 문자열 — 모르는 값은 기본값 · 범위는 이력 탭만 싣는다', () => {
    expect(decodeConsoleParams(new URLSearchParams('tab=x&severity=9'))).toEqual({
      tab: 'active',
      range: '7d',
      severity: null,
    });
    expect(encodeConsoleParams({ tab: 'active', range: '30d', severity: 2 }).toString()).toBe(
      'tab=active&severity=2',
    );
    expect(encodeConsoleParams({ tab: 'history', range: '30d', severity: null }).toString()).toBe(
      'tab=history&range=30d',
    );
  });
  it('목록 응답 파싱 — nextCursor 없으면 null · state 2값 밖은 던진다', () => {
    const page = parseEventPage({ items: [event()], meta: { nextCursor: 'abc', limit: 50 } });
    expect(page.nextCursor).toBe('abc');
    expect(page.items[0]?.tagIsActive).toBe(true);
    expect(parseEventPage({ items: [], meta: { nextCursor: null, limit: 50 } }).nextCursor).toBeNull();
    expect(() =>
      parseEventPage({ items: [{ ...event(), state: 'ACKED' }], meta: { nextCursor: null, limit: 50 } }),
    ).toThrow();
  });
  it('shared 스키마 — 모르는 필드는 버리고(응답 필드 추가 허용) 모양 위반은 던진다', () => {
    const page = parseEventPage({ items: [{ ...event(), extra: 1 }], meta: { nextCursor: null, limit: 50 } });
    expect(page.items[0]).toEqual(event());
    expect(() =>
      parseEventPage({ items: [{ ...event(), eventId: 1.5 }], meta: { nextCursor: null, limit: 50 } }),
    ).toThrow();
    const rule = {
      ruleId: 2,
      tagId: 7,
      conditionType: 'OUT_OF_RANGE',
      threshold: 9,
      thresholdLow: 1,
      debounceMs: 5000,
      severity: 3,
      enabled: true,
    };
    expect(parseRuleList({ items: [rule], meta: { count: 1 } })).toEqual([rule]);
    expect(() => parseRuleList({ items: [{ ...rule, conditionType: 'EQ' }], meta: { count: 1 } })).toThrow();
  });
});

describe('확인 허용 판정 · 결과별 표시(08_screen/05 §확인 허용 판정)', () => {
  it('ACTIVE · 미확인만 활성 — 인증 전에는 역할로 숨기지 않는다', () => {
    expect(ackButton(event())).toEqual({ kind: 'enabled' });
    expect(ackButton(event({ state: 'CLEARED', clearedAt: '2026-09-26T01:20:00.000Z' }))).toEqual({
      kind: 'cleared',
    });
    expect(ackButton(event({ ackedBy: 1, ackedAt: '2026-09-26T01:13:00.000Z' }))).toEqual({
      kind: 'acked',
      ackedBy: 1,
      ackedAt: '2026-09-26T01:13:00.000Z',
    });
  });
  it('200 → 재조회 · 409 · 404 → 문구 + 재조회 · 401 · 403 → 제자리', () => {
    expect(ackOutcome(null)).toEqual({ message: null, tone: 'info', refetch: true });
    const o409 = ackOutcome(new ApiError(409, 'alarms.ack_not_allowed', 'x'));
    expect(o409.message).toContain('이미 확인됐거나 해제된 알람');
    expect(o409.refetch).toBe(true);
    const o404 = ackOutcome(new ApiError(404, 'common.not_found', 'x'));
    expect(o404.message).toContain('대상이 없다');
    expect(o404.refetch).toBe(true);
    const o401 = ackOutcome(new ApiError(401, 'auth.unauthenticated', 'x'));
    expect(o401.message).toContain('확인 행위자 계정이 설정되지 않았다');
    expect(o401.refetch).toBe(false);
    const o403 = ackOutcome(new ApiError(403, 'auth.forbidden', 'x'));
    expect(o403.message).toContain('운영자');
    expect(o403.refetch).toBe(false);
    expect(ackOutcome(new ApiError(503, 'common.postgres_unavailable', 'x')).message).toContain(
      '업무 저장소 응답 불가',
    );
    expect(ackOutcome(new ApiError(0, null, 'x')).message).toContain('네트워크');
  });
});

describe('실시간 겹침(08_screen/05 §실시간 겹침)', () => {
  const opened = { eventId: 10, ruleId: 2, tagId: 7, transition: 'OPENED' as const, ts: 1000, severity: 3 };
  it('같은 eventId의 열림 · 닫힘은 한 행', () => {
    const a = applyAlarmFrame({}, opened, 5000);
    const b = applyAlarmFrame(a, { ...opened, transition: 'CLEARED', ts: 2000 }, 6000);
    expect(Object.keys(b)).toEqual(['10']);
    expect(b[10]).toMatchObject({ openedTs: 1000, clearedTs: 2000, receivedAt: 6000 });
  });
  it('목록에 나타나면 · 닫힘은 CLEARED로 나타나면 · TTL 경과 뒤 재조회면 사라진다', () => {
    const item = applyAlarmFrame({}, opened, 5000)[10];
    if (!item) throw new Error('겹침 행 없음');
    expect(isOverlaySettled(item, new Map(), 6000)).toBe(false);
    expect(isOverlaySettled(item, new Map([[10, { state: 'ACTIVE' as const }]]), 6000)).toBe(true);
    const cleared = { ...item, clearedTs: 2000 };
    expect(isOverlaySettled(cleared, new Map([[10, { state: 'ACTIVE' as const }]]), 6000)).toBe(false);
    expect(isOverlaySettled(cleared, new Map([[10, { state: 'CLEARED' as const }]]), 6000)).toBe(true);
    expect(isOverlaySettled(item, new Map(), 5000 + 30_000)).toBe(true);
  });
  it('알람 규칙 신호 → alarm · rules 무효화 · 이벤트는 신호로 무효화하지 않는다', () => {
    const a = actionsForSignal(['cache:alarmrules']);
    expect(a).toEqual([{ kind: 'query', key: ['alarm', 'rules'] }]);
  });
});

describe('규칙 폼 검증(08_screen/05 §규칙 폼 검증 — 필드 7)', () => {
  const ok = { ...EMPTY_RULE_FORM, tagId: 7, threshold: '80' };
  it('통과 — 생성 본문 · OUT_OF_RANGE 밖 thresholdLow null', () => {
    expect(validateRuleForm({ ...ok, thresholdLow: '3' }, true)).toEqual({
      ok: true,
      body: {
        tagId: 7,
        conditionType: 'GT',
        threshold: 80,
        thresholdLow: null,
        debounceMs: 5000,
        severity: 2,
        enabled: true,
      },
    });
  });
  it('태그 필수 · 비활성 태그 거절 · 임계 수치 · 디바운스 0 이상 정수', () => {
    const r = validateRuleForm({ ...ok, tagId: null, threshold: 'x', debounceMs: '-1' }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['debounceMs', 'tagId', 'threshold']);
    const inactive = validateRuleForm(ok, false);
    expect(!inactive.ok && inactive.errors.tagId).toBeTruthy();
    const frac = validateRuleForm({ ...ok, debounceMs: '1.5' }, true);
    expect(!frac.ok && frac.errors.debounceMs).toBeTruthy();
  });
  it('OUT_OF_RANGE — 하한 필수 · 하한 < 임계', () => {
    const oor = { ...ok, conditionType: 'OUT_OF_RANGE' as const };
    const missing = validateRuleForm(oor, true);
    expect(!missing.ok && missing.errors.thresholdLow).toBeTruthy();
    const inverted = validateRuleForm({ ...oor, thresholdLow: '90' }, true);
    expect(!inverted.ok && inverted.errors.thresholdLow).toBeTruthy();
    const good = validateRuleForm({ ...oor, thresholdLow: '1' }, true);
    expect(good.ok && good.body.thresholdLow).toBe(1);
  });
  it('심각도 1~3 밖 거절', () => {
    const r = validateRuleForm({ ...ok, severity: 4 }, true);
    expect(!r.ok && r.errors.severity).toBeTruthy();
  });
  it('편집 PATCH — 바뀐 가변 필드만 · tagId · conditionType은 싣지 않는다', () => {
    const before: AlarmRule = {
      ruleId: 2,
      tagId: 7,
      conditionType: 'GT',
      threshold: 80,
      thresholdLow: null,
      debounceMs: 5000,
      severity: 3,
      enabled: true,
    };
    const v = validateRuleForm({ ...ok, severity: 3, threshold: '85' }, null);
    if (!v.ok) throw new Error('검증 실패');
    expect(rulePatchBody(before, { ...v.body, tagId: 99, conditionType: 'LT' })).toEqual({ threshold: 85 });
    expect(rulePatchBody(before, { ...v.body, threshold: 80, enabled: false })).toEqual({ enabled: false });
  });
  it('서버 400 details.fields → 필드 옆 문구(reference · immutable)', () => {
    const e = new ApiError(400, 'common.validation_failed', 'x', {
      fields: [
        { path: 'tagId', reason: 'reference' },
        { path: 'conditionType', reason: 'immutable' },
        { path: 'header.host', reason: 'enum' },
      ],
    });
    const f = serverFieldErrors(e);
    expect(f.tagId).toContain('비활성');
    expect(f.conditionType).toContain('바꿀 수 없는');
    expect(Object.keys(f)).toHaveLength(2);
    expect(serverFieldErrors(new ApiError(503, 'common.postgres_unavailable', 'x'))).toEqual({});
  });
});

describe('판정 분석 열(#6 — min · max 쌍 · 빈 버킷)', () => {
  // API 실제 모양 — 판정이 없는 버킷은 행이 없다(05_timeseries 관례 · WITH FILL 없음)
  const M = 60_000;
  const FROM = Date.parse('2026-09-26T00:00:00+09:00');
  it('누락 버킷 합성 — meta.interval · from · to로 빠진 버킷을 evalCount 0 행으로 끼운다', () => {
    const r = parseEvaluations({
      meta: {
        interval: '1m',
        from: '2026-09-25T15:00:00.000Z', // = FROM
        to: '2026-09-25T15:04:00.000Z',
        columns: ['ts', 'min', 'max', 'breachCount', 'evalCount'],
        pointCount: 2,
        rule: null,
      },
      series: [
        {
          ruleId: 2,
          tagId: 7,
          points: [
            [FROM + 2 * M, 70, 82, 3, 60],
            [FROM, 60, 75, 0, 60],
          ],
        },
      ],
    });
    expect(r.interval).toBe('1m');
    // 정렬 + 1분 · 3분 버킷 합성(범위 [from, to) = 버킷 4)
    expect(r.points).toEqual([
      [FROM, 60, 75, 0, 60],
      [FROM + M, null, null, 0, 0],
      [FROM + 2 * M, 70, 82, 3, 60],
      [FROM + 3 * M, null, null, 0, 0],
    ]);
    const c = evalColumns(r.points, EVAL_BUCKET_MS[r.interval]);
    expect(c.ratio).toEqual([0, null, 0.05, null]);
    expect(c.empty).toEqual([false, true, false, true]); // 빈 버킷 주의 표지가 실제로 켜진다(AC-36)
    expect(c.breached).toEqual([false, false, true, false]);
    expect(c.min).toEqual([60, null, 70, null]);
    expect([c.totalEval, c.totalBreach, c.stepMs]).toEqual([120, 3, M]);
  });
  it('판정 기록이 전혀 없는 범위 — 빈 series도 전 버킷이 빈 버킷이다', () => {
    const r = parseEvaluations({
      meta: {
        interval: '1h',
        from: '2026-09-26T00:30:00+09:00',
        to: '2026-09-26T03:00:00+09:00',
        columns: ['ts', 'min', 'max', 'breachCount', 'evalCount'],
        pointCount: 0,
        rule: null,
      },
      series: [],
    });
    // 경계는 api 집계와 같은 epoch 정렬 — 00:30 → 00:00 버킷부터 · to 03:00은 제외
    const H = 3_600_000;
    expect(r.points.map((p) => p[0])).toEqual([FROM, FROM + H, FROM + 2 * H]);
    expect(evalColumns(r.points, H).empty).toEqual([true, true, true]);
  });
  it('raw — 합성하지 않는다(점이 판정 한 건이라 버킷이 아니다) · 판정 행은 정렬만', () => {
    const r = parseEvaluations({
      meta: {
        interval: 'raw',
        from: '2026-09-25T15:00:00.000Z',
        to: '2026-09-25T15:00:03.000Z',
        columns: ['ts', 'min', 'max', 'breachCount', 'evalCount'],
        pointCount: 2,
        rule: null,
      },
      series: [
        {
          ruleId: 2,
          tagId: 7,
          points: [
            [FROM + 2_500, 3, 3, 0, 1],
            [FROM + 200, 1, 1, 0, 1],
          ],
        },
      ],
    });
    expect(r.points).toEqual([
      [FROM + 200, 1, 1, 0, 1],
      [FROM + 2_500, 3, 3, 0, 1],
    ]);
    expect(evalColumns(r.points, EVAL_BUCKET_MS.raw).empty).toEqual([false, false]);
  });
  it('모양 위반은 던진다 — 열 5 아님 · interval 3값 밖', () => {
    const meta = {
      interval: '1m',
      from: '2026-09-25T15:00:00.000Z',
      to: '2026-09-25T15:04:00.000Z',
      columns: [],
      pointCount: 0,
      rule: null,
    };
    expect(() =>
      parseEvaluations({ meta, series: [{ ruleId: 2, tagId: 7, points: [[0, 1, 2]] }] }),
    ).toThrow();
    expect(() => parseEvaluations({ meta: { ...meta, interval: '5m' }, series: [] })).toThrow();
  });
  it('임계선 — OUT_OF_RANGE 둘 · 변화율은 값 축이 아니라 긋지 않는다', () => {
    expect(thresholdLines({ conditionType: 'GT', threshold: 80, thresholdLow: null })).toEqual([80]);
    expect(thresholdLines({ conditionType: 'OUT_OF_RANGE', threshold: 9, thresholdLow: 1 })).toEqual([1, 9]);
    expect(thresholdLines({ conditionType: 'RATE_OF_CHANGE', threshold: 0.5, thresholdLow: null })).toEqual(
      [],
    );
  });
});
