#!/usr/bin/env python3
"""S5 대조군 역전 지점 격자 러너(EXP-01~05) · 압축 대조 러너(EXP-35) 본체.

정본
- 설계: docs/05_data_stores/10_olap_vs_rdb_control.md(쿼리 5종 양쪽 SQL · 비교 축 6 · 격자 · 단계 절차 ①~⑥ · 측정 조건 8)
- 실행: docs/10_observability/06_experiment_catalog.md EXP-01~05 · EXP-35 · §대조 실험 조정값
- 기록: docs/10_observability/04_experiment_protocol.md §기계 판독 블록(points · axes)
- 계획 판정 2(5단계는 디스크 예산 성립 시만 · 6단계 없음) · 3(I1 → I2 빌드 → I2 → DROP) · 4(콜드 · 웜)

격자 2차(1차 기록 035~039 폐기 뒤 재측정 — 리드 판정)
- 적재 방향은 미래 방향(시간 순) 누적이다 — "구성을 고정하고 기간으로 키운다. 시스템이 실제로 쌓이는 순서 그대로"(§역전 지점 탐색 설계).
  시작 시각 S를 고정하고 점 p의 데이터 구간은 [S, S + D_p) · 쿼리 기준 시각 {end} = S + D_p. 1차(end 고정 · 과거 방향)는 파티션 물리 순서가
  시간과 어긋나 10^9에서 PostgreSQL 플래너가 BRIN을 포기했다(ts 상관 0.027). 1차 상태 파일(direction 없음)은 읽지 않는다.
- 정밀화는 적응형 로그 이분 2회다(L316 "로그 중점으로 두 번 나눈다" · 05_load_scenarios L27 "같은 규칙"). 교차 구간 (10^a, 10^(a+1)]에서
  m1 = 10^(a+1/2)를 재고, 역전이 든 반쪽의 로그 중점 m2 = 10^(a+1/4) 또는 10^(a+3/4)를 잰다. 어느 반쪽인지는 리드가 판정한다.
- 누적 격자에서 되돌아가려고 단계 1~4 끝에 채움 스냅샷을 뜬다(snapshot) — m1은 단계 a 스냅샷 복원 뒤 이어 채우고, m2 upper는 m1에서 이어 채우고,
  m2 lower는 다시 복원한다.

진입점은 grid.sh · exp35.sh다(저장소 루트로 cd · 이미지 확인 · Compose 명령 문자열을 환경변수로 넘긴다).
호출 하나는 10분 미만이 되게 작업을 하위 명령으로 쪼갰다. 백그라운드 프로세스를 두지 않는다 — 모든 자식은 같은 호출 안에서 끝난다.
비밀을 읽지 않는다 — 저장소 접속은 컨테이너 안 CLI(ClickHouse는 컨테이너 환경변수 계정 · PostgreSQL은 postgres OS 계정 peer)로만 한다.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import re
import shlex
import shutil
import statistics
import subprocess
import sys
import time
from pathlib import Path

CH = 'db_study-clickhouse-1'
PG = 'db_study-postgres-1'
KST = dt.timezone(dt.timedelta(hours=9))
UTC = dt.timezone.utc
TAGS_M = 10_000                 # M 티어 설비 50 × 태그 200 · 1 Hz — 행 수 = 1만 × 초(격자 표)
STAGES = (1, 2, 3, 4, 5)        # 6단계는 하지 않는다(계획 판정 2 · 보존 7일 판정)
SNAPSHOT_STAGES = (1, 2, 3, 4)  # 정밀화 구간의 아래 끝이 될 수 있는 단계 — 5단계 위 구간은 없다(6단계 없음)
REFINE_FRACS = {None: 0.5, 'lower': 0.25, 'upper': 0.75}   # 적응형 로그 이분 2회 — m1 · m2(아래 반쪽 · 위 반쪽)
RETENTION_SEC = 7 * 86400       # 원시 보존 7일(08_retention_lifecycle · 모드 D RAW_RETENTION_DAYS) — budget은 TTL을 다시 읽는다
START_MOD = 20                  # S ≡ 20초(mod 60) → S + 10^4 · S + 10^5(차 90000 = 1500분)가 분 경계(Q4 분 버킷 · tag_1m 대조 창)
START_SPLIT_SEC = 50_020        # 기본 S = KST 자정 − 50020초 → 5단계 [S, S + 10^5)가 자정 앞 13.89시간 · 뒤 13.88시간으로 갈린다
ALIGN_OVER_SEC = 3600           # D > 1시간이면 Q4 창 [end − 1h, end)가 S 뒤에서 시작한다 — 그때만 end가 분 경계여야 한다
MIN_CAMPAIGN_SEC = 2 * 86400    # init 시점 머리 만료까지 남은 시간의 하한(격자 1차 약 4.2시간 + 스냅샷 · 정밀화 여유)
DEFAULT_FILL_RATE = 100_000     # 속도 실측이 없을 때 조각 소요 추정(행/초) — 1차 최저 약 13만(1단계)보다 보수적
SNAPSHOT_RATE_BPS = 40 * 2**20  # 스냅샷 소요 추정(볼륨 바이트/초) — 실측 뒤 상태의 값으로 바뀐다
STORE_CONTAINERS = ('db_study-postgres-1', 'db_study-clickhouse-1', 'db_study-redis-1')
LOGICAL_ROW_BYTES = 41          # 공통 논리 크기 = 행 수 × 41 B(ClickHouse 컬럼 폭 합 · 비교 축 2)
DERIVED_HEAP_ROW = 76           # 대조군 용량 축 도출 — 힙 행 약 76 B
DERIVED_BTREE_ROW = 30          # btree(I2) 약 30 B
DERIVED_CH_ROW = 4              # EXP-35 원본 산정 행당 4 B — 실측 행당 값이 있으면 그것을 쓴다
CALL_LIMIT_SEC = 540            # 호출당 10분 미만 — 여유 60초
EXP_GRID = ['EXP-01', 'EXP-02', 'EXP-03', 'EXP-04', 'EXP-05']
QUERIES = ('Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q5x')   # Q5x = 조건 없는 count(보조 관찰 · EXP-05)
PROFILES = ('SINE', 'RANDOM_WALK', 'RAMP', 'STEP', 'BINARY', 'COUNTER', 'SPIKE', 'DROPOUT')
U = 2.0 ** -53

GRID_DIR = Path(os.environ.get('GRID_DIR', 'snapshots/lab-s5-grid-f'))   # 격자 2차(미래 방향) — 1차 snapshots/lab-s5-grid는 읽지 않는다
STATE = GRID_DIR / 'state.json'


# ───────────────────────── 공용 ─────────────────────────

def die(msg: str) -> None:
    print(f'오류: {msg}', file=sys.stderr)
    sys.exit(1)


def now_utc() -> dt.datetime:
    return dt.datetime.now(UTC)


def iso(t: dt.datetime) -> str:
    return t.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%S.') + f'{t.microsecond // 1000:03d}Z'


def parse_iso(s: str) -> dt.datetime:
    t = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    if t.tzinfo is None:
        die(f'시각에 시간대가 없다: {s}')
    return t


def kst_text(t: dt.datetime, ms: bool = True) -> str:
    k = t.astimezone(KST)
    return k.strftime('%Y-%m-%d %H:%M:%S') + (f'.{k.microsecond // 1000:03d}' if ms else '')


def run(cmd: list[str], *, input_text: str | None = None, check: bool = True) -> subprocess.CompletedProcess:
    p = subprocess.run(cmd, input=input_text, capture_output=True, text=True)
    if check and p.returncode != 0:
        sys.stderr.write(p.stdout[-4000:] + p.stderr[-4000:])
        die(f'명령 실패({p.returncode}): {" ".join(cmd[:6])} …')
    return p


def chq(sql: str, params: dict | None = None, fmt: str = 'TSV', extra: list[str] | None = None) -> str:
    cmd = ['docker', 'exec', CH, 'clickhouse-client', '--format', fmt]
    for k, v in (params or {}).items():
        cmd.append(f'--param_{k}={v}')
    cmd += (extra or []) + ['-q', sql]
    return run(cmd).stdout


def pgq(sql: str) -> str:
    return run(['docker', 'exec', '-u', 'postgres', PG, 'psql', '-d', 'plc', '-XAtq', '-v', 'ON_ERROR_STOP=1',
                '-F', '\t', '-c', sql]).stdout


def pg_script(script: str, check: bool = True) -> subprocess.CompletedProcess:
    return run(['docker', 'exec', '-i', '-u', 'postgres', PG, 'psql', '-d', 'plc', '-XAtq', '-v', 'ON_ERROR_STOP=1',
                '-F', '\t', '-f', '-'], input_text=script, check=check)


def compose_cmd(var: str) -> list[str]:
    s = os.environ.get(var)
    if not s:
        die(f'{var} 환경변수가 없다 — grid.sh · exp35.sh로 부른다')
    return shlex.split(s)


def load_state() -> dict:
    if not STATE.exists():
        die(f'{STATE} 가 없다 — 먼저 init')
    st = json.loads(STATE.read_text())
    if st.get('direction') != 'forward':
        die(f'{STATE} 는 격자 1차(end 고정 · 과거 방향) 상태다 — 이 러너는 미래 방향 격자만 다룬다. 새 GRID_DIR로 init '
            '(1차 재현은 커밋 19f8861의 러너)')
    return st


def save_state(st: dict) -> None:
    GRID_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=1))
    tmp.replace(STATE)


def out_path(default: str) -> Path:
    p = Path(os.environ.get('OUT', str(GRID_DIR / default)))
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def emit(line: dict, default_out: str = 'grid.jsonl') -> None:
    line = {'at': iso(now_utc()), **line}
    with out_path(default_out).open('a') as f:
        f.write(json.dumps(line, ensure_ascii=False) + '\n')
    print(json.dumps(line, ensure_ascii=False))


def median(xs: list[float]) -> float | None:
    return statistics.median(xs) if xs else None


def git_head() -> dict:
    h = run(['git', 'rev-parse', '--short', 'HEAD']).stdout.strip()
    dirty = run(['git', 'status', '--porcelain', '--', 'apps/api', 'packages', 'infra', 'scripts/lab/s5']).stdout.strip() != ''
    return {'commitHash': h, 'dirty': dirty}


def container_res(name: str) -> dict:
    o = run(['docker', 'inspect', name, '--format', '{{.HostConfig.CpusetCpus}} {{.HostConfig.Memory}} {{.State.Status}}']).stdout.split()
    return {'cpuset': o[0], 'memBytes': int(o[1]), 'state': o[2]}


def container_running(name: str) -> bool:
    p = run(['docker', 'inspect', name, '--format', '{{.State.Running}}'], check=False)
    return p.returncode == 0 and p.stdout.strip() == 'true'


def wait_stores(limit: int = 180) -> float:
    """두 저장소가 쿼리를 받을 때까지(재기동 직후) — 걸린 초."""
    t0 = time.time()
    ok_ch = ok_pg = False
    while time.time() - t0 < limit:
        if not ok_ch:
            ok_ch = run(['docker', 'exec', CH, 'clickhouse-client', '-q', 'SELECT 1'], check=False).returncode == 0
        if not ok_pg:
            ok_pg = run(['docker', 'exec', '-u', 'postgres', PG, 'psql', '-d', 'plc', '-XAtqc', 'SELECT 1'],
                        check=False).returncode == 0
        if ok_ch and ok_pg:
            return round(time.time() - t0, 1)
        time.sleep(1)
    die(f'저장소 재기동 대기 {limit}초 초과(clickhouse {ok_ch} · postgres {ok_pg})')
    return 0.0


def engine_env() -> dict:
    """측정 조건 — 병렬도(max_threads · 병렬 작업자) · 내구성 · 캐시 크기 · 자원(측정 조건 8)."""
    ch = chq("SELECT getSetting('max_threads'), getSetting('max_insert_block_size'), version()").split('\t')
    names = ('max_parallel_workers_per_gather', 'max_parallel_workers', 'max_worker_processes',
             'max_parallel_maintenance_workers', 'shared_buffers', 'effective_cache_size', 'work_mem',
             'maintenance_work_mem', 'synchronous_commit', 'jit', 'max_wal_size', 'checkpoint_timeout',
             'autovacuum_naptime', 'autovacuum_vacuum_insert_threshold', 'autovacuum_vacuum_insert_scale_factor')
    rows = pgq("SELECT name, current_setting(name) FROM pg_settings WHERE name IN (%s) ORDER BY name"
               % ','.join(f"'{n}'" for n in names))
    pg = dict(ln.split('\t') for ln in rows.strip().splitlines())
    return {'clickhouse': {'max_threads': ch[0].strip(), 'max_insert_block_size': ch[1].strip(), 'version': ch[2].strip(),
                           **container_res(CH)},
            'postgres': {**pg, **container_res(PG)}}


def control_resources_ok(res: dict) -> list[str]:
    """대조 실험 자원 조건(04_architecture/03 §대조 실험 배치 · 09_tech_stack/04 §대조 실험 메모리 조건)."""
    bad = []
    if res['clickhouse']['cpuset'] != '5-7' or res['clickhouse']['memBytes'] != 3584 * 2**20:
        bad.append(f"clickhouse cpuset {res['clickhouse']['cpuset']} · mem {res['clickhouse']['memBytes']} (기대 5-7 · 3584m)")
    if res['postgres']['cpuset'] != '8-10' or res['postgres']['memBytes'] != 3584 * 2**20:
        bad.append(f"postgres cpuset {res['postgres']['cpuset']} · mem {res['postgres']['memBytes']} (기대 8-10 · 3584m)")
    return bad


# ───────────────────────── 격자 기하 ─────────────────────────
# 점 id(pid) — 기본 단계 '1'~'5' · 정밀화 점 'r{행 수 지수}'(예: r8.5 = 10^8.5행 공칭 · r8.25 · r8.75).
# 원시의 stage 값 = 행 수 지수 − 4(단계 k는 정수 k · 정밀화 점은 4.5 · 4.25 · 4.75) — 판독기는 stage를 수로만 읽고 선은 rows로 그린다.
# 점 p의 데이터 구간은 [S, S + D_p) · 새로 채우는 구간은 [S + D_base, S + D_p) · 쿼리 기준 시각 {end} = S + D_p(미래 방향 누적).

def d_sec(k: int) -> int:
    """데이터 기간 D_k = 10^k 초(1만 태그 × 1 Hz → 10^(k+4)행)."""
    return 10 ** k if k > 0 else 0


def is_stage(pid: str) -> bool:
    return pid in {str(k) for k in STAGES}


def parse_pid(s: str) -> str:
    """'3' → '3' · 'r6.5' → 'r6.5'. 정밀화 점은 단계 j(1~4) 구간 (10^(j+4), 10^(j+5)]의 1/4 · 1/2 · 3/4 지수만."""
    if is_stage(s):
        return s
    m = re.fullmatch(r'r(\d)\.(5|25|75)', s)
    if not m or int(m.group(1)) - 4 not in SNAPSHOT_STAGES:
        die(f'점 {s!r} — 단계 1~5 또는 정밀화 점 r{{j+4}}.{{25|5|75}}(j = 1~4 · 예: r8.5)')
    return s


def refine_pid(j: int, side: str | None) -> str:
    return f'r{j + 4}.{str(REFINE_FRACS[side]).split(".")[1]}'


def point_exp(pid: str) -> float:
    """공칭 행 수 지수 — 단계 k는 k + 4 · 정밀화 점은 id의 지수."""
    return int(pid) + 4 if is_stage(pid) else float(pid[1:])


def stage_num(pid: str) -> int | float:
    """원시의 stage 값 — 단계는 정수 · 정밀화 점은 두 단계 사이의 소수(지수 − 4)."""
    return int(pid) if is_stage(pid) else point_exp(pid) - 4


def refine_d(e: float, start: dt.datetime) -> int:
    """정밀화 점의 데이터 기간(정수 초) — 반올림 규칙.
    ① 공칭 D* = 10^(e − 4)초(1만 태그 × 1 Hz). ② D* ≤ 1시간이면 가장 가까운 정수 초(.5는 올림) — 데이터가 Q4 창보다 짧아 창 시작이 S 앞이다.
    ③ D* > 1시간이면 end = S + D가 분 경계가 되는 초 가운데 가장 가까운 값(D ≡ −S mod 60) — Q4 분 버킷 · tag_1m 대조 창의 첫 분이 온전해야 한다.
    오차는 ③에서 최대 30초(10^8.25행 D ≈ 17783초에서 0.17% · 지수 0.0007)."""
    x = 10 ** (e - 4)
    if x <= ALIGN_OVER_SEC:
        return int(math.floor(x + 0.5))
    off = (-int(start.timestamp())) % 60
    return int(math.floor((x - off) / 60 + 0.5)) * 60 + off


def point_d(st: dict, pid: str) -> int:
    return d_sec(int(pid)) if is_stage(pid) else st['stages'][pid]['d']


def point_base(st: dict, pid: str) -> str | None:
    """앞 점 — 단계 k는 k − 1(1단계는 없음) · 정밀화 점은 등록 때 정한 base(m1 · m2 lower = 단계 j · m2 upper = m1)."""
    if is_stage(pid):
        return str(int(pid) - 1) if int(pid) > 1 else None
    return st['stages'][pid]['base']


def point_chain(st: dict, pid: str) -> list[str]:
    """pid에서 1단계까지 base를 따라간 점들 — 지금 테이블의 행은 이 점들의 조각 합이다."""
    out, p = [], pid
    while p is not None:
        out.append(p)
        p = point_base(st, p)
    return out


def start_of(st: dict) -> dt.datetime:
    return parse_iso(st['start'])


def point_end(st: dict, pid: str) -> dt.datetime:
    return start_of(st) + dt.timedelta(seconds=point_d(st, pid))


def fill_range(st: dict, pid: str) -> tuple[dt.datetime, dt.datetime]:
    """점 p가 새로 채우는 구간 [S + D_base, S + D_p)."""
    s, base = start_of(st), point_base(st, pid)
    return s + dt.timedelta(seconds=point_d(st, base) if base else 0), point_end(st, pid)


def default_chunk_sec(st: dict, pid: str) -> int:
    env = os.environ.get('FILL_CHUNK_SEC')
    if env:
        return int(env)
    if is_stage(pid):
        return {1: 10, 2: 90, 3: 900, 4: 3000, 5: 3600}[int(pid)]   # 4단계 3조각 · 5단계 25조각(1조각 3.6 × 10^7행)
    a, b = fill_range(st, pid)
    n = max(1, math.ceil((b - a).total_seconds() / 3600))           # 정밀화 — 조각 ≤ 3600초(3.6 × 10^7행) · 고르게
    return math.ceil((b - a).total_seconds() / n)


def chunks_of(st: dict, pid: str, chunk: int) -> list[tuple[dt.datetime, dt.datetime]]:
    a, b = fill_range(st, pid)
    out, t = [], a
    while t < b:
        u = min(t + dt.timedelta(seconds=chunk), b)
        out.append((t, u))
        t = u
    return out


def kst_day_split(a: dt.datetime, b: dt.datetime) -> list[dict]:
    res, t = [], a
    while t < b:
        k = t.astimezone(KST)
        nxt = (k.replace(hour=0, minute=0, second=0, microsecond=0) + dt.timedelta(days=1)).astimezone(UTC)
        u = min(nxt, b)
        res.append({'day': k.strftime('%Y-%m-%d'), 'sec': int((u - t).total_seconds()),
                    'rowsNominal': int((u - t).total_seconds()) * TAGS_M})
        t = u
    return res


def default_start(now: dt.datetime | None = None) -> dt.datetime:
    """시작 시각 S 선택 규칙 — S = M − 50020초(M = KST 자정).
    ① S ≡ 20초(mod 60) — 4 · 5단계 end(S + 10^4 · S + 10^5)가 분 경계.
    ② 5단계 [S, S + 10^5)가 자정 M 앞뒤로 약 반씩(13.89 · 13.88시간) — 최대 일 파티션이 가장 작다(1차 판정 ③과 같은 뜻).
    ③ M은 S + 10^5 ≤ 지금 − 60초를 만족하는 가장 늦은 KST 자정 — 모드 D는 미래 ts를 채우지 않는다.
    머리 만료(S + 7일)까지 남은 시간 = 7일 − (지금 − S) — ③에서 지금 − S는 약 1.16 ~ 2.16일이라 남은 시간은 4.8일 이상이다."""
    now = now or now_utc()
    latest = now - dt.timedelta(seconds=d_sec(5) - START_SPLIT_SEC + 60)
    m = latest.astimezone(KST).replace(hour=0, minute=0, second=0, microsecond=0)
    return (m - dt.timedelta(seconds=START_SPLIT_SEC)).astimezone(UTC)


def start_problems(start: dt.datetime, now: dt.datetime) -> list[str]:
    bad = []
    if start.microsecond or int(start.timestamp()) % 60 != START_MOD:
        bad.append(f'S의 초가 {START_MOD}(mod 60)가 아니다 — 4 · 5단계 end가 분 경계가 되지 않는다')
    if start + dt.timedelta(seconds=d_sec(5)) > now:
        bad.append('S + 10^5초(5단계 end)가 미래다 — 모드 D는 미래 ts를 채우지 않는다')
    remain = (start + dt.timedelta(seconds=RETENTION_SEC) - now).total_seconds()
    if remain < MIN_CAMPAIGN_SEC:
        bad.append(f'머리 만료(S + 7일)까지 {remain / 3600:.1f}시간 — 하한 {MIN_CAMPAIGN_SEC // 3600}시간(격자 · 스냅샷 · 정밀화 전부가 이 안에 끝나야 한다)')
    return bad


def plan_state(start: dt.datetime) -> dict:
    """저장소 없이 기하만 계산하는 임시 상태(plan · plan-refine)."""
    return {'direction': 'forward', 'start': iso(start), 'stages': {}}


def register_refine(st: dict, j: int, side: str | None) -> str:
    """정밀화 점 등록(상태에 d · base · refine) — 이미 있으면 그대로 둔다(d는 처음 계산값으로 고정)."""
    pid = refine_pid(j, side)
    if pid not in st['stages'] or 'd' not in st['stages'][pid]:
        e = j + 4 + REFINE_FRACS[side]
        d = refine_d(e, start_of(st))
        base = str(j) if side in (None, 'lower') else refine_pid(j, None)
        st['stages'].setdefault(pid, {}).update({
            'd': d, 'base': base,
            'refine': {'interval': [j, j + 1], 'intervalRows': [d_sec(j) * TAGS_M, d_sec(j + 1) * TAGS_M],
                       'step': 1 if side is None else 2, 'side': side, 'nominalExp': e,
                       'rowsExp': round(math.log10(d * TAGS_M), 6),
                       'rule': '적응형 로그 이분 2회 — m1 = 10^(a+1/2) · m2 = 역전이 든 반쪽의 로그 중점(a+1/4 · a+3/4) · D 반올림은 refine_d'}})
    return pid


def point_fields(st: dict, pid: str) -> dict:
    """원시 줄의 점 표지 — stage(수) · point(id) · refine(정밀화 점만)."""
    out = {'stage': stage_num(pid), 'point': pid}
    s = st['stages'].get(pid) or {}
    if s.get('refine'):
        out['refine'] = s['refine']
    return out


def print_point(st: dict, pid: str) -> None:
    a, b = fill_range(st, pid)
    d, s = point_d(st, pid), start_of(st)
    ch = chunks_of(st, pid, default_chunk_sec(st, pid))
    end = point_end(st, pid)
    aligned = int(end.timestamp()) % 60 == 0
    need_align = d > ALIGN_OVER_SEC
    base = point_base(st, pid)
    print(f'점 {pid} (stage {stage_num(pid)}): D {d}초 · {d * TAGS_M:,}행(10^{math.log10(d * TAGS_M):.4f}) · end {iso(end)} '
          f'(KST {kst_text(end, False)}) 분 경계 {"예" if aligned else "아니오"}{" — 필요" if need_align else " — 불필요(D ≤ 1시간)"}')
    print(f'    base {base or "빈 테이블"} · 채우기 [{iso(a)}, {iso(b)}) {int((b - a).total_seconds())}초 · '
          f'{int((b - a).total_seconds()) * TAGS_M:,}행 · 조각 {len(ch)} × ≤ {default_chunk_sec(st, pid)}초')
    for x in kst_day_split(s, end):
        print(f"    파티션 plc_tag_raw_control_p{x['day'].replace('-', '')} · tag_raw {x['day'].replace('-', '')}: {x['rowsNominal']:,}행(누적)")


def cmd_plan(args: list[str]) -> None:
    """plan [START_ISO] — 저장소 접속 없음. 상태가 있으면 그 S를 쓴다."""
    if args:
        start = parse_iso(args[0])
    elif STATE.exists():
        start = start_of(load_state())
    else:
        start = default_start()
    st = plan_state(start)
    now = now_utc()
    print(f'S = {iso(start)} (KST {kst_text(start, False)}) · 머리 만료 {iso(start + dt.timedelta(seconds=RETENTION_SEC))} '
          f'· 지금부터 {(start + dt.timedelta(seconds=RETENTION_SEC) - now).total_seconds() / 3600:.1f}시간')
    for p in start_problems(start, now):
        print(f'  경고: {p}')
    for k in STAGES:
        print_point(st, str(k))
    worst = max(x['rowsNominal'] for x in kst_day_split(start, point_end(st, '5')))
    print(f'5단계 최대 일 파티션 {worst:.2e}행 — 5단계 I2는 파티션별 비동기 빌드(i2-build → i2-build-poll).')
    print(f'채움 스냅샷: 단계 {", ".join(map(str, SNAPSHOT_STAGES))} 끝(i2-drop 뒤)에 snapshot <k> → 이름 {snapshot_name(1)[:-1]}<k>')


def cmd_plan_refine(args: list[str]) -> None:
    """plan-refine <j> [lower|upper] [START_ISO] — 정밀화 점 하나의 D · 행 · end · 채우기 구간(저장소 접속 없음)."""
    if not args:
        die('plan-refine <구간 아래 단계 j = 1~4> [lower|upper] [START_ISO]')
    j = int(args[0])
    if j not in SNAPSHOT_STAGES:
        die('j는 1~4 — 교차 구간 (10^(j+4), 10^(j+5)]의 아래 단계')
    rest = args[1:]
    side = rest.pop(0) if rest and rest[0] in ('lower', 'upper') else None
    if rest:
        st = plan_state(parse_iso(rest[0]))
    elif STATE.exists():
        st = json.loads(json.dumps(load_state()))   # 사본 — plan은 상태를 쓰지 않는다
    else:
        st = plan_state(default_start())
    if side is not None:
        register_refine(st, j, None)
    pid = register_refine(st, j, side)
    print(f"구간 (10^{j + 4}, 10^{j + 5}] · {'m1(로그 중점)' if side is None else f'm2 {side}(m1 뒤 {side} 반쪽의 로그 중점)'} · 공칭 10^{st['stages'][pid]['refine']['nominalExp']}행")
    print_point(st, pid)
    restore = side in (None, 'lower')
    print(f"    절차: {'restore ' + str(j) + ' → ' if restore else ''}refine {j}{' ' + side if side else ''} → budget {pid} → fill {pid} … "
          f"→ check · settle · axes · query · i2 · i2-drop"
          + ('' if restore else f' — {refine_pid(j, None)} 측정 직후 복원 없이 이어 채운다(테이블이 {refine_pid(j, None)} 상태여야 한다)'))


# ───────────────────────── 쿼리 정의 ─────────────────────────
# 양쪽 SQL은 05_data_stores/10 §동일 쿼리 5종 그대로다. 매개변수 자리표시만 엔진 문법으로 바꿨다:
#   ClickHouse {device} → {device:UInt32} 등 형식 매개변수(--param_*)
#   PostgreSQL $device · $tag · $end · $v → PREPARE의 $1 · $2 · $3(형식 선언) — 서버 쪽 바인딩

END_T = "{end:DateTime64(3, 'Asia/Seoul')}"
CH_SQL = {
    'Q1': f"""SELECT ts, value, quality FROM plc.tag_raw
WHERE device_id = {{device:UInt32}} AND tag_id = {{tag:UInt32}} AND ts >= {END_T} - INTERVAL 1 HOUR AND ts < {END_T}
ORDER BY ts""",
    'Q2': f"""SELECT toStartOfHour(ts) AS b, avg(value), min(value), max(value), count() FROM plc.tag_raw
WHERE device_id = {{device:UInt32}} AND tag_id = {{tag:UInt32}} AND ts >= {END_T} - INTERVAL 7 DAY AND ts < {END_T}
GROUP BY b ORDER BY b""",
    'Q3': f"""SELECT tag_id, avg(value), min(value), max(value), count() FROM plc.tag_raw
WHERE device_id = {{device:UInt32}} AND ts >= {END_T} - INTERVAL 1 DAY AND ts < {END_T}
GROUP BY tag_id""",
    'Q4': f"""SELECT toStartOfMinute(ts) AS b, device_id, tag_id,
       count(), avg(value), min(value), max(value), countIf(quality IN (2, 4))
FROM plc.tag_raw
WHERE ts >= {END_T} - INTERVAL 1 HOUR AND ts < {END_T}
GROUP BY b, device_id, tag_id""",
    'Q5': "SELECT count() FROM plc.tag_raw WHERE value > {v:Float64}",
    'Q5x': "SELECT count() FROM plc.tag_raw",
}
CH_PARAMS = {'Q1': ('device', 'tag', 'end'), 'Q2': ('device', 'tag', 'end'), 'Q3': ('device', 'end'),
             'Q4': ('end',), 'Q5': ('v',), 'Q5x': ()}

PG_PREPARE = {
    'Q1': """PREPARE q(integer, integer, timestamptz) AS
SELECT ts, value, quality FROM plc_tag_raw_control
WHERE device_id = $1 AND tag_id = $2 AND ts >= $3 - interval '1 hour' AND ts < $3
ORDER BY ts;""",
    'Q2': """PREPARE q(integer, integer, timestamptz) AS
SELECT date_trunc('hour', ts) AS b, avg(value), min(value), max(value), count(*) FROM plc_tag_raw_control
WHERE device_id = $1 AND tag_id = $2 AND ts >= $3 - interval '7 days' AND ts < $3
GROUP BY b ORDER BY b;""",
    'Q3': """PREPARE q(integer, timestamptz) AS
SELECT tag_id, avg(value), min(value), max(value), count(*) FROM plc_tag_raw_control
WHERE device_id = $1 AND ts >= $2 - interval '1 day' AND ts < $2
GROUP BY tag_id;""",
    'Q4': """PREPARE q(timestamptz) AS
SELECT date_trunc('minute', ts) AS b, device_id, tag_id,
       count(*), avg(value), min(value), max(value), count(*) FILTER (WHERE quality IN (2, 4))
FROM plc_tag_raw_control
WHERE ts >= $1 - interval '1 hour' AND ts < $1
GROUP BY b, device_id, tag_id;""",
    'Q5': """PREPARE q(double precision) AS
SELECT count(*) FROM plc_tag_raw_control WHERE value > $1;""",
    'Q5x': """PREPARE q AS
SELECT count(*) FROM plc_tag_raw_control;""",
}
PG_ARGS = CH_PARAMS

# 결과 대조용 보조 조회(시간을 재지 않는다) — avg 허용 오차식의 n · S = count() · sum(abs(value))(14 §롤업 정합성 허용 오차 판정)
CH_AUX = {
    'Q2': f"""SELECT toStartOfHour(ts) AS b, count(), sum(abs(value)) FROM plc.tag_raw
WHERE device_id = {{device:UInt32}} AND tag_id = {{tag:UInt32}} AND ts >= {END_T} - INTERVAL 7 DAY AND ts < {END_T} GROUP BY b""",
    'Q3': f"""SELECT tag_id, count(), sum(abs(value)) FROM plc.tag_raw
WHERE device_id = {{device:UInt32}} AND ts >= {END_T} - INTERVAL 1 DAY AND ts < {END_T} GROUP BY tag_id""",
    'Q4': f"""SELECT toStartOfMinute(ts) AS b, device_id, tag_id, count(), sum(abs(value)) FROM plc.tag_raw
WHERE ts >= {END_T} - INTERVAL 1 HOUR AND ts < {END_T} GROUP BY b, device_id, tag_id""",
}
# EXP-04 — 결과가 tag_1m -Merge와 같다(롤업 대조) · 조건식은 롤업과 같은 quality IN (2, 4)
CH_ROLLUP_Q4 = f"""SELECT bucket, device_id, tag_id, countMerge(cnt), avgMerge(avg_v), minMerge(min_v), maxMerge(max_v), countIfMerge(bad_cnt)
FROM plc.tag_1m
WHERE bucket >= toStartOfMinute({END_T} - INTERVAL 1 HOUR) AND bucket < {END_T}
GROUP BY bucket, device_id, tag_id"""


def param_values(st: dict, q: str, pid: str) -> dict:
    """{end} = 점의 데이터 끝 S + D_p(미래 방향 누적 — 점마다 다르다) · device · tag · v는 격자 전체 고정."""
    p = st.get('params')
    if not p and q not in ('Q4', 'Q5x'):
        die('params가 없다 — 1단계 check 뒤 params를 먼저 부른다')
    end = point_end(st, pid)
    vals = {'device': p and p['device'], 'tag': p and p['tag'], 'v': p and p['v'], 'end': kst_text(end)}
    return {k: vals[k] for k in CH_PARAMS[q]}


def pg_execute(st: dict, q: str, pid: str) -> str:
    pv = param_values(st, q, pid)
    lit = []
    for k in PG_ARGS[q]:
        if k == 'end':
            lit.append(f"'{pv['end']}+09'")
        elif k == 'v':
            lit.append(f"'{pv['v']}'")
        else:
            lit.append(str(int(pv[k])))
    return f"EXECUTE q({', '.join(lit)});" if lit else 'EXECUTE q;'


# ───────────────────────── init · params ─────────────────────────

def require_table_at(st: dict, pid: str, what: str) -> dict:
    """테이블이 지금 점 pid의 행을 담고 있어야 한다(tableAt) — 누적 격자 · 복원이 섞여도 다른 점의 테이블을 재지 않게."""
    s = st['stages'].get(pid)
    if not s or not s.get('checked'):
        die(f'{pid} check가 먼저다')
    if st.get('tableAt') != pid:
        die(f"테이블은 지금 점 {st.get('tableAt')} 상태다 — {pid}의 {what}을(를) 잴 수 없다"
            + (f' (정밀화 점의 base 단계로 되돌리려면 restore)' if not is_stage(pid) else ''))
    return s


MEMORY_LIMIT_SOURCE = 'cgroup max — datagen-d 서비스에 compose 메모리 상한 없음(readMemoryLimitMb: memory.max = max → null)'


def with_memory_source(run_: dict | None) -> dict | None:
    """04 §조건 칸(2026-09-27) — 도구 컨테이너 경로의 memoryLimitMb null은 선택 키 run.memoryLimitSource가 있으면 4요소 충족.
    값은 바꾸지 않는다(null 그대로 · 저장소 상한 3584 같은 다른 값으로 채우지 않는다)."""
    if run_ is None or run_.get('memoryLimitMb') is not None:
        return run_
    return {**run_, 'memoryLimitSource': MEMORY_LIMIT_SOURCE}


def grid_run(st: dict) -> dict | None:
    """기록 4요소 run — 모드 D 보고(datagen-d) 그대로에서 capacityTier만 EXP-01~05 공통 조건 "티어 해당 없음"(행 수 격자가 축)으로 둔다.
    memoryLimitMb null에는 run.memoryLimitSource를 붙인다."""
    r = st.get('run')
    return r and with_memory_source({**r, 'capacityTier': '해당 없음'})


GRID_TIER_NOTE = ('EXP-01~05 공통 조건 "티어 해당 없음"(행 수 격자가 축) — datagen-d에 CAPACITY_TIER를 주지 않는다(모드 D 보고 null) · '
                  '모드 D --tier M은 생성 구성(설비 50 × 태그 200 · 1 Hz)을 고르는 인자')


def run_fields(st: dict) -> dict:
    return {'run': grid_run(st), 'runNotes': {'capacityTierSource': GRID_TIER_NOTE}, 'switches': st.get('switches')}


def cmd_init(args: list[str]) -> None:
    if STATE.exists() and os.environ.get('FORCE') != '1':
        die(f'{STATE} 가 이미 있다 — 새 격자면 GRID_DIR를 바꾸거나 FORCE=1')
    opts = dict(zip(args[::2], args[1::2]))
    env = engine_env()
    bad = control_resources_ok(env)
    if bad:
        die('대조 자원 조건이 아니다 — task up CONTROL=1(또는 compose.control.yml 덧씌움)로 두 저장소를 다시 만든다: ' + ' / '.join(bad))
    if container_running('db_study-api-1'):
        die('api가 떠 있다 — 모드 D는 다른 주입 · 정상 수집이 멈춘 상태에서만(06_pipeline/10 모드 D ②)')
    ch_n = int(chq('SELECT count() FROM plc.tag_raw'))
    pg_n = int(pgq('SELECT count(*) FROM plc_tag_raw_control'))
    r1m = int(chq('SELECT count() FROM plc.tag_1m'))
    if ch_n or pg_n:
        die(f'격자는 빈 테이블에서 시작한다 — tag_raw {ch_n} · 대조군 {pg_n}행(단계 행 수 = 테이블 총 행 수). 빈 스냅샷을 복원한다')
    btree = pgq("SELECT count(*) FROM pg_class WHERE relname = 'plc_tag_raw_control_key_btree'").strip()
    if btree != '0':
        die('I2 btree가 이미 있다 — 격자 채우기는 I1(BRIN만)에서 한다')
    now = now_utc()
    start = parse_iso(opts['--start']) if '--start' in opts else default_start(now)
    bad = start_problems(start, now)
    if bad and os.environ.get('FORCE') != '1':
        die('시작 시각 S 규칙 위반 — ' + ' / '.join(bad))
    st = {'direction': 'forward', 'start': iso(start), 'startKst': kst_text(start, False), 'createdAt': iso(now),
          'headExpiresAt': iso(start + dt.timedelta(seconds=RETENTION_SEC)),
          'seed': int(opts.get('--seed', 42)), 'mix': opts.get('--mix', 'mixed'), 'tier': 'M',
          'params': None, 'stages': {}, 'i2': None, 'env': env, 'tag1mRowsAtInit': r1m, 'tableAt': None, 'snapshots': {}}
    save_state(st)
    emit({'kind': 'init', 'exp': EXP_GRID, 'direction': 'forward', 'start': st['start'], 'startKst': st['startKst'],
          'headExpiresAt': st['headExpiresAt'], 'startRule': default_start.__doc__.split('\n')[0], 'startProblems': bad,
          'seed': st['seed'], 'mix': st['mix'], 'env': env, 'tag1mRowsAtInit': r1m, 'git': git_head()})
    cmd_plan([st['start']])


def later_filled(st: dict) -> list[str]:
    """1단계 뒤 점 가운데 조각을 채우기 시작한 점(todo가 아닌 조각이 있는 점) — params · refill 1이 같은 조건으로 거부한다(검수 L5).
    항목만 있거나 조각이 전부 todo인 점(예: fill 2가 조각을 만들고 추정 초과로 거부됨)은 테이블을 바꾸지 않았으므로 세지 않는다."""
    return [p for p, x in st['stages'].items() if p != '1' and any(c['status'] != 'todo' for c in x.get('chunks', []))]


def cmd_params(_args: list[str]) -> None:
    st = load_state()
    if st.get('params') and os.environ.get('FORCE') != '1':
        die(f"params가 이미 고정됐다 {st['params']} — 단계마다 다시 정하지 않는다(§대조 실험 조정값 Q5 문턱)")
    s1 = st['stages'].get('1')
    if not s1 or not s1.get('checked'):
        die('1단계 채우기 · check가 먼저다 — Q5 문턱은 격자 1단계 적재 직후 한 번 정한다')
    if later_filled(st) or st.get('tableAt') != '1':
        die('2단계 이후가 이미 채워졌다 — 문턱은 1단계 적재 직후 값이어야 한다')
    v = chq('SELECT toString(quantileExact(0.5)(value)) FROM plc.tag_raw').strip()
    dev, tag = chq('SELECT device_id, tag_id FROM plc.tag_raw GROUP BY device_id, tag_id ORDER BY device_id, tag_id LIMIT 1').split()
    sel = chq(f'SELECT countIf(value > {v}) / count() FROM plc.tag_raw').strip()
    st['params'] = {'device': int(dev), 'tag': int(tag), 'v': v, 'q5SelectivityStage1': float(sel),
                    'rule': 'v = quantileExact(0.5)(value) 1단계 직후 · device · tag = (device_id, tag_id) 사전순 첫 쌍'}
    save_state(st)
    line = {'kind': 'params', 'exp': EXP_GRID, 'stage': 1, **st['params']}
    if st.get('paramsHistory'):
        prev = st['paramsHistory'][-1]['params']
        keys = ('device', 'tag', 'v')
        line['paramsChanged'] = {'changed': any(prev.get(k) != st['params'][k] for k in keys),
                                 'previous': {k: prev.get(k) for k in keys + ('q5SelectivityStage1',)},
                                 'new': {k: st['params'][k] for k in keys + ('q5SelectivityStage1',)},
                                 'reason': 'refill 1 — 재채움 뒤 1단계 적재가 새 "1단계 적재"(§대조 실험 조정값)'}
    emit(line)


# ───────────────────────── fill ─────────────────────────

def pg_counters() -> dict:
    r = pgq("""SELECT (SELECT wal_bytes FROM pg_stat_wal), (SELECT wal_fpi FROM pg_stat_wal), (SELECT wal_records FROM pg_stat_wal),
  pg_current_wal_lsn(), (SELECT num_done FROM pg_stat_checkpointer),
  coalesce(sum(s.autovacuum_count), 0), coalesce(sum(s.vacuum_count), 0), coalesce(sum(s.autoanalyze_count), 0)
FROM pg_stat_all_tables s JOIN pg_partition_tree('plc_tag_raw_control') p ON p.relid = s.relid AND p.isleaf""").strip().split('\t')
    return {'walBytes': int(r[0]), 'walFpi': int(r[1]), 'walRecords': int(r[2]), 'lsn': r[3], 'checkpointsDone': int(r[4]),
            'autovacuumCount': int(r[5]), 'vacuumCount': int(r[6]), 'autoanalyzeCount': int(r[7])}


def lsn_diff(a: str, b: str) -> int:
    return int(pgq(f"SELECT pg_wal_lsn_diff('{b}', '{a}')").strip().split('.')[0])


def mode_d(from_t: dt.datetime, to_t: dt.datetime, *, control: str, mix: str | None, profile: str | None, seed: int,
           compose_var: str, capacity_tier: str | None = None) -> tuple[dict, float, int]:
    """모드 D 한 호출 — 종료 코드 0 전부 일치 · 2 불일치 일 있음(출력 JSON은 있다) · 1 실패(s5-inject 계약).
    모드 D는 대상 구간에 행이 이미 있거나 최근 30초 안에 ts · ingested_at이 둘 다 있는 행이 있으면 거부한다(api · 수집 정지 전제).
    상태형 프로파일(RANDOM_WALK · BINARY · COUNTER)은 호출마다 KST 일 조각별로 초기 상태에서 다시 시작한다 — 조각 나누기가 값을 바꾸므로 chunkSec를 조건으로 남긴다."""
    # capacity_tier — datagen-d 환경 CAPACITY_TIER(설정 로더 → 보고 run.capacityTier의 원천). 모드 D는 --tier와 다르면 거부한다.
    # EXP-35는 M(카탈로그 조건 "M 행 수") · 격자는 주지 않는다(EXP-01~05 "티어 해당 없음" — grid_run)
    env = ['-e', f'CAPACITY_TIER={capacity_tier}'] if capacity_tier else []
    cmd = compose_cmd(compose_var) + ['--profile', 'datagen-d', 'run', '--rm', '--no-deps', *env, 'datagen-d', 'node', 'dist/mode-d.js',
                                      '--tier', 'M', '--seed', str(seed), '--from', iso(from_t), '--to', iso(to_t),
                                      '--control', control, '--rollup', 'on']
    if mix:
        cmd += ['--mix', mix]
    if profile:
        cmd += ['--profile', profile]
    t0 = time.time()
    p = run(cmd, check=False)
    wall = time.time() - t0
    lines = [ln for ln in p.stdout.splitlines() if ln.startswith('{')]
    if p.returncode not in (0, 2) or not lines:
        sys.stderr.write(p.stdout[-4000:] + p.stderr[-4000:])
        die(f'모드 D 실패(종료 {p.returncode}) — 도중 실패는 MV 분리 상태에서 처음부터 다시 한다(REQ-GEN-10). '
            '부분 적재가 남았으면 모드 D가 같은 구간 재실행을 거부하므로 단계 시작 전 스냅샷으로 되돌린다(check로 확인)')
    return json.loads(lines[-1]), wall, p.returncode


def cmd_fill(args: list[str]) -> None:
    """fill <점> [next|조각번호] — 조각 하나 = 호출 하나(도구 상한 600초). 여러 조각을 한 셸 호출에 묶지 않는다."""
    st = load_state()
    pid = parse_pid(args[0]) if args else die('fill <점: 1~5 | r8.5 …> [next|조각번호]')
    which = args[1] if len(args) > 1 else 'next'
    if not is_stage(pid) and 'd' not in st['stages'].get(pid, {}):
        die(f'정밀화 점 {pid}이 등록되지 않았다 — refine <j> [lower|upper] 먼저')
    base = point_base(st, pid)
    if st.get('tableAt') not in (base, pid):
        die(f"테이블은 점 {st.get('tableAt')} 상태다 — {pid}는 {base or '빈 테이블'} 위에 이어 채운다(누적 격자)"
            + (f' · restore {base}' if base and is_stage(base) and base in st.get('snapshots', {}) else ''))
    if base and not st['stages'].get(base, {}).get('checked'):
        die(f'{base} check가 먼저다(누적 격자)')
    if st.get('i2'):
        die('I2 btree가 있다 — i2-drop 뒤에 채운다(삽입 처리량 축은 I1 적재 계측)')
    # 검수 M1 — 단계 k(1~4) 채움 스냅샷 없이 k+1을 채우면 정밀화 복원점이 영영 사라진다
    if is_stage(pid) and base and int(base) in SNAPSHOT_STAGES and base not in st.get('snapshots', {}) \
            and os.environ.get('FORCE') != '1':
        die(f'단계 {base} 채움 스냅샷이 없다 — {pid}를 채우면 단계 {base}로 되돌아갈 수 없다. 먼저 grid.sh snapshot {base}'
            '(FORCE=1이면 복원점 없이 진행)')
    s = st['stages'].setdefault(pid, {})
    if st.get('tableAt') == base and any(c['status'] != 'todo' for c in s.get('chunks', [])):
        die(f'{pid}는 이미 채운 적이 있고 테이블은 base {base} 상태다(복원 뒤) — grid.sh refill {pid}로 앞 채움을 보관 · 초기화한 뒤 채운다')
    last = st.get('lastRestore')
    if base and last and last.get('k') == base and not any(c['status'] != 'todo' for c in s.get('chunks', [])):
        s['restoredFrom'] = last     # 검수 L4 — 원시 conditions에 "스냅샷 복원 → 재기동 → 이어 채움"을 남긴다
    fresh = not s.get('chunks') or (os.environ.get('FILL_CHUNK_SEC') and all(x['status'] == 'todo' for x in s['chunks']))
    if fresh:   # 조각 나누기는 첫 조각을 채우기 전까지만 바꿀 수 있다
        s['chunkSec'] = default_chunk_sec(st, pid)
        s['chunks'] = [{'i': i, 'from': iso(a), 'to': iso(b), 'status': 'todo'}
                       for i, (a, b) in enumerate(chunks_of(st, pid, s['chunkSec']))]
    todo = [c for c in s['chunks'] if c['status'] != 'done']
    if not todo:
        die(f'{pid} 조각이 전부 채워졌다 — check로 넘어간다')
    c = todo[0] if which == 'next' else next((x for x in s['chunks'] if x['i'] == int(which)), None)
    if c is None or c['status'] == 'done':
        die(f'조각 {which} 없음 또는 이미 채움')
    if c['status'] in ('failed', 'running') and os.environ.get('FORCE') != '1':
        die(f"조각 {c['i']}은 {c['status']} 표시다 — 부분 적재가 남았으면 모드 D가 같은 구간을 거부한다. "
            f"구간이 두 저장소 모두 비었음을 확인한 뒤에만 FORCE=1 — 아니면 {refill_path(st, pid)}")
    rows_nom = int((parse_iso(c['to']) - parse_iso(c['from'])).total_seconds()) * TAGS_M
    est, rate, src = fill_estimate(st, pid, rows_nom)
    if est > CALL_LIMIT_SEC and os.environ.get('FORCE') != '1':
        die(f'{src} {rate:.0f}행/초로 이 조각 {rows_nom:,}행은 약 {est:.0f}초 — 호출 하나 {CALL_LIMIT_SEC}초 상한(도구 600초)을 넘는다. '
            'FILL_CHUNK_SEC를 줄여 다시 쪼갠다(아직 조각을 채우기 전이어야 한다)')
    print(f"조각 {c['i'] + 1}/{len(s['chunks'])} {rows_nom:,}행 · 추정 {est:.0f}초({src}) — 이 호출은 이 조각 하나만 채운다", file=sys.stderr)
    if 'baseline' not in s:
        s['fillStartAt'] = iso(now_utc())
        s['chFillStart'] = chq("SELECT toString(now64(6, 'UTC'))").strip()
        s['baseline'] = pg_counters()
        save_state(st)
    c['status'] = 'running'
    st['tableAt'] = pid       # 첫 조각부터 테이블은 이 점의 것이다(부분 적재 포함)
    # 단계 경과의 시작은 첫 조각을 채우기 전이다 — 명령 뒤 touch는 첫 조각 소요를 빠뜨린다(검수 N2)
    s.setdefault('firstAt', iso(now_utc()))
    save_state(st)
    out, wall, rc = mode_d(parse_iso(c['from']), parse_iso(c['to']), control='on', mix=st['mix'], profile=None, seed=st['seed'],
                           compose_var='GCOMPOSE')
    tot = out.get('totals', {})
    # 일치 판정 — 종료 코드 0 · 두 저장소 행 수 · 일별 3자 대조(days[].match — rollupCount는 분 경계로 넓힌 rollupRawCount와 대조)
    ok = rc == 0 and tot.get('chRows') == tot.get('controlRows') and all(d.get('match') for d in out.get('days', []))
    c.update({'status': 'done' if ok else 'failed', 'wallSec': round(wall, 1), 'modeD': out, 'exitCode': rc})
    if tot.get('chRows'):
        s['lastWallRowsPerSec'] = tot['chRows'] / wall
    st['run'], st['switches'] = out.get('run'), out.get('switches')
    if all(x['status'] == 'done' for x in s['chunks']):
        s['fillEndAt'] = iso(now_utc())
        s['fillEnd'] = pg_counters()
    save_state(st)
    emit({'kind': 'fill', 'exp': EXP_GRID, **point_fields(st, pid), 'chunk': c['i'], 'chunks': len(s['chunks']),
          'window': {'start': c['from'], 'end': c['to']}, 'rowsNominal': rows_nom, 'wallSec': round(wall, 1),
          'chRows': tot.get('chRows'), 'controlRows': tot.get('controlRows'), 'chInsertSec': tot.get('chInsertSec'),
          'controlCopySec': tot.get('controlCopySec'), 'rollupSec': tot.get('rollupSec'), 'days': out.get('days'),
          'match': ok, 'exitCode': rc, 'chunkSec': s['chunkSec'], **run_fields(st), 'modeDRun': out.get('run'),
          'options': out.get('options')})
    if not ok:
        die(f'조각 불일치(종료 {rc}) — 모드 D ⑧(대조군 그 일 재적재)을 거쳐도 남은 불일치다. 점 무효 — {refill_path(st, pid)}')
    left = [x for x in s['chunks'] if x['status'] != 'done']
    if left:
        nxt = int((parse_iso(left[0]['to']) - parse_iso(left[0]['from'])).total_seconds()) * TAGS_M
        print(f"남은 조각 {len(left)} — 다음 호출: grid.sh fill {pid} next(추정 {nxt / s['lastWallRowsPerSec']:.0f}초 · 조각 하나 = 호출 하나)",
              file=sys.stderr)
    else:
        print(f'채우기 끝 — 다음: grid.sh check {pid}', file=sys.stderr)


def refill_path(st: dict, pid: str) -> str:
    """점 무효 뒤 다시 채우는 길 — restore base → refill p → fill p(1단계는 빈 스냅샷 task restore)."""
    base = point_base(st, pid)
    if base is None:
        first = '빈 스냅샷 task restore'
    elif is_stage(base):
        first = f'grid.sh restore {base}'
    else:                       # m2 upper — base m1부터 다시: restore j → refill m1 → fill m1 … → m1 check
        first = f'grid.sh restore {int(point_exp(base)) - 4} → refill {base} → {base} 다시 채움'
    return f'{first} → grid.sh refill {pid} → grid.sh fill {pid} next'


def fill_estimate(st: dict, pid: str, rows: int) -> tuple[float, float, str]:
    """조각 소요 추정 — 이 점의 직전 조각 속도 → base 점의 속도 → 보수적 기본값."""
    s = st['stages'].get(pid, {})
    base = point_base(st, pid)
    for rate, src in ((s.get('lastWallRowsPerSec'), '직전 조각 속도'),
                      (base and st['stages'].get(base, {}).get('lastWallRowsPerSec'), f'{base} 마지막 조각 속도')):
        if rate:
            return rows / rate, rate, src
    return rows / DEFAULT_FILL_RATE, DEFAULT_FILL_RATE, '실측 없음 — 기본 속도'


# ───────────────────────── check ─────────────────────────

def cmd_check(args: list[str]) -> None:
    st = load_state()
    pid = parse_pid(args[0]) if args else die('check <점>')
    s = st['stages'].get(pid)
    if not s or not s.get('chunks') or any(c['status'] != 'done' for c in s['chunks']):
        die(f'{pid} 채우기가 끝나지 않았다')
    if st.get('tableAt') != pid:
        die(f"테이블은 점 {st.get('tableAt')} 상태다 — {pid}를 확인할 수 없다")
    start, end = start_of(st), point_end(st, pid)
    chain = point_chain(st, pid)
    ranges = []
    for j in chain:
        ranges += [(parse_iso(c['from']), parse_iso(c['to'])) for c in st['stages'][j]['chunks']]
    ranges.sort()
    # 사슬의 조각이 [S, end)를 빈틈 · 겹침 없이 덮어야 한다(복원 · 이어 채우기가 섞여도 행 집합이 이 점의 것)
    cover = ranges[0][0] == start and ranges[-1][1] == end and all(x[1] == y[0] for x, y in zip(ranges, ranges[1:]))
    t0 = time.time()
    rows, ch_sum, pg_sum = [], 0, 0
    for a, b in ranges:
        ch = int(chq(f"SELECT count() FROM plc.tag_raw WHERE ts >= toDateTime64('{kst_text(a)}', 3, 'Asia/Seoul') "
                     f"AND ts < toDateTime64('{kst_text(b)}', 3, 'Asia/Seoul')"))
        pg = int(pgq(f"SELECT count(*) FROM plc_tag_raw_control WHERE ts >= '{kst_text(a)}+09' AND ts < '{kst_text(b)}+09'"))
        rows.append({'from': iso(a), 'to': iso(b), 'ch': ch, 'pg': pg, 'match': ch == pg})
        ch_sum += ch
        pg_sum += pg
    ch_out = int(chq(f"SELECT count() FROM plc.tag_raw WHERE ts < toDateTime64('{kst_text(start)}', 3, 'Asia/Seoul') "
                     f"OR ts >= toDateTime64('{kst_text(end)}', 3, 'Asia/Seoul')"))
    pg_out = int(pgq(f"SELECT count(*) FROM plc_tag_raw_control WHERE ts < '{kst_text(start)}+09' OR ts >= '{kst_text(end)}+09'"))
    roll = int(chq(f"SELECT countMerge(cnt) FROM plc.tag_1m WHERE bucket >= toStartOfMinute(toDateTime64('{kst_text(start)}', 3, 'Asia/Seoul')) "
                   f"AND bucket < toDateTime64('{kst_text(end)}', 3, 'Asia/Seoul')"))
    # 모드 D 일별 롤업 대조(rollupCount = 분 경계로 넓힌 rollupRawCount)를 조각 출력에서 다시 확인한다
    day_roll = [{'stage': j, 'chunk': c['i'], 'day': d.get('day'), 'rollupCount': d.get('rollupCount'), 'rollupRawCount': d.get('rollupRawCount')}
                for j in chain for c in st['stages'][j]['chunks'] for d in c['modeD'].get('days', [])]
    day_roll_ok = all(x['rollupCount'] is not None and x['rollupCount'] == x['rollupRawCount'] for x in day_roll)
    match = cover and all(r['match'] for r in rows) and ch_out == 0 and pg_out == 0 and roll == ch_sum and day_roll_ok
    s['checked'] = match
    s['rows'] = ch_sum
    save_state(st)
    emit({'kind': 'check', 'exp': EXP_GRID, **point_fields(st, pid), 'rows': ch_sum, 'rowsNominal': point_d(st, pid) * TAGS_M,
          'window': {'start': iso(start), 'end': iso(end)}, 'chain': chain, 'rangesCoverWindow': cover, 'total': {'ch': ch_sum, 'pg': pg_sum, 'rollupCountMerge': roll},
          'outside': {'ch': ch_out, 'pg': pg_out}, 'ranges': rows, 'modeDRollupDays': day_roll, 'modeDRollupOk': day_roll_ok, 'match': match, 'sec': round(time.time() - t0, 1)})
    if not match:
        die(f'{pid} 구간 count 정합 실패 — 그 점의 모든 수치가 무효다(REQ-NFR-18). 어긋난 구간을 다시 채운다')


# ───────────────────────── settle ─────────────────────────

def settle_sample() -> dict:
    parts = int(chq("SELECT count() FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND active"))
    merges = int(chq("SELECT count() FROM system.merges WHERE database = 'plc' AND table = 'tag_raw'"))
    r = pgq("""WITH leaf AS (SELECT relid FROM pg_partition_tree('plc_tag_raw_control') WHERE isleaf),
thr AS (SELECT current_setting('autovacuum_vacuum_insert_threshold')::float8 AS t, current_setting('autovacuum_vacuum_insert_scale_factor')::float8 AS f)
SELECT (SELECT count(*) FROM pg_stat_progress_vacuum v WHERE v.relid IN (SELECT relid FROM leaf)),
       (SELECT count(*) FROM pg_stat_activity WHERE backend_type = 'autovacuum worker'),
       (SELECT count(*) FROM pg_stat_all_tables s JOIN pg_class c ON c.oid = s.relid, thr
          WHERE s.relid IN (SELECT relid FROM leaf) AND s.n_ins_since_vacuum > thr.t + thr.f * greatest(c.reltuples, 0)),
       (SELECT num_done FROM pg_stat_checkpointer)""").strip().split('\t')
    return {'t': iso(now_utc()), 'chParts': parts, 'chMerges': merges, 'pgVacuumRunning': int(r[0]),
            'pgAutovacuumWorkers': int(r[1]), 'pgPartsPendingInsertVacuum': int(r[2]), 'pgCheckpointsDone': int(r[3])}


def cmd_settle(args: list[str]) -> None:
    st = load_state()
    pid = parse_pid(args[0]) if args else die('settle <점> [최대 초=540] [표본 간격 초=20]')
    limit = int(args[1]) if len(args) > 1 else CALL_LIMIT_SEC
    step = int(args[2]) if len(args) > 2 else 20
    s = require_table_at(st, pid, '안정화')
    ck0 = s['fillEnd']['checkpointsDone']
    t0, samples, settled = time.time(), [], False
    while True:
        x = settle_sample()
        samples.append(x)
        last3 = samples[-3:]
        ch_ok = len(last3) == 3 and len({y['chParts'] for y in last3}) == 1 and all(y['chMerges'] == 0 for y in last3)
        pg_ok = x['pgVacuumRunning'] == 0 and x['pgPartsPendingInsertVacuum'] == 0
        ck_ok = x['pgCheckpointsDone'] > ck0
        if ch_ok and pg_ok and ck_ok:
            settled = True
            break
        if time.time() - t0 + step > limit:
            break
        time.sleep(step)
    s['settled'] = settled
    if settled:
        s['settledAt'] = iso(now_utc())
    save_state(st)
    emit({'kind': 'settle', 'exp': EXP_GRID, **point_fields(st, pid), 'settled': settled, 'sec': round(time.time() - t0, 1),
          'conditions': {'chPartsStable3AndNoMerge': ch_ok, 'pgVacuumIdleAndNoPendingInsertVacuum': pg_ok,
                         'checkpointAfterFill': ck_ok, 'checkpointsAtFillEnd': ck0},
          'last': samples[-1], 'samples': len(samples)})
    if not settled:
        print('아직 안정화 전 — settle을 다시 부른다(체크포인트 간격 checkpoint_timeout만큼 걸릴 수 있다)', file=sys.stderr)


# ───────────────────────── axes ─────────────────────────

def ch_parts_totals(table: str = 'tag_raw') -> dict:
    r = chq(f"""SELECT sum(rows), sum(bytes_on_disk), sum(data_compressed_bytes), sum(data_uncompressed_bytes),
  sum(primary_key_bytes_in_memory), sum(marks_bytes), count(), groupUniqArray(part_type), uniqExact(partition)
FROM system.parts WHERE database = 'plc' AND table = '{table}' AND active""", fmt='JSONCompact')
    d = json.loads(r)['data'][0]
    return {'rows': int(d[0]), 'bytesOnDisk': int(d[1]), 'compressed': int(d[2]), 'uncompressed': int(d[3]),
            'pkBytesInMemory': int(d[4]), 'marksBytes': int(d[5]), 'parts': int(d[6]), 'partTypes': d[7], 'partitions': int(d[8])}


def pg_sizes() -> dict:
    r = pgq("""SELECT coalesce(sum(pg_table_size(relid)), 0), coalesce(sum(pg_relation_size(relid, 'main')), 0),
  coalesce(sum(pg_indexes_size(relid)), 0), coalesce(sum(pg_total_relation_size(relid)), 0),
  (SELECT coalesce(sum(pg_relation_size(relid)), 0) FROM pg_partition_tree('plc_tag_raw_control_ts_brin') WHERE isleaf),
  (SELECT coalesce(max(age(c.relfrozenxid)), 0) FROM pg_partition_tree('plc_tag_raw_control') p JOIN pg_class c ON c.oid = p.relid WHERE p.isleaf AND c.relkind = 'r')
FROM pg_partition_tree('plc_tag_raw_control') WHERE isleaf""").strip().split('\t')
    return {'tableBytes': int(r[0]), 'heapMainBytes': int(r[1]), 'indexesBytes': int(r[2]), 'totalBytes': int(r[3]),
            'brinBytes': int(r[4]), 'maxRelfrozenxidAge': int(r[5])}


def btree_present() -> bool:
    return pgq("SELECT count(*) FROM pg_class WHERE relname = 'plc_tag_raw_control_key_btree'").strip() != '0'


def cmd_axes(args: list[str]) -> None:
    st = load_state()
    pid = parse_pid(args[0]) if args else die('axes <점>')
    s = require_table_at(st, pid, '비 쿼리 축')
    if not s.get('settled') and os.environ.get('FORCE') != '1':
        die('안정화 전 — 축 5가 0에 가깝게 보인다(단계 절차 ③). settle 뒤 부르거나 FORCE=1(기록에 밝힌다)')
    if btree_present():
        die('I2 btree가 있다 — 비 쿼리 축은 I1 상태에서 잰다(I2 비용은 i2-build 줄)')
    chq('SYSTEM FLUSH LOGS')
    ch = ch_parts_totals()
    pl = json.loads(chq(f"""SELECT sumIf(size_in_bytes, event_type = 'NewPart'), sumIf(size_in_bytes, event_type = 'MergeParts'),
  countIf(event_type = 'NewPart'), countIf(event_type = 'MergeParts'), sumIf(read_bytes, event_type = 'MergeParts')
FROM system.part_log WHERE database = 'plc' AND table = 'tag_raw' AND event_time_microseconds >= toDateTime64('{s['chFillStart']}', 6, 'UTC')""",
                        fmt='JSONCompact'))['data'][0]
    new_b, merge_b = int(pl[0]), int(pl[1])
    pg = pg_sizes()
    now_c = pg_counters()
    b0 = s['baseline']
    rows = s['rows']
    delta_rows = sum(c['modeD']['totals']['chRows'] for c in s['chunks'])
    # 적재 시간이 계측되지 않은 조각(러너 중단 뒤 행 수 대조로 복구한 조각 — kind fill-recovered)은 처리량 합산에서 뺀다
    timed = [c for c in s['chunks'] if c['modeD']['totals'].get('chInsertSec') is not None]
    untimed = [c['i'] for c in s['chunks'] if c not in timed]
    ch_ins_rows = sum(c['modeD']['totals']['chRows'] for c in timed)
    ch_ins_s = sum(c['modeD']['totals']['chInsertSec'] for c in timed)
    pg_rows = sum(c['modeD']['totals']['controlRows'] for c in timed)
    pg_copy_s = sum(c['modeD']['totals']['controlCopySec'] for c in timed)
    wal = now_c['walBytes'] - b0['walBytes']
    common = {'exp': EXP_GRID, **point_fields(st, pid), 'rows': rows, **run_fields(st)}
    axes = [
        {'axis': 'storage_bytes', 'store': 'clickhouse', 'index': None, 'value': ch['bytesOnDisk'], 'unit': 'bytes',
         'parts': ch['parts'], 'partTypes': ch['partTypes']},
        {'axis': 'storage_bytes', 'store': 'postgresql', 'index': 'I1', 'value': pg['totalBytes'], 'unit': 'bytes',
         'heapBytes': pg['tableBytes'], 'heapMainBytes': pg['heapMainBytes'], 'indexBytes': pg['indexesBytes']},
        {'axis': 'compression_ratio', 'store': 'clickhouse', 'index': None, 'value': rows * LOGICAL_ROW_BYTES / ch['bytesOnDisk'],
         'unit': 'ratio', 'logicalBytes': rows * LOGICAL_ROW_BYTES, 'denominator': 'bytes_on_disk'},
        {'axis': 'compression_ratio', 'store': 'postgresql', 'index': 'I1', 'value': rows * LOGICAL_ROW_BYTES / pg['tableBytes'],
         'unit': 'ratio', 'logicalBytes': rows * LOGICAL_ROW_BYTES, 'denominator': 'pg_table_size(힙 · FSM · VM · TOAST — 인덱스 제외)'},
        {'axis': 'insert_rows_per_sec', 'store': 'clickhouse', 'index': None, 'value': ch_ins_rows / ch_ins_s if ch_ins_s else None,
         'unit': 'rows/s', 'stageRows': ch_ins_rows, 'insertSec': ch_ins_s, 'untimedChunks': untimed, 'source': '모드 D 단독 적재 계측(tag_raw INSERT)'},
        {'axis': 'insert_rows_per_sec', 'store': 'postgresql', 'index': 'I1', 'value': pg_rows / pg_copy_s if pg_copy_s else None,
         'unit': 'rows/s', 'stageRows': pg_rows, 'insertSec': pg_copy_s, 'untimedChunks': untimed, 'source': 'GEN-10 COPY 트랜잭션 시간(synchronous_commit off)'},
        {'axis': 'write_amplification', 'store': 'clickhouse', 'index': None, 'value': merge_b / new_b if new_b else None,
         'unit': 'ratio', 'mergeWriteBytes': merge_b, 'insertPartBytes': new_b, 'newParts': int(pl[2]), 'merges': int(pl[3]),
         'mergeReadBytes': int(pl[4]), 'formula': '머지 쓰기 바이트 ÷ 삽입 파트 바이트(part_log · 단계 채우기 시작 ~ 지금)'},
        {'axis': 'write_amplification', 'store': 'postgresql', 'index': 'I1',
         'value': wal / (delta_rows * LOGICAL_ROW_BYTES) if delta_rows else None, 'unit': 'ratio', 'walBytes': wal,
         'lsnBytes': lsn_diff(b0['lsn'], now_c['lsn']), 'walFpi': now_c['walFpi'] - b0['walFpi'],
         'autovacuumRuns': now_c['autovacuumCount'] - b0['autovacuumCount'], 'vacuumRuns': now_c['vacuumCount'] - b0['vacuumCount'],
         'autoanalyzeRuns': now_c['autoanalyzeCount'] - b0['autoanalyzeCount'], 'maxRelfrozenxidAge': pg['maxRelfrozenxidAge'],
         'formula': 'WAL 바이트 증가분(pg_stat_wal · 채우기 시작 ~ 안정화 뒤) ÷ (단계 증가 행 × 41 B)'},
        {'axis': 'index_bytes', 'store': 'clickhouse', 'index': None, 'value': ch['pkBytesInMemory'] + ch['marksBytes'], 'unit': 'bytes',
         'primaryKeyBytesInMemory': ch['pkBytesInMemory'], 'marksBytes': ch['marksBytes']},
        {'axis': 'index_bytes', 'store': 'postgresql', 'index': 'I1', 'value': pg['brinBytes'], 'unit': 'bytes', 'indexKind': 'BRIN(ts)'},
    ]
    for a in axes:
        emit({**common, **a, 'kind': 'axis'})   # kind는 마지막 — 축 항목의 키가 줄 종류를 덮지 못하게(1차 결함: index_bytes I1 줄이 kind BRIN(ts))
    s['axes'] = {'ch': ch, 'pg': pg, 'at': iso(now_utc())}
    save_state(st)


# ───────────────────────── query · capture · explain ─────────────────────────

def restart_stores() -> float:
    run(['docker', 'restart', CH, PG])
    return wait_stores()


def ch_timed(sql: str, params: dict, n: int, tag: str) -> tuple[list[float], list[str]]:
    times, ids = [], []
    for i in range(n):
        qid = f'grid-{tag}-{i}-{int(time.time() * 1000)}'
        cmd = ['docker', 'exec', CH, 'clickhouse-client', '--time', '--format', 'Null', '--query_id', qid]
        cmd += [f'--param_{k}={v}' for k, v in params.items()] + ['-q', sql]
        p = run(cmd)
        sec = [ln for ln in p.stderr.strip().splitlines() if re.fullmatch(r'\d+(\.\d+)?', ln.strip())]
        if not sec:
            die(f'clickhouse-client --time 출력을 읽지 못했다: {p.stderr[-300:]}')
        times.append(float(sec[-1]) * 1000.0)
        ids.append(qid)
    return times, ids


def ch_query_log(ids: list[str]) -> list[dict]:
    chq('SYSTEM FLUSH LOGS')
    inlist = ','.join(f"'{i}'" for i in ids)
    r = json.loads(chq(f"""SELECT query_id, query_duration_ms,
  dateDiff('microsecond', query_start_time_microseconds, event_time_microseconds), read_rows, read_bytes, result_rows, memory_usage
FROM system.query_log WHERE type = 'QueryFinish' AND query_id IN ({inlist})""", fmt='JSONCompact'))['data']
    by = {x[0]: x for x in r}
    out = []
    for i in ids:
        x = by.get(i)
        out.append(None if x is None else {'queryDurationMs': int(x[1]), 'serverUs': int(x[2]), 'readRows': int(x[3]),
                                           'readBytes': int(x[4]), 'resultRows': int(x[5]), 'memoryUsage': int(x[6])})
    return out


# pg_stat_statements의 행 키는 (userid, dbid, queryid, toplevel)이다 — queryid만으로 묶으면 EXPLAIN · capture 뒤 생긴
# 같은 queryid의 다른 toplevel 행이 앞 행을 덮어 증분이 사라진다(격자 2차 1단계 반복 2 · 3 PG 서버 시간 null 실측)
PGSS_SNAP = """SELECT 'PSS', {i}, userid || ':' || queryid || ':' || toplevel, calls, total_exec_time FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND query NOT LIKE '%pg_stat_statements%' AND query ILIKE '%plc_tag_raw_control%';"""


def pg_timed_script(st: dict, q: str, n: int, pid: str) -> str:
    """EXECUTE마다 앞뒤로 pg_stat_statements 표본을 찍는다 — 표본 조회는 \\timing 밖 · 결과는 표준 출력(EXECUTE 결과는 /dev/null)."""
    parts = [PG_PREPARE[q], '\\o /dev/null']
    for i in range(n + 1):
        parts += ['\\timing off', '\\o', PGSS_SNAP.format(i=i), '\\o /dev/null']
        if i < n:
            parts += ['\\timing on', pg_execute(st, q, pid)]
    return '\n'.join(parts) + '\n'


def parse_pg_timed(stdout: str, n: int) -> tuple[list[float], list[float | None]]:
    """클라이언트 = psql \\timing(µs 해상도) · 서버 = pg_stat_statements total_exec_time 증가분(ms · µs 해상도).
    서버 값 규칙 — 앞뒤 표본 사이 calls가 정확히 1 늘어난 항목(대조군 테이블을 읽는 문장 · 표본 조회 제외) 중 증가분이 가장 작은 것.
    track = all이면 EXECUTE 안의 준비된 문장(중첩)이 잡힌다 · 후보가 없으면 null(원시에 그대로 — 추정으로 채우지 않는다)."""
    times = [float(m) for m in re.findall(r'^Time: ([\d.]+) ms', stdout, re.M)]
    if len(times) != n:
        die(f'psql \\timing 줄 {len(times)}개 — 기대 {n}: {stdout[-300:]}')
    snaps: dict[int, dict[str, tuple[int, float]]] = {i: {} for i in range(n + 1)}
    for ln in stdout.splitlines():
        f = ln.split('\t')
        if len(f) == 5 and f[0] == 'PSS':
            snaps[int(f[1])][f[2]] = (int(f[3]), float(f[4]))
    server: list[float | None] = []
    for i in range(1, n + 1):
        a, b = snaps[i - 1], snaps[i]
        cand = [b[k][1] - a.get(k, (0, 0.0))[1] for k in b if b[k][0] - a.get(k, (0, 0.0))[0] == 1]
        server.append(round(min(cand), 6) if cand else None)
    return times, server


def pg_timed(st: dict, q: str, n: int, pid: str) -> tuple[list[float], list[float | None]]:
    return parse_pg_timed(pg_script(pg_timed_script(st, q, n, pid)).stdout, n)


def spread(xs: list[float | None]) -> float | None:
    """(최대 − 최소) ÷ 중앙값 — 04 §반복과 폐기의 편차 식을 줄 안 반복 값에 적용한 참고값."""
    v = [x for x in xs if x is not None]
    if len(v) != len(xs) or len(v) < 2 or statistics.median(v) == 0:   # 콜드(값 하나)는 편차가 없다 — null
        return None
    return round((max(v) - min(v)) / statistics.median(v), 6)


def timing_fields(store: str, client: list[float], server: list[float | None]) -> dict:
    """판정 값은 지금까지와 같이 클라이언트 values · median이다(리드 승인 전 전환 금지). 서버 시간을 함께 적는다(05/10 공정성 규칙 4)."""
    return {
        'clientResolutionMs': 1.0 if store == 'clickhouse' else 0.001,
        'clientSource': ('clickhouse-client --time(초 소수 3자리 = 1 ms 해상도 · 컨테이너 안 · 프로세스 기동 제외)' if store == 'clickhouse'
                         else 'psql \\timing(µs 해상도 · 컨테이너 안 한 세션 · 결과 전송 포함)'),
        'server': {'unit': 'ms', 'values': server, 'median': median([x for x in server if x is not None]) if all(x is not None for x in server) else None,
                   'source': ('system.query_log event_time_microseconds − query_start_time_microseconds(µs)' if store == 'clickhouse'
                              else 'pg_stat_statements total_exec_time 증가분(EXECUTE 한 번 · 계획 시간 제외 · µs)')},
        'spread': {'client': spread(client), 'server': spread(server)},
        'medianBasis': 'client',   # 대표값(values · median)은 client ms — 편차 판정 기준은 judgmentSpread
    }


SERVER_TIME_ASYMMETRY = ('서버 시간은 두 엔진이 같은 구간을 재지 않는다 — PostgreSQL: pg_stat_statements total_exec_time(실행만 · '
                         'track_planning off라 계획 시간 제외 · 준비된 문장의 custom plan 계획도 빠진다) · '
                         'ClickHouse: query_log query_start_time_microseconds ~ event_time_microseconds(파싱 · 분석 · 계획 포함 · 결과 전송 포함)')
QUANT_CLIENT_MS = 10.0   # CH client 해상도 1 ms가 값의 10% 이상 — 양자화 값(06 §EXP-29~39 끝 불릿 · 리드 판정 2026-09-27)


def judgment_basis(st: dict, pid: str, q: str, cache: str) -> dict | None:
    """점(점 · 쿼리 · 캐시)의 편차 판정 기준 — 그 점의 첫 ClickHouse 줄에서 한 번 정하고 두 저장소 · 모든 반복 · 변형이 같이 쓴다."""
    return st['stages'][pid].get('judgmentBasis', {}).get(f'{q}|{cache}')


def set_judgment_basis(st: dict, pid: str, q: str, cache: str, ch_client_median: float, rep: int) -> dict:
    jb = st['stages'][pid].setdefault('judgmentBasis', {})
    key = f'{q}|{cache}'
    if key not in jb:
        jb[key] = {'basis': 'server' if ch_client_median < QUANT_CLIENT_MS else 'client',
                   'chClientMedianMs': ch_client_median, 'decidedAtRep': rep}
    return jb[key]


def judgment_spread(basis: dict | None, client: list[float], server: list[float | None]) -> dict:
    """편차 판정에 쓸 값 — 대표값(values · median)은 client ms 그대로다. basis server인데 서버 값이 비면 client로 두고 표지를 남긴다."""
    out = {'basis': 'client', 'value': spread(client),
           'rule': f'점의 CH client 중앙값 < {QUANT_CLIENT_MS:g} ms(1 ms 해상도가 값의 10% 이상 — 양자화)면 두 저장소 모두 server µs로 편차 판정'}
    if basis is None:
        out['basisUnknown'] = True
        return out
    out['chClientMedianMs'] = basis['chClientMedianMs']
    if basis['basis'] == 'server':
        if any(x is None for x in server):
            out['serverNull'] = True
        else:
            out.update({'basis': 'server', 'value': spread(server)})
    return out


def fill_conditions(st: dict, pid: str) -> dict:
    """검수 L2 · L4 — 정밀화 점의 조각 경계 · 스냅샷 복원 뒤 이어 채움을 원시 conditions에 남긴다(기록 조건 칸의 원천)."""
    s = st['stages'][pid]
    if is_stage(pid) and not s.get('restoredFrom'):
        return {}
    out = {'fillChain': point_chain(st, pid),
           'chunkBounds': [c['from'] for c in s.get('chunks', [])] + ([s['chunks'][-1]['to']] if s.get('chunks') else []),
           'chunkSec': s.get('chunkSec')}
    if s.get('restoredFrom'):
        r = s['restoredFrom']
        out['restoredFrom'] = r
        out['fillNote'] = (f"단계 {r['k']} 채움 스냅샷 {r['name']} 복원 → 저장소 재기동(캐시 콜드) → 이어 채움 — "
                           f"단계 {r['k']} 부분의 바이트는 스냅샷과 같고 통계 · 캐시 · 파트 상태는 재기동 · 새 안정화 뒤의 것")
    return out


def record_pair(st: dict, pid: str, q: str, cache: str, store: str, idx: str | None, rep: int, line: dict) -> None:
    """검수 L1(b) — 같은 점 · 반복의 두 저장소 줄이 모이면 kind pair 한 줄. CH client 중앙값 < 10 ms이고 두 client 중앙값 차 < 1 ms(CH 해상도)면
    tieWithinResolution true — 역전 판정은 기록 작성자 · 리드가 이 표지와 server 중앙값을 보고 한다(러너는 표지만)."""
    s = st['stages'][pid]
    pairs = s.setdefault('pairs', {})
    pairs[f"{q}|{cache}|{store}|{idx or '-'}|{rep}"] = {'client': line['median'], 'server': line['server']['median']}
    save_state(st)
    ch = pairs.get(f'{q}|{cache}|clickhouse|-|{rep}')
    pgs = [(k.split('|')[3], v) for k, v in pairs.items() if k.startswith(f'{q}|{cache}|postgresql|') and k.endswith(f'|{rep}')]
    if not ch:
        return
    for pidx, pg in pgs:
        if store == 'postgresql' and pidx != idx:
            continue            # 이번 줄이 PG면 그 변형만 · CH면 이미 잰 변형 전부
        diff = abs(ch['client'] - pg['client'])
        emit({'kind': 'pair', 'exp': EXP_GRID, **point_fields(st, pid), 'query': q, 'cache': cache, 'index': pidx, 'rep': rep,
              'rows': s['rows'], 'chClientMedianMs': ch['client'], 'pgClientMedianMs': pg['client'], 'clientDiffMs': round(diff, 6),
              'chServerMedianMs': ch['server'], 'pgServerMedianMs': pg['server'],
              'tieWithinResolution': ch['client'] < QUANT_CLIENT_MS and diff < 1.0,
              'rule': f'CH client 중앙값 < {QUANT_CLIENT_MS:g} ms이고 |CH − PG| client 중앙값 차 < 1 ms(CH client 해상도) — 판정은 기록 작성자 · 리드'})


def result_file(pid: str, q: str, store: str) -> Path:
    return GRID_DIR / 'results' / f's{pid}' / f'{q}.{store}.tsv'


def capture(st: dict, pid: str, q: str, store: str) -> Path:
    f = result_file(pid, q, store)
    f.parent.mkdir(parents=True, exist_ok=True)
    if store == 'clickhouse':
        f.write_text(chq(CH_SQL[q], param_values(st, q, pid), fmt='TSV'))
    else:
        f.write_text(pg_script(PG_PREPARE[q] + '\n' + pg_execute(st, q, pid) + '\n').stdout)
    return f


def explain(st: dict, pid: str, q: str, index: str) -> dict:
    p = pg_script(PG_PREPARE[q] + '\nEXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + pg_execute(st, q, pid) + '\n')
    f = GRID_DIR / 'explain' / f's{pid}' / f'{q}.{index}.json'
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(p.stdout)
    plan = json.loads(p.stdout)[0]
    nodes, planned, launched = [], 0, 0

    def walk(n: dict) -> None:
        nonlocal planned, launched
        nodes.append(n.get('Node Type') + (f"({n['Index Name']})" if n.get('Index Name') else ''))
        planned += n.get('Workers Planned', 0)
        launched += n.get('Workers Launched', 0)
        for c in n.get('Plans', []):
            walk(c)
    walk(plan['Plan'])
    top = plan['Plan']
    return {'file': str(f), 'executionMs': plan.get('Execution Time'), 'planningMs': plan.get('Planning Time'),
            'sharedHitBlocks': top.get('Shared Hit Blocks'), 'sharedReadBlocks': top.get('Shared Read Blocks'),
            'tempReadBlocks': top.get('Temp Read Blocks'), 'workersPlanned': planned, 'workersLaunched': launched,
            'nodes': nodes, 'actualRows': top.get('Actual Rows')}


def match_state(pid: str, q: str) -> bool | None:
    f = GRID_DIR / 'match' / f's{pid}-{q}.json'
    return json.loads(f.read_text())['resultMatch'] if f.exists() else None


def cmd_query(args: list[str]) -> None:
    if len(args) < 5:
        die('query <점> <clickhouse|postgresql> <I1|I2|-> <반복> <Q1..Q5|Q5x> [단계들: cold,warm,explain,capture]')
    st = load_state()
    pid, store, index, rep, q = parse_pid(args[0]), args[1], args[2], int(args[3]), args[4]
    if q not in QUERIES:
        die(f'쿼리 {q} — {QUERIES}')
    s = require_table_at(st, pid, '쿼리')
    if store == 'clickhouse':
        if index not in ('-', 'null'):
            die('ClickHouse는 인덱스 변형이 없다 — index 자리에 - 를 준다(points의 index null)')
        idx = None
    elif store == 'postgresql':
        if index not in ('I1', 'I2'):
            die('PostgreSQL 변형은 I1 · I2')
        has = btree_present()
        if (index == 'I2') != has:
            die(f'변형 {index}인데 btree {"있음" if has else "없음"} — I1은 i2-drop 뒤, I2는 i2-build 완료 뒤')
        if index == 'I2' and not (st.get('i2') or {}).get('complete'):
            die('I2 빌드가 끝나지 않았다(부모 인덱스 미완)')
        idx = index
    else:
        die('저장소는 clickhouse · postgresql')
    ch_rows_now = int(chq('SELECT count() FROM plc.tag_raw'))
    if ch_rows_now != s['rows']:
        die(f'tag_raw 행 {ch_rows_now} ≠ {pid} check 행 {s["rows"]} — TTL 머지나 다른 적재를 의심한다')
    default = ['cold', 'warm']
    if store == 'postgresql' and rep == 1:
        default.append('explain')
    if not result_file(pid, q, store).exists():
        default.append('capture')
    phases = args[5].split(',') if len(args) > 5 else default
    end = point_end(st, pid)
    base = {'exp': EXP_GRID, 'arm': f'{store}/{idx or "-"}', 'query': q, 'rows': s['rows'], **point_fields(st, pid),
            'store': store, 'index': idx, 'rep': rep, 'unit': 'ms', **run_fields(st),
            'conditions': {'q5Threshold': (st.get('params') or {}).get('v'), 'device': (st.get('params') or {}).get('device'),
                           'tag': (st.get('params') or {}).get('tag'), 'start': st['start'], 'end': iso(end),
                           'direction': 'forward — 데이터 [start, end) · 쿼리 창은 end 기준',
                           'coldApprox': 'OS 페이지 캐시는 Docker VM 안이라 비울 수 없다 — 콜드는 두 저장소 컨테이너 재기동 직후 첫 실행(근사)',
                           'serverTimeAsymmetry': SERVER_TIME_ASYMMETRY, **fill_conditions(st, pid)}}
    tag = f's{pid}-{q}-{store}-{idx or "x"}-r{rep}'
    for ph in phases:
        if ph in ('cold', 'warm') and store == 'postgresql' and judgment_basis(st, pid, q, ph) is None \
                and os.environ.get('FORCE') != '1':
            die(f'{pid} {q} {ph}의 ClickHouse 줄이 아직 없다 — 편차 판정 기준(CH client 중앙값 < {QUANT_CLIENT_MS:g} ms면 server)은 '
                'CH 첫 줄에서 정한다. clickhouse를 먼저 잰다(FORCE=1이면 basisUnknown 표지로 client)')
    for ph in phases:
        t0 = now_utc()
        if ph in ('cold', 'warm'):
            n = 1 if ph == 'cold' else 4
            wait = restart_stores() if ph == 'cold' else None
            if store == 'clickhouse':
                t, ids = ch_timed(CH_SQL[q], param_values(st, q, pid), n, f'{tag}-{ph}')
                ql = ch_query_log(ids)
                srv = [x and x['serverUs'] / 1000.0 for x in ql]
                extra = {'queryLog': ql} if ph == 'cold' else {'queryLog': ql[1:], 'warmupQueryLog': ql[0]}
            else:
                t, srv = pg_timed(st, q, n, pid)
                extra = {}
            vals, srv_vals = (t, srv) if ph == 'cold' else (t[1:], srv[1:])
            if store == 'clickhouse':
                set_judgment_basis(st, pid, q, ph, median(vals), rep)
                save_state(st)
            line = {'kind': 'query', **base, 'cache': ph, 'values': vals, 'median': median(vals),
                    'window': {'start': iso(t0), 'end': iso(now_utc())}, 'resultMatch': match_state(pid, q),
                    **timing_fields(store, vals, srv_vals),
                    'judgmentSpread': judgment_spread(judgment_basis(st, pid, q, ph), vals, srv_vals), **extra}
            if ph == 'cold':
                line['restartWaitSec'] = wait
            else:
                line['warmupMs'] = t[0]
                line['warmupServerMs'] = srv[0]
            emit(line)
            record_pair(st, pid, q, ph, store, idx, rep, line)
        elif ph == 'explain':
            if store != 'postgresql':
                die('explain은 PostgreSQL만(ClickHouse 쪽은 query_log)')
            emit({'kind': 'explain', **{x: base[x] for x in ('exp', 'query', 'rows', 'stage', 'point', 'store', 'index', 'rep')},
                  **explain(st, pid, q, idx), 'note': '시간 판정에 쓰지 않는다 — EXPLAIN 없는 실행이 판정 값이다'})
        elif ph == 'capture':
            f = capture(st, pid, q, store)
            emit({'kind': 'capture', **{x: base[x] for x in ('exp', 'query', 'rows', 'stage', 'point', 'store')}, 'file': str(f),
                  'resultRows': sum(1 for _ in f.open())})
            other = result_file(pid, q, 'postgresql' if store == 'clickhouse' else 'clickhouse')
            if other.exists() and match_state(pid, q) is None:
                cmd_match([pid, q])
        else:
            die(f'단계 {ph} — cold · warm · explain · capture')


# ───────────────────────── match ─────────────────────────

TS_RE = re.compile(r'^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d+)?([+-]\d{2}(?::?\d{2})?)?$')


def ts_ms(s: str) -> int:
    m = TS_RE.match(s.strip())
    if not m:
        die(f'시각 형식 {s!r}')
    frac = int(((m.group(5) or '.0')[1:] + '000')[:3])
    off = m.group(6) or '+09'
    sign = 1 if off[0] == '+' else -1
    oh, om = int(off[1:3]), int(off[-2:]) if len(off) > 3 else 0
    tz = dt.timezone(sign * dt.timedelta(hours=oh, minutes=om))
    t = dt.datetime.fromisoformat(f'{m.group(1)}T{m.group(2)}:{m.group(3)}:{m.group(4)}').replace(tzinfo=tz)
    return int(t.timestamp()) * 1000 + frac


def read_tsv(f: Path) -> list[list[str]]:
    return [ln.split('\t') for ln in f.read_text().splitlines() if ln != '']


def gamma(n: int) -> float:
    return n * U / (1 - n * U)


KEYS = {'Q2': 1, 'Q3': 1, 'Q4': 3}          # 그룹 키 열 수
KEY_TS = {'Q2': (0,), 'Q3': (), 'Q4': (0,)}  # 키 중 시각 열


def keyed(rows: list[list[str]], q: str) -> dict:
    out = {}
    for r in rows:
        key = tuple(ts_ms(r[i]) if i in KEY_TS[q] else int(r[i]) for i in range(KEYS[q]))
        out[key] = r[KEYS[q]:]
    return out


def cmd_match(args: list[str]) -> None:
    st = load_state()
    pid, q = parse_pid(args[0]), args[1]
    require_table_at(st, pid, '결과 대조(보조 조회가 지금 테이블을 읽는다)')
    fc, fp = result_file(pid, q, 'clickhouse'), result_file(pid, q, 'postgresql')
    if not (fc.exists() and fp.exists()):
        die('두 저장소 capture가 모두 있어야 한다')
    a, b = read_tsv(fc), read_tsv(fp)
    detail: dict = {'rowsCh': len(a), 'rowsPg': len(b)}
    ok = True
    if q in ('Q5', 'Q5x'):
        ok = a == b
        detail['countCh'], detail['countPg'] = a[0][0], b[0][0]
    elif q == 'Q1':
        ok = len(a) == len(b) and all(ts_ms(x[0]) == ts_ms(y[0]) and float(x[1]) == float(y[1]) and int(x[2]) == int(y[2])
                                      for x, y in zip(a, b))
    else:
        ka, kb = keyed(a, q), keyed(b, q)
        aux = keyed(read_tsv_str(chq(CH_AUX[q], param_values(st, q, pid))), q)   # 키 → [n, S]
        # 키 뒤 열 순서 — Q2 · Q3: avg · min · max · count / Q4: count · avg · min · max · bad
        # order = (count, avg, min, max, bad) 열 번호
        order = {'Q2': (3, 0, 1, 2, None), 'Q3': (3, 0, 1, 2, None), 'Q4': (0, 1, 2, 3, 4)}[q]
        bad_keys, max_rel = [], 0.0
        if set(ka) != set(kb):
            ok = False
            detail['keyDiff'] = len(set(ka) ^ set(kb))
        for key in ka.keys() & kb.keys():
            x, y = ka[key], kb[key]
            ic, ia, imn, imx, ib = order
            n, s_abs = int(aux[key][0]), float(aux[key][1])
            tol = 2 * gamma(n) * s_abs / n if n else 0.0
            diff = abs(float(x[ia]) - float(y[ia]))
            max_rel = max(max_rel, diff / tol if tol else (0.0 if diff == 0 else math.inf))
            exact = int(x[ic]) == int(y[ic]) == n and float(x[imn]) == float(y[imn]) and float(x[imx]) == float(y[imx])
            if ib is not None:
                exact = exact and int(x[ib]) == int(y[ib])
            if not exact or diff > tol:
                bad_keys.append(list(key))
        ok = ok and not bad_keys
        detail.update({'groups': len(ka), 'mismatchGroups': len(bad_keys), 'mismatchSample': bad_keys[:5],
                       'maxAvgDiffOverBound': max_rel, 'avgBound': '|Δavg| ≤ 2·γ(n)·S/n · γ(n)=n·u/(1−n·u) · u=2^−53'})
        if q == 'Q4':
            roll = keyed(read_tsv_str(chq(CH_ROLLUP_Q4, param_values(st, q, pid))), q)
            rbad = []
            for key in set(ka) | set(roll):
                if key not in ka or key not in roll:
                    rbad.append(list(key))
                    continue
                x, r = ka[key], roll[key]
                n, s_abs = int(aux[key][0]), float(aux[key][1])
                tol = 2 * gamma(n) * s_abs / n if n else 0.0
                if not (int(x[0]) == int(r[0]) and float(x[2]) == float(r[2]) and float(x[3]) == float(r[3])
                        and int(x[4]) == int(r[4]) and abs(float(x[1]) - float(r[1])) <= tol):
                    rbad.append(list(key))
            detail['rollupMatch'] = not rbad
            detail['rollupMismatchGroups'] = len(rbad)
    res = {'resultMatch': ok, **detail}
    f = GRID_DIR / 'match' / f's{pid}-{q}.json'
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(res, ensure_ascii=False))
    emit({'kind': 'match', 'exp': EXP_GRID, **point_fields(st, pid), 'query': q, 'rows': st['stages'][pid]['rows'], **res})


def read_tsv_str(s: str) -> list[list[str]]:
    return [ln.split('\t') for ln in s.splitlines() if ln != '']


# ───────────────────────── I2 ─────────────────────────

def pg_leaves() -> list[tuple[str, int]]:
    r = pgq("""SELECT c.relname, greatest(c.reltuples, 0)::bigint FROM pg_partition_tree('plc_tag_raw_control') p
JOIN pg_class c ON c.oid = p.relid WHERE p.isleaf ORDER BY c.relname""")
    return [(x.split('\t')[0], int(x.split('\t')[1])) for x in r.strip().splitlines()]


def attached_children() -> set[str]:
    r = pgq("""SELECT t.relname FROM pg_partition_tree('plc_tag_raw_control_key_btree') i
JOIN pg_index x ON x.indexrelid = i.relid JOIN pg_class t ON t.oid = x.indrelid WHERE i.isleaf""")
    return set(r.split())


ASYNC_DIR = '/tmp/i2build'       # postgres 컨테이너 안 상태 파일 자리(볼륨 밖 — 스냅샷 크기에 섞이지 않는다)
ASYNC_OVER_ROWS = 10 ** 8       # 리드 판정 ② — 10^8행 초과(5단계 · 10^8~10^9 정밀화 점)만 비동기 · 1~4단계는 동기 유지


def i2_mode(st: dict, pid: str) -> str:
    return 'async' if point_d(st, pid) * TAGS_M > ASYNC_OVER_ROWS else 'sync'


def i2_begin(st: dict, pid: str) -> tuple[dict, dict]:
    s = require_table_at(st, pid, 'I2 빌드')
    i2 = st.get('i2')
    if i2 and i2.get('point') != pid:
        die(f"다른 점({i2.get('point')})의 I2가 남았다 — i2-drop 먼저")
    if not i2:
        before = pg_counters()
        pgq('CREATE INDEX plc_tag_raw_control_key_btree ON ONLY plc_tag_raw_control (device_id, tag_id, ts)')
        i2 = st['i2'] = {'point': pid, 'startedAt': iso(now_utc()), 'buildSec': 0.0, 'walBytes': 0, 'lsnBytes': 0,
                         'parts': [], 'complete': False, 'baseline': before, 'mode': i2_mode(st, pid),
                         'running': None}
        save_state(st)
    return s, i2


def i2_report(st: dict, pid: str, s: dict, i2: dict) -> None:
    valid = pgq("SELECT indisvalid FROM pg_index WHERE indexrelid = 'plc_tag_raw_control_key_btree'::regclass").strip() == 't'
    size = int(pgq("SELECT coalesce(sum(pg_relation_size(relid)), 0) FROM pg_partition_tree('plc_tag_raw_control_key_btree') WHERE isleaf").strip())
    i2['complete'] = valid
    i2['indexBytes'] = size
    save_state(st)
    line = {'exp': EXP_GRID, **point_fields(st, pid), 'rows': s['rows'], **run_fields(st)}
    method = ('CREATE INDEX ON ONLY 부모 → 파티션별 CREATE INDEX + ATTACH(합 = 분할 빌드 시간)' if i2['mode'] == 'sync' else
              'CREATE INDEX ON ONLY 부모 → 파티션별 CREATE INDEX를 postgres 컨테이너 안 psql(docker exec -d)로 · '
              '빌드 시간 = 파티션별 (끝 − 시작 clock_timestamp) 합 · ATTACH는 poll 호출이 동기로')
    emit({'kind': 'i2-build', **line, 'complete': valid, 'mode': i2['mode'], 'buildSec': round(i2['buildSec'], 3), 'indexBytes': size,
          'walBytes': i2['walBytes'], 'lsnBytes': i2['lsnBytes'], 'partitionsBuilt': len(i2['parts']),
          'running': i2.get('running') and {x: i2['running'][x] for x in ('rel', 'tuples', 'startedAt')},
          'partitions': i2['parts'], 'method': method,
          'env': {'maintenance_work_mem': pgq("SHOW maintenance_work_mem").strip(),
                  'max_parallel_maintenance_workers': pgq("SHOW max_parallel_maintenance_workers").strip()}})
    if valid:
        emit({'kind': 'axis', **line, 'axis': 'index_bytes', 'store': 'postgresql', 'index': 'I2', 'value': size, 'unit': 'bytes',
              'indexKind': 'btree(device_id, tag_id, ts) — BRIN은 I1 줄', 'buildSec': round(i2['buildSec'], 3), 'buildWalBytes': i2['walBytes']})
    else:
        print('빌드가 남았다 — ' + ('i2-build-poll을 다시 부른다' if i2['mode'] == 'async' else 'i2-build를 다시 부른다'), file=sys.stderr)


def next_leaf(i2: dict) -> tuple[str, int] | None:
    done = attached_children()
    for rel, tuples in pg_leaves():
        if rel not in done:
            return rel, tuples
    return None


def attach(rel: str) -> float:
    p = pg_script(f'\\timing on\nALTER INDEX plc_tag_raw_control_key_btree ATTACH PARTITION {rel}_key_btree;\n')
    tm = [float(m) for m in re.findall(r'^Time: ([\d.]+) ms', p.stdout, re.M)]
    return tm[0] if tm else None


def cmd_i2_build(args: list[str]) -> None:
    st = load_state()
    pid = parse_pid(args[0]) if args else die('i2-build <점> [예산 초=480]')
    budget = int(args[1]) if len(args) > 1 else 480
    s, i2 = i2_begin(st, pid)
    if i2['mode'] == 'async':
        if i2.get('running'):
            die(f"{i2['running']['rel']} 빌드가 돌고 있다 — i2-build-poll로 이어 간다")
        nxt = next_leaf(i2)
        if nxt:
            async_start(st, i2, *nxt)
        i2_report(st, pid, s, i2)
        return
    t0 = time.time()
    done = attached_children()
    for rel, tuples in pg_leaves():
        if rel in done:
            continue
        rate = (sum(p['tuples'] for p in i2['parts']) / i2['buildSec']) if i2['buildSec'] > 1 else None
        est = tuples / rate if rate else None
        if est is not None and time.time() - t0 + est > budget:
            break
        if est is not None and est > CALL_LIMIT_SEC and os.environ.get('FORCE') != '1':
            die(f'파티션 {rel}({tuples}행) 빌드 추정 {est:.0f}초 — 한 호출 10분을 넘는다. 동기 경로는 1~4단계용 — FORCE=1 또는 판정')
        c0 = pg_counters()
        idx = f'{rel}_key_btree'
        p = pg_script(f'\\timing on\nCREATE INDEX {idx} ON {rel} (device_id, tag_id, ts);\n'
                      f'ALTER INDEX plc_tag_raw_control_key_btree ATTACH PARTITION {idx};\n')
        tm = [float(m) for m in re.findall(r'^Time: ([\d.]+) ms', p.stdout, re.M)]
        c1 = pg_counters()
        i2['parts'].append({'rel': rel, 'tuples': tuples, 'createMs': tm[0] if tm else None, 'attachMs': tm[1] if len(tm) > 1 else None,
                            'walBytes': c1['walBytes'] - c0['walBytes']})
        i2['buildSec'] += (tm[0] if tm else 0) / 1000.0
        i2['walBytes'] += c1['walBytes'] - c0['walBytes']
        i2['lsnBytes'] += lsn_diff(c0['lsn'], c1['lsn'])
        save_state(st)
    i2_report(st, pid, s, i2)


def async_start(st: dict, i2: dict, rel: str, tuples: int) -> None:
    """파티션 하나의 CREATE INDEX를 postgres 컨테이너 안 psql로 띄운다(리드 판정 ② — Soak 표본 컨테이너와 같은 예외).
    상태 파일: {ASYNC_DIR}/{rel}.start · .end(clock_timestamp epoch) · .rc(종료 코드) · .log"""
    busy = int(pgq('SELECT count(*) FROM pg_stat_progress_create_index').strip())
    if busy:
        die(f'다른 인덱스 빌드가 진행 중이다({busy}) — 한 번에 하나만')
    f = f'{ASYNC_DIR}/{rel}'
    ep = "psql -d plc -XAtq -v ON_ERROR_STOP=1 -c 'SELECT extract(epoch FROM clock_timestamp())'"
    sh = (f"mkdir -p {ASYNC_DIR} && rm -f {f}.start {f}.end {f}.rc {f}.log && "
          f"{ep} > {f}.start && "
          f"psql -d plc -Xq -v ON_ERROR_STOP=1 -c 'CREATE INDEX {rel}_key_btree ON {rel} (device_id, tag_id, ts)' > {f}.log 2>&1; "
          f"rc=$?; {ep} > {f}.end; echo $rc > {f}.rc")
    c0 = pg_counters()
    run(['docker', 'exec', '-d', '-u', 'postgres', PG, 'sh', '-c', sh])
    i2['running'] = {'rel': rel, 'tuples': tuples, 'startedAt': iso(now_utc()), 'c0': c0}
    save_state(st)
    print(f'{rel}({tuples}행) 빌드 시작 — 컨테이너 안 {f}.* · i2-build-poll로 확인', file=sys.stderr)


def cat_in_pg(path: str) -> str | None:
    p = run(['docker', 'exec', PG, 'cat', path], check=False)
    return p.stdout.strip() if p.returncode == 0 else None


def cmd_i2_build_poll(args: list[str]) -> None:
    """비동기 빌드 상태를 읽고, 끝난 파티션은 ATTACH · 계측하고 다음 파티션을 띄운다. 최대 대기 초 동안 포그라운드로 기다린다."""
    st = load_state()
    pid = parse_pid(args[0]) if args else die('i2-build-poll <점> [최대 대기 초=480] [간격 초=15]')
    limit = int(args[1]) if len(args) > 1 else 480
    step = int(args[2]) if len(args) > 2 else 15
    s, i2 = i2_begin(st, pid)
    if i2['mode'] != 'async':
        die('동기 경로 단계다 — i2-build를 쓴다')
    t0 = time.time()
    while True:
        r = i2.get('running')
        if not r:
            nxt = next_leaf(i2)
            if not nxt:
                break
            async_start(st, i2, *nxt)
            continue
        f = f"{ASYNC_DIR}/{r['rel']}"
        rc = cat_in_pg(f + '.rc')
        if rc is None:
            prog = pgq("""SELECT phase, blocks_done, blocks_total, tuples_done, tuples_total FROM pg_stat_progress_create_index""").strip()
            if not prog:
                # CREATE INDEX가 끝난 직후 · .rc를 쓰기 전(뒤 psql 한 번)의 틈일 수 있다 — 잠깐 기다려 한 번 더 읽는다(검수 #9)
                time.sleep(5)
                if cat_in_pg(f + '.rc') is not None:
                    continue
                die(f"{r['rel']} 상태 파일에 종료 코드가 없는데 진행 중인 빌드도 없다 — 컨테이너 재기동 등으로 끊겼을 수 있다. {f}.log 확인")
            if time.time() - t0 + step > limit:
                print(f"진행 중 {r['rel']} — {prog}", file=sys.stderr)
                break
            time.sleep(step)
            continue
        if rc != '0':
            die(f"{r['rel']} CREATE INDEX 실패(rc {rc}) — {cat_in_pg(f + '.log')}")
        start, end_ = float(cat_in_pg(f + '.start')), float(cat_in_pg(f + '.end'))
        c1 = pg_counters()
        attach_ms = attach(r['rel'])
        i2['parts'].append({'rel': r['rel'], 'tuples': r['tuples'], 'createSec': round(end_ - start, 3), 'attachMs': attach_ms,
                            'walBytes': c1['walBytes'] - r['c0']['walBytes'], 'startEpoch': start, 'endEpoch': end_})
        i2['buildSec'] += end_ - start
        i2['walBytes'] += c1['walBytes'] - r['c0']['walBytes']
        i2['lsnBytes'] += lsn_diff(r['c0']['lsn'], c1['lsn'])
        i2['running'] = None
        save_state(st)
        run(['docker', 'exec', PG, 'rm', '-f', f + '.start', f + '.end', f + '.rc', f + '.log'], check=False)
    i2_report(st, pid, s, i2)


def cmd_i2_drop(args: list[str]) -> None:
    st = load_state()
    pid = parse_pid(args[0]) if args else die('i2-drop <점>')
    if not btree_present():
        die('btree가 없다')
    c0 = pg_counters()
    p = pg_script('\\timing on\nDROP INDEX plc_tag_raw_control_key_btree;\n')
    tm = [float(m) for m in re.findall(r'^Time: ([\d.]+) ms', p.stdout, re.M)]
    c1 = pg_counters()
    prev = st.get('i2')
    st['i2'] = None
    save_state(st)
    emit({'kind': 'i2-drop', 'exp': EXP_GRID, **point_fields(st, pid), 'dropMs': tm[0] if tm else None,
          'walBytes': c1['walBytes'] - c0['walBytes'], 'builtPoint': prev and prev.get('point')})
    if is_stage(pid) and int(pid) in SNAPSHOT_STAGES and str(int(pid)) not in st.get('snapshots', {}):
        print(f'다음: grid.sh snapshot {pid}(정밀화 복원점) → 그 뒤 budget {int(pid) + 1}', file=sys.stderr)


# ───────────────────────── budget ─────────────────────────

def cmd_budget(args: list[str]) -> None:
    """점 p 진입 전 — 디스크 예산 식 · 적재 시간 예산(§대조 실험 조정값). 미래 방향 누적이라 머리(S)가 모든 점에 같다 —
    남은 시간 = S + 보존 − 지금이 격자 · 스냅샷 · 정밀화 전부의 상한이다."""
    st = load_state()
    pid = parse_pid(args[0]) if args else die('budget <진입할 점>')
    if not is_stage(pid) and 'd' not in st['stages'].get(pid, {}):
        die(f'정밀화 점 {pid}이 등록되지 않았다 — refine 먼저')
    host = run(['df', '-k', str(Path.home())]).stdout.strip().splitlines()[-1].split()
    host_free = int(host[3]) * 1024
    vm = run(['docker', 'exec', CH, 'df', '-k', '/var/lib/clickhouse']).stdout.strip().splitlines()[-1].split()
    vm_total, vm_free = int(vm[1]) * 1024, int(vm[3]) * 1024
    snap = volumes_bytes()
    ch_now = ch_parts_totals()
    ch_row = ch_now['bytesOnDisk'] / ch_now['rows'] if ch_now['rows'] else DERIVED_CH_ROW
    base = point_base(st, pid)
    r_cur = point_d(st, base) * TAGS_M if base else 0
    r_next = point_d(st, pid) * TAGS_M
    max_wal = int(pgq("SELECT setting::bigint * 1024 * 1024 FROM pg_settings WHERE name = 'max_wal_size'").strip())
    need = {'controlHeap': (r_next - r_cur) * DERIVED_HEAP_ROW, 'i2Btree': r_next * DERIVED_BTREE_ROW,
            'clickhouse': int((r_next - r_cur) * ch_row), 'walMargin': max_wal}
    need['total'] = sum(need.values())
    free = min(host_free, vm_free)
    alert = int(0.20 * vm_total)
    lhs = free - alert - snap
    ttl = re.search(r'(?:toIntervalDay\((\d+)\)|INTERVAL (\d+) DAY)', chq("SELECT engine_full FROM system.tables WHERE database = 'plc' AND name = 'tag_raw'"))
    retention = int(ttl.group(1) or ttl.group(2)) * 86400 if ttl else die('tag_raw TTL을 읽지 못했다')
    head_expire = start_of(st) + dt.timedelta(seconds=retention)
    remain = (head_expire - now_utc()).total_seconds()
    prev = st['stages'].get(base, {}) if base else {}
    rate = prev.get('lastWallRowsPerSec')
    est_fill = (r_next - r_cur) / rate if rate else None
    # 단계 전체(채우기 · check · settle · axes · 쿼리 · I2 빌드 · drop) 경과 추정 — 앞 단계 실측 경과 × 행 비(선형 · 보수적)
    # 앞 단계 기록이 없으면 채우기 추정만 쓴다(1단계) — 1계층 관계의 좌변은 마지막 쿼리까지다(검수 #5)
    prev_elapsed = None
    if prev.get('firstAt') and prev.get('lastAt'):
        prev_elapsed = (parse_iso(prev['lastAt']) - parse_iso(prev['firstAt'])).total_seconds()
    prev_rows = prev.get('rows') or 0
    est_stage = prev_elapsed * (r_next / prev_rows) if prev_elapsed and prev_rows else None
    est_total = max(x for x in (est_fill, est_stage, 0) if x is not None)
    emit({'kind': 'budget', 'exp': EXP_GRID, **point_fields(st, pid), 'rows': r_next, 'baseRows': r_cur,
          'disk': {'formula': '여유 − 디스크 잔여 알림 문턱 − 다음 스냅샷 크기(현재 볼륨 합) ≥ 다음 단계 도출 크기',
                   'hostFreeBytes': host_free, 'vmFreeBytes': vm_free, 'vmTotalBytes': vm_total, 'freeBytes': free,
                   'alertThresholdBytes': alert, 'alertRule': 'disk_low ch_disk_free/ch_disk_total < 0.20',
                   'snapshotBytes': snap, 'lhsBytes': lhs, 'need': need,
                   'chBytesPerRow': ch_row, 'chBytesPerRowSource': '현재 단계 실측' if ch_now['rows'] else '원본 산정 4 B',
                   'ok': lhs >= need['total']},
          'time': {'retentionSec': retention, 'dSec': point_d(st, pid), 'budgetSec': retention - point_d(st, pid),
                   'relation': '점 p 채우기 시작 ~ 마지막 쿼리 경과 < 원시 보존 − D_p',
                   'headExpiresAt': iso(head_expire), 'remainingSec': round(remain),
                   'remainingNote': '미래 방향 누적 — 머리 S가 모든 점에 같아 S + 보존 − 지금이 남은 격자 · 스냅샷 · 정밀화 전부의 상한이다',
                   'estFillSec': round(est_fill) if est_fill else None,
                   'prevStageElapsedSec': round(prev_elapsed) if prev_elapsed else None,
                   'estStageSec': round(est_stage) if est_stage else None,
                   'estimate': 'base 점 firstAt~lastAt 경과 × (이 점 행 ÷ base 점 행) · 채우기 추정 중 큰 값',
                   'marginSec': round(remain - est_total), 'ok': remain > est_total}})


VOLUMES = ('pgdata', 'chdata', 'redisdata', 'spooldata')   # Taskfile VOLUMES — 네 볼륨은 한 몸(스냅샷 · 복원은 함께)
TAR_IMAGE = 'postgres:18.6-alpine'                          # Taskfile TAR_IMAGE(busybox tar · 버전 고정표의 태그 고정 이미지)
PROJECT = 'db_study'


def volume_sizes() -> dict[str, int]:
    """볼륨별 du(바이트) — 디스크 예산 식의 "다음 스냅샷 크기" · 스냅샷 · 복원 소요 추정의 원천."""
    vols = [f'{PROJECT}_{v}' for v in VOLUMES]
    mounts = sum((['-v', f'{v}:/v/{v}:ro'] for v in vols), [])
    du = run(['docker', 'run', '--rm', *mounts, TAR_IMAGE, 'du', '-sk', *[f'/v/{v}' for v in vols]]).stdout
    out = {}
    for x in du.strip().splitlines():
        kb, path = x.split()[:2]
        out[path.rsplit('/', 1)[-1].removeprefix(f'{PROJECT}_')] = int(kb) * 1024
    return out


def volumes_bytes() -> int:
    return sum(volume_sizes().values())


# ───────────────────────── 채움 스냅샷 · 복원 · 정밀화 ─────────────────────────
# 스냅샷 · 복원은 두 경로다. 전체 추정 ≤ 540초면 task snapshot · task restore 한 호출.
# 넘으면 볼륨별 경로 — 첫 호출이 컨테이너를 멈추고(스냅샷은 manifest도 쓴다) 볼륨 하나 = 호출 하나로 tar를 부르고,
# 마지막 볼륨 호출이 저장소를 다시 띄운다. 산출 형식(snapshots/NAME/{볼륨}.tar.gz · manifest.txt)은 Taskfile과 같아 서로 복원된다.
# 볼륨별 경로가 진행 중인 동안(state.volumeOp) 다른 하위 명령은 거부한다 — 컨테이너가 멈춰 있다.

def snapshot_name(k: int) -> str:
    """스냅샷 이름 규칙 — {GRID_DIR 이름}-s{k}(예: lab-s5-grid-f-s4). task snapshot은 같은 이름을 거부한다 — 격자마다 GRID_DIR가 달라 겹치지 않는다."""
    return f'{GRID_DIR.name}-s{k}'


def snapshot_dir(name: str) -> Path:
    return Path('snapshots') / name


def stop_api() -> None:
    """task snapshot · restore는 compose start/stop을 프로젝트 전체에 건다 — 멈춘 api 컨테이너가 있으면 restore의 start가 그것을 다시 띄운다."""
    run(compose_cmd('GCOMPOSE') + ['rm', '-sf', 'api'], check=False)


def op_rate(st: dict) -> float:
    return st.get('snapshotRateBps') or SNAPSHOT_RATE_BPS


def volume_arg(args: list[str]) -> str | None:
    if '--volume' not in args:
        return None
    i = args.index('--volume')
    v = args[i + 1] if i + 1 < len(args) else die('--volume <pgdata|chdata|redisdata|spooldata>')
    if v not in VOLUMES:
        die(f'볼륨 {v} — {VOLUMES}')
    return v


def volume_exists(v: str) -> bool:
    return run(['docker', 'volume', 'inspect', f'{PROJECT}_{v}'], check=False).returncode == 0


def write_manifest(name: str) -> None:
    """Taskfile snapshot의 manifest.txt와 같은 줄들(name · created_utc · git_commit · git_dirty · container.*) — volume.* 줄은 볼륨 호출이 덧붙인다."""
    d = snapshot_dir(name)
    d.mkdir(parents=True)
    dirty = run(['git', 'status', '--porcelain', '--untracked-files=no']).stdout.strip() != ''
    lines = [f'name={name}', f"created_utc={now_utc().strftime('%Y-%m-%dT%H:%M:%SZ')}",
             f"git_commit={run(['git', 'rev-parse', '--short', 'HEAD']).stdout.strip()}", f"git_dirty={'yes' if dirty else 'no'}"]
    for s in ('postgres', 'clickhouse', 'redis'):
        c = f'{PROJECT}-{s}-1'
        p = run(['docker', 'inspect', '-f', '{{.Config.Image}} mem={{.HostConfig.Memory}} cpuset={{.HostConfig.CpusetCpus}}', c], check=False)
        lines.append(f'container.{s}={p.stdout.strip() if p.returncode == 0 else "absent"}')
    (d / 'manifest.txt').write_text('\n'.join(lines) + '\n')


def restart_after_volume_op() -> float:
    run(['docker', 'start', *STORE_CONTAINERS])
    return wait_stores()


def op_flags(args: list[str]) -> tuple[str | None, bool, bool]:
    fin, ab = '--finish' in args, '--abort' in args
    vol = volume_arg(args)
    if sum((vol is not None, fin, ab)) > 1:
        die('--volume · --finish · --abort는 하나만')
    return vol, fin, ab


def remaining(op: dict) -> list[str]:
    return [v for v in op['volumes'] if v not in op['done']]


def require_op(st: dict, kind: str, k: int) -> dict:
    op = st.get('volumeOp')
    if not op or op['op'] != kind or op['k'] != k:
        die(f'진행 중인 {kind} {k}이 없다(volumeOp {op and (op["op"], op["k"])})')
    return op


# 상태 모양 규칙(검수 M2) — volumeOp는 작업 시작 전에 기록하고, 재기동 · 확인이 성공한 뒤에만 지운다.
# 도중 실패(tar · task · 재기동 · 확인)는 volumeOp를 남기므로 --finish(남은 마무리만 다시) 또는 --abort(정리 · 재기동 · 해제)로 풀 수 있다.

def finish_snapshot(st: dict, op: dict) -> None:
    """스냅샷 마무리 — 재기동 → 기록 → volumeOp 해제(이 순서라 재기동이 실패해도 --finish로 다시 부를 수 있다)."""
    k, name, sizes = op['k'], op['name'], op['sizes']
    wait = restart_after_volume_op()
    vb = sum(sizes.values())
    s = st['stages'][str(k)]
    arch = sum(f.stat().st_size for f in snapshot_dir(name).glob('*.tar.gz'))
    sec = op['sec']
    st['snapshotRateBps'] = vb / sec if sec > 1 else op_rate(st)
    st.setdefault('snapshots', {})[str(k)] = {'name': name, 'rows': s['rows'], 'volumeBytes': vb, 'volumeSizes': sizes, 'archiveBytes': arch,
                                              'sec': round(sec, 1), 'at': iso(now_utc()), 'path': op['path']}
    st['volumeOp'] = None
    save_state(st)
    emit({'kind': 'snapshot', 'exp': EXP_GRID, **point_fields(st, str(k)), 'rows': s['rows'], 'name': name, 'volumeBytes': vb,
          'archiveBytes': arch, 'sec': round(sec, 1), 'restartWaitSec': wait, 'path': op['path'],
          'note': '정밀화 복원점 — 단계 끝(i2-drop 뒤) · 컨테이너 정지 · 볼륨 4개 tar.gz(Taskfile 형식)'})


def manifest_complete(name: str) -> bool:
    f = snapshot_dir(name) / 'manifest.txt'
    lines = f.read_text().splitlines() if f.exists() else []
    return all(any(ln.startswith(f'volume.{v}=') for ln in lines) for v in VOLUMES)


def cmd_snapshot(args: list[str]) -> None:
    """snapshot <k> [--volume v | --finish | --abort] — 단계 k(1~4) 끝의 채움 스냅샷(정밀화 복원점). 단계의 쿼리 · I2 빌드 · i2-drop이 모두 끝난 뒤, 다음 단계 fill 전.
    전체 추정 ≤ 540초면 task snapshot 한 호출 · 넘으면 첫 호출이 정지 · manifest만 하고 볼륨마다 --volume 호출을 안내한다.
    --finish: 볼륨이 다 묶였는데 재기동 · 기록이 실패했을 때 그것만 다시 · --abort: 부분 디렉터리를 지우고 재기동 · 해제."""
    st = load_state()
    k = int(args[0]) if args and args[0].isdigit() else die('snapshot <단계 1~4> [--volume v | --finish | --abort]')
    vol, fin, ab = op_flags(args)
    if k not in SNAPSHOT_STAGES:
        die('채움 스냅샷은 단계 1~4 — 5단계 위 정밀화 구간은 없다(6단계 없음)')
    if vol or fin or ab:
        op = require_op(st, 'snapshot', k)
        if vol:
            snapshot_volume(st, op, vol)
        elif fin:
            if not manifest_complete(op['name']):
                die(f"manifest에 볼륨 줄이 다 없다 — 남은 볼륨 {remaining(op)}(task 경로 실패면 --abort 뒤 다시)")
            finish_snapshot(st, op)
        else:
            d = snapshot_dir(op['name'])
            if d.exists():
                shutil.rmtree(d)
            wait = restart_after_volume_op()
            st['volumeOp'] = None
            save_state(st)
            emit({'kind': 'snapshot-abort', 'exp': EXP_GRID, **point_fields(st, str(k)), 'name': op['name'], 'path': op['path'],
                  'done': op['done'], 'restartWaitSec': wait})
        return
    if st.get('volumeOp'):
        op = st['volumeOp']
        die(f"{op['op']} {op['k']}이 진행 중이다 — 남은 볼륨 {remaining(op)} · 또는 --finish · --abort")
    pid = str(k)
    s = require_table_at(st, pid, '채움 스냅샷')
    if not s.get('axes'):
        die(f'{pid} 비 쿼리 축(axes)이 먼저다 — 스냅샷은 단계 측정이 끝난 뒤(재기동이 누적 계수기 · 캐시 상태를 끊는다)')
    if btree_present() or st.get('i2'):
        die('I2 btree가 있다 — i2-drop 뒤에 뜬다(정밀화 점은 I1 상태에서 채운다)')
    name = snapshot_name(k)
    if snapshot_dir(name).exists():
        die(f'snapshots/{name} 이 이미 있다')
    sizes = volume_sizes()
    vb = sum(sizes.values())
    rate = op_rate(st)
    big = {v: b / rate for v, b in sizes.items() if b / rate > CALL_LIMIT_SEC}
    if big and os.environ.get('FORCE') != '1':
        die(f'볼륨 하나의 추정이 {CALL_LIMIT_SEC}초를 넘는다 {big} — 볼륨별 경로로도 한 호출에 끝나지 않는다(판정 필요)')
    path = 'task' if vb / rate <= CALL_LIMIT_SEC else 'volume'
    op = st['volumeOp'] = {'op': 'snapshot', 'k': k, 'name': name, 'path': path, 'volumes': list(VOLUMES), 'done': [],
                           'sizes': sizes, 'sec': 0.0, 'startedAt': iso(now_utc())}
    save_state(st)
    stop_api()
    if path == 'task':
        print(f'볼륨 {vb / 2**30:.2f} GiB · 추정 {vb / rate:.0f}초 — task snapshot NAME={name}', file=sys.stderr)
        t0 = time.time()
        run(['task', 'snapshot', f'NAME={name}'])   # 실패하면 volumeOp가 남는다 — --abort
        op['sec'] = time.time() - t0
        op['done'] = list(VOLUMES)
        save_state(st)
        finish_snapshot(st, op)
        return
    write_manifest(name)
    run(compose_cmd('GCOMPOSE') + ['stop'])
    print(f'볼륨 {vb / 2**30:.2f} GiB · 추정 {vb / rate:.0f}초 > {CALL_LIMIT_SEC}초 — 볼륨별 경로. 컨테이너 정지 · manifest 작성 완료. 다음 호출(하나씩):',
          file=sys.stderr)
    for v in VOLUMES:
        print(f'  grid.sh snapshot {k} --volume {v}   (추정 {sizes.get(v, 0) / rate:.0f}초)', file=sys.stderr)


def snapshot_volume(st: dict, op: dict, v: str) -> None:
    if op['path'] != 'volume':
        die('task 경로 스냅샷이다 — --finish 또는 --abort')
    if v in op['done']:
        die(f'{v}는 이미 묶었다 — 남은 볼륨 {remaining(op)}' + ('' if remaining(op) else ' · --finish'))
    d = snapshot_dir(op['name'])
    t0 = time.time()
    if volume_exists(v):
        run(['docker', 'run', '--rm', '-v', f'{PROJECT}_{v}:/v:ro', '-v', f'{d.resolve()}:/out', TAR_IMAGE,
             'tar', '--numeric-owner', '-C', '/v', '-czf', f'/out/{v}.tar.gz', '.'])
        line = f'volume.{v}=archived {(d / f"{v}.tar.gz").stat().st_size}B'
    else:
        line = f'volume.{v}=absent'
    with (d / 'manifest.txt').open('a') as f:
        f.write(line + '\n')
    op['sec'] += time.time() - t0
    op['done'].append(v)
    save_state(st)
    print(f'{line} · {time.time() - t0:.0f}초 · 남은 볼륨 {remaining(op)}', file=sys.stderr)
    if not remaining(op):
        finish_snapshot(st, op)


def verify_restored(st: dict, op: dict, snap: dict, wait: float) -> None:
    """복원 확인 — volumeOp를 먼저 해제하고 tableAt을 비운 뒤 잰다(확인이 실패해도 상태는 "복원 다시"만 남는다 · 검수 M2)."""
    k = op['k']
    st['volumeOp'] = None
    st['tableAt'] = None
    st['i2'] = None
    save_state(st)
    res = {'clickhouse': container_res(CH), 'postgres': container_res(PG)}
    bad = control_resources_ok(res)
    start, end = start_of(st), point_end(st, str(k))
    ch_n = int(chq('SELECT count() FROM plc.tag_raw'))
    pg_n = int(pgq('SELECT count(*) FROM plc_tag_raw_control'))
    ch_out = int(chq(f"SELECT count() FROM plc.tag_raw WHERE ts < toDateTime64('{kst_text(start)}', 3, 'Asia/Seoul') "
                     f"OR ts >= toDateTime64('{kst_text(end)}', 3, 'Asia/Seoul')"))
    ok = not bad and ch_n == pg_n == snap['rows'] and ch_out == 0 and not btree_present()
    if ok:
        st['tableAt'] = str(k)
        st['lastRestore'] = {'k': str(k), 'name': snap['name'], 'at': iso(now_utc()), 'path': op['path']}
    save_state(st)
    emit({'kind': 'restore', 'exp': EXP_GRID, **point_fields(st, str(k)), 'name': snap['name'], 'rows': ch_n, 'controlRows': pg_n,
          'expectRows': snap['rows'], 'outside': ch_out, 'resourceProblems': bad, 'ok': ok, 'sec': round(op['sec'], 1),
          'restartWaitSec': wait, 'path': op['path']})
    if not ok:
        die(f'복원 확인 실패 — 자원 {bad} · tag_raw {ch_n} · 대조군 {pg_n} · 기대 {snap["rows"]} · 구간 밖 {ch_out} — restore {k}를 다시')


def finish_restore(st: dict, op: dict, snap: dict) -> None:
    """복원 마무리 — 스냅샷 때 없던 볼륨(manifest absent)을 비우고(멱등) 재기동 → 확인. 재기동이 실패하면 volumeOp가 남는다(--finish)."""
    d = snapshot_dir(op['name'])
    for ln in (d / 'manifest.txt').read_text().splitlines():
        m = re.fullmatch(r'volume\.(\w+)=absent', ln.strip())
        if m and volume_exists(m.group(1)):
            run(['docker', 'run', '--rm', '-v', f'{PROJECT}_{m.group(1)}:/v', TAR_IMAGE, 'find', '/v', '-mindepth', '1', '-delete'])
    verify_restored(st, op, snap, restart_after_volume_op())


def cmd_restore(args: list[str]) -> None:
    """restore <k> [--volume v | --finish | --abort] — 단계 k 채움 스냅샷으로 되돌린다(정밀화 m1 · m2 lower 앞). 복원 뒤 두 저장소 행 수가
    단계 k와 같고 [S, S + D_k) 밖이 0인지 확인한다. 추정 > 540초면 볼륨별 경로(첫 호출 정지 · --volume마다 한 볼륨 · 마지막이 기동 · 확인).
    --finish: 볼륨이 다 풀렸는데 재기동 · 확인이 실패했을 때 그것만 다시 · --abort: 재기동 · 해제 · tableAt 비움(볼륨이 섞였을 수 있다 — restore k를 처음부터)."""
    st = load_state()
    k = int(args[0]) if args and args[0].isdigit() else die('restore <단계 1~4> [--volume v | --finish | --abort]')
    vol, fin, ab = op_flags(args)
    snap = st.get('snapshots', {}).get(str(k)) or die(f'단계 {k} 채움 스냅샷이 상태에 없다 — snapshot {k}')
    d = snapshot_dir(snap['name'])
    if not d.exists():
        die(f"snapshots/{snap['name']} 이 없다")
    if vol or fin or ab:
        op = require_op(st, 'restore', k)
        if vol:
            restore_volume(st, op, snap, vol)
        elif fin:
            if remaining(op):
                die(f'남은 볼륨 {remaining(op)} — 먼저 --volume으로 되돌린다(task 경로 실패면 --abort 뒤 다시)')
            finish_restore(st, op, snap)
        else:
            wait = restart_after_volume_op()
            st.update({'volumeOp': None, 'tableAt': None, 'i2': None})
            save_state(st)
            emit({'kind': 'restore-abort', 'exp': EXP_GRID, **point_fields(st, str(k)), 'name': snap['name'], 'path': op['path'],
                  'done': op['done'], 'restartWaitSec': wait, 'note': '볼륨이 섞였을 수 있다 — tableAt 비움 · restore를 처음부터'})
        return
    if st.get('volumeOp'):
        op = st['volumeOp']
        die(f"{op['op']} {op['k']}이 진행 중이다 — 남은 볼륨 {remaining(op)} · 또는 --finish · --abort")
    rate = op_rate(st)
    arch = sorted(f.name.removesuffix('.tar.gz') for f in d.glob('*.tar.gz'))
    sizes = snap.get('volumeSizes') or {}
    big = {v: b / rate for v, b in sizes.items() if b / rate > CALL_LIMIT_SEC}
    if big and os.environ.get('FORCE') != '1':
        die(f'볼륨 하나의 복원 추정이 {CALL_LIMIT_SEC}초를 넘는다 {big} — 볼륨별 경로로도 한 호출에 끝나지 않는다(판정 필요)')
    path = 'task' if snap['volumeBytes'] / rate <= CALL_LIMIT_SEC else 'volume'
    op = st['volumeOp'] = {'op': 'restore', 'k': k, 'name': snap['name'], 'path': path, 'volumes': arch, 'done': [],
                           'sec': 0.0, 'startedAt': iso(now_utc())}
    st['tableAt'] = None          # 복원을 시작하면 테이블 상태는 확인 전까지 모른다
    save_state(st)
    stop_api()
    if path == 'task':
        t0 = time.time()
        run(['task', 'restore', f"NAME={snap['name']}"])   # 실패하면 volumeOp가 남는다 — --abort 뒤 다시
        op['sec'] = time.time() - t0
        op['done'] = list(arch)
        save_state(st)
        verify_restored(st, op, snap, restart_after_volume_op())
        return
    run(compose_cmd('GCOMPOSE') + ['stop'])
    print(f"추정 {snap['volumeBytes'] / rate:.0f}초 > {CALL_LIMIT_SEC}초 — 볼륨별 경로. 컨테이너 정지 완료. 다음 호출(하나씩):", file=sys.stderr)
    for v in arch:
        print(f'  grid.sh restore {k} --volume {v}' + (f'   (추정 {sizes[v] / rate:.0f}초)' if v in sizes else ''), file=sys.stderr)


def restore_volume(st: dict, op: dict, snap: dict, v: str) -> None:
    if op['path'] != 'volume':
        die('task 경로 복원이다 — --abort 뒤 다시')
    if v in op['done'] or v not in op['volumes']:
        die(f'{v}는 이미 되돌렸거나 스냅샷에 없다 — 남은 볼륨 {remaining(op)}' + ('' if remaining(op) else ' · --finish'))
    d = snapshot_dir(op['name'])
    t0 = time.time()
    if not volume_exists(v):
        run(['docker', 'volume', 'create', '--label', f'com.docker.compose.project={PROJECT}',
             '--label', f'com.docker.compose.volume={v}', f'{PROJECT}_{v}'])
    run(['docker', 'run', '--rm', '-v', f'{PROJECT}_{v}:/v', '-v', f'{d.resolve()}:/in:ro', TAR_IMAGE,
         'sh', '-c', f'find /v -mindepth 1 -delete && tar --numeric-owner -C /v -xzpf /in/{v}.tar.gz'])
    op['sec'] += time.time() - t0
    op['done'].append(v)
    save_state(st)
    print(f'restored {v} · {time.time() - t0:.0f}초 · 남은 볼륨 {remaining(op)}', file=sys.stderr)
    if not remaining(op):
        finish_restore(st, op, snap)


VOLUME_OP_ALLOWED = {'snapshot', 'restore', 'status', 'plan', 'plan-refine'}


def guard_volume_op(cmd: str) -> None:
    """볼륨별 스냅샷 · 복원 중에는 컨테이너가 멈춰 있다 — 다른 하위 명령을 거부한다."""
    if cmd in VOLUME_OP_ALLOWED or not STATE.exists():
        return
    st = json.loads(STATE.read_text())
    op = st.get('volumeOp')
    if op:
        die(f"{op['op']} {op['k']}이 진행 중이거나 도중에 멈췄다(컨테이너 정지일 수 있다) — 남은 볼륨 {remaining(op)} · "
            f"또는 grid.sh {op['op']} {op['k']} --finish | --abort")


def cmd_refine(args: list[str]) -> None:
    """refine <j> [lower|upper] — 정밀화 점 등록. 인자 없는 쪽이 m1(구간 로그 중점) · m1을 잰 뒤 역전이 든 반쪽을 리드가 골라 m2를 등록한다.
    역전 구간은 쿼리 · 변형 · 캐시마다 다를 수 있다 — 같은 구간에서 두 반쪽이 다 필요하면 upper(이어 채움)를 먼저, lower(복원)를 뒤에."""
    st = load_state()
    if not args:
        die('refine <구간 아래 단계 j = 1~4> [lower|upper]')
    j = int(args[0])
    side = args[1] if len(args) > 1 else None
    if j not in SNAPSHOT_STAGES or side not in REFINE_FRACS:
        die('refine <j = 1~4> [lower|upper]')
    for p in (str(j), str(j + 1)):
        if not st['stages'].get(p, {}).get('checked'):
            die(f'단계 {p}가 측정되지 않았다 — 교차 구간은 두 단계 결과로 정한다')
    m1 = refine_pid(j, None)
    if side and not (st['stages'].get(m1, {}).get('checked') and st['stages'][m1].get('axes')):
        die(f'm1 {m1}을 먼저 잰다 — m2의 반쪽은 m1 결과로 고른다')
    if str(j) not in st.get('snapshots', {}):
        die(f'단계 {j} 채움 스냅샷이 없다 — m1 · m2 lower는 그 스냅샷에서 이어 채운다')
    pid = register_refine(st, j, side)
    save_state(st)
    r = st['stages'][pid]
    emit({'kind': 'refine', 'exp': EXP_GRID, **point_fields(st, pid), 'd': r['d'], 'rowsNominal': r['d'] * TAGS_M,
          'base': r['base'], 'end': iso(point_end(st, pid))})
    base = r['base']
    if st.get('tableAt') != base:
        how = f'restore {base}' if is_stage(base) else f'테이블이 {base} 상태가 아니다 — restore {j} → refine {j} → fill {base} … 다시'
        print(f'다음: {how} → budget {pid} → fill {pid}', file=sys.stderr)
    else:
        print(f'다음: budget {pid} → fill {pid}(테이블이 이미 base {base} 상태)', file=sys.stderr)


REFILL_KEYS = ('chunks', 'chunkSec', 'baseline', 'chFillStart', 'fillStartAt', 'firstAt', 'lastAt', 'fillEnd', 'fillEndAt',
               'checked', 'rows', 'settled', 'settledAt', 'axes', 'lastWallRowsPerSec', 'judgmentBasis', 'pairs', 'restoredFrom')


def cmd_refill(args: list[str]) -> None:
    """refill <점> — 복원 뒤(tableAt == base) 그 점을 다시 채우려고 앞 채움의 기록을 보관하고 초기화한다(검수 M3 · L3 · R1).
    정밀화 점과 단계 점 모두 — 단계 k의 base는 k − 1(그 채움 스냅샷이 있어야 한다) · 1단계는 빈 테이블(두 저장소 0행 확인).
    보관: 상태 stages[p].history[] · 결과 · 대조 · EXPLAIN 파일은 *.refill-{n}으로 옮긴다 · 원시 kind refill-reset 한 줄.
    초기화: 조각 · 기준 계수기 · chFillStart · firstAt · checked · 안정화 · 축 · 속도 · 편차 판정 기준(복원 뒤 재측정은 새 측정 — 기준도 새로)
    — d · base · refine은 그대로. 단계 점의 옛 채움 스냅샷(snapshots[k])이 있으면 이름을 NAME.refill-{n}으로 옮기고 상태에서 뺀다(새 스냅샷을 뜰 수 있게)."""
    st = load_state()
    pid = parse_pid(args[0]) if args else die('refill <점>')
    s = st['stages'].get(pid) or die(f'{pid}은 채운 적이 없다 — fill로 바로 채운다')
    base = point_base(st, pid)
    # 1단계의 base는 빈 테이블 — 빈 스냅샷 복원은 러너 밖(task restore)이라 tableAt이 따라오지 않는다. 실제 0행 확인이 조건이다(아래)
    if base is not None and st.get('tableAt') != base:
        how = f'restore {base}' if is_stage(base) else f'restore {int(point_exp(base)) - 4} → refill {base} → {base} 다시 채움'
        die(f"테이블이 base {base} 상태가 아니다(지금 {st.get('tableAt')}) — {how} → refill {pid} → fill {pid}")
    if is_stage(pid) and base and base not in st.get('snapshots', {}):
        die(f'단계 {base} 채움 스냅샷이 상태에 없다 — {pid}를 다시 채울 복원점이 없다(새 GRID_DIR로 격자를 다시 시작)')
    if base is None:
        ch_n, pg_n = int(chq('SELECT count() FROM plc.tag_raw')), int(pgq('SELECT count(*) FROM plc_tag_raw_control'))
        if ch_n or pg_n:
            die(f'1단계 재채움은 빈 테이블에서 — tag_raw {ch_n} · 대조군 {pg_n}행. 빈 스냅샷을 task restore로 되돌린다')
        later = later_filled(st)
        if later:
            die(f'1단계 뒤 점 {later}이 이미 채워졌다 — 1단계 재채움은 격자 전체를 바꾼다(새 GRID_DIR로 격자를 다시 시작)')
        st['tableAt'] = None
    if st.get('i2'):
        die('I2 btree가 있다 — i2-drop 먼저')
    old = {k: s[k] for k in REFILL_KEYS if k in s}
    if not old.get('chunks'):
        die(f'{pid}은 아직 채운 적이 없다 — fill로 바로 채운다')
    n = len(s.get('history', [])) + 1
    moved = []
    for sub in ('results', 'explain'):
        d = GRID_DIR / sub / f's{pid}'
        if d.exists():
            d.rename(d.with_name(f'{d.name}.refill-{n}'))
            moved.append(str(d.with_name(f'{d.name}.refill-{n}')))
    for f in (GRID_DIR / 'match').glob(f's{pid}-*.json'):
        f.rename(f.with_name(f'{f.name}.refill-{n}'))
        moved.append(str(f.with_name(f'{f.name}.refill-{n}')))
    if pid == '1' and st.get('params'):
        # 카탈로그 §대조 실험 조정값 "Q5 문턱 — 격자 1단계 적재 직후 한 번" — 재채움 뒤 1단계 적재가 새 "1단계 적재"다(리드 판정)
        old['params'] = st['params']
        st.setdefault('paramsHistory', []).append({'n': n, 'archivedAt': iso(now_utc()), 'params': st['params']})
        st['params'] = None
    old_snap = st.get('snapshots', {}).pop(pid, None) if is_stage(pid) else None
    if old_snap:
        d = snapshot_dir(old_snap['name'])
        if d.exists():
            d.rename(d.with_name(f'{d.name}.refill-{n}'))
            moved.append(str(d.with_name(f'{d.name}.refill-{n}')))
        old['snapshot'] = old_snap
    s.setdefault('history', []).append({'n': n, 'archivedAt': iso(now_utc()), **old})
    for k in REFILL_KEYS:
        s.pop(k, None)
    save_state(st)
    emit({'kind': 'refill-reset', 'exp': EXP_GRID, **point_fields(st, pid), 'n': n, 'base': base,
          'previous': {'chunks': len(old.get('chunks', [])), 'chunksDone': sum(c['status'] == 'done' for c in old.get('chunks', [])),
                       'checked': old.get('checked'), 'rows': old.get('rows'), 'firstAt': old.get('firstAt'), 'lastAt': old.get('lastAt'),
                       'chFillStart': old.get('chFillStart')},
          'movedFiles': moved, 'note': '앞 채움의 원시 줄은 그대로 남는다 — 이 줄 뒤의 같은 point 줄이 새 채움이다'})
    print(f'보관 · 초기화 완료 — 다음: grid.sh budget {pid} → fill {pid} next', file=sys.stderr)


def cmd_status(_args: list[str]) -> None:
    st = load_state()
    print(f"S {st['start']} (KST {st['startKst']}) · 머리 만료 {st['headExpiresAt']} · seed {st['seed']} · mix {st['mix']} · params {st.get('params')}")
    print(f"테이블 상태 tableAt {st.get('tableAt')} · 스냅샷 {sorted(st.get('snapshots', {}))}")
    for pid, s in sorted(st['stages'].items(), key=lambda x: point_exp(x[0])):
        ch = s.get('chunks', [])
        print(f"{pid} (stage {stage_num(pid)} · D {point_d(st, pid)}초 · base {point_base(st, pid)}): 조각 {sum(c['status'] == 'done' for c in ch)}/{len(ch)} · "
              f"checked {s.get('checked')} · rows {s.get('rows')} · settled {s.get('settled')} · axes {'있음' if s.get('axes') else '없음'}")
    print(f"I2: {st.get('i2') and {x: st['i2'].get(x) for x in ('point', 'complete', 'buildSec')}}")


# ───────────────────────── EXP-35 ─────────────────────────

def cmd_exp35(args: list[str]) -> None:
    """EXP-35 한 팔 · 한 반복 — 복원 → 모드 D(ClickHouse만 · 대조군 off) → 파트 1개 수렴 → 압축률 · 행당 바이트."""
    if len(args) < 2:
        die('exp35 <mixed|프로파일> <반복> [구간 초=3600] [복원 스냅샷=s7a-seed-m]')
    arm, rep = args[0], int(args[1])
    dur = int(args[2]) if len(args) > 2 else 3600
    base = args[3] if len(args) > 3 else 's7a-seed-m'   # 기록 034 — 티어 M 시드 · tag_raw 0행
    if arm != 'mixed' and arm not in PROFILES:
        die(f'팔은 mixed 또는 {PROFILES}')
    res = {'clickhouse': container_res(CH), 'postgres': container_res(PG)}
    if res['clickhouse']['cpuset'] != '5-8' or res['clickhouse']['memBytes'] != 5 * 2**30:
        die(f"EXP-35는 부하 실험 프로파일(clickhouse 5-8 · 5g)에서 — 지금 {res['clickhouse']} (대조 자원 조건이면 task up 으로 되돌린다)")
    lc = compose_cmd('LCOMPOSE')
    run(lc + ['rm', '-sf', 'api'], check=False)
    run(['task', 'restore', f'NAME={base}'])
    wait_stores()
    if int(chq('SELECT count() FROM plc.tag_raw')) != 0:
        die(f'{base} 복원 뒤 tag_raw가 비어 있지 않다')
    end = parse_iso(os.environ['END']) if os.environ.get('END') else now_utc().replace(minute=0, second=0, microsecond=0)
    start = end - dt.timedelta(seconds=dur)
    kd = end.astimezone(KST).replace(hour=0, minute=0, second=0, microsecond=0)
    if start.astimezone(KST) < kd and end.astimezone(KST) != kd:   # 한 KST 일(= 한 파티션) 안에 두어 "파트 1개"가 문자 그대로 성립하게
        end = kd.astimezone(UTC)
        start = end - dt.timedelta(seconds=dur)
    out, wall, rc = mode_d(start, end, control='off', mix='mixed' if arm == 'mixed' else None,
                       profile=None if arm == 'mixed' else arm, seed=int(os.environ.get('SEED', 42)), compose_var='LCOMPOSE',
                       capacity_tier='M')   # 카탈로그 EXP-35 조건 "M 행 수" — 보고 run.capacityTier M(기록 034는 null이었다)
    if rc != 0:
        die(f'모드 D 종료 {rc} — 일별 count 대조 불일치: {out.get("days")}')
    sw10 = (out.get('switches') or {}).get('SW-10')
    sw10 = sw10.get('value') if isinstance(sw10, dict) else sw10
    if sw10 not in ('off', None):
        die(f'SW-10이 {sw10} — EXP-35는 SW-10 off(조합 제약 #5)')
    t0 = time.time()
    chq('OPTIMIZE TABLE plc.tag_raw FINAL')
    chq('OPTIMIZE TABLE plc.tag_1m FINAL')
    while True:
        maxp = int(chq("""SELECT max(c) FROM (SELECT count() AS c FROM system.parts
  WHERE database = 'plc' AND table IN ('tag_raw', 'tag_1m') AND active GROUP BY table, partition)"""))
        merges = int(chq("SELECT count() FROM system.merges WHERE database = 'plc' AND table IN ('tag_raw', 'tag_1m')"))
        pp = (maxp, merges)
        if maxp == 1 and merges == 0:
            break
        if time.time() - t0 > 240:
            die(f'파트 1개 수렴 240초 초과(파티션당 최대 파트 {pp[0]} · 머지 {pp[1]})')
        time.sleep(5)
    conv = round(time.time() - t0, 1)
    raw = ch_parts_totals('tag_raw')
    r1m = ch_parts_totals('tag_1m')
    col = json.loads(chq("""SELECT column, sum(column_data_compressed_bytes), sum(column_data_uncompressed_bytes)
FROM system.parts_columns WHERE database = 'plc' AND table = 'tag_raw' AND active GROUP BY column ORDER BY column""", fmt='JSONCompact'))['data']
    emit({'kind': 'exp35', 'exp': 'EXP-35', 'rep': rep, 'arm': arm, 'window': {'start': iso(start), 'end': iso(end)},
          'run': with_memory_source(out.get('run')), 'switches': out.get('switches'),
          'conditions': {'injectionMode': 'D', 'control': 'off', 'profileMix': arm, 'seed': int(os.environ.get('SEED', 42)),
                         'restore': base, 'converge': 'OPTIMIZE TABLE … FINAL → 파티션당 활성 파트 1 · 머지 0 확인 뒤 측정',
                         'resources': res},
          'rows': raw['rows'], 'modeD': {'chRows': out.get('totals', {}).get('chRows'), 'chInsertSec': out.get('totals', {}).get('chInsertSec'),
                                         'rollupSec': out.get('totals', {}).get('rollupSec'), 'days': out.get('days'), 'wallSec': round(wall, 1)},
          'bytesOnDisk': raw['bytesOnDisk'], 'compressionRatio': raw['rows'] * LOGICAL_ROW_BYTES / raw['bytesOnDisk'],
          'compressionRatioBasis': '공통 논리 크기(행 × 41 B) ÷ bytes_on_disk',
          'bytesPerRow': raw['bytesOnDisk'] / raw['rows'], 'dataCompressed': raw['compressed'], 'dataUncompressed': raw['uncompressed'],
          'partTypes': raw['partTypes'], 'parts': raw['parts'], 'partitions': raw['partitions'],
          'columns': {c[0]: {'compressed': int(c[1]), 'uncompressed': int(c[2])} for c in col},
          'rollup1m': {'rows': r1m['rows'], 'bytesOnDisk': r1m['bytesOnDisk'],
                       'bytesPerRollupRow': r1m['bytesOnDisk'] / r1m['rows'] if r1m['rows'] else None,
                       'bytesPerRawRow': r1m['bytesOnDisk'] / raw['rows'] if raw['rows'] else None, 'parts': r1m['parts']},
          'convergeSec': conv}, default_out='exp35.jsonl')


COMMANDS = {'plan': cmd_plan, 'plan-refine': cmd_plan_refine, 'snapshot': cmd_snapshot, 'restore': cmd_restore, 'refine': cmd_refine,
            'refill': cmd_refill,
            'init': cmd_init, 'params': cmd_params, 'fill': cmd_fill, 'check': cmd_check,
            'settle': cmd_settle, 'axes': cmd_axes, 'query': cmd_query, 'match': cmd_match, 'i2-build': cmd_i2_build, 'i2-build-poll': cmd_i2_build_poll,
            'i2-drop': cmd_i2_drop, 'budget': cmd_budget, 'status': cmd_status, 'exp35': cmd_exp35}

# 단계 활동 시각 — 적재 시간 예산의 좌변(채우기 시작 ~ 마지막 쿼리 경과)을 실측으로 남긴다(검수 #5).
# 단계를 인자로 받는 하위 명령이 성공하면 그 단계의 firstAt(처음 한 번) · lastAt(매번)을 갱신한다.
STAGE_ACTIVITY = {'fill', 'check', 'settle', 'axes', 'query', 'match', 'i2-build', 'i2-build-poll', 'i2-drop'}


def touch_stage_activity(cmd: str, args: list[str]) -> None:
    if cmd not in STAGE_ACTIVITY or not args or not STATE.exists():
        return
    if not (is_stage(args[0]) or re.fullmatch(r'r\d\.(5|25|75)', args[0])):
        return
    st = load_state()
    s = st['stages'].setdefault(args[0], {})
    now = iso(now_utc())
    s.setdefault('firstAt', now)
    s['lastAt'] = now
    save_state(st)


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        die(f'하위 명령 — {" · ".join(COMMANDS)}')
    guard_volume_op(sys.argv[1])
    COMMANDS[sys.argv[1]](sys.argv[2:])
    touch_stage_activity(sys.argv[1], sys.argv[2:])
