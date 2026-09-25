#!/usr/bin/env python3
"""S5 대조군 역전 지점 격자 러너(EXP-01~05) · 압축 대조 러너(EXP-35) 본체.

정본
- 설계: docs/05_data_stores/10_olap_vs_rdb_control.md(쿼리 5종 양쪽 SQL · 비교 축 6 · 격자 · 단계 절차 ①~⑥ · 측정 조건 8)
- 실행: docs/10_observability/06_experiment_catalog.md EXP-01~05 · EXP-35 · §대조 실험 조정값
- 기록: docs/10_observability/04_experiment_protocol.md §기계 판독 블록(points · axes)
- 계획 판정 2(5단계는 디스크 예산 성립 시만 · 6단계 없음) · 3(I1 → I2 빌드 → I2 → DROP) · 4(콜드 · 웜)

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
LOGICAL_ROW_BYTES = 41          # 공통 논리 크기 = 행 수 × 41 B(ClickHouse 컬럼 폭 합 · 비교 축 2)
DERIVED_HEAP_ROW = 76           # 대조군 용량 축 도출 — 힙 행 약 76 B
DERIVED_BTREE_ROW = 30          # btree(I2) 약 30 B
DERIVED_CH_ROW = 4              # EXP-35 원본 산정 행당 4 B — 실측 행당 값이 있으면 그것을 쓴다
CALL_LIMIT_SEC = 540            # 호출당 10분 미만 — 여유 60초
EXP_GRID = ['EXP-01', 'EXP-02', 'EXP-03', 'EXP-04', 'EXP-05']
QUERIES = ('Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q5x')   # Q5x = 조건 없는 count(보조 관찰 · EXP-05)
PROFILES = ('SINE', 'RANDOM_WALK', 'RAMP', 'STEP', 'BINARY', 'COUNTER', 'SPIKE', 'DROPOUT')
U = 2.0 ** -53

GRID_DIR = Path(os.environ.get('GRID_DIR', 'snapshots/lab-s5-grid'))
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
    return json.loads(STATE.read_text())


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

def d_sec(k: int) -> int:
    """데이터 기간 D_k = 10^k 초(1만 태그 × 1 Hz → 10^(k+4)행)."""
    return 10 ** k if k > 0 else 0


def stage_range(end: dt.datetime, k: int) -> tuple[dt.datetime, dt.datetime]:
    """단계 k가 새로 채우는 구간 [end − D_k, end − D_(k−1))."""
    return end - dt.timedelta(seconds=d_sec(k)), end - dt.timedelta(seconds=d_sec(k - 1))


def default_chunk_sec(k: int) -> int:
    env = os.environ.get('FILL_CHUNK_SEC')
    if env:
        return int(env)
    return {1: 10, 2: 90, 3: 900, 4: 3000, 5: 3600}[k]   # 4단계 3조각 · 5단계 25조각(1조각 3.6 × 10^7행)


def chunks_of(end: dt.datetime, k: int, chunk: int) -> list[tuple[dt.datetime, dt.datetime]]:
    a, b = stage_range(end, k)
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


def default_end() -> dt.datetime:
    """리드 판정 ③ — 지나간 가장 최근 KST 14:00. 5단계(약 27.8시간)가 두 KST 일로 약 반씩 갈려 최대 일 파티션이 가장 작다."""
    k = now_utc().astimezone(KST)
    e = k.replace(hour=14, minute=0, second=0, microsecond=0)
    if e > k:
        e -= dt.timedelta(days=1)
    return e.astimezone(UTC)


def cmd_plan(args: list[str]) -> None:
    end = parse_iso(args[0]) if args else default_end()
    print(f'end = {iso(end)} (KST {kst_text(end, False)})')
    for k in STAGES:
        a, b = stage_range(end, k)
        ch = chunks_of(end, k, default_chunk_sec(k))
        cum = kst_day_split(end - dt.timedelta(seconds=d_sec(k)), end)
        print(f'단계 {k}: 채우기 [{iso(a)}, {iso(b)}) {d_sec(k) - d_sec(k - 1)}초 · 조각 {len(ch)} · 누적 {d_sec(k) * TAGS_M:.0e}행')
        for d in cum:
            print(f"    파티션 plc_tag_raw_control_p{d['day'].replace('-', '')} · tag_raw {d['day'].replace('-', '')}: {d['rowsNominal']:,}행(공칭 누적)")
    worst = max(d['rowsNominal'] for d in kst_day_split(end - dt.timedelta(seconds=d_sec(5)), end))
    print(f'5단계 최대 일 파티션 {worst:.2e}행 — 5단계 I2는 파티션별 비동기 빌드(i2-build → i2-build-poll).')


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


def param_values(st: dict, q: str) -> dict:
    p = st.get('params')
    if not p and q not in ('Q4', 'Q5x'):
        die('params가 없다 — 1단계 check 뒤 params를 먼저 부른다')
    end = parse_iso(st['end'])
    vals = {'device': p and p['device'], 'tag': p and p['tag'], 'v': p and p['v'], 'end': kst_text(end)}
    return {k: vals[k] for k in CH_PARAMS[q]}


def pg_execute(st: dict, q: str) -> str:
    pv = param_values(st, q)
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
    end = parse_iso(opts['--end']) if '--end' in opts else default_end()
    if end.second or end.microsecond:
        die('end는 분 경계여야 한다 — Q4 분 버킷 · tag_1m 대조 창이 맞는다')
    if end > now_utc():
        die('end가 미래다')
    st = {'end': iso(end), 'endKst': kst_text(end, False), 'createdAt': iso(now_utc()),
          'seed': int(opts.get('--seed', 42)), 'mix': opts.get('--mix', 'mixed'), 'tier': 'M',
          'params': None, 'stages': {}, 'i2': None, 'env': env, 'tag1mRowsAtInit': r1m}
    save_state(st)
    emit({'kind': 'init', 'exp': EXP_GRID, 'end': st['end'], 'endKst': st['endKst'], 'seed': st['seed'], 'mix': st['mix'],
          'env': env, 'tag1mRowsAtInit': r1m, 'git': git_head()})
    cmd_plan([st['end']])


def cmd_params(_args: list[str]) -> None:
    st = load_state()
    if st.get('params') and os.environ.get('FORCE') != '1':
        die(f"params가 이미 고정됐다 {st['params']} — 단계마다 다시 정하지 않는다(§대조 실험 조정값 Q5 문턱)")
    s1 = st['stages'].get('1')
    if not s1 or not s1.get('checked'):
        die('1단계 채우기 · check가 먼저다 — Q5 문턱은 격자 1단계 적재 직후 한 번 정한다')
    if any(st['stages'].get(str(k)) for k in (2, 3, 4, 5)):
        die('2단계 이후가 이미 채워졌다 — 문턱은 1단계 적재 직후 값이어야 한다')
    v = chq('SELECT toString(quantileExact(0.5)(value)) FROM plc.tag_raw').strip()
    dev, tag = chq('SELECT device_id, tag_id FROM plc.tag_raw GROUP BY device_id, tag_id ORDER BY device_id, tag_id LIMIT 1').split()
    sel = chq(f'SELECT countIf(value > {v}) / count() FROM plc.tag_raw').strip()
    st['params'] = {'device': int(dev), 'tag': int(tag), 'v': v, 'q5SelectivityStage1': float(sel),
                    'rule': 'v = quantileExact(0.5)(value) 1단계 직후 · device · tag = (device_id, tag_id) 사전순 첫 쌍'}
    save_state(st)
    emit({'kind': 'params', 'exp': EXP_GRID, 'stage': 1, **st['params']})


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
           compose_var: str) -> tuple[dict, float, int]:
    """모드 D 한 호출 — 종료 코드 0 전부 일치 · 2 불일치 일 있음(출력 JSON은 있다) · 1 실패(s5-inject 계약).
    모드 D는 대상 구간에 행이 이미 있거나 최근 30초 안에 ts · ingested_at이 둘 다 있는 행이 있으면 거부한다(api · 수집 정지 전제).
    상태형 프로파일(RANDOM_WALK · BINARY · COUNTER)은 호출마다 KST 일 조각별로 초기 상태에서 다시 시작한다 — 조각 나누기가 값을 바꾸므로 chunkSec를 조건으로 남긴다."""
    cmd = compose_cmd(compose_var) + ['--profile', 'datagen-d', 'run', '--rm', '--no-deps', 'datagen-d', 'node', 'dist/mode-d.js',
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
    st = load_state()
    k = int(args[0]) if args else die('fill <단계> [next|조각번호]')
    which = args[1] if len(args) > 1 else 'next'
    if k not in STAGES:
        die('단계는 1~5(6단계는 수행하지 않는다 — 보존 판정)')
    if k > 1 and not st['stages'].get(str(k - 1), {}).get('checked'):
        die(f'{k - 1}단계 check가 먼저다(누적 격자)')
    if st.get('i2'):
        die('I2 btree가 있다 — i2-drop 뒤에 채운다(삽입 처리량 축은 I1 적재 계측)')
    end = parse_iso(st['end'])
    s = st['stages'].setdefault(str(k), {})
    fresh = not s.get('chunks') or (os.environ.get('FILL_CHUNK_SEC') and all(x['status'] == 'todo' for x in s['chunks']))
    if fresh:   # 조각 나누기는 첫 조각을 채우기 전까지만 바꿀 수 있다
        s['chunkSec'] = default_chunk_sec(k)
        s['chunks'] = [{'i': i, 'from': iso(a), 'to': iso(b), 'status': 'todo'} for i, (a, b) in enumerate(chunks_of(end, k, s['chunkSec']))]
    todo = [c for c in s['chunks'] if c['status'] != 'done']
    if not todo:
        die(f'{k}단계 조각이 전부 채워졌다 — check로 넘어간다')
    c = todo[0] if which == 'next' else next((x for x in s['chunks'] if x['i'] == int(which)), None)
    if c is None or c['status'] == 'done':
        die(f'조각 {which} 없음 또는 이미 채움')
    if c['status'] in ('failed', 'running') and os.environ.get('FORCE') != '1':
        die(f"조각 {c['i']}은 {c['status']} 표시다 — 부분 적재가 남았으면 모드 D가 같은 구간을 거부한다. "
            "구간이 두 저장소 모두 비었음을 확인한 뒤에만 FORCE=1(아니면 단계 시작 전 스냅샷 복원)")
    rows_nom = int((parse_iso(c['to']) - parse_iso(c['from'])).total_seconds()) * TAGS_M
    rate = s.get('lastWallRowsPerSec') or st['stages'].get(str(k - 1), {}).get('lastWallRowsPerSec')
    if rate and rows_nom / rate > CALL_LIMIT_SEC and os.environ.get('FORCE') != '1':
        die(f'직전 조각 속도 {rate:.0f}행/초로 이 조각 {rows_nom}행은 약 {rows_nom / rate:.0f}초 — 10분 상한을 넘는다. '
            'FILL_CHUNK_SEC를 줄여 단계를 다시 쪼갠다(아직 조각을 채우기 전이어야 한다)')
    if 'baseline' not in s:
        s['fillStartAt'] = iso(now_utc())
        s['chFillStart'] = chq("SELECT toString(now64(6, 'UTC'))").strip()
        s['baseline'] = pg_counters()
        save_state(st)
    c['status'] = 'running'
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
    emit({'kind': 'fill', 'exp': EXP_GRID, 'stage': k, 'chunk': c['i'], 'chunks': len(s['chunks']),
          'window': {'start': c['from'], 'end': c['to']}, 'rowsNominal': rows_nom, 'wallSec': round(wall, 1),
          'chRows': tot.get('chRows'), 'controlRows': tot.get('controlRows'), 'chInsertSec': tot.get('chInsertSec'),
          'controlCopySec': tot.get('controlCopySec'), 'rollupSec': tot.get('rollupSec'), 'days': out.get('days'),
          'match': ok, 'exitCode': rc, 'chunkSec': s['chunkSec'], 'run': out.get('run'), 'switches': out.get('switches'), 'options': out.get('options')})
    if not ok:
        die(f'조각 불일치(종료 {rc}) — 모드 D ⑧(대조군 그 일 재적재)을 거쳐도 남은 불일치다. 단계 무효 — 단계 시작 전 스냅샷으로 되돌려 다시 채운다')


# ───────────────────────── check ─────────────────────────

def cmd_check(args: list[str]) -> None:
    st = load_state()
    k = int(args[0]) if args else die('check <단계>')
    s = st['stages'].get(str(k))
    if not s or any(c['status'] != 'done' for c in s.get('chunks', [])):
        die(f'{k}단계 채우기가 끝나지 않았다')
    end = parse_iso(st['end'])
    start = end - dt.timedelta(seconds=d_sec(k))
    ranges = []
    for j in range(1, k + 1):
        ranges += [(parse_iso(c['from']), parse_iso(c['to'])) for c in st['stages'][str(j)]['chunks']]
    ranges.sort()
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
                for j in range(1, k + 1) for c in st['stages'][str(j)]['chunks'] for d in c['modeD'].get('days', [])]
    day_roll_ok = all(x['rollupCount'] is not None and x['rollupCount'] == x['rollupRawCount'] for x in day_roll)
    match = all(r['match'] for r in rows) and ch_out == 0 and pg_out == 0 and roll == ch_sum and day_roll_ok
    s['checked'] = match
    s['rows'] = ch_sum
    save_state(st)
    emit({'kind': 'check', 'exp': EXP_GRID, 'stage': k, 'rows': ch_sum, 'rowsNominal': d_sec(k) * TAGS_M,
          'window': {'start': iso(start), 'end': iso(end)}, 'total': {'ch': ch_sum, 'pg': pg_sum, 'rollupCountMerge': roll},
          'outside': {'ch': ch_out, 'pg': pg_out}, 'ranges': rows, 'modeDRollupDays': day_roll, 'modeDRollupOk': day_roll_ok, 'match': match, 'sec': round(time.time() - t0, 1)})
    if not match:
        die(f'{k}단계 구간 count 정합 실패 — 그 단계의 모든 수치가 무효다(REQ-NFR-18). 어긋난 구간을 다시 채운다')


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
    k = int(args[0]) if args else die('settle <단계> [최대 초=540] [표본 간격 초=20]')
    limit = int(args[1]) if len(args) > 1 else CALL_LIMIT_SEC
    step = int(args[2]) if len(args) > 2 else 20
    s = st['stages'].get(str(k))
    if not s or not s.get('checked'):
        die(f'{k}단계 check가 먼저다')
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
    emit({'kind': 'settle', 'exp': EXP_GRID, 'stage': k, 'settled': settled, 'sec': round(time.time() - t0, 1),
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
    k = int(args[0]) if args else die('axes <단계>')
    s = st['stages'].get(str(k))
    if not s or not s.get('checked'):
        die(f'{k}단계 check가 먼저다')
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
    ch_ins_s = sum(c['modeD']['totals']['chInsertSec'] for c in s['chunks'])
    pg_rows = sum(c['modeD']['totals']['controlRows'] for c in s['chunks'])
    pg_copy_s = sum(c['modeD']['totals']['controlCopySec'] for c in s['chunks'])
    wal = now_c['walBytes'] - b0['walBytes']
    common = {'exp': EXP_GRID, 'stage': k, 'rows': rows, 'run': st.get('run'), 'switches': st.get('switches')}
    axes = [
        {'axis': 'storage_bytes', 'store': 'clickhouse', 'index': None, 'value': ch['bytesOnDisk'], 'unit': 'bytes',
         'parts': ch['parts'], 'partTypes': ch['partTypes']},
        {'axis': 'storage_bytes', 'store': 'postgresql', 'index': 'I1', 'value': pg['totalBytes'], 'unit': 'bytes',
         'heapBytes': pg['tableBytes'], 'heapMainBytes': pg['heapMainBytes'], 'indexBytes': pg['indexesBytes']},
        {'axis': 'compression_ratio', 'store': 'clickhouse', 'index': None, 'value': rows * LOGICAL_ROW_BYTES / ch['bytesOnDisk'],
         'unit': 'ratio', 'logicalBytes': rows * LOGICAL_ROW_BYTES, 'denominator': 'bytes_on_disk'},
        {'axis': 'compression_ratio', 'store': 'postgresql', 'index': 'I1', 'value': rows * LOGICAL_ROW_BYTES / pg['tableBytes'],
         'unit': 'ratio', 'logicalBytes': rows * LOGICAL_ROW_BYTES, 'denominator': 'pg_table_size(힙 · FSM · VM · TOAST — 인덱스 제외)'},
        {'axis': 'insert_rows_per_sec', 'store': 'clickhouse', 'index': None, 'value': delta_rows / ch_ins_s if ch_ins_s else None,
         'unit': 'rows/s', 'stageRows': delta_rows, 'insertSec': ch_ins_s, 'source': '모드 D 단독 적재 계측(tag_raw INSERT)'},
        {'axis': 'insert_rows_per_sec', 'store': 'postgresql', 'index': 'I1', 'value': pg_rows / pg_copy_s if pg_copy_s else None,
         'unit': 'rows/s', 'stageRows': pg_rows, 'insertSec': pg_copy_s, 'source': 'GEN-10 COPY 트랜잭션 시간(synchronous_commit off)'},
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
        {'axis': 'index_bytes', 'store': 'postgresql', 'index': 'I1', 'value': pg['brinBytes'], 'unit': 'bytes', 'kind': 'BRIN(ts)'},
    ]
    for a in axes:
        emit({'kind': 'axis', **common, **a})
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


def pg_timed(st: dict, q: str, n: int) -> list[float]:
    script = PG_PREPARE[q] + '\n\\o /dev/null\n\\timing on\n' + '\n'.join([pg_execute(st, q)] * n) + '\n'
    p = pg_script(script)
    times = [float(m) for m in re.findall(r'^Time: ([\d.]+) ms', p.stdout, re.M)]
    if len(times) != n:
        die(f'psql \\timing 줄 {len(times)}개 — 기대 {n}: {p.stdout[-300:]}')
    return times


def result_file(k: int, q: str, store: str) -> Path:
    return GRID_DIR / 'results' / f's{k}' / f'{q}.{store}.tsv'


def capture(st: dict, k: int, q: str, store: str) -> Path:
    f = result_file(k, q, store)
    f.parent.mkdir(parents=True, exist_ok=True)
    if store == 'clickhouse':
        f.write_text(chq(CH_SQL[q], param_values(st, q), fmt='TSV'))
    else:
        f.write_text(pg_script(PG_PREPARE[q] + '\n' + pg_execute(st, q) + '\n').stdout)
    return f


def explain(st: dict, k: int, q: str, index: str) -> dict:
    p = pg_script(PG_PREPARE[q] + '\nEXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + pg_execute(st, q) + '\n')
    f = GRID_DIR / 'explain' / f's{k}' / f'{q}.{index}.json'
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


def match_state(k: int, q: str) -> bool | None:
    f = GRID_DIR / 'match' / f's{k}-{q}.json'
    return json.loads(f.read_text())['resultMatch'] if f.exists() else None


def cmd_query(args: list[str]) -> None:
    if len(args) < 5:
        die('query <단계> <clickhouse|postgresql> <I1|I2|-> <반복> <Q1..Q5|Q5x> [단계들: cold,warm,explain,capture]')
    st = load_state()
    k, store, index, rep, q = int(args[0]), args[1], args[2], int(args[3]), args[4]
    if q not in QUERIES:
        die(f'쿼리 {q} — {QUERIES}')
    s = st['stages'].get(str(k))
    if not s or not s.get('checked'):
        die(f'{k}단계 check가 먼저다')
    later = [j for j in STAGES if j > k and st['stages'].get(str(j), {}).get('chunks')
             and any(c['status'] != 'todo' for c in st['stages'][str(j)]['chunks'])]
    if later:
        die(f'이미 {later}단계 적재가 시작됐다 — 테이블 행 수가 {k}단계가 아니다')
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
        die(f'tag_raw 행 {ch_rows_now} ≠ {k}단계 check 행 {s["rows"]} — TTL 머지나 다른 적재를 의심한다')
    default = ['cold', 'warm']
    if store == 'postgresql' and rep == 1:
        default.append('explain')
    if not result_file(k, q, store).exists():
        default.append('capture')
    phases = args[5].split(',') if len(args) > 5 else default
    base = {'exp': EXP_GRID, 'arm': f'{store}/{idx or "-"}', 'query': q, 'rows': s['rows'], 'stage': k, 'store': store, 'index': idx, 'rep': rep,
            'unit': 'ms', 'run': st.get('run'), 'switches': st.get('switches'),
            'conditions': {'q5Threshold': (st.get('params') or {}).get('v'), 'device': (st.get('params') or {}).get('device'),
                           'tag': (st.get('params') or {}).get('tag'), 'end': st['end'],
                           'coldApprox': 'OS 페이지 캐시는 Docker VM 안이라 비울 수 없다 — 콜드는 두 저장소 컨테이너 재기동 직후 첫 실행(근사)'}}
    tag = f's{k}-{q}-{store}-{idx or "x"}-r{rep}'
    for ph in phases:
        t0 = now_utc()
        if ph == 'cold':
            wait = restart_stores()
            if store == 'clickhouse':
                t, ids = ch_timed(CH_SQL[q], param_values(st, q), 1, tag + '-cold')
                extra = {'queryLog': ch_query_log(ids)}
            else:
                t = pg_timed(st, q, 1)
                extra = {}
            emit({'kind': 'query', **base, 'cache': 'cold', 'values': t, 'median': t[0], 'restartWaitSec': wait,
                  'window': {'start': iso(t0), 'end': iso(now_utc())}, 'resultMatch': match_state(k, q), **extra})
        elif ph == 'warm':
            if store == 'clickhouse':
                t, ids = ch_timed(CH_SQL[q], param_values(st, q), 4, tag + '-warm')
                extra = {'queryLog': ch_query_log(ids)[1:], 'warmupQueryLog': ch_query_log(ids[:1])[0]}
            else:
                t = pg_timed(st, q, 4)
                extra = {}
            emit({'kind': 'query', **base, 'cache': 'warm', 'values': t[1:], 'median': median(t[1:]), 'warmupMs': t[0],
                  'window': {'start': iso(t0), 'end': iso(now_utc())}, 'resultMatch': match_state(k, q), **extra})
        elif ph == 'explain':
            if store != 'postgresql':
                die('explain은 PostgreSQL만(ClickHouse 쪽은 query_log)')
            emit({'kind': 'explain', **{x: base[x] for x in ('exp', 'query', 'rows', 'stage', 'store', 'index', 'rep')},
                  **explain(st, k, q, idx), 'note': '시간 판정에 쓰지 않는다 — EXPLAIN 없는 실행이 판정 값이다'})
        elif ph == 'capture':
            f = capture(st, k, q, store)
            emit({'kind': 'capture', **{x: base[x] for x in ('exp', 'query', 'rows', 'stage', 'store')}, 'file': str(f),
                  'resultRows': sum(1 for _ in f.open())})
            other = result_file(k, q, 'postgresql' if store == 'clickhouse' else 'clickhouse')
            if other.exists() and match_state(k, q) is None:
                cmd_match([str(k), q])
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
    k, q = int(args[0]), args[1]
    fc, fp = result_file(k, q, 'clickhouse'), result_file(k, q, 'postgresql')
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
        aux = keyed(read_tsv_str(chq(CH_AUX[q], param_values(st, q))), q)   # 키 → [n, S]
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
            roll = keyed(read_tsv_str(chq(CH_ROLLUP_Q4, param_values(st, q))), q)
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
    f = GRID_DIR / 'match' / f's{k}-{q}.json'
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(res, ensure_ascii=False))
    emit({'kind': 'match', 'exp': EXP_GRID, 'stage': k, 'query': q, 'rows': st['stages'][str(k)]['rows'], **res})


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
ASYNC_STAGES = (5,)             # 리드 판정 ② — 5단계만 비동기 · 1~4단계는 동기 유지


def i2_begin(st: dict, k: int) -> tuple[dict, dict]:
    s = st['stages'].get(str(k))
    if not s or not s.get('checked'):
        die(f'{k}단계 check가 먼저다')
    i2 = st.get('i2')
    if i2 and i2.get('stage') != k:
        die(f"다른 단계({i2.get('stage')})의 I2가 남았다 — i2-drop 먼저")
    if not i2:
        before = pg_counters()
        pgq('CREATE INDEX plc_tag_raw_control_key_btree ON ONLY plc_tag_raw_control (device_id, tag_id, ts)')
        i2 = st['i2'] = {'stage': k, 'startedAt': iso(now_utc()), 'buildSec': 0.0, 'walBytes': 0, 'lsnBytes': 0,
                         'parts': [], 'complete': False, 'baseline': before, 'mode': 'async' if k in ASYNC_STAGES else 'sync',
                         'running': None}
        save_state(st)
    return s, i2


def i2_report(st: dict, k: int, s: dict, i2: dict) -> None:
    valid = pgq("SELECT indisvalid FROM pg_index WHERE indexrelid = 'plc_tag_raw_control_key_btree'::regclass").strip() == 't'
    size = int(pgq("SELECT coalesce(sum(pg_relation_size(relid)), 0) FROM pg_partition_tree('plc_tag_raw_control_key_btree') WHERE isleaf").strip())
    i2['complete'] = valid
    i2['indexBytes'] = size
    save_state(st)
    line = {'exp': EXP_GRID, 'stage': k, 'rows': s['rows'], 'run': st.get('run'), 'switches': st.get('switches')}
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
    k = int(args[0]) if args else die('i2-build <단계> [예산 초=480]')
    budget = int(args[1]) if len(args) > 1 else 480
    s, i2 = i2_begin(st, k)
    if i2['mode'] == 'async':
        if i2.get('running'):
            die(f"{i2['running']['rel']} 빌드가 돌고 있다 — i2-build-poll로 이어 간다")
        nxt = next_leaf(i2)
        if nxt:
            async_start(st, i2, *nxt)
        i2_report(st, k, s, i2)
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
    i2_report(st, k, s, i2)


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
    k = int(args[0]) if args else die('i2-build-poll <단계> [최대 대기 초=480] [간격 초=15]')
    limit = int(args[1]) if len(args) > 1 else 480
    step = int(args[2]) if len(args) > 2 else 15
    s, i2 = i2_begin(st, k)
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
    i2_report(st, k, s, i2)


def cmd_i2_drop(args: list[str]) -> None:
    st = load_state()
    k = int(args[0]) if args else die('i2-drop <단계>')
    if not btree_present():
        die('btree가 없다')
    c0 = pg_counters()
    p = pg_script('\\timing on\nDROP INDEX plc_tag_raw_control_key_btree;\n')
    tm = [float(m) for m in re.findall(r'^Time: ([\d.]+) ms', p.stdout, re.M)]
    c1 = pg_counters()
    prev = st.get('i2')
    st['i2'] = None
    save_state(st)
    emit({'kind': 'i2-drop', 'exp': EXP_GRID, 'stage': k, 'dropMs': tm[0] if tm else None,
          'walBytes': c1['walBytes'] - c0['walBytes'], 'builtStage': prev and prev.get('stage')})


# ───────────────────────── budget ─────────────────────────

def cmd_budget(args: list[str]) -> None:
    """단계 k 진입 전 — 디스크 예산 식 · 적재 시간 예산(§대조 실험 조정값)."""
    st = load_state()
    k = int(args[0]) if args else die('budget <진입할 단계>')
    end = parse_iso(st['end'])
    host = run(['df', '-k', str(Path.home())]).stdout.strip().splitlines()[-1].split()
    host_free = int(host[3]) * 1024
    vm = run(['docker', 'exec', CH, 'df', '-k', '/var/lib/clickhouse']).stdout.strip().splitlines()[-1].split()
    vm_total, vm_free = int(vm[1]) * 1024, int(vm[3]) * 1024
    vols = ['db_study_pgdata', 'db_study_chdata', 'db_study_redisdata', 'db_study_spooldata']
    mounts = sum((['-v', f'{v}:/v/{v}:ro'] for v in vols), [])
    du = run(['docker', 'run', '--rm', *mounts, 'postgres:18.6-alpine', 'du', '-sk', *[f'/v/{v}' for v in vols]]).stdout
    snap = sum(int(x.split()[0]) * 1024 for x in du.strip().splitlines())
    ch_now = ch_parts_totals()
    ch_row = ch_now['bytesOnDisk'] / ch_now['rows'] if ch_now['rows'] else DERIVED_CH_ROW
    r_cur = st['stages'].get(str(k - 1), {}).get('rows', 0) if k > 1 else 0
    r_next = d_sec(k) * TAGS_M
    max_wal = int(pgq("SELECT setting::bigint * 1024 * 1024 FROM pg_settings WHERE name = 'max_wal_size'").strip())
    need = {'controlHeap': (r_next - r_cur) * DERIVED_HEAP_ROW, 'i2Btree': r_next * DERIVED_BTREE_ROW,
            'clickhouse': int((r_next - r_cur) * ch_row), 'walMargin': max_wal}
    need['total'] = sum(need.values())
    free = min(host_free, vm_free)
    alert = int(0.20 * vm_total)
    lhs = free - alert - snap
    ttl = re.search(r'(?:toIntervalDay\((\d+)\)|INTERVAL (\d+) DAY)', chq("SELECT engine_full FROM system.tables WHERE database = 'plc' AND name = 'tag_raw'"))
    retention = int(ttl.group(1) or ttl.group(2)) * 86400 if ttl else die('tag_raw TTL을 읽지 못했다')
    head_expire = end - dt.timedelta(seconds=d_sec(k)) + dt.timedelta(seconds=retention)
    remain = (head_expire - now_utc()).total_seconds()
    prev = st['stages'].get(str(k - 1), {})
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
    emit({'kind': 'budget', 'exp': EXP_GRID, 'stage': k, 'rows': r_next,
          'disk': {'formula': '여유 − 디스크 잔여 알림 문턱 − 다음 스냅샷 크기(현재 볼륨 합) ≥ 다음 단계 도출 크기',
                   'hostFreeBytes': host_free, 'vmFreeBytes': vm_free, 'vmTotalBytes': vm_total, 'freeBytes': free,
                   'alertThresholdBytes': alert, 'alertRule': 'disk_low ch_disk_free/ch_disk_total < 0.20',
                   'snapshotBytes': snap, 'lhsBytes': lhs, 'need': need,
                   'chBytesPerRow': ch_row, 'chBytesPerRowSource': '현재 단계 실측' if ch_now['rows'] else '원본 산정 4 B',
                   'ok': lhs >= need['total']},
          'time': {'retentionSec': retention, 'dSec': d_sec(k), 'budgetSec': retention - d_sec(k),
                   'relation': '단계 k 채우기 시작 ~ 마지막 쿼리 경과 < 원시 보존 − D_k',
                   'headExpiresAt': iso(head_expire), 'remainingSec': round(remain),
                   'remainingNote': 'end를 격자 시작에 고정하므로 머리 행 만료까지 남은 시간이 더 엄격한 한계다',
                   'estFillSec': round(est_fill) if est_fill else None,
                   'prevStageElapsedSec': round(prev_elapsed) if prev_elapsed else None,
                   'estStageSec': round(est_stage) if est_stage else None,
                   'estimate': '앞 단계 firstAt~lastAt 경과 × (다음 단계 행 ÷ 앞 단계 행) · 채우기 추정 중 큰 값',
                   'marginSec': round(remain - est_total), 'ok': remain > est_total}})


def cmd_status(_args: list[str]) -> None:
    st = load_state()
    print(f"end {st['end']} (KST {st['endKst']}) · seed {st['seed']} · mix {st['mix']} · params {st.get('params')}")
    for k in STAGES:
        s = st['stages'].get(str(k))
        if not s:
            continue
        ch = s.get('chunks', [])
        print(f"단계 {k}: 조각 {sum(c['status'] == 'done' for c in ch)}/{len(ch)} · checked {s.get('checked')} · rows {s.get('rows')} · "
              f"settled {s.get('settled')} · axes {'있음' if s.get('axes') else '없음'}")
    print(f"I2: {st.get('i2') and {x: st['i2'][x] for x in ('stage', 'complete', 'buildSec')}}")


# ───────────────────────── EXP-35 ─────────────────────────

def cmd_exp35(args: list[str]) -> None:
    """EXP-35 한 팔 · 한 반복 — 복원 → 모드 D(ClickHouse만 · 대조군 off) → 파트 1개 수렴 → 압축률 · 행당 바이트."""
    if len(args) < 2:
        die('exp35 <mixed|프로파일> <반복> [구간 초=3600] [복원 스냅샷=s3-empty-m]')
    arm, rep = args[0], int(args[1])
    dur = int(args[2]) if len(args) > 2 else 3600
    base = args[3] if len(args) > 3 else 's3-empty-m'
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
                       profile=None if arm == 'mixed' else arm, seed=int(os.environ.get('SEED', 42)), compose_var='LCOMPOSE')
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
          'run': out.get('run'), 'switches': out.get('switches'),
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


COMMANDS = {'plan': cmd_plan, 'init': cmd_init, 'params': cmd_params, 'fill': cmd_fill, 'check': cmd_check,
            'settle': cmd_settle, 'axes': cmd_axes, 'query': cmd_query, 'match': cmd_match, 'i2-build': cmd_i2_build, 'i2-build-poll': cmd_i2_build_poll,
            'i2-drop': cmd_i2_drop, 'budget': cmd_budget, 'status': cmd_status, 'exp35': cmd_exp35}

# 단계 활동 시각 — 적재 시간 예산의 좌변(채우기 시작 ~ 마지막 쿼리 경과)을 실측으로 남긴다(검수 #5).
# 단계를 인자로 받는 하위 명령이 성공하면 그 단계의 firstAt(처음 한 번) · lastAt(매번)을 갱신한다.
STAGE_ACTIVITY = {'fill', 'check', 'settle', 'axes', 'query', 'match', 'i2-build', 'i2-build-poll', 'i2-drop'}


def touch_stage_activity(cmd: str, args: list[str]) -> None:
    if cmd not in STAGE_ACTIVITY or not args or not args[0].isdigit() or not STATE.exists():
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
    COMMANDS[sys.argv[1]](sys.argv[2:])
    touch_stage_activity(sys.argv[1], sys.argv[2:])
