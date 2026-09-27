// BizHandlers — kind 14 → 기존 쓰기 서비스(기전 정본 docs/06_pipeline/07_business_crud.md §업무 명령 경로 · 계약 biz-contracts.ts)
// 명령 하나 = 트랜잭션 하나(업무 행 · audit_log · ledger면 biz_command_log APPLIED — 기존 서비스 tx()의 COMMIT 직전 훅).
// payload는 api가 공유 스키마로 검증을 마친 값이다 — 워커는 형식을 다시 거르지 않고 도메인 규칙만 본다(서비스가 던지는 ApiError).
// 경로 식별자는 params.id 하나다(표면 경로의 :id). 상태 코드는 기존 컨트롤러와 같다(생성 201 · 그 밖 200).
// 체인 ②③은 서비스 안에서 커밋 뒤 · 반환 전(⑥이 ⑦보다 앞) · ④는 응답 뒤(setImmediate).
import type {
  AlarmRuleCreate,
  AlarmRulePatch,
  BizCommandEnvelopeBody,
  BizKind,
  ModbusConfigBody,
  TagCreate,
  TagPatch,
  TagReissue,
} from '@db-study/shared';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error';
import { AlarmEventsService } from '../alarm/api/alarm-events.service';
import { AlarmRulesService } from '../alarm/api/alarm-rules.service';
import { MasterWriteService } from '../master/master-write.service';
import type { BizApplyOutcome, BizApplyTrace, BizHandlers } from './biz-contracts';
import { emptyTrace, runInBizScope } from './biz-ledger';

type Body = Record<string, unknown>;
interface Route {
  httpStatus: 200 | 201;
  run: (id: number, body: unknown) => Promise<unknown>;
}

/** 거절 · 불가 오류에 붙은 trace — 흐름 요약 txMs 등(없으면 빈 trace) */
export function bizTraceOf(e: unknown): BizApplyTrace {
  return (e as { trace?: BizApplyTrace })?.trace ?? emptyTrace();
}

@Injectable()
export class BizHandlersImpl implements BizHandlers {
  private readonly routes: Record<BizKind, Route>;

  constructor(master: MasterWriteService, rules: AlarmRulesService, events: AlarmEventsService) {
    this.routes = {
      'master.tag.create': { httpStatus: 201, run: (_, b) => master.createTag(b as TagCreate) },
      'master.tag.patch': { httpStatus: 200, run: (id, b) => master.patchTag(id, b as TagPatch) },
      'master.tag.deactivate': { httpStatus: 200, run: (id) => master.deactivateTag(id) },
      'master.tag.reissue': { httpStatus: 201, run: (id, b) => master.reissueTag(id, b as TagReissue) },
      'master.site.create': {
        httpStatus: 201,
        run: (_, b) => master.createSite(b as { siteCode: string; siteName: string }),
      },
      'master.site.patch': { httpStatus: 200, run: (id, b) => master.patchSite(id, b as Body) },
      'master.line.create': {
        httpStatus: 201,
        run: (_, b) => master.createLine(b as { siteId: number; lineCode: string; lineName: string }),
      },
      'master.line.patch': { httpStatus: 200, run: (id, b) => master.patchLine(id, b as Body) },
      'master.device.create': {
        httpStatus: 201,
        run: (_, b) => master.createDevice(b as Parameters<MasterWriteService['createDevice']>[0]),
      },
      'master.device.patch': { httpStatus: 200, run: (id, b) => master.patchDevice(id, b as Body) },
      'master.modbus.put': {
        httpStatus: 200,
        run: (id, b) => master.putModbusConfig(id, b as ModbusConfigBody),
      },
      'alarm.rule.create': { httpStatus: 201, run: (_, b) => rules.create(b as AlarmRuleCreate) },
      'alarm.rule.patch': { httpStatus: 200, run: (id, b) => rules.patch(id, b as AlarmRulePatch) },
      'alarm.event.ack': { httpStatus: 200, run: (id) => events.ack(id) },
    };
  }

  async apply(env: BizCommandEnvelopeBody, opts: { ledger: boolean }): Promise<BizApplyOutcome> {
    const route = this.routes[env.kind];
    // 봉투 스키마가 kind를 닫힌 집합으로 거르지만, 표면이 늘어 워커가 옛 코드로 돌 때를 위해 한 번 더 막는다
    if (!route)
      throw new ApiError('common.validation_failed', '모르는 명령 종류다', {
        fields: [{ path: 'kind', reason: 'enum' }],
      });
    const trace = emptyTrace();
    const scope = {
      ledger: opts.ledger
        ? {
            cmdId: env.cmdId,
            kind: env.kind,
            actor: env.actor,
            requestedAt: env.requestedAt,
            httpStatus: route.httpStatus,
          }
        : null,
      trace,
    };
    try {
      const body = await runInBizScope(scope, () =>
        route.run(Number(env.payload.params.id), env.payload.body),
      );
      return { httpStatus: route.httpStatus, body, trace };
    } catch (e) {
      if (e instanceof Error) Object.assign(e, { trace });
      throw e;
    }
  }
}
