// 역방향 대조 실행기(EXP-40~44) 인자 — 설계 정본 docs/05_data_stores/10_olap_vs_rdb_control.md §역방향 대조 — 업무 워크로드
// 변형은 스위치가 아니라 이 하위 동작 · --variant가 고른다(앱 코드 경로를 바꾸지 않는다 — 앱 밖 측정).
// 폴링 간격 · 상한 · 갱신 건수 N · 상태 분포 · 동시 완료 쌍 수 · 중복 K는 2계층(실행기 소유 · 기록 조건 칸)이다 — 기본값은 아래 상수.

export const SCALES = [10_000, 100_000, 1_000_000] as const;
export const EXPS = ['exp40', 'exp41', 'exp42', 'exp43', 'exp44'] as const;
export type Exp = (typeof EXPS)[number];

/**
 * EXP별 변형 — 검산: ClickHouse 변형 = 40 4 + 41 2 + 42 1 + 43 3 + 44 2 = 12(PostgreSQL 쪽 pg · pg_sync_on 별도)
 * EXP-43 ch_mt_dedup — ⓓ 재삽입만 · 실행 범위에서 non_replicated_deduplication_window N을 켜고 insert_deduplication_token 유 · 무로 잰 뒤 0으로 복원(W1 검수 판정)
 * EXP-42 ch_lwu는 update_parallel_mode auto(기본) · sync 두 팔 — 변형이 아니라 --update-parallel-mode 인자(W1 검수 판정)
 */
export const VARIANTS = {
  exp40: ['pg', 'ch_alter_async', 'ch_alter_sync', 'ch_lwu', 'ch_rmt'],
  exp41: ['pg', 'ch_g8192', 'ch_g256'],
  exp42: ['pg', 'ch_lwu'],
  exp43: ['pg', 'ch_mt', 'ch_rmt', 'ch_mt_dedup'],
  exp44: ['pg', 'pg_sync_on', 'ch_sync', 'ch_async'],
} as const satisfies Record<Exp, readonly string[]>;
export type Variant<E extends Exp = Exp> = (typeof VARIANTS)[E][number];

export const DEFAULTS = {
  seed: 42,
  /** 채움 상태 분포 — IN_PROGRESS 비율(나머지는 PLANNED 6 · COMPLETED 3 · CANCELLED 1 비) */
  inProgress: 0.5,
  /** EXP-40 반복당 갱신 건수 N(순차 · 동시성 1) */
  n40: 100,
  pollIntervalMs: 5,
  /** 폴링 횟수 상한 — 넘으면 "상한 안 미관측"으로 센다 */
  pollMax: 2000,
  /** 갱신 뒤 조회 R1(점조회 대상 N개) · R2(상태별 건수) 반복 수 */
  r2Repeat: 5,
  /** EXP-40 R2 예열 횟수 — 판독 단계 · 판독기마다 측정 전 R2를 이만큼 돌리고 버린다(역방향 측정 조건 캐시 행 "웜 — 예열 1회 뒤 반복") */
  readWarmup40: 1,
  /** 머지 수렴 대기 상한(초) · 표본 간격 */
  settleMaxSec: 120,
  settleIntervalSec: 2,
  /** EXP-40 한 호출의 총 시간 예산(초) — 오케스트레이터 호출 한도(570초)에서 컨테이너 기동 여유를 뺀 값 · 넘을 몫은 null + budgetExhausted */
  budgetSec40: 510,
  /** EXP-41 조회 수(동시성 무관 총수) · 예열 수(측정과 같은 순서의 앞부분 — 기본 한 바퀴 전부) */
  queries41: 2000,
  warmup41: 2000,
  /** EXP-41 서버 쪽 읽은 블록 표본(EXPLAIN ANALYZE BUFFERS) 수 */
  explainSample: 20,
  /** EXP-43 ch_mt_dedup — 실행 범위 중복 제거 윈도우 N */
  dedupWindow: 100,
  /** EXP-42 실패 주입 건수 · 동시 완료 쌍 수 */
  inject42: 20,
  pairs42: 20,
  /** EXP-43 같은 order_no 동시 삽입 수 K · FINAL 비용 반복 */
  k43: 8,
  finalRepeat: 10,
  /** EXP-44 요청률 구간 길이(초) · 최대 동시 요청(넘치면 누락으로 센다) */
  duration44: 60,
  inflight44: 64,
} as const;

export interface ConnOpts {
  /** ClickHouse 대상 데이터베이스(기본 plc) — 스모크는 lab_scratch_* */
  chDb: string;
  /** PostgreSQL search_path(기본 public) — 스모크는 임시 스키마 */
  pgSchema: string;
}

export interface FillArgs extends ConnOpts {
  action: 'fill';
  scale: number;
  seed: number;
  inProgress: number;
  /** both — 빈 업무 테이블 전제 · clickhouse — 대조 테이블만 비우고 다시 채운다(변형 사이 초기화) */
  stores: 'both' | 'clickhouse';
}
/** 채움 대조(쓰지 않는다) — 복원한 채움 스냅샷이 지금 코드의 행 벡터와 같은가(러너 adopt) */
export interface VerifyArgs extends ConnOpts {
  action: 'verify';
  scale: number;
  seed: number;
  inProgress: number;
}
export interface ProbeArgs extends ConnOpts {
  action: 'probe';
}
export interface SettleArgs extends ConnOpts {
  action: 'settle';
  maxSec: number;
  intervalSec: number;
}
export interface RunArgs extends ConnOpts {
  action: Exp;
  variant: string;
  scale: number;
  seed: number;
  inProgress: number;
  /** 반복 번호 0 · 1 · 2 — 대상 집합 창을 가른다 */
  rep: number;
  n: number;
  concurrency: number;
  rate: number | null;
  durationSec: number;
  pollIntervalMs: number;
  pollMax: number;
  queries: number;
  warmup: number;
  k: number;
  pairs: number;
  inject: number;
  /**
   * 머지 뒤 조회(EXP-40 · 43) — both: 한 호출 안에서 자연 대기 → 판독(after_wait) → 강제(APPLY PATCHES · OPTIMIZE FINAL ·
   * ALTER UPDATE는 mutation 완료 대기) → 판독(after_force) · skip: 머지 뒤 조회를 하지 않는다
   */
  converge: 'both' | 'skip';
  /** EXP-40 총 시간 예산(초) — 쓰기 · 폴링 · 머지 뒤 판독이 이 안에서 끝나게 자른다 */
  budgetSec: number;
  settleMaxSec: number;
  r2Repeat: number;
  /** EXP-40 R2 예열 횟수(측정에서 뺀다 · 서버 시간은 다른 log_comment라 섞이지 않는다) — 0이면 예열 없음 */
  readWarmup: number;
  finalRepeat: number;
  explainSample: number;
  /** EXP-42 ClickHouse 동시 UPDATE 일관성 팔 */
  updateParallelMode: 'auto' | 'sync';
  dedupWindow: number;
  /** EXP-44 동시 요청 상한(넘치면 누락) — 두 저장소 같은 값 · 기본 커넥션 수 × 4 */
  inflight: number;
}
export type OltpArgs = FillArgs | VerifyArgs | ProbeArgs | SettleArgs | RunArgs;

function arg(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} 값이 없다`);
  return v;
}

function intArg(argv: readonly string[], name: string, def: number, min: number, max: number): number {
  const raw = arg(argv, name);
  if (raw === null) return def;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`--${name} ${raw} — ${min}~${max} 정수`);
  return v;
}

function ratioArg(argv: readonly string[], name: string, def: number): number {
  const raw = arg(argv, name);
  if (raw === null) return def;
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0 || v >= 1) throw new Error(`--${name} ${raw} — 0과 1 사이(양 끝 제외)`);
  return v;
}

/** 식별자 인자 — SQL에 그대로 들어가므로 영문 · 숫자 · 밑줄만 */
function identArg(argv: readonly string[], name: string, def: string): string {
  const v = arg(argv, name) ?? def;
  if (!/^[a-z_][a-z0-9_]*$/.test(v)) throw new Error(`--${name} ${v} — 소문자 · 숫자 · 밑줄 식별자`);
  return v;
}

function scaleArg(argv: readonly string[], smoke: boolean): number {
  const raw = arg(argv, 'scale');
  if (raw === null) throw new Error('--scale 필요(10000 · 100000 · 1000000)');
  const v = Number(raw);
  // 스모크(plc 밖 대상)는 작은 규모를 허용한다 — 실측 격자는 3단계뿐이다
  if (
    smoke ? !(Number.isInteger(v) && v >= 100 && v <= 1_000_000) : !(SCALES as readonly number[]).includes(v)
  )
    throw new Error(`--scale ${raw} — ${smoke ? '100~1000000(스모크)' : SCALES.join(' · ')}`);
  return v;
}

export function parseOltpArgs(argv: readonly string[]): OltpArgs {
  const action = argv[2];
  const chDb = identArg(argv, 'ch-db', 'plc');
  const pgSchema = identArg(argv, 'pg-schema', 'public');
  const conn = { chDb, pgSchema };
  const smoke = chDb !== 'plc' || pgSchema !== 'public';
  if (smoke && (chDb === 'plc' || pgSchema === 'public'))
    throw new Error('--ch-db · --pg-schema는 함께 바꾼다(한쪽만 업무 테이블을 쓰면 비교가 아니다)');
  if (action === 'probe') return { action, ...conn };
  if (action === 'settle')
    return {
      action,
      ...conn,
      maxSec: intArg(argv, 'max-sec', DEFAULTS.settleMaxSec, 1, 540),
      intervalSec: intArg(argv, 'interval-sec', DEFAULTS.settleIntervalSec, 1, 60),
    };
  if (action === 'verify')
    return {
      action,
      ...conn,
      scale: scaleArg(argv, smoke),
      seed: intArg(argv, 'seed', DEFAULTS.seed, 0, 2 ** 31 - 1),
      inProgress: ratioArg(argv, 'in-progress', DEFAULTS.inProgress),
    };
  if (action === 'fill') {
    const stores = arg(argv, 'stores') ?? 'both';
    if (stores !== 'both' && stores !== 'clickhouse')
      throw new Error(`--stores ${stores} — both · clickhouse`);
    return {
      action,
      ...conn,
      scale: scaleArg(argv, smoke),
      seed: intArg(argv, 'seed', DEFAULTS.seed, 0, 2 ** 31 - 1),
      inProgress: ratioArg(argv, 'in-progress', DEFAULTS.inProgress),
      stores,
    };
  }
  if (!(EXPS as readonly string[]).includes(action ?? ''))
    throw new Error(`하위 동작 ${String(action)} — probe · fill · verify · settle · ${EXPS.join(' · ')}`);
  const exp = action as Exp;
  const variant = arg(argv, 'variant');
  const allowed = VARIANTS[exp] as readonly string[];
  if (!variant || !allowed.includes(variant))
    throw new Error(`--variant ${String(variant)} — ${exp}: ${allowed.join(' · ')}`);
  const converge = arg(argv, 'converge') ?? 'both';
  // natural · force 따로 부르면 같은 판독 라벨이 두 호출에 갈려 collect가 덮어쓴다 — 한 호출에 두 라벨(after_wait · after_force)
  if (converge !== 'both' && converge !== 'skip') throw new Error(`--converge ${converge} — both · skip`);
  const upm = arg(argv, 'update-parallel-mode') ?? 'auto';
  if (upm !== 'auto' && upm !== 'sync') throw new Error(`--update-parallel-mode ${upm} — auto · sync`);
  const rateRaw = arg(argv, 'rate');
  if (exp === 'exp44' && rateRaw === null) throw new Error('exp44는 --rate 필요(50 · 200 · 500 req/s)');
  return {
    action: exp,
    ...conn,
    variant,
    scale: scaleArg(argv, smoke),
    seed: intArg(argv, 'seed', DEFAULTS.seed, 0, 2 ** 31 - 1),
    inProgress: ratioArg(argv, 'in-progress', DEFAULTS.inProgress),
    rep: intArg(argv, 'rep', 0, 0, 2),
    n: intArg(argv, 'n', DEFAULTS.n40, 1, 100_000),
    concurrency: intArg(argv, 'concurrency', 1, 1, 256),
    rate: rateRaw === null ? null : intArg(argv, 'rate', 0, 1, 100_000),
    durationSec: intArg(argv, 'duration', DEFAULTS.duration44, 1, 540),
    pollIntervalMs: intArg(argv, 'poll-interval-ms', DEFAULTS.pollIntervalMs, 0, 10_000),
    pollMax: intArg(argv, 'poll-max', DEFAULTS.pollMax, 1, 1_000_000),
    queries: intArg(argv, 'queries', DEFAULTS.queries41, 1, 10_000_000),
    warmup: intArg(argv, 'warmup', DEFAULTS.warmup41, 0, 1_000_000),
    k: intArg(argv, 'k', DEFAULTS.k43, 2, 256),
    pairs: intArg(argv, 'pairs', DEFAULTS.pairs42, 1, 10_000),
    inject: intArg(argv, 'inject', DEFAULTS.inject42, 1, 10_000),
    converge,
    settleMaxSec: intArg(argv, 'settle-max-sec', DEFAULTS.settleMaxSec, 1, 540),
    budgetSec: intArg(argv, 'budget-sec', DEFAULTS.budgetSec40, 30, 3600),
    r2Repeat: intArg(argv, 'r2-repeat', DEFAULTS.r2Repeat, 1, 1000),
    readWarmup: intArg(argv, 'read-warmup', DEFAULTS.readWarmup40, 0, 100),
    finalRepeat: intArg(argv, 'final-repeat', DEFAULTS.finalRepeat, 1, 1000),
    explainSample: intArg(argv, 'explain-sample', DEFAULTS.explainSample, 0, 1000),
    updateParallelMode: upm,
    dedupWindow: intArg(argv, 'dedup-window', DEFAULTS.dedupWindow, 1, 1_000_000),
    inflight: intArg(argv, 'inflight', intArg(argv, 'concurrency', 1, 1, 256) * 4, 1, 4096),
  };
}

/**
 * 커넥션 배선(공정성 규칙 1) — 두 저장소 같은 수: 동시성 실험(41 · 44)은 --concurrency · EXP-43은 ⓐ 동시 삽입 K(리드 판정 L4) ·
 * 나머지는 순차라 작은 고정 풀. 판독 · 계기 커넥션은 따로(PostgreSQL 2 · ClickHouse 4 — EXP-40 판독기 두 개가 따로 폴링한다).
 */
export function connPlan(a: Pick<RunArgs, 'action' | 'concurrency' | 'k'>): {
  pgMax: number;
  chMax: number;
  pgAuxMax: number;
  chAuxMax: number;
} {
  const n = a.action === 'exp41' || a.action === 'exp44' ? a.concurrency : a.action === 'exp43' ? a.k : 4;
  return { pgMax: n, chMax: n, pgAuxMax: 2, chAuxMax: 4 };
}
