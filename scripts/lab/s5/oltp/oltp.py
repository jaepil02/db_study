#!/usr/bin/env python3
"""S5 역방향 대조 러너(EXP-40~44 · 업무 워크로드를 ClickHouse에) 본체.

정본
- 설계: docs/05_data_stores/10_olap_vs_rdb_control.md §역방향 대조 — 업무 워크로드(실험의 모양 · 변형과 판정 지표 · 업무 규모 격자 ·
  그래뉼 변형 판정 · ClickHouse 변형의 설정 · 공정성 규칙 10 · 역방향 측정 조건 · 기계 판독 블록 제안)
- DDL: docs/05_data_stores/03_clickhouse_schema.md §업무 대조 테이블(infra/clickhouse/ddl/009)
- 실행: docs/10_observability/06_experiment_catalog.md EXP-40~44 · 기록: docs/10_observability/04_experiment_protocol.md(반복과 폐기 · reverse 필드)

진입점은 oltp.sh다(저장소 루트로 cd · 이미지 확인 · Compose 명령 문자열을 환경변수 OCOMPOSE로 넘긴다).
측정은 도구 컨테이너(oltp-lab 서비스 · CPU 11-12)의 dist/oltp-lab.js가 한다 — 이 러너는 하위 명령 하나 = 실행기 호출 하나(10분 미만)로 쪼개고
원시 jsonl(OLTP_DIR/oltp.jsonl) · 상태 파일(state.json)을 남긴다. 저장소 CLI(docker exec)는 조건 기록 · VACUUM ANALYZE · 부재 확인에만 쓴다.
비밀을 읽지 않는다 — 실행기 접속은 Compose 치환(.env)으로만 흐른다. 백그라운드 프로세스를 두지 않는다.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import shlex
import statistics
import subprocess
import sys
import time
from pathlib import Path

CH = 'db_study-clickhouse-1'
PG = 'db_study-postgres-1'
UTC = dt.timezone.utc
SCALES = (10_000, 100_000, 1_000_000)
CALL_LIMIT_SEC = 570            # 호출당 10분 미만
CONTAINER_OVERHEAD_SEC = 60     # compose run 기동 · 접속 · 조건 기록 · 종료 여유 — 실행기 예산은 호출 한도에서 이것을 뺀 값
EXP40_BUDGET_SEC = CALL_LIMIT_SEC - CONTAINER_OVERHEAD_SEC   # 실행기 --budget-sec(M3 — 넘을 몫은 null + budget_exhausted)
LAB_DBS = ('lab_oltp_g256', 'lab_oltp_probe')   # 실행 범위 실험 DB — 스냅샷 전 부재 확인(05_data_stores/10 §그래뉼 변형 판정 ②)
SPREAD_LIMIT = float(os.environ.get('SPREAD_LIMIT', '0.2'))    # 편차 폐기 기준(2계층 · 04_experiment_protocol 현행 참고 20%)
TOOL_CPU_SATURATED = float(os.environ.get('TOOL_CPU_SATURATED', '0.9'))   # 도구 CPU 포화 창 문턱(공정성 규칙 10 · 2계층)

EXPS = {
    'exp40': {'id': 'EXP-40', 'variants': ('pg', 'ch_alter_async', 'ch_alter_sync', 'ch_lwu', 'ch_rmt')},
    'exp41': {'id': 'EXP-41', 'variants': ('pg', 'ch_g8192', 'ch_g256')},
    'exp42': {'id': 'EXP-42', 'variants': ('pg', 'ch_lwu')},
    'exp43': {'id': 'EXP-43', 'variants': ('pg', 'ch_mt', 'ch_rmt', 'ch_mt_dedup')},   # ch_mt_dedup — ⓓ만 · 윈도우 N + 토큰(W1 검수)
    'exp44': {'id': 'EXP-44', 'variants': ('pg', 'pg_sync_on', 'ch_sync', 'ch_async')},
}
CONCURRENCY_41 = (1, 8, 32)
UPDATE_PARALLEL_MODES = ('auto', 'sync')   # EXP-42 ClickHouse 두 팔(W1 검수 판정)
RATES_44 = (50, 200, 500)

# 2계층 기본 인자(실행기 소유 · 기록 조건 칸) — 호출 하나가 10분 안에 끝나게 변형별로 잡는다.
# ch_rmt의 plain 판독은 옛 버전이 머지로 사라질 때까지 폴링하므로 상한을 짧게 둔다(상한 안 미관측으로 센다).
# EXP-40은 폴링 최악(N × 상한 × (간격 + 왕복))이 호출 한도를 넘을 수 있어 실행기 총 예산(--budget-sec)이 자른다(M3).
# --converge both — 한 호출 안에서 after_wait(자연 대기) · after_force(강제) 두 라벨(M1 · 두 번 부르지 않는다).
RUN_DEFAULTS: dict[tuple[str, str | None], list[str]] = {
    ('exp40', None): ['--n', '100', '--poll-interval-ms', '5', '--poll-max', '2000', '--converge', 'both', '--settle-max-sec', '120',
                      '--budget-sec', str(EXP40_BUDGET_SEC)],
    ('exp40', 'ch_rmt'): ['--n', '50', '--poll-interval-ms', '5', '--poll-max', '200', '--converge', 'both', '--settle-max-sec', '120',
                          '--budget-sec', str(EXP40_BUDGET_SEC)],
    ('exp41', None): ['--queries', '2000', '--warmup', '2000', '--explain-sample', '20'],
    ('exp42', None): ['--inject', '20', '--pairs', '20'],
    ('exp43', None): ['--k', '8', '--converge', 'both', '--settle-max-sec', '120', '--final-repeat', '10'],
    # 커넥션 수 · 동시 요청 상한은 두 저장소 같은 값(공정성 규칙 1 · W1 검수 판정)
    ('exp44', None): ['--duration', '60', '--concurrency', '16', '--inflight', '64'],
    ('exp43', 'ch_mt_dedup'): ['--dedup-window', '100'],
}
# ClickHouse 대조 테이블 상태를 바꾸는 실행 — 다음 exp40 · exp41 ClickHouse 변형은 reset clickhouse 뒤에만(공정성 규칙 9)
CH_MUTATING = {'exp40', 'exp42', 'exp43'}
# 서버 기본값으로 기록할 ClickHouse 설정 — 실행기 oltp-stores.ts CH_RECORDED_SETTINGS와 같은 목록(경량 UPDATE Beta · patch 적용 ·
# 동시 UPDATE 일관성 · async insert 플러시 시점 · 중복 제거 토큰 — 값은 바꾸지 않고 읽기만 · W1 검수 판정)
CH_RECORDED_SETTINGS = (
    'mutations_sync', 'apply_mutations_on_fly', 'enable_lightweight_update', 'allow_experimental_lightweight_update',
    'apply_patch_parts', 'update_parallel_mode', 'async_insert', 'wait_for_async_insert', 'wait_for_async_insert_timeout',
    'async_insert_busy_timeout_ms', 'async_insert_busy_timeout_max_ms', 'async_insert_busy_timeout_min_ms',
    'async_insert_use_adaptive_busy_timeout', 'async_insert_busy_timeout_increase_rate', 'async_insert_busy_timeout_decrease_rate',
    'async_insert_max_data_size', 'async_insert_max_query_number', 'async_insert_poll_timeout_ms', 'async_insert_deduplicate',
    'insert_deduplicate', 'insert_deduplication_token', 'max_threads', 'use_query_condition_cache', 'use_uncompressed_cache',
)
CAPACITY_TIER_NA = '해당 없음'   # 역방향은 용량 티어 축 밖(업무 규모 단계가 축) — 판독기 계약은 문자열
CH_NEEDS_CLEAN = {'exp40', 'exp41'}

OLTP_DIR = Path(os.environ.get('OLTP_DIR', 'snapshots/lab-s5-oltp'))
STATE = OLTP_DIR / 'state.json'


# ───────────────────────── 공용 ─────────────────────────

def die(msg: str) -> None:
    print(f'오류: {msg}', file=sys.stderr)
    sys.exit(1)


def iso(t: dt.datetime) -> str:
    return t.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%S.') + f'{t.microsecond // 1000:03d}Z'


def now_iso() -> str:
    return iso(dt.datetime.now(UTC))


def run(cmd: list[str], *, input_text: str | None = None, check: bool = True, timeout: int | None = None) -> subprocess.CompletedProcess:
    p = subprocess.run(cmd, input=input_text, capture_output=True, text=True, timeout=timeout)
    if check and p.returncode != 0:
        sys.stderr.write(p.stdout[-4000:] + p.stderr[-4000:])
        die(f'명령 실패({p.returncode}): {" ".join(cmd[:8])} …')
    return p


def chq(sql: str, fmt: str = 'TSV') -> str:
    return run(['docker', 'exec', CH, 'clickhouse-client', '--format', fmt, '-q', sql]).stdout


def pgq(sql: str) -> str:
    return run(['docker', 'exec', '-u', 'postgres', PG, 'psql', '-d', 'plc', '-XAtq', '-v', 'ON_ERROR_STOP=1',
                '-F', '\t', '-c', sql]).stdout


def compose_cmd() -> list[str]:
    s = os.environ.get('OCOMPOSE')
    if not s:
        die('OCOMPOSE 환경변수가 없다 — oltp.sh로 부른다')
    return shlex.split(s)


def load_state() -> dict:
    if not STATE.exists():
        die(f'{STATE} 가 없다 — 먼저 init')
    return json.loads(STATE.read_text())


def save_state(st: dict) -> None:
    OLTP_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=1))
    tmp.replace(STATE)


def out_path() -> Path:
    p = Path(os.environ.get('OUT', str(OLTP_DIR / 'oltp.jsonl')))
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def emit(line: dict) -> None:
    line = {'at': now_iso(), **line}
    with out_path().open('a') as f:
        f.write(json.dumps(line, ensure_ascii=False) + '\n')


def git_head() -> dict:
    h = run(['git', 'rev-parse', '--short', 'HEAD']).stdout.strip()
    dirty = run(['git', 'status', '--porcelain', '--', 'apps/api', 'packages', 'infra', 'scripts/lab/s5']).stdout.strip() != ''
    return {'commitHash': h, 'dirty': dirty}


def container_res(name: str) -> dict:
    o = run(['docker', 'inspect', name, '--format', '{{.HostConfig.CpusetCpus}} {{.HostConfig.Memory}} {{.State.Status}}']).stdout.split()
    return {'cpuset': o[0], 'memBytes': int(o[1]), 'state': o[2]}


def control_resources_ok(res: dict) -> list[str]:
    """대조 실험 자원 조건(04_architecture/03 §대조 실험 배치 · 09_tech_stack/04 §대조 실험 메모리 조건 · 공정성 규칙 2)."""
    bad = []
    if res['clickhouse']['cpuset'] != '5-7' or res['clickhouse']['memBytes'] != 3584 * 2**20:
        bad.append(f"clickhouse cpuset {res['clickhouse']['cpuset']} · mem {res['clickhouse']['memBytes']} (기대 5-7 · 3584m)")
    if res['postgres']['cpuset'] != '8-10' or res['postgres']['memBytes'] != 3584 * 2**20:
        bad.append(f"postgres cpuset {res['postgres']['cpuset']} · mem {res['postgres']['memBytes']} (기대 8-10 · 3584m)")
    return bad


def lab_dbs_present() -> list[str]:
    names = ','.join(f"'{d}'" for d in LAB_DBS)
    return [x for x in chq(f'SELECT name FROM system.databases WHERE name IN ({names})').split() if x]


def dedup_window_drift() -> list[str]:
    """plc 대조 테이블에 실행 범위 설정(중복 제거 윈도우)이 남았는가 — ch_mt_dedup이 도중에 죽으면 남는다."""
    out = chq("""SELECT name, engine_full FROM system.tables WHERE database = 'plc'
  AND name IN ('work_order_control','work_order_control_rmt','production_log_control')""")
    return [ln.split('\t')[0] for ln in out.splitlines() if 'non_replicated_deduplication_window' in ln]


def guard_clean_schema() -> None:
    present = lab_dbs_present()
    if present:
        die(f'실행 범위 실험 DB가 남아 있다: {present} — 앞 실행 잔재를 확인하고 DROP DATABASE 한 뒤 다시')
    drift = dedup_window_drift()
    if drift:
        die(f'plc 대조 테이블에 중복 제거 윈도우 설정이 남아 있다: {drift} — ALTER TABLE plc.<t> RESET SETTING non_replicated_deduplication_window 뒤 다시')


def parse_scale(s: str) -> int:
    try:
        v = int(s.replace('_', ''))
    except ValueError:
        v = -1
    if v not in SCALES:
        die(f'규모 {s} — {" · ".join(map(str, SCALES))}')
    return v


# ───────────────────────── 실행기 호출 ─────────────────────────

def json_lines(text: str) -> tuple[list[dict], int]:
    """'{'로 시작하는 줄을 JSON으로 — 줄마다 따로 읽고 잘린 줄(한도에 끊긴 마지막 줄 등)은 건너뛰어 그 수를 센다(N4)."""
    got: list[dict] = []
    skipped = 0
    for ln in text.splitlines():
        if not ln.startswith('{'):
            continue
        try:
            got.append(json.loads(ln))
        except json.JSONDecodeError:
            skipped += 1
    return got, skipped


def executor(args: list[str], timeout: int = CALL_LIMIT_SEC) -> tuple[list[dict], int, float]:
    """도구 컨테이너 한 번 — JSON 줄 목록 · 종료 코드 · 벽시계 초. 메모리 프로파일 · 워커 수는 compose.load.yml의 oltp-lab 덮어쓰기
    (MEMORY_PROFILE load · WORKER_POOL_SIZE 1)가 준다 — run -e로 같은 값을 한 번 더 싣는 것은 덮어쓰기 파일이 빠진 호출에서도
    측정 기록 4요소의 memoryProfile이 같게 하려는 이중 고정이다.
    한도를 넘기면 그때까지의 표준 출력(JSON 줄)을 원시에 executor_timeout으로 남긴 뒤 멈춘다 — 잘린 줄은 건너뛰고 수를 센다(N4).
    이것은 마지막 보루다 — 실행기는 측정 줄을 끝에서만 출력하므로 받은 줄이 없을 수 있다 · 실제 보호는 실행기 예산 가드(--budget-sec · M3)."""
    cmd = compose_cmd() + ['--profile', 'oltp-lab', 'run', '--rm', '--no-deps',
                           '-e', 'MEMORY_PROFILE=load', '-e', 'WORKER_POOL_SIZE=1',
                           'oltp-lab', 'node', 'dist/oltp-lab.js'] + args
    t0 = time.time()
    try:
        p = run(cmd, check=False, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        partial = e.stdout.decode(errors='replace') if isinstance(e.stdout, bytes) else (e.stdout or '')
        got, skipped = json_lines(partial)
        emit({'kind': 'executor_timeout', 'args': args, 'timeoutSec': timeout, 'wallSec': round(time.time() - t0, 1),
              'partial': got, 'skippedLines': skipped})
        die(f'실행기가 {timeout}초를 넘었다(받은 {len(got)}줄은 원시에 executor_timeout으로) — 2계층 인자(N · 폴링 상한 · '
            '조회 수 · 구간 길이 · --budget-sec)를 줄여 다시 부른다 · 남은 도구 컨테이너가 있으면 docker ps로 확인')
    wall = time.time() - t0
    lines, skipped = json_lines(p.stdout)
    if p.returncode not in (0, 2) or not lines or skipped:
        sys.stderr.write(p.stdout[-4000:] + p.stderr[-4000:])
        emit({'kind': 'executor_failed', 'args': args, 'exitCode': p.returncode, 'wallSec': round(wall, 1),
              'partial': lines, 'skippedLines': skipped, 'stderrTail': p.stderr[-2000:]})
        die(f'실행기 실패(종료 {p.returncode}): {" ".join(args[:6])}')
    return lines, p.returncode, wall


def run_args(exp: str, variant: str, extra: list[str]) -> list[str]:
    """변형 기본 인자 + 호출자 인자(뒤가 이긴다 — 실행기는 같은 이름의 첫 값을 읽으므로 호출자 인자를 앞에 둔다)."""
    base = RUN_DEFAULTS.get((exp, variant)) or RUN_DEFAULTS.get((exp, None), [])
    given = {extra[i] for i in range(0, len(extra), 2) if extra[i].startswith('--')}
    kept: list[str] = []
    for i in range(0, len(base), 2):
        if base[i] not in given:
            kept += base[i:i + 2]
    return extra + kept


# ───────────────────────── 하위 명령 ─────────────────────────

def engine_env() -> dict:
    names_ch = ','.join(f"'{n}'" for n in CH_RECORDED_SETTINGS)
    ch_settings = chq(f'SELECT name, value, changed FROM system.settings WHERE name IN ({names_ch}) ORDER BY name')
    server = chq("SELECT name, value FROM system.server_settings WHERE name IN ('max_concurrent_queries','background_pool_size') ORDER BY name")
    tables = chq("""SELECT name, engine_full FROM system.tables WHERE database = 'plc'
  AND name IN ('work_order_control','work_order_control_rmt','production_log_control') ORDER BY name""")
    names = ('server_version', 'synchronous_commit', 'shared_buffers', 'max_connections', 'autovacuum', 'autovacuum_naptime',
             'wal_level', 'fsync', 'full_page_writes', 'jit', 'max_wal_size', 'checkpoint_timeout')
    rows = pgq("SELECT name, current_setting(name) FROM pg_settings WHERE name IN (%s) ORDER BY name" % ','.join(f"'{n}'" for n in names))
    tsv = lambda s: [ln.split('\t') for ln in s.strip().splitlines() if ln]  # noqa: E731
    return {'clickhouse': {'version': chq('SELECT version()').strip(), 'settings': tsv(ch_settings), 'server': tsv(server),
                           'tables': tsv(tables), **container_res(CH)},
            'postgres': {**dict(tsv(rows)), **container_res(PG)}}


def cmd_init(args: list[str]) -> None:
    """상태 초기화 · 자원 조건 · 서버 버전과 설정 · 판별 대상 4(실행기 probe — plc 밖 탐침 DB)를 원시에 남긴다."""
    seed = int(args[args.index('--seed') + 1]) if '--seed' in args else 42
    inprog = float(args[args.index('--in-progress') + 1]) if '--in-progress' in args else 0.5
    if STATE.exists() and os.environ.get('FORCE') != '1':
        die(f'{STATE} 가 이미 있다 — 새 실행이면 OLTP_DIR을 바꾸거나 FORCE=1')
    env = engine_env()
    bad = control_resources_ok(env)
    if bad and os.environ.get('ALLOW_RESOURCES') != '1':
        die('대조 자원 조건이 아니다(task up CONTROL=1): ' + ' / '.join(bad))
    if len(env['clickhouse']['tables']) != 3:
        die('plc 업무 대조 테이블 3이 없다 — migrate(009) 먼저')
    guard_clean_schema()
    lines, _, wall = executor(['probe'])
    probe = next((x for x in lines if x.get('kind') == 'probe'), None)
    st = {'createdAt': now_iso(), 'seed': seed, 'inProgress': inprog, 'git': git_head(), 'env': env, 'resourcesBad': bad,
          'probe': probe['probe'] if probe else None,
          'run': {**(probe.get('run') or {}), 'capacityTier': CAPACITY_TIER_NA} if probe else None,
          'switches': probe.get('switches') if probe else None, 'scales': {}, 'runs': {}}
    save_state(st)
    emit({'kind': 'init', 'env': env, 'resourcesBad': bad, 'git': st['git'], 'wallSec': round(wall, 1)})
    if probe:
        emit({**probe, 'kind': 'probe'})
    print(json.dumps({'probe': st['probe'], 'resourcesBad': bad}, ensure_ascii=False, indent=1))


def cmd_fill(args: list[str]) -> None:
    st = load_state()
    k = parse_scale(args[0]) if args else die('fill <규모>')
    s = st['scales'].setdefault(str(k), {})
    if s.get('filled') and os.environ.get('FORCE') != '1':
        die(f'규모 {k}은 이미 채웠다 — 다른 규모는 그 규모의 빈 업무 테이블(빈 볼륨 · 채움 전 스냅샷)에서')
    n = int(pgq('SELECT count(*) FROM work_order').strip())
    if n != 0:
        die(f'work_order에 {n}행 — 빈 업무 테이블에서만 채운다(IDENTITY 1..N 공유 · 05_data_stores/10 §업무 규모 격자와 채우기)')
    lines, rc, wall = executor(['fill', '--scale', str(k), '--seed', str(st['seed']), '--in-progress', str(st['inProgress'])])
    out = lines[-1]
    s.update({'filled': rc == 0 and out.get('match'), 'fillAt': now_iso(), 'chDirty': False, 'pgDirty': False})
    save_state(st)
    emit({**out, 'kind': 'fill', 'wallSec': round(wall, 1)})
    print(json.dumps({k2: out.get(k2) for k2 in ('match', 'set', 'status', 'pgCopyMs', 'chInsertMs')}, ensure_ascii=False))
    if not s['filled']:
        die('두 저장소 (order_id · order_no) 집합 또는 상태 분포가 어긋났다 — 그 단계는 무효(빈 볼륨에서 다시)')


def pg_vacuum_analyze() -> float:
    t0 = time.time()
    pgq('VACUUM (ANALYZE) work_order, production_log, audit_log')
    return round(time.time() - t0, 1)


def cmd_settle(args: list[str]) -> None:
    """시작 상태 — PostgreSQL VACUUM ANALYZE · ClickHouse 대조 테이블 활성 파트 수렴(역방향 측정 조건 시작 상태 행)."""
    st = load_state()
    k = parse_scale(args[0]) if args else die('settle <규모> [최대 초]')
    max_sec = args[1] if len(args) > 1 else '240'
    vac = pg_vacuum_analyze()
    lines, _, wall = executor(['settle', '--max-sec', max_sec])
    out = lines[-1]
    s = st['scales'].setdefault(str(k), {})
    s['settledAt'] = now_iso()
    save_state(st)
    emit({**out, 'kind': 'settle', 'scale': k, 'pgVacuumAnalyzeSec': vac, 'wallSec': round(wall, 1)})
    print(json.dumps({'converged': out.get('converged'), 'waitedSec': out.get('waitedSec'), 'pgVacuumAnalyzeSec': vac}, ensure_ascii=False))
    if not out.get('converged'):
        die('ClickHouse 활성 파트가 상한 안에 수렴하지 않았다 — 다시 settle')


def cmd_snapshot(args: list[str]) -> None:
    """채움 스냅샷(리드 전용 · 컨테이너를 멈춘다) — 실험 DB 부재 확인 뒤 task snapshot · 재기동은 사람이."""
    st = load_state()
    k = parse_scale(args[0]) if args else die('snapshot <규모> [이름]')
    guard_clean_schema()   # 스냅샷에 들어가는 스키마는 순번 마이그레이션이 만든 것뿐이어야 한다
    name = args[1] if len(args) > 1 else f"oltp-s{k}-{st['git']['commitHash']}"
    run(['task', 'snapshot', f'NAME={name}'], timeout=CALL_LIMIT_SEC)
    st['scales'].setdefault(str(k), {})['snapshot'] = name
    save_state(st)
    emit({'kind': 'snapshot', 'scale': k, 'name': name})
    print(f'스냅샷 {name} — 컨테이너는 정지 상태다. 대조 조건으로 다시 띄운 뒤 settle {k}')


def cmd_reset(args: list[str]) -> None:
    """변형 사이 초기화 — clickhouse: 대조 테이블을 비우고 같은 행 벡터로 다시 채운 뒤 수렴 / all: 채움 스냅샷 복원(리드 전용) 뒤 settle."""
    st = load_state()
    k = parse_scale(args[0]) if args else die('reset <규모> clickhouse|all')
    what = args[1] if len(args) > 1 else 'clickhouse'
    s = st['scales'].setdefault(str(k), {})
    if what == 'clickhouse':
        lines, rc, wall = executor(['fill', '--scale', str(k), '--seed', str(st['seed']), '--in-progress', str(st['inProgress']),
                                    '--stores', 'clickhouse'])
        out = lines[-1]
        if rc != 0 or not out.get('match'):
            die('ClickHouse 다시 채우기가 PostgreSQL 집합 · 행 벡터 분포와 어긋났다')
        sl, _, _ = executor(['settle', '--max-sec', '240'])
        s['chDirty'] = False
        save_state(st)
        emit({**out, 'kind': 'reset', 'scale': k, 'what': what, 'settle': sl[-1], 'wallSec': round(wall, 1)})
        print(json.dumps({'match': out.get('match'), 'settle': sl[-1].get('converged')}, ensure_ascii=False))
        return
    if what != 'all':
        die('reset <규모> clickhouse|all')
    name = s.get('snapshot') or die(f'규모 {k}의 채움 스냅샷이 없다 — snapshot {k} 먼저')
    run(['task', 'restore', f'NAME={name}'], timeout=CALL_LIMIT_SEC)
    vac = pg_vacuum_analyze()
    sl, _, _ = executor(['settle', '--max-sec', '240'])
    s.update({'chDirty': False, 'pgDirty': False})
    save_state(st)
    emit({'kind': 'reset', 'scale': k, 'what': what, 'snapshot': name, 'pgVacuumAnalyzeSec': vac, 'settle': sl[-1]})
    print(json.dumps({'restored': name, 'settle': sl[-1].get('converged')}, ensure_ascii=False))


def pg_state() -> dict:
    """PostgreSQL 누적 상태(죽은 튜플 · 산 튜플 · WAL 누적) — PostgreSQL 변형 반복 사이 상태를 원시에(L1 · 공정성 규칙 9)."""
    rows = pgq("""SELECT relname, n_live_tup, n_dead_tup, n_tup_upd, autovacuum_count FROM pg_stat_user_tables
  WHERE relname IN ('work_order','production_log','audit_log') ORDER BY relname""")
    tables = {}
    for ln in rows.splitlines():
        if ln:
            name, live, dead, upd, av = ln.split('\t')
            tables[name] = {'liveTup': int(live), 'deadTup': int(dead), 'tupUpd': int(upd), 'autovacuumCount': int(av)}
    wal = pgq('SELECT wal_bytes FROM pg_stat_wal').strip()
    return {'tables': tables, 'walBytes': int(wal) if wal else None}


def run_key(exp: str, variant: str, scale: int, conc: int | None, rate: int | None, rep: int, arm: str | None = None) -> str:
    return f'{exp}:{variant}{":" + arm if arm else ""}:{scale}:c{conc or "-"}:r{rate or "-"}:{rep}'


def cmd_run(args: list[str]) -> None:
    """run <exp> <변형> <규모> <반복 0|1|2> [--concurrency c] [--rate r] [실행기 2계층 인자 …]"""
    st = load_state()
    if len(args) < 4:
        die('run <exp40..exp44> <변형> <규모> <반복 0|1|2> [인자 …]')
    exp, variant, k, rep = args[0], args[1], parse_scale(args[2]), int(args[3])
    extra = args[4:]
    if exp not in EXPS or variant not in EXPS[exp]['variants']:
        die(f'{exp} {variant} — ' + ' · '.join(f"{e}: {'/'.join(v['variants'])}" for e, v in EXPS.items()))
    if rep not in (0, 1, 2):
        die('반복은 0 · 1 · 2')
    opt = lambda n: int(extra[extra.index(n) + 1]) if n in extra else None  # noqa: E731
    conc, rate = opt('--concurrency'), opt('--rate')
    if exp == 'exp41' and conc not in CONCURRENCY_41:
        die(f'exp41은 --concurrency {"/".join(map(str, CONCURRENCY_41))}')
    if exp == 'exp44' and rate not in RATES_44:
        die(f'exp44는 --rate {"/".join(map(str, RATES_44))}')
    s = st['scales'].get(str(k), {})
    if not s.get('filled'):
        die(f'규모 {k}이 채워지지 않았다 — fill {k} · settle {k} 먼저')
    ch = variant.startswith('ch')
    if ch and exp in CH_NEEDS_CLEAN and s.get('chDirty') and os.environ.get('FORCE') != '1':
        die(f'ClickHouse 대조 테이블이 앞 실행({s.get("chDirtyBy")})의 상태를 담고 있다 — reset {k} clickhouse 뒤에 부른다(공정성 규칙 9)')
    guard_clean_schema()
    upm = extra[extra.index('--update-parallel-mode') + 1] if '--update-parallel-mode' in extra else None
    if exp == 'exp42' and variant.startswith('ch') and upm not in UPDATE_PARALLEL_MODES:
        die(f'exp42 ClickHouse는 --update-parallel-mode {"/".join(UPDATE_PARALLEL_MODES)}(두 팔 · W1 검수 판정)')
    key = run_key(exp, variant, k, conc, rate, rep, upm)
    if st['runs'].get(key, {}).get('done') and os.environ.get('FORCE') != '1':
        die(f'{key} 은 이미 했다 — 다시 하려면 FORCE=1(원시에 두 번 남는다 — collect는 마지막 실행을 쓴다)')
    full = run_args(exp, variant, ['--variant', variant, '--scale', str(k), '--rep', str(rep), '--seed', str(st['seed']),
                                   '--in-progress', str(st['inProgress'])] + extra)
    # 예산 검산(M3) — 실행기 예산 + 기동 여유가 호출 한도 안인가를 부르기 전에 확인하고 원시에 남긴다
    budget_check = None
    if exp == 'exp40':
        b = int(full[full.index('--budget-sec') + 1])
        budget_check = {'callLimitSec': CALL_LIMIT_SEC, 'budgetSec': b, 'overheadSec': CONTAINER_OVERHEAD_SEC,
                        'ok': b + CONTAINER_OVERHEAD_SEC <= CALL_LIMIT_SEC}
        if not budget_check['ok']:
            die(f'--budget-sec {b} + 기동 여유 {CONTAINER_OVERHEAD_SEC} > 호출 한도 {CALL_LIMIT_SEC} — 예산을 줄인다')
    # PostgreSQL 누적 상태(L1) — 앞 PostgreSQL 실행이 남긴 죽은 튜플 · WAL 위에서 재는지 경고하고 원시에 남긴다(막지 않는다)
    pg_dirty = None
    if not ch:
        pg_dirty = {'dirty': bool(s.get('pgDirty')), 'by': s.get('pgDirtyBy'), 'state': pg_state()}
        if pg_dirty['dirty']:
            print(f"경고: PostgreSQL이 앞 실행({pg_dirty['by']})의 누적 상태다 — 죽은 튜플 · WAL이 섞인다(공정성 규칙 9 · "
                  f"reset {k} all 뒤가 원칙) · detail.pgDirty에 기록", file=sys.stderr)
    lines, rc, wall = executor([exp] + full)
    measures = [x for x in lines if x.get('kind') == 'measure']
    det = next((x for x in lines if x.get('kind') == 'detail'), {})
    run_id = det.get('runId')
    for m in measures:
        emit({**m, 'kind': 'measure', 'key': key})
    emit({**det, 'kind': 'detail', 'key': key, 'wallSec': round(wall, 1), 'git': git_head(),
          'pgDirty': pg_dirty, 'budgetCheck': budget_check})
    if ch and exp in CH_MUTATING:
        s['chDirty'] = True
        s['chDirtyBy'] = key
    if not ch and exp in ('exp40', 'exp42', 'exp43', 'exp44'):
        s['pgDirty'] = True
        s['pgDirtyBy'] = key
    st['scales'][str(k)] = s
    st['runs'][key] = {'done': rc == 0, 'at': now_iso(), 'runId': run_id, 'wallSec': round(wall, 1), 'measures': len(measures)}
    save_state(st)
    for m in measures:
        print(f"{m['metric']:<32} {str(m.get('read') or ''):<28} {m.get('value')} {m.get('unit')}")
    print(f'— {key} · {len(measures)}줄 · {wall:.1f}초')


# ───────────────────────── collect ─────────────────────────

GROUP_KEYS = ('exp', 'op', 'store', 'variant', 'scale', 'concurrency', 'rate', 'read', 'metric', 'unit')


def spread(values: list[float]) -> float | None:
    """(최대 − 최소) ÷ 중앙값 — 중앙값 0이면 모두 0일 때만 0(04_experiment_protocol §반복과 폐기)."""
    if len(values) < 2:
        return None
    med = statistics.median(values)
    if med == 0:
        return 0.0 if max(values) == min(values) == 0 else None
    return (max(values) - min(values)) / abs(med)


def summarize(measures: list[dict]) -> list[dict]:
    """원시 측정 줄 → reverse 행. 같은 (key 제외 반복) 묶음에서 반복마다 마지막 실행을 쓴다 · 구조 지표는 중앙값 없이 3회 전부.
    EXP-41 도구 CPU 포화 반복은 분포 지표에서 뺀다(공정성 규칙 10) · 편차가 기준을 넘는 분포 지표에 spreadExceeded."""
    last: dict[tuple, dict] = {}
    for m in measures:
        g = tuple(m.get(k) for k in GROUP_KEYS) + (m.get('rep'),)
        last[g] = m   # 뒤 실행이 앞을 덮는다(FORCE 재실행)
    saturated = {(m.get('exp'), m.get('variant'), m.get('scale'), m.get('concurrency'), m.get('rep'))
                 for m in last.values() if m.get('metric') == 'tool_cpu' and (m.get('value') or 0) >= TOOL_CPU_SATURATED}
    groups: dict[tuple, dict[int, dict]] = {}
    for g, m in last.items():
        groups.setdefault(g[:-1], {})[m.get('rep')] = m
    rows = []
    for g, reps in sorted(groups.items(), key=lambda x: tuple(str(v) for v in x[0])):
        base = dict(zip(GROUP_KEYS, g))
        # unit bool(판정 칸)은 분포로 요약하지 않는다 — 구조처럼 3회 전부(N1 · 옛 원시의 converged 행 포함)
        structural = any(m.get('structural') or m.get('unit') == 'bool' for m in reps.values())
        values = [reps[r].get('value') if r in reps else None for r in (0, 1, 2)]
        row = {**{k: base[k] for k in ('exp', 'op', 'store', 'variant', 'scale', 'concurrency', 'rate', 'read', 'metric', 'unit')},
               'values': values, 'median': None}
        if structural:
            row['structural'] = True
        else:
            sat = [r for r in (0, 1, 2) if (base['exp'], base['variant'], base['scale'], base['concurrency'], r) in saturated]
            use = [v for r, v in enumerate(values) if v is not None and r not in sat]
            row['median'] = statistics.median(use) if use else None
            sp = spread(use) if len(use) == 3 else None
            row['spread'] = None if sp is None else round(sp, 4)
            # 반올림한 값으로 판정한다 — 부동소수 오차가 경계(20%)를 넘은 것으로 읽히지 않게
            if row['spread'] is not None and row['spread'] > SPREAD_LIMIT:
                row['spreadExceeded'] = True
            if sat:
                row['saturatedReps'] = sat
        rows.append(row)
    return rows


def cmd_collect(_args: list[str]) -> None:
    """원시 → 기록용 요약(reverse 블록 행 · 3회 중앙값 · 편차) — OLTP_DIR/oltp-summary.json."""
    src = out_path()
    if not src.exists():
        die(f'{src} 가 없다')
    measures = [json.loads(ln) for ln in src.read_text().splitlines() if ln.strip()]
    measures = [m for m in measures if m.get('kind') == 'measure']
    rows = summarize(measures)
    incomplete = [r for r in rows if any(v is None for v in r['values'])]
    exceeded = [r for r in rows if r.get('spreadExceeded')]
    st = json.loads(STATE.read_text()) if STATE.exists() else {}
    run_info = {**(st.get('run') or {}), 'capacityTier': CAPACITY_TIER_NA}
    out = {'generatedAt': now_iso(), 'run': run_info, 'switches': st.get('switches'),
           'conditions': {'capacityTier': CAPACITY_TIER_NA, 'seed': st.get('seed'), 'inProgress': st.get('inProgress'),
                          'env': st.get('env'), 'probe': st.get('probe')},
           'spreadLimit': SPREAD_LIMIT, 'toolCpuSaturated': TOOL_CPU_SATURATED,
           'reverse': rows, 'incomplete': len(incomplete), 'spreadExceeded': len(exceeded)}
    p = OLTP_DIR / 'oltp-summary.json'
    OLTP_DIR.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for r in rows:
        flag = ' ⚠편차' if r.get('spreadExceeded') else ''
        print(f"{r['exp']} {r['variant']:<15} {r['scale']:>8} c{r['concurrency']} r{r['rate']} {str(r['read'] or ''):<26} "
              f"{r['metric']:<32} {r['values']} → {r['median'] if not r.get('structural') else '(구조 · 3회 전부)'}{flag}")
    print(f'— {len(rows)}행 · 반복 미완 {len(incomplete)} · 편차 초과 {len(exceeded)} → {p}')


def cmd_status(_args: list[str]) -> None:
    st = load_state()
    print(json.dumps({'seed': st['seed'], 'inProgress': st['inProgress'], 'git': st['git'], 'resourcesBad': st['resourcesBad'],
                      'probe': st.get('probe'), 'scales': st['scales'],
                      'runs': {k: v.get('done') for k, v in sorted(st['runs'].items())},
                      'labDbsPresent': lab_dbs_present(), 'dedupWindowDrift': dedup_window_drift()}, ensure_ascii=False, indent=1))


COMMANDS = {'init': cmd_init, 'fill': cmd_fill, 'settle': cmd_settle, 'snapshot': cmd_snapshot, 'reset': cmd_reset,
            'run': cmd_run, 'collect': cmd_collect, 'status': cmd_status}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        die(f'하위 명령 — {" · ".join(COMMANDS)}')
    COMMANDS[sys.argv[1]](sys.argv[2:])
