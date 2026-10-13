// 시작 거절 매핑 — api의 순서 · 설정 거절(400 fields path · 409 compare_no_data reason)이 쉬운 문구로 가는지
import { describe, expect, it } from 'vitest';
import { powerErrorText } from '../components/controls/control-text';
import { ApiError } from '../lib/api';
import { REFUSE_TEXT, refusedPath, requestStart } from '../lib/runs';

const reject = (status: number, code: string, details: Record<string, unknown>) =>
  (async () =>
    new Response(JSON.stringify({ error: { code, message: 'x', details } }), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

describe('시작 거절 → 문구', () => {
  it.each([
    [400, 'common.validation_failed', { fields: [{ path: 'plant', reason: 'enum' }] }, 'plant_on'],
    [400, 'common.validation_failed', { fields: [{ path: 'purge', reason: 'enum' }] }, 'purging'],
    [400, 'common.validation_failed', { fields: [{ path: 'SW-09', reason: 'enum' }] }, 'sink_off'],
    [409, 'datagen.compare_no_data', { reason: 'ingest_incomplete' }, 'ingest_incomplete'],
    [409, 'datagen.compare_no_data', { reason: 'no_ingest' }, 'no_data'],
  ] as const)('%i %s %j → %s', async (status, code, details, reason) => {
    const o = await requestStart('compare', { part: 'query' }, reject(status, code, details));
    expect(o.kind).toBe('refused');
    if (o.kind === 'refused') {
      expect(o.reason).toBe(reason);
      expect(REFUSE_TEXT[o.reason].length).toBeGreaterThan(0);
    }
  });

  it('다른 400은 고른 값 문제(invalid)', async () => {
    const o = await requestStart(
      'compare',
      { part: 'query' },
      reject(400, 'common.validation_failed', { fields: [{ path: 'params.part', reason: 'enum' }] }),
    );
    expect(o.kind).toBe('invalid');
  });

  it('설비 가동 켜기가 지우는 중이라 거절되면 그 문구', () => {
    const e = new ApiError(400, 'common.validation_failed', 'x', {
      fields: [{ path: 'purge', reason: 'enum' }],
    });
    expect(refusedPath(e)).toBe('purge');
    expect(powerErrorText(e)).toContain('지우는 중');
  });
});
