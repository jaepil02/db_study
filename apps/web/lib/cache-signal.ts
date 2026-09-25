// 무효화 신호 수신(체인 ⑥단) — 정본 docs/08_screen/01_standards.md §무효화 신호 수신
// cacheinv 메시지의 keys(접두 포함 키 이름)를 쿼리 키 무효화 동작으로 바꾼다. 받은 키를 받은 대로 처리한다 — 병합하지 않는다.
// timeseries 쿼리는 어떤 신호에도 무효화하지 않는다 — cache:q는 체인 대상이 아니라 재조회해도 서버가 옛 이름을 TTL만큼 낸다.

/** 마스터 쿼리 키 — 가운뎃점 표기의 배열 원소화(08_screen/01 §갱신 주기와 캐시 층 정렬) */
export const masterKeys = {
  all: ['master'] as const,
  sites: () => ['master', 'sites'] as const,
  lines: (siteId: number) => ['master', 'lines', siteId] as const,
  devices: (siteId: number, includeInactive: boolean) =>
    ['master', 'devices', siteId, includeInactive] as const,
  tags: (deviceId: number, includeInactive: boolean) =>
    ['master', 'tags', deviceId, includeInactive] as const,
  tag: (tagId: number) => ['master', 'tag', tagId] as const,
  modbus: (deviceId: number) => ['master', 'modbus', deviceId] as const,
};

export type SignalAction =
  /** 접두 일치 무효화 */
  | { kind: 'query'; key: readonly unknown[] }
  /** 그 태그를 가진 설비의 최신값 쿼리 — 화면이 그 태그를 들고 있을 때만 다시 부른다 */
  | { kind: 'realtimeTag'; tagId: number }
  /** 자기 user_id면 "다시 로그인하면 반영" 안내만(S7) */
  | { kind: 'permNotice'; userId: number };

const PATTERNS: readonly [RegExp, (m: RegExpExecArray) => SignalAction[]][] = [
  [
    /^cache:tagmeta:(\d+)$/,
    (m) => {
      const tagId = Number(m[1]);
      return [
        { kind: 'query', key: ['master', 'tags'] },
        { kind: 'query', key: masterKeys.tag(tagId) },
        { kind: 'realtimeTag', tagId },
        { kind: 'query', key: ['alarm', 'rules'] },
      ];
    },
  ],
  [
    /^cache:devlist:(\d+)$/,
    (m) => [
      { kind: 'query', key: ['master', 'devices', Number(m[1])] },
      // 같은 사이트 설비의 접속 설정 — 설비 → 사이트를 화면이 모르므로 접속 설정 조회 전부(no-store라 재조회 비용만)
      { kind: 'query', key: ['master', 'modbus'] },
    ],
  ],
  [/^cache:alarmrules$/, () => [{ kind: 'query', key: ['alarm', 'rules'] }]],
  [/^cache:perm:(\d+)$/, (m) => [{ kind: 'permNotice', userId: Number(m[1]) }]],
];

/** 신호 키 4종 → 동작. 모르는 키는 버린다(계약 밖 키로 아무 쿼리나 지우지 않는다) */
export function actionsForSignal(keys: readonly string[]): SignalAction[] {
  const out: SignalAction[] = [];
  for (const k of keys) {
    for (const [re, f] of PATTERNS) {
      const m = re.exec(k);
      if (m) {
        out.push(...f(m));
        break;
      }
    }
  }
  return out;
}

/** 재연결 직후 — 끊긴 동안 놓친 신호를 master 계열 1회 무효화로 메운다(Pub/Sub은 전달을 보장하지 않는다) */
export const RECONNECT_ACTIONS: readonly SignalAction[] = [{ kind: 'query', key: masterKeys.all }];
