// 시연 전용 행(DEMO-FLOW · DEMO-FLOW-L · DEMO-FLOW-DEV) — 정본 docs/06_pipeline/10_datagen_inject.md §시연 전용 행
// flow 실행의 업무 명령 대상이다(HMI 개요에 안 보이는 비활성 설비).
// 코드로 찾고 없는 것만 BizWritePort(업무 명령)로 만든다 — 사이트 → 라인 → 설비 → 비활성 patch. actor null · 되돌림 없음.
// flow 전용 태그(r5 H2 · 지침서 §6): flow 실행은 이 설비 아래 태그 FLOW_TAG_COUNT개에만 발행한다 — 카드 라인 30대의 태그에
// 가짜 값을 쓰면 ⑦ HMI의 지금 값 · 상태 · 최근 추이가 거짓이 된다. 없는 태그만 master.tag.create로 만든다(멱등 · 처음 한 번).
// 설비가 비활성이라 수집기 · 가상 PLC는 이 태그를 읽지 않는다 — 값은 flow 실행이 Redis Stream으로 보낸 것뿐이다.
import { DEMO_FLOW, type TagCreate, TagCreateRequest } from '@db-study/shared';
import type { BizWritePort, BizWriteRequest } from '../biz/biz-contracts';

/** 시연 전용 행 조회 결과 — 코드로 찾는다 */
export interface DemoRows {
  siteId: number | null;
  lineId: number | null;
  deviceId: number | null;
  deviceActive: boolean | null;
}

/** 시연 전용 행 이름 · 설비 접속 설정(비활성 · 루프백 기본값 — 폴링하지 않는다) */
export const DEMO_NAMES = { site: '시연 사이트', line: '시연 라인', device: '시연 설비' } as const;
export const DEMO_MODBUS = {
  host: '127.0.0.1',
  port: 502,
  unitId: 1,
  timeoutMs: 3000,
  retryCount: 0,
  maxRegsPerRequest: 125,
} as const;

export interface DemoDeps {
  /** siteId가 주어지면 그 사이트 안 라인을 찾는다 */
  findDemo(siteId?: number | null): Promise<DemoRows>;
  port: BizWritePort;
}

/** 생성 명령 — 적용(2xx)만 성공 · 대기 상한 초과 · 거절 · 불가는 던진다(실행 failed) */
async function create(
  port: BizWritePort,
  kind: BizWriteRequest['kind'],
  params: Record<string, number>,
  body: unknown,
): Promise<unknown> {
  const out = await port.submit({ kind, params, body, actor: null, idempotencyKey: null });
  if (out.type === 'accepted')
    throw new Error(
      `시연 전용 행 명령 ${kind}가 대기 상한을 넘었다(${out.status}) — 다음 실행이 다시 확인한다`,
    );
  if (out.httpStatus < 200 || out.httpStatus >= 300)
    throw new Error(`시연 전용 행 명령 ${kind} 응답 ${out.httpStatus}`);
  return out.body;
}

/** 시연 전용 행 — 없는 것만 만든다 · 명령 결과까지 기다린 뒤 checkStop(던지면 그 자리에서 멈춘다) */
export async function ensureDemoRows(
  deps: DemoDeps,
  checkStop: () => void,
): Promise<{ siteId: number; deviceId: number }> {
  let rows = await deps.findDemo();
  let siteId = rows.siteId;
  if (siteId === null) {
    const b = (await create(
      deps.port,
      'master.site.create',
      {},
      { siteCode: DEMO_FLOW.siteCode, siteName: DEMO_NAMES.site },
    )) as { siteId: number };
    siteId = b.siteId;
    checkStop();
    rows = await deps.findDemo(siteId);
  }
  let lineId = rows.lineId;
  if (lineId === null) {
    const b = (await create(
      deps.port,
      'master.line.create',
      {},
      { siteId, lineCode: DEMO_FLOW.lineCode, lineName: DEMO_NAMES.line },
    )) as { lineId: number };
    lineId = b.lineId;
    checkStop();
  }
  let deviceId = rows.deviceId;
  let active = rows.deviceActive;
  if (deviceId === null) {
    const b = (await create(
      deps.port,
      'master.device.create',
      {},
      {
        lineId,
        deviceCode: DEMO_FLOW.deviceCode,
        deviceName: DEMO_NAMES.device,
        vendor: null,
        model: null,
        modbusConfig: DEMO_MODBUS,
      },
    )) as { deviceId: number };
    deviceId = b.deviceId;
    active = true;
    checkStop();
  }
  // 생성 표면이 isActive를 받지 않아 비활성은 뒤따르는 patch가 한다 — 앞 실행이 patch 전에 끊겼으면 여기서 마저 한다
  if (active) {
    await create(deps.port, 'master.device.patch', { id: deviceId }, { isActive: false });
    checkStop();
  }
  return { siteId, deviceId };
}

// ── flow 전용 태그

/** flow 전용 태그 수 — 가장 큰 pps(50,000)에서도 한 초 한 태그 점 수가 상한(FLOW_MAX_REPS_PER_TAG 1,000) 안이다 */
export const FLOW_TAG_COUNT = 50;

/** flow 전용 태그 코드 — DEMO-FLOW-DEV-T01 … T50(tag_code는 전체에서 하나뿐이다) */
export function flowTagCode(n: number): string {
  return `${DEMO_FLOW.deviceCode}-T${String(n).padStart(2, '0')}`;
}

/**
 * 생성 본문 — 실수 FLOAT32(유지 레지스터 2워드씩) · 1초 주기 · 값 범위 0~100(flow 값 식 0.0~99.9).
 * 업무 명령 워커는 본문을 다시 거르지 않는다(api가 공유 스키마로 검증한 값을 넘긴다) — 표면과 같은 스키마로 기본값까지 채운다.
 */
export function flowTagBody(deviceId: number, n: number): TagCreate {
  return TagCreateRequest.parse({
    deviceId,
    tagCode: flowTagCode(n),
    tagName: `시연 태그 ${n}`,
    functionCode: 3,
    address: (n - 1) * 2,
    dataType: 'FLOAT32',
    wordOrder: 'ABCD',
    scanRateMs: 1000,
    rangeMin: 0,
    rangeMax: 100,
  });
}

export interface FlowTagDeps {
  port: BizWritePort;
  /** 시연 설비의 태그 전부(활성 여부 무관) — 코드로 flow 전용 태그를 가른다 */
  loadDemoTags(deviceId: number): Promise<{ tagId: number; tagCode: string }[]>;
}

/** flow 전용 태그 — 없는 코드만 만든다 · tag_id 오름차순(발행 식의 태그 목록 T) · 이번에 만든 수 */
export async function ensureFlowTags(
  deps: FlowTagDeps,
  deviceId: number,
  checkStop: () => void,
): Promise<{ tagIds: number[]; created: number }> {
  const have = new Map((await deps.loadDemoTags(deviceId)).map((t) => [t.tagCode, t.tagId]));
  let created = 0;
  for (let n = 1; n <= FLOW_TAG_COUNT; n++) {
    const code = flowTagCode(n);
    if (have.has(code)) continue;
    const b = (await create(deps.port, 'master.tag.create', {}, flowTagBody(deviceId, n))) as {
      tagId: number;
    };
    have.set(code, Number(b.tagId));
    created += 1;
    checkStop();
  }
  const tagIds = Array.from({ length: FLOW_TAG_COUNT }, (_, i) => have.get(flowTagCode(i + 1)) as number);
  return { tagIds: tagIds.sort((a, b) => a - b), created };
}
