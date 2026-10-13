// 공용 컨트롤 읽기 · 쓰기 — 설비 가동(/bff/plant/power) · 센서 데이터 현황(/bff/data/sensor/stats) · 지우기(/bff/data/sensor/purge)
// 정본 docs/08_screen/10_lab_screen.md §공용 컨트롤 · 계약 packages/shared/src/api/plant.ts · data.ts.
// ⑤ · ⑦ 머리가 같은 쿼리 키를 나눠 쓴다 — 한 화면에서 켜거나 지우면 다른 조각(현황)이 같은 값을 본다.
import { ApiError } from '../../lib/api';
import {
  ErrorEnvelope,
  PlantPower,
  type PlantPowerBody,
  SensorDataStats,
  type SensorDataStatsBody,
  SensorPurgeResult,
  type SensorPurgeResultBody,
} from '../../lib/shared';

export const controlKeys = {
  power: ['plant', 'power'] as const,
  stats: ['data', 'sensor', 'stats'] as const,
};

/** 설비 가동 다시 읽기 — 다른 화면 · 다른 창에서 바꾼 값도 몇 초 안에 따라간다(요청 하나 · Redis GET 하나) */
export const POWER_POLL_MS = 5_000;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** BFF 요청 하나 — 2xx면 본문 · 아니면 봉투를 읽어 ApiError(code · details) · 닿지 못하면 status 0 */
export async function bffJson(url: string, init?: RequestInit, f: Fetch = fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, { cache: 'no-store', ...init });
  } catch {
    throw new ApiError(0, null, 'BFF에 닿지 못했다');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // 본문이 JSON이 아니다 — 상태만 남긴다
  }
  if (!res.ok) {
    const env = ErrorEnvelope.safeParse(body);
    if (env.success)
      throw new ApiError(
        res.status,
        env.data.error.code ?? null,
        env.data.error.message,
        env.data.error.details ?? null,
      );
    throw new ApiError(res.status, null, `HTTP ${res.status}`);
  }
  return body;
}

function parsed<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success || r.data === undefined) throw new ApiError(200, null, '응답 형식이 계약과 다르다');
  return r.data;
}

export async function fetchPower(f: Fetch = fetch): Promise<PlantPowerBody> {
  return parsed(PlantPower, await bffJson('/bff/plant/power', undefined, f));
}

export async function setPower(on: boolean, f: Fetch = fetch): Promise<PlantPowerBody> {
  return parsed(
    PlantPower,
    await bffJson(
      '/bff/plant/power',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on }) },
      f,
    ),
  );
}

export async function fetchSensorStats(f: Fetch = fetch): Promise<SensorDataStatsBody> {
  return parsed(SensorDataStats, await bffJson('/bff/data/sensor/stats', undefined, f));
}

/** 지우기 — 상태를 바꾸는 POST는 JSON 본문 필수(api 규칙 · 지우기는 빈 객체) */
export async function purgeSensorData(f: Fetch = fetch): Promise<SensorPurgeResultBody> {
  return parsed(
    SensorPurgeResult,
    await bffJson(
      '/bff/data/sensor/purge',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      f,
    ),
  );
}

export function powerQueryOptions() {
  return {
    queryKey: controlKeys.power,
    queryFn: () => fetchPower(),
    staleTime: 0,
    retry: false,
    refetchInterval: POWER_POLL_MS,
    refetchOnWindowFocus: false,
  };
}

export function statsQueryOptions() {
  return {
    queryKey: controlKeys.stats,
    queryFn: () => fetchSensorStats(),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  };
}
