// Prometheus 텍스트 형식의 작은 파서 — BFF(/bff/metrics)가 api /metrics를 읽어 S2 3계열만 요약한다.
// 파서 선택은 09_tech_stack/01 §미확인 · 미설계 등재("라이브러리 또는 직접 구현")였다 — 직접 구현을 택한다.
// 근거: S2가 읽는 것은 gauge · counter 샘플 줄(이름 · 레이블 · 값)뿐이고 히스토그램 · 요약의 구조 해석이 필요 없다.
// 라이브러리(prom-client는 생산자용 · 파서가 아니다)를 들이면 웹 의존성과 버전 고정표 행이 늘어 학습 대상이 아닌 층이 는다.
// 범위: # 주석 줄 무시 · name{k="v",...} value [timestamp] · 레이블 값 이스케이프(\\ \" \n) · NaN · ±Inf.

export interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

function parseValue(raw: string): number {
  switch (raw) {
    case 'NaN':
      return Number.NaN;
    case '+Inf':
    case 'Inf':
      return Number.POSITIVE_INFINITY;
    case '-Inf':
      return Number.NEGATIVE_INFINITY;
    default:
      return Number(raw);
  }
}

/** 레이블 블록 본문(중괄호 안)을 읽고 닫는 중괄호 다음 위치를 돌려준다 — 형식 위반이면 null */
function parseLabels(line: string, from: number): { labels: Record<string, string>; next: number } | null {
  const labels: Record<string, string> = {};
  let i = from;
  for (;;) {
    while (line[i] === ' ' || line[i] === ',') i++;
    if (line[i] === '}') return { labels, next: i + 1 };
    const eq = line.indexOf('=', i);
    if (eq < 0 || line[eq + 1] !== '"') return null;
    const key = line.slice(i, eq).trim();
    let j = eq + 2;
    let val = '';
    while (j < line.length && line[j] !== '"') {
      if (line[j] === '\\') {
        const c = line[j + 1];
        val += c === 'n' ? '\n' : (c ?? '');
        j += 2;
      } else {
        val += line[j];
        j++;
      }
    }
    if (j >= line.length) return null;
    labels[key] = val;
    i = j + 1;
  }
}

/** 텍스트 전체 → 샘플 배열. 읽을 수 없는 줄은 건너뛴다(한 줄 결함이 요약 전체를 지우지 않게) */
export function parsePrometheusText(text: string): MetricSample[] {
  const out: MetricSample[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const nameEnd = line.search(/[{\s]/);
    if (nameEnd <= 0) continue;
    const name = line.slice(0, nameEnd);
    let labels: Record<string, string> = {};
    let rest: string;
    if (line[nameEnd] === '{') {
      const parsed = parseLabels(line, nameEnd + 1);
      if (!parsed) continue;
      labels = parsed.labels;
      rest = line.slice(parsed.next);
    } else {
      rest = line.slice(nameEnd);
    }
    const valueToken = rest.trim().split(/\s+/)[0];
    if (valueToken === undefined || valueToken === '') continue;
    const value = parseValue(valueToken);
    if (Number.isNaN(value) && valueToken !== 'NaN') continue;
    out.push({ name, labels, value });
  }
  return out;
}

/**
 * EXP-CONSOLE용 S2 요약 — 웹 내부 계약(08_screen/07 §미확인 등재: BFF 해석 결과 모양은 웹 내부 계약).
 * 계열이 /metrics에 없으면 null — 화면이 "이 단계에서 아직 계측하지 않는다"로 그린다.
 */
export interface MetricsSummary {
  /** consumer_lag — 그룹 lag + pending(엔트리) */
  consumerLag: number | null;
  /** e2e_latency{quantile} — 초 · 최근 창 ingested_at − ts */
  e2e: { p50: number | null; p95: number | null; p99: number | null; rows: number | null } | null;
  /** gen_points_generated_total{mode="A"} 합(profile 전부) — 생성기 pps는 화면이 두 폴링 사이 차로 계산한다 */
  genPointsModeA: number | null;
}

export function summarizeS2(samples: readonly MetricSample[]): MetricsSummary {
  let consumerLag: number | null = null;
  const q: Record<string, number> = {};
  let e2eRows: number | null = null;
  let genA: number | null = null;
  for (const s of samples) {
    if (s.name === 'consumer_lag') consumerLag = s.value;
    else if (s.name === 'e2e_latency' && s.labels.quantile !== undefined) q[s.labels.quantile] = s.value;
    else if (s.name === 'e2e_latency_rows') e2eRows = s.value;
    else if (s.name === 'gen_points_generated_total' && s.labels.mode === 'A') genA = (genA ?? 0) + s.value;
  }
  const hasE2e = Object.keys(q).length > 0 || e2eRows !== null;
  return {
    consumerLag,
    e2e: hasE2e
      ? { p50: q['0.5'] ?? null, p95: q['0.95'] ?? null, p99: q['0.99'] ?? null, rows: e2eRows }
      : null,
    genPointsModeA: genA,
  };
}

/**
 * 생성기 pps — 두 폴링 사이 누적값 차 ÷ 경과 초.
 * 누적값이 줄면 재기동(카운터 0 복귀)이라 계산하지 않는다(08_screen/07 §전환 절차 — 재기동은 누적값을 0으로 되돌린다).
 */
export function ratePerSecond(
  prev: { value: number | null; atMs: number } | null,
  cur: { value: number | null; atMs: number },
): number | null {
  if (!prev || prev.value === null || cur.value === null) return null;
  const dt = (cur.atMs - prev.atMs) / 1000;
  if (dt <= 0 || cur.value < prev.value) return null;
  return (cur.value - prev.value) / dt;
}

// ── S5 — EXP-CONSOLE 메트릭 요약 확장(08_screen/07 §요소: 앱 · 파이프라인 요약 · 저장소 요약 · 키 계열별 메모리) ──
// 이름 · 레이블 정본은 10_observability/01_metrics_catalog.md다. 계열이 /metrics에 없으면 null — 카드가 "이 단계에서 아직 계측하지 않는다"로 그린다.
// 카운터(누적)는 누적값 그대로 내리고, 비율 · 초당 값은 화면이 두 폴링 사이 차로 계산한다(재기동 감지 규칙은 ratePerSecond와 같다).

/** 백프레셔 단계 값 → 이름(카탈로그 §레이블 — 0 정상 · 1 주의 · 2 경고 · 3 위험 · 4 복구) */
export const BACKPRESSURE_STAGE_NAMES = ['정상', '주의', '경고', '위험', '복구'] as const;

export function backpressureStageName(v: number): string {
  return BACKPRESSURE_STAGE_NAMES[v] ?? `알 수 없는 값 ${v}`;
}

/** 모드 C 거절 — 설계된 거절 중 모드 C 표면의 에러 코드(07_api/09 · 11_glossary/02) */
export const MODE_C_REJECT_CODE = 'datagen.stream_full';

/** 생성기 pps에 넣는 주입 모드 — standalone(단독 실행 경로)은 api /metrics에 싣지 않지만 섞이면 뺀다 */
const GEN_MODES = new Set(['A', 'B', 'C', 'D']);

export interface PostgresSummary {
  /** pg_connections{state} 합과 상태별 값 */
  connections: { total: number; byState: Record<string, number> } | null;
  /** pg_statement_top_mean_seconds{rank="1"} — 평균 시간 1위 문형(초) · 문형 텍스트는 싣지 않는다 */
  slowestMeanSec: number | null;
  lockWaits: number | null;
  bufferHitRatio: number | null;
  /** pg_xact_commit_total(누적) — TPS는 화면이 폴링 차로 */
  xactCommitTotal: number | null;
}

export interface ClickHouseSummary {
  /** ch_active_parts{table} — 합과 테이블별 */
  activeParts: { total: number; byTable: Record<string, number> } | null;
  mergesRunning: number | null;
  queryP95Sec: number | null;
  memoryTrackingBytes: number | null;
  diskFreeBytes: number | null;
  diskTotalBytes: number | null;
}

export interface RedisSummary {
  usedMemoryBytes: number | null;
  maxMemoryBytes: number | null;
  evictedKeysTotal: number | null;
  opsPerSec: number | null;
  /** redis_stream_length{stream} — 메모리 양 · 트리밍 감시 전용 · 적체 판정 금지(ADR-21) */
  streamLength: Record<string, number> | null;
}

export interface StoreCollect {
  /** obs_collect_last_success_timestamp_seconds{store} — epoch 초 */
  lastSuccessSec: number | null;
  /** obs_collect_errors_total{store} — 누적 */
  errorsTotal: number | null;
}

export interface ConsoleSummary extends MetricsSummary {
  /** ing_group_lag · ing_group_pending · ing_consumer_lag_unknown — 미확인 적체(= consumer_lag)의 두 성분 */
  unacked: { groupLag: number | null; pending: number | null; lagUnknown: boolean } | null;
  /** stream_trimmed_unacked(누적) — 0이어야 한다 */
  trimmedUnacked: number | null;
  /** backpressure_stage{publisher} */
  backpressure: { publisher: string; stage: number }[] | null;
  /** spool_active · spool_bytes · spool_drain_rate */
  spool: { active: boolean | null; bytes: number | null; drainRate: number | null } | null;
  /** dlq_count{reason}(누적) */
  dlq: { total: number; byReason: Record<string, number> } | null;
  /** tsq_cache_requests_total{result}(누적) — 히트율은 이 계열만 쓴다(카탈로그 §파생 지표) */
  cacheRequests: { hit: number; miss: number; error: number } | null;
  /** gen_points_generated_total{mode}(누적 · 모드 A~D) */
  genPointsByMode: Record<string, number> | null;
  /** http_designed_rejections_total{error_code="datagen.stream_full"}(누적) */
  modeCRejections: number | null;
  stores: {
    postgres: PostgresSummary | null;
    clickhouse: ClickHouseSummary | null;
    redis: RedisSummary | null;
  };
  collect: Record<'postgres' | 'clickhouse' | 'redis', StoreCollect>;
  /** redis_prefix_memory_bytes{prefix} — OBS-03(S6) · 없으면 null */
  keyMemory: Record<string, number> | null;
}

function addTo(rec: Record<string, number>, key: string, v: number) {
  rec[key] = (rec[key] ?? 0) + v;
}

const allNull = (o: object) => Object.values(o).every((v) => v === null);

export function summarizeConsole(samples: readonly MetricSample[]): ConsoleSummary {
  const base = summarizeS2(samples);
  let groupLag: number | null = null;
  let pending: number | null = null;
  let lagUnknown: boolean | null = null;
  let trimmedUnacked: number | null = null;
  const bp: { publisher: string; stage: number }[] = [];
  const spool = {
    active: null as boolean | null,
    bytes: null as number | null,
    drainRate: null as number | null,
  };
  const dlq: Record<string, number> = {};
  let hasDlq = false;
  const cache = { hit: 0, miss: 0, error: 0 };
  let hasCache = false;
  const gen: Record<string, number> = {};
  let modeC: number | null = null;
  const pgConn: Record<string, number> = {};
  let hasPgConn = false;
  const pg: PostgresSummary = {
    connections: null,
    slowestMeanSec: null,
    lockWaits: null,
    bufferHitRatio: null,
    xactCommitTotal: null,
  };
  const chParts: Record<string, number> = {};
  let hasChParts = false;
  const ch: ClickHouseSummary = {
    activeParts: null,
    mergesRunning: null,
    queryP95Sec: null,
    memoryTrackingBytes: null,
    diskFreeBytes: null,
    diskTotalBytes: null,
  };
  const redis: RedisSummary = {
    usedMemoryBytes: null,
    maxMemoryBytes: null,
    evictedKeysTotal: null,
    opsPerSec: null,
    streamLength: null,
  };
  const collect: ConsoleSummary['collect'] = {
    postgres: { lastSuccessSec: null, errorsTotal: null },
    clickhouse: { lastSuccessSec: null, errorsTotal: null },
    redis: { lastSuccessSec: null, errorsTotal: null },
  };
  const keyMem: Record<string, number> = {};
  let hasKeyMem = false;

  for (const s of samples) {
    const v = s.value;
    switch (s.name) {
      case 'ing_group_lag':
        groupLag = v;
        break;
      case 'ing_group_pending':
        pending = v;
        break;
      case 'ing_consumer_lag_unknown':
        lagUnknown = v === 1;
        break;
      case 'stream_trimmed_unacked':
        trimmedUnacked = (trimmedUnacked ?? 0) + v;
        break;
      case 'backpressure_stage':
        bp.push({ publisher: s.labels.publisher ?? '(레이블 없음)', stage: v });
        break;
      case 'spool_active':
        spool.active = v === 1;
        break;
      case 'spool_bytes':
        spool.bytes = v;
        break;
      case 'spool_drain_rate':
        spool.drainRate = v;
        break;
      case 'dlq_count':
        hasDlq = true;
        addTo(dlq, s.labels.reason ?? '(레이블 없음)', v);
        break;
      case 'tsq_cache_requests_total': {
        const r = s.labels.result;
        if (r === 'hit' || r === 'miss' || r === 'error') {
          hasCache = true;
          cache[r] += v;
        }
        break;
      }
      case 'gen_points_generated_total':
        if (s.labels.mode !== undefined && GEN_MODES.has(s.labels.mode)) addTo(gen, s.labels.mode, v);
        break;
      case 'http_designed_rejections_total':
        if (s.labels.error_code === MODE_C_REJECT_CODE) modeC = (modeC ?? 0) + v;
        break;
      case 'pg_connections':
        hasPgConn = true;
        addTo(pgConn, s.labels.state ?? '(레이블 없음)', v);
        break;
      case 'pg_statement_top_mean_seconds':
        if (s.labels.rank === '1') pg.slowestMeanSec = v;
        break;
      case 'pg_lock_waits':
        pg.lockWaits = v;
        break;
      case 'pg_buffer_hit_ratio':
        pg.bufferHitRatio = v;
        break;
      case 'pg_xact_commit_total':
        pg.xactCommitTotal = v;
        break;
      case 'ch_active_parts':
        hasChParts = true;
        addTo(chParts, s.labels.table ?? '(레이블 없음)', v);
        break;
      case 'ch_merges_running':
        ch.mergesRunning = v;
        break;
      case 'ch_query_duration_p95_seconds':
        ch.queryP95Sec = v;
        break;
      case 'ch_memory_tracking_bytes':
        ch.memoryTrackingBytes = v;
        break;
      case 'ch_disk_free_bytes':
        ch.diskFreeBytes = v;
        break;
      case 'ch_disk_total_bytes':
        ch.diskTotalBytes = v;
        break;
      case 'redis_used_memory_bytes':
        redis.usedMemoryBytes = v;
        break;
      case 'redis_maxmemory_bytes':
        redis.maxMemoryBytes = v;
        break;
      case 'redis_evicted_keys_total':
        redis.evictedKeysTotal = v;
        break;
      case 'redis_ops_per_sec':
        redis.opsPerSec = v;
        break;
      case 'redis_stream_length':
        redis.streamLength ??= {};
        addTo(redis.streamLength, s.labels.stream ?? '(레이블 없음)', v);
        break;
      case 'obs_collect_last_success_timestamp_seconds':
      case 'obs_collect_errors_total': {
        const st = s.labels.store;
        if (st === 'postgres' || st === 'clickhouse' || st === 'redis') {
          if (s.name === 'obs_collect_errors_total') collect[st].errorsTotal = v;
          else collect[st].lastSuccessSec = v;
        }
        break;
      }
      case 'redis_prefix_memory_bytes':
        hasKeyMem = true;
        addTo(keyMem, s.labels.prefix ?? '(레이블 없음)', v);
        break;
    }
  }

  if (hasPgConn) {
    pg.connections = { total: Object.values(pgConn).reduce((a, b) => a + b, 0), byState: pgConn };
  }
  if (hasChParts) {
    ch.activeParts = { total: Object.values(chParts).reduce((a, b) => a + b, 0), byTable: chParts };
  }
  const hasUnacked = groupLag !== null || pending !== null || lagUnknown !== null;
  return {
    ...base,
    unacked: hasUnacked ? { groupLag, pending, lagUnknown: lagUnknown === true } : null,
    trimmedUnacked,
    backpressure: bp.length > 0 ? bp.sort((a, b) => a.publisher.localeCompare(b.publisher)) : null,
    spool: allNull(spool) ? null : spool,
    dlq: hasDlq ? { total: Object.values(dlq).reduce((a, b) => a + b, 0), byReason: dlq } : null,
    cacheRequests: hasCache ? cache : null,
    genPointsByMode: Object.keys(gen).length > 0 ? gen : null,
    modeCRejections: modeC,
    stores: {
      postgres: allNull(pg) ? null : pg,
      clickhouse: allNull(ch) ? null : ch,
      redis: allNull(redis) ? null : redis,
    },
    collect,
    keyMemory: hasKeyMem ? keyMem : null,
  };
}

/**
 * 조회 캐시 히트율 — 두 폴링 사이 hit 증가 ÷ (hit + miss 증가)(카탈로그 §파생 지표 · tsq_cache_requests_total만).
 * 누적값이 줄면 재기동이라 계산하지 않는다 · 창 안 조회가 0건이면 null(0%로 그리지 않는다).
 */
export function cacheHitRatio(
  prev: { hit: number; miss: number } | null,
  cur: { hit: number; miss: number } | null,
): number | null {
  if (!prev || !cur) return null;
  const dh = cur.hit - prev.hit;
  const dm = cur.miss - prev.miss;
  if (dh < 0 || dm < 0 || dh + dm === 0) return null;
  return dh / (dh + dm);
}

/** 모드별 누적 합 — 생성기 pps 분자(모드 A~D 전부) */
export function sumModes(byMode: Record<string, number> | null): number | null {
  return byMode === null ? null : Object.values(byMode).reduce((a, b) => a + b, 0);
}
