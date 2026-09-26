// 확인(ACK) 행위자 해석 — 판정 정본 docs/07_api/07_alarms.md §인증 전 확인 행위자 판정
// 인증 전(S7 ①): ALARM_ACK_ACTOR_EMAIL(기동 시 1회)이 가리키는 활성 · OPERATOR 계정 — 조회는 확인 트랜잭션의 첫 문장에서 확인마다 한다.
// 기동 시에 해석하지 않는다 — 계정 시드가 없는 옛 스냅샷에서 기동 거부로 측정까지 막거나, PostgreSQL이 늦게 뜬 기동에서 확인이 전부 401이 된다.
// 교체는 이 포트 하나다 — 인증 뒤(S7 ②)에는 액세스 토큰 주체를 돌려주는 구현으로 바꾸고 환경변수를 폐기한다.
import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ApiError } from '../../../common/http/api-error';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';

export interface AckActorResolver {
  /** 요청자 user_id — 없음 · 비활성 401 auth.unauthenticated · OPERATOR 없음 403 auth.forbidden */
  resolve(c: PoolClient): Promise<number>;
}

export const ACK_ACTOR_RESOLVER = Symbol('ACK_ACTOR_RESOLVER');

/** email 유일 인덱스 + user_role 기본 키 — 확인은 드물어 1회 조회가 비용이 되지 않는다 */
const ACTOR_SQL = `SELECT u.user_id, u.is_active,
       EXISTS (SELECT 1 FROM user_role ur JOIN role r ON r.role_id = ur.role_id
                WHERE ur.user_id = u.user_id AND r.role_code = 'OPERATOR') AS is_operator
  FROM user_account u WHERE u.email = $1`;

@Injectable()
export class EnvAckActorResolver implements AckActorResolver {
  private readonly email: string | null;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.email = cfg.alarmAckActorEmail;
  }

  async resolve(c: PoolClient): Promise<number> {
    // 신원이 없는 요청과 같은 뜻이라 새 코드를 채번하지 않는다(07_api/07 §인증 전 확인 행위자 판정 · 실패 행)
    if (!this.email) throw new ApiError('auth.unauthenticated', '확인 행위자가 설정되지 않았다');
    const r = await c.query(ACTOR_SQL, [this.email]);
    const row = r.rows[0] as { user_id: number; is_active: boolean; is_operator: boolean } | undefined;
    if (!row?.is_active) throw new ApiError('auth.unauthenticated', '확인 행위자 계정이 없다');
    if (!row.is_operator) throw new ApiError('auth.forbidden', '확인 행위자에 OPERATOR 역할이 없다');
    return Number(row.user_id);
  }
}
