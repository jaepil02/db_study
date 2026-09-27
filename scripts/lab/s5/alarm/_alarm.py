#!/usr/bin/env python3
# EXP-33 알람 분기 · 부분 실패(alarm-branch-partial-failure) 판독 · 판정 · 기록 줄 조립 — 러너 exp33-alarm.sh의 파이썬 절반.
# 정본: docs/10_observability/06_experiment_catalog.md EXP-33 · docs/03_requirements/14_acceptance_criteria.md AC-09 · AC-35 · AC-36
#       docs/06_pipeline/08_alarm.md(전이 8 · 부분 실패 6 · ⑧ 깊이 1 큐 · 배치 halt) · 10_observability/02_instrumentation.md §구간 기록 · §확인(ACK) 신호 부재의 계측
#       10_observability/04_experiment_protocol.md(구조 판정 3회 전부 · 분포 판정 중앙값 · 편차 p50) · 05_load_scenarios.md(모드 B · 생성기 포화 판정)
# 규칙 계획은 SPIKE 프로파일 생성식(apps/api/src/modules/datagen/signal/profiles.ts · rng.ts)의 태그 기저값에 맞춘 2계층이다:
#   계층 S(스파이크) — GT 임계 = 기저 + 25 · 디바운스 5,000 ms → 한 시점 이상치만 위반(1 Hz · 연속 이상치 확률 0.005^6) = 디바운스 미만(AC-09 미만)
#   계층 B(기저)    — GT 임계 = 기저 − 1 · 디바운스 2,000 ms → 잡음 N(0,1)이 위반 84% · 정상 16%로 열림 · 해소 · 재위반이 저절로 돈다(AC-09 이상 · 전이 8 · 발행)
#   탐침 P(AC-36)   — GT 임계 = 기저 − 10(상시 위반) · 디바운스 30,000 ms → PostgreSQL 정지 중에 확정 시점이 온다
# 사용(러너가 부른다): _alarm.py plan <태그 목록 파일> <출력 json>   · stamp(표준 입력 → "epoch_ms 줄")
#   check-plan <계획 json> <중앙값 tsv> · warm-print <창 디렉터리> · rec <상태 디렉터리> <출력 jsonl> · table <원시 jsonl> <출력 jsonl>
import json
import math
import os
import statistics
import sys
import time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'load'))
import _rec as R  # noqa: E402 — S5 공용 판독(읽기만 · 수정하지 않는다)

# ── 계획 기본값(러너가 start에서 kv params로 고정한다 — 반복끼리 같아야 한다)
DEFAULTS = {
    'seed': 42, 'mix': 'SPIKE', 'pps': 10000, 'tier': 'M',
    'nS': 20, 'nB': 20,
    'sOffset': 25.0, 'sDebounceMs': 5000, 'sSeverity': 1,
    'bOffset': -1.0, 'bDebounceMs': 2000, 'bSeverity': 2,
    'pOffset': -10.0, 'pDebounceMs': 30000, 'pSeverity': 3,
}
FLUSH_PERIOD_MS = {'A': 1000, 'B': 5000, 'C': 1000}  # _rec.BATCH_PLAN_WINDOW_MS와 같은 값 — app-config INGEST_BATCH_PLANS 시간 트리거
LIST_TTL_MS = 30000        # cache:alarmevents TTL(05_data_stores/05 · 현행 참고 30초) = 웹 ALARM_EVENTS_TTL_MS
ACK_SLACK_MS = 3000        # 재조회 → 응답 → 그리기 여유(러너 잠정 · 판정 요청 대상)
FAULT_PG_LEAD_MS = 1000    # fault-pg 제외 구간 여유 — docker stop 호출 1초 앞부터(리드 판정 2026-09-27)
VALUE_TOL = 1e-6           # 행 값 대조 허용 — 생성기가 결정적이라 값 자체를 복제한다(Math.log · cos의 마지막 자리 차만 허용)
DEVIATION_THRESHOLD = 0.2  # 04 §반복과 폐기 — 현행 참고 20%
MIN_RUNS = 3


# ── SPIKE 기저값 — rng.ts(fmix32 · uniform · tagParam) · profiles.ts SPIKE(base = 20 + 60 · tagParam(seed, tag, 2))
def _imul(a, b):
    return (a * b) & 0xFFFFFFFF


def fmix32(h):
    x = h & 0xFFFFFFFF
    x ^= x >> 16
    x = _imul(x, 0x85EBCA6B)
    x ^= x >> 13
    x = _imul(x, 0xC2B2AE35)
    x ^= x >> 16
    return x & 0xFFFFFFFF


def uniform(seed, tag_id, k, stream):
    h = fmix32((seed ^ 0x9E3779B9) & 0xFFFFFFFF)
    h = fmix32(h ^ _imul(tag_id, 0x27D4EB2D))
    h = fmix32(h ^ _imul(k & 0xFFFFFFFF, 0x165667B1))
    h = fmix32(h ^ _imul(k // 4294967296, 0x61C88647))
    h = fmix32(h ^ _imul(stream, 0x2545F491))
    return h / 4294967296


def tag_param(seed, tag_id, stream):
    return uniform(seed, tag_id, 0xFFFFFFFF, 1000 + stream)


def spike_base(seed, tag_id):
    return 20 + 60 * tag_param(seed, tag_id, 2)


def normal(seed, tag_id, k, stream):
    """rng.ts normal — Box–Muller(u1이 0이면 2^-32)"""
    u1 = uniform(seed, tag_id, k, stream) or 1 / 4294967296
    u2 = uniform(seed, tag_id, k, stream + 1)
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


def spike_value(seed, tag_id, ts_ms, period_ms=1000):
    """profiles.ts SPIKE 시점 값 — mode-b-runner: k = floor(ts ÷ 주기) · base + normal(61) + (uniform(60) < 0.005 ? 50 + 50·uniform(63) : 0)"""
    k = int(ts_ms // period_ms)
    spike = uniform(seed, tag_id, k, 60) < 0.005
    return spike_base(seed, tag_id) + normal(seed, tag_id, k, 61) + ((50 + 50 * uniform(seed, tag_id, k, 63)) if spike else 0)


def plan_rules(tag_ids, p=None):
    """태그 목록(정렬) → 규칙 계획 — 태그를 고르게 벌려 계층 S · B · 탐침 P 순으로 배정(설비가 겹치지 않게 간격 = 전체 ÷ 규칙 수)"""
    p = {**DEFAULTS, **(p or {})}
    tags = sorted(int(t) for t in tag_ids)
    n = p['nS'] + p['nB'] + 1
    if len(tags) < n:
        raise SystemExit(f'태그 {len(tags)}개 — 규칙 {n}개를 배정할 수 없다')
    step = len(tags) // n
    picked = [tags[i * step] for i in range(n)]
    out = []
    for i, tag in enumerate(picked):
        tier = 'S' if i < p['nS'] else ('B' if i < p['nS'] + p['nB'] else 'P')
        base = spike_base(p['seed'], tag)
        off, deb, sev = p[tier.lower() + 'Offset'], p[tier.lower() + 'DebounceMs'], p[tier.lower() + 'Severity']
        out.append({'tier': tier, 'tagId': tag, 'base': round(base, 6), 'conditionType': 'GT',
                    'threshold': round(base + off, 3), 'debounceMs': deb, 'severity': sev})
    return out


def check_values(plan, rows, seed=DEFAULTS['seed'], period_ms=1000):
    """실측 행(tag_id, ts ms, value) 대 생성식 복제값 — 행마다 |차| ≤ 1e-6. 한 행이라도 어긋나거나 계획 태그에 행이 없으면 실패
    (복제가 이미지의 생성식과 다르면 임계가 분포 밖에 놓인다 — 러너가 생성기를 멈추고 끝낸다)"""
    tags = {r['tagId'] for r in plan}
    seen, bad, n = set(), [], 0
    for tag, ts, v in rows:
        if tag not in tags:
            continue
        n += 1
        seen.add(tag)
        want = spike_value(seed, tag, ts, period_ms)
        if abs(want - v) > VALUE_TOL:
            bad.append({'tagId': tag, 'ts': ts, 'value': v, 'expected': want})
    missing = sorted(tags - seen)
    return {'rows': n, 'tags': len(seen), 'mismatch': bad[:20], 'mismatchCount': len(bad), 'missingTags': missing,
            'tolerance': VALUE_TOL, 'ok': n > 0 and not bad and not missing}


# ── 판독 조각
def read_tsv(p, types):
    rows = []
    for ln in (R.rd(p, '') or '').splitlines():
        f = ln.split('\t') if '\t' in ln else ln.split(',')
        if len(f) < len(types):
            continue
        rows.append(tuple(t(x) if x != '' else None for t, x in zip(types, f)))
    return rows


def parse_states(text):
    """'== <rule_id>' 머리 뒤 HGETALL 필드 · 값 줄 교대 → {rule_id: {필드: 값}} — 키가 없으면 빈 사전"""
    out, cur, buf = {}, None, []
    def flush():
        if cur is not None:
            out[cur] = {buf[i]: buf[i + 1] for i in range(0, len(buf) - 1, 2)}
    for ln in (text or '').splitlines():
        if ln.startswith('== '):
            flush()
            cur, buf = int(ln[3:].strip()), []
        elif cur is not None:
            buf.append(ln.rstrip('\r'))
    flush()
    return out


def parse_frames(p):
    """구독 기록 줄 'epoch_ms {json}' → [(수신 ms, 프레임)]"""
    out = []
    for ln in (R.rd(p, '') or '').splitlines():
        sp = ln.find(' ')
        if sp < 0:
            continue
        try:
            out.append((int(ln[:sp]), json.loads(ln[sp + 1:])))
        except (ValueError, json.JSONDecodeError):
            continue
    return out


def frames_between(frames, a, b, rule=None, transition=None):
    return [f for t, f in frames if a <= t <= b and (rule is None or f.get('ruleId') == rule)
            and (transition is None or f.get('transition') == transition)]


def breach_runs(rows):
    """[(ts, breached)] ts 오름차순 → 위반 연속 구간 [(시작 ts, 끝 ts)]"""
    runs, start, last = [], None, None
    for ts, b in rows:
        if b:
            if start is None:
                start = ts
            last = ts
        elif start is not None:
            runs.append((start, last))
            start = None
    if start is not None:
        runs.append((start, last))
    return runs


def debounce_check(events, rows_by_rule, debounce_by_rule):
    """확정 열림마다 — 그 행(occurred_at = 판정 행 ts)으로 끝나는 위반 연속 구간 길이 ≥ debounce_ms 인가(06_pipeline/08 PENDING → ACTIVE)
    판정 행이 alarm_eval에 없으면(무효 구간 · 창 밖) unknown · 짧으면 short(디바운스 미만 확정 = AC-09 결함)"""
    out = {'ok': 0, 'short': 0, 'unknown': 0, 'shortEvents': []}
    for ev in events:
        rows = rows_by_rule.get(ev['ruleId']) or []
        t = ev['occurredMs']
        idx = next((i for i, (ts, _) in enumerate(rows) if ts == t), None)
        if idx is None or not rows[idx][1]:
            out['unknown'] += 1
            continue
        j = idx
        while j > 0 and rows[j - 1][1]:
            j -= 1
        if j == 0:  # 창 첫 행까지 위반 — 시작점을 모른다(창을 앞당겨 뽑는다)
            if t - rows[0][0] >= debounce_by_rule[ev['ruleId']]:
                out['ok'] += 1
            else:
                out['unknown'] += 1
            continue
        if t - rows[j][0] >= debounce_by_rule[ev['ruleId']]:
            out['ok'] += 1
        else:
            out['short'] += 1
            out['shortEvents'].append({'eventId': ev['eventId'], 'ruleId': ev['ruleId'], 'runMs': t - rows[j][0]})
    return out


def rows_by_rule(tsv_rows):
    by = {}
    for rule, ts, b in tsv_rows:
        by.setdefault(rule, []).append((ts, b))
    for v in by.values():
        v.sort()
    return by


def le_fraction(a, b, name, le, **want):
    """히스토그램 창 차에서 le 칸 누적 ÷ 전체 — 보간 없는 정확 비율(구조 관계 판정용 · 04 §반복과 폐기 분위수 규칙 밖)"""
    if not a or not b:
        return None
    tot = R.pdelta(a, b, f'{name}_count', **want)
    if not tot:
        return None
    hit = None
    for (n, lab), v in b.items():
        if n != f'{name}_bucket':
            continue
        l = R.histdiff.labels(lab)
        if any(l.get(k) != str(val) for k, val in want.items()) or l.get('le') in (None, '+Inf'):
            continue
        if abs(float(l['le']) - le) < 1e-12:
            hit = (hit or 0.0) + v - a.get((n, lab), 0.0)
    return None if hit is None else hit / tot


PHASES = ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'total')
TRANSITIONS = (('NORMAL', 'PENDING'), ('PENDING', 'PENDING'), ('PENDING', 'NORMAL'), ('PENDING', 'ACTIVE'),
               ('ACTIVE', 'CLEARING'), ('ACTIVE', 'NORMAL'), ('CLEARING', 'ACTIVE'), ('CLEARING', 'NORMAL'))


def alarm_metrics(a, b, secs=None):
    """판정기(worker) 창 차 — 판정 수 · 처리량 · 판정 구간 · 인계 대기 · 전이 · 확정 · 전수 · 무효 구간 · 실패 계수"""
    if not a or not b:
        return None
    ev_v = R.pdelta(a, b, 'alm_evaluations_total', result='violation')
    ev_n = R.pdelta(a, b, 'alm_evaluations_total', result='normal')
    ev = None if ev_v is None and ev_n is None else (ev_v or 0) + (ev_n or 0)
    tot_batches = R.pdelta(a, b, 'alm_eval_duration_seconds_count', phase='total')
    return {
        'evaluations': ev, 'violations': ev_v, 'normals': ev_n,
        'evalRowsPerS': ev / secs if (ev is not None and secs) else None,
        'batchesTotal': tot_batches, 'batchesA1': R.pdelta(a, b, 'alm_eval_duration_seconds_count', phase='A1'),
        'batchesPerS': tot_batches / secs if (tot_batches is not None and secs) else None,
        'duration': {ph: R.bucket_view(a, b, 'alm_eval_duration_seconds', phase=ph) for ph in PHASES},
        'handoffWait': R.bucket_view(a, b, 'alm_handoff_wait_seconds'),
        'handoffWaitCount': R.pdelta(a, b, 'alm_handoff_wait_seconds_count'),
        'transitions': {f'{f}>{t}': R.pdelta(a, b, 'alm_transitions_total', **{'from': f, 'to': t}) for f, t in TRANSITIONS},
        'opened': R.pdelta(a, b, 'alm_events_opened_total'), 'closed': R.pdelta(a, b, 'alm_events_closed_total'),
        'activeAlarms': {s: R.psum(b, 'alm_active_alarms', severity=s) for s in ('1', '2', '3')},
        'evalRowsInserted': R.pdelta(a, b, 'alm_eval_rows_inserted_total'),
        'gapBatches': R.pdelta(a, b, 'alm_eval_gap_batches_total'), 'gapRows': R.pdelta(a, b, 'alm_eval_gap_rows_total'),
        'stateWriteFailures': R.pdelta(a, b, 'alm_state_write_failures_total'),
        'pgWriteFailures': {op: R.pdelta(a, b, 'alm_pg_write_failures_total', op=op) for op in ('open', 'close')},
        'routedRows': {ly: R.pdelta(a, b, 'ing_routed_rows_total', layer=ly) for ly in ('raw', 'alarm')},
        'rowsInserted': R.pdelta(a, b, 'rows_inserted'), 'dlq': R.pdelta(a, b, 'dlq_count'),
        'publishFailuresAlarm': R.pdelta(a, b, 'rlt_publish_failures_total', channel='alarm'),
        'restartDetected': R.restart_detected(a, b),
    }


def flush_relation(a, b, flush_ms):
    """구조 관계 — 판정 구간 p95 ≤ 플러시 주기(06_pipeline/08 · 04_architecture/05): le = 플러시 주기 칸 누적 비율 ≥ 0.95
    버킷 경계에 플러시 주기(1 s)가 있어 보간 없이 판정한다 · 경계가 없으면 None(보간 값으로 구조 판정하지 않는다)"""
    frac = le_fraction(a, b, 'alm_eval_duration_seconds', flush_ms / 1000, phase='total')
    return {'flushPeriodMs': flush_ms, 'fractionWithin': frac, 'holds': None if frac is None else frac >= 0.95,
            'basis': 'bucket le=flush period cumulative ratio(no interpolation)'}


# ── 기록 한 줄 — 창(window) · ACK · PostgreSQL 정지 · alarm_eval 강제 실패 · 마감(stop)
def load_rules(d):
    return R.jload(os.path.join(d, 'rules.json'), []) or []


def window_view(d, rules, flush_ms):
    sd = os.path.join(d, 'window')
    m = R.meta(os.path.join(sd, 'meta'))
    w0, w1 = R.num(m.get('winStartMs')), R.num(m.get('winEndMs'))
    secs = (w1 - w0) / 1000 if (w0 and w1) else None
    a0w, a1w = R.prom(os.path.join(sd, 'm0.worker')), R.prom(os.path.join(sd, 'm1.worker'))
    ids = {r['ruleId']: r for r in rules}
    ev = read_tsv(os.path.join(sd, 'eval.tsv'), (int, int, int))
    in_win = [x for x in ev if w0 <= x[1] < w1]
    by_rule_eval = {}
    for rule, _, b in in_win:
        c = by_rule_eval.setdefault(rule, [0, 0])
        c[0] += 1
        c[1] += b
    events = [e for e in events_of(os.path.join(sd, 'events.csv')) if e['ruleId'] in ids]
    opened_win = [e for e in events if w0 <= e['occurredMs'] < w1]
    closed_win = [e for e in events if e['clearedMs'] is not None and w0 <= e['clearedMs'] < w1]
    by_rule_open = {}
    for e in opened_win:
        by_rule_open[e['ruleId']] = by_rule_open.get(e['ruleId'], 0) + 1
    keys = R.num(R.rd(os.path.join(sd, 'keys')))
    judged_all = R.num(R.rd(os.path.join(sd, 'judged-rules')))
    per_rule_ok = all(by_rule_eval.get(r, [0])[0] >= n for r, n in by_rule_open.items())
    live = [r for r in rules if (r.get('createdMs') or 0) < (w1 or 0)]  # 창 끝에 있던 규칙(탐침은 창 뒤 fault-pg가 만든다)
    eval_total = len(in_win)
    three = {
        'evalRows': eval_total, 'evalBreached': sum(x[2] for x in in_win), 'judgedRulesWindow': len(by_rule_eval),
        'eventsOpened': len(opened_win), 'eventsClosed': len(closed_win), 'stateKeys': keys,
        'judgedRulesAll': judged_all, 'rulesCreated': len(live),
        # AC-35 — 셋이 각자의 목적대로 존재 · 건수 일치를 기대하지 않는다(판정 ≥ 확정 · 상태 키 = 판정된 규칙당 1)
        'evalGeConfirmed': eval_total >= len(opened_win) and per_rule_ok,
        'keysEqJudgedRules': keys is not None and judged_all is not None and keys == judged_all == len(live),
    }
    rb = rows_by_rule(ev)
    deb = {r['ruleId']: r['debounceMs'] for r in rules}
    b_events = [e for e in opened_win if ids[e['ruleId']]['tier'] == 'B']
    s_rules = [r['ruleId'] for r in rules if r['tier'] == 'S']
    s_runs = [(e - s) for r in s_rules for s, e in breach_runs([x for x in rb.get(r, []) if w0 <= x[0] < w1])]
    met = alarm_metrics(a0w, a1w, secs)
    return {
        'window': {'start': R.iso(w0), 'end': R.iso(w1)}, 'seconds': secs,
        'metrics': met, 'flushRelation': flush_relation(a0w, a1w, flush_ms),
        'threeStores': three,
        'debounceB': debounce_check(b_events, rb, deb),
        'spikeTier': {'events': sum(1 for e in opened_win if ids[e['ruleId']]['tier'] == 'S'),
                      'breachedRows': sum(x[2] for x in in_win if ids.get(x[0], {}).get('tier') == 'S'),
                      'maxRunMs': max(s_runs) if s_runs else None, 'runs': len(s_runs)},
        'lag': R.series_summary(R.col(R.samples(os.path.join(sd, 'win.samples')), 1)),
        'cpu': R.cpu_summary(R.stats(os.path.join(sd, 'stats')), int(w0 / 1000) if w0 else None, int(w1 / 1000) if w1 else None),
    }


def events_of(p):
    """events.csv: event_id, rule_id, occurred_ms, cleared_ms, acked_ms, state"""
    out = []
    for r in read_tsv(p, (int, int, int, int, int, str)):
        out.append({'eventId': r[0], 'ruleId': r[1], 'occurredMs': r[2], 'clearedMs': r[3], 'ackedMs': r[4], 'state': r[5]})
    return out


def ack_bound_ms(resp_ms, frame_times, list_fetch_times=(), ttl=LIST_TTL_MS):
    """구조 상한(리드 판정 2026-09-27 · 정본 문장은 W6) — 다른 탭의 확인 표시는 다음 목록 재조회 때이고, 이 화면의 재조회 계기는
    겹침 행 TTL 경과뿐이다(08_screen/05 §실시간 겹침). 기준점 = max(tR − TTL, tR 이전 B의 마지막 목록 응답 시각) —
    그 전에 받은 프레임은 이미 재조회로 정리됐거나 tR 전에 재조회를 일으켰다. 상한 = (기준점 뒤 첫 프레임 수신) + TTL − tR.
    기준점 뒤 프레임이 없으면 계기가 없다(None — 무한). 여유(ACK_SLACK_MS)는 판정 쪽에서 더한다"""
    before = [t for t in list_fetch_times if t <= resp_ms]
    base = max([resp_ms - ttl] + before)
    later = [t for t in frame_times if t > base]
    return None if not later else min(later) + ttl - resp_ms


def ack_view(d):
    j = R.jload(os.path.join(d, 'ack', 'ack.json'))
    if not j:
        return None
    fb = j.get('framesB') or []
    lf = [x[0] for x in (j.get('listFetchesB') or []) if x]
    trials = []
    for t in j.get('trials') or []:
        x = dict(t)
        if t.get('status') == 200:
            x['delayMs'] = None if t.get('bDomMs') is None else t['bDomMs'] - t['respMs']
            x['delayFromClickMs'] = None if t.get('bDomMs') is None else t['bDomMs'] - t['clickMs']
            x['selfMs'] = None if t.get('aDomMs') is None else t['aDomMs'] - t['respMs']
            x['boundMs'] = ack_bound_ms(t['respMs'], fb, lf)
            if x['boundMs'] is None:
                x['withinBound'] = None
            elif t.get('bDomMs') is None:
                x['withinBound'] = False if (t.get('waitedMs') or 0) > x['boundMs'] + ACK_SLACK_MS else None
            else:
                x['withinBound'] = x['delayMs'] <= x['boundMs'] + ACK_SLACK_MS
        trials.append(x)
    ok = [t for t in trials if t.get('status') == 200]
    delays = [t['delayMs'] for t in ok if t.get('delayMs') is not None]
    selfs = [t['selfMs'] for t in ok if t.get('selfMs') is not None]
    m0, m1 = R.prom(os.path.join(d, 'ack', 'm0.api')), R.prom(os.path.join(d, 'ack', 'm1.api'))
    return {
        'method': j.get('method'), 'url': j.get('url'), 'error': j.get('error'),
        'trials': trials, 'accepted': len(ok), 'rejected': sum(1 for t in trials if t.get('status') not in (None, 200)),
        'displayed': len(delays), 'delayMedianMs': statistics.median(delays) if delays else None,
        'delayMaxMs': max(delays) if delays else None, 'selfMedianMs': statistics.median(selfs) if selfs else None,
        'framesA': len(j.get('framesA') or []), 'framesB': len(fb), 'listFetchesB': len(j.get('listFetchesB') or []),
        'framesBByTransition': {t: sum(1 for x in (j.get('framesDetailB') or []) if len(x) > 2 and x[2] == t) for t in ('OPENED', 'CLEARED')},
        'window': {'loaded': R.iso(j.get('loadedMs')), 'end': R.iso(j.get('endedMs'))},
        'acksMetric': {r: R.pdelta(m0, m1, 'alm_acks_total', result=r) for r in ('accepted', 'rejected')},
        'webBuild': R.meta(os.path.join(d, 'ack', 'meta')).get('webBuild'),
        'webDirty': R.meta(os.path.join(d, 'ack', 'meta')).get('webDirty'),
    }


def faultpg_view(d, rules):
    sd = os.path.join(d, 'fault-pg')
    m = R.meta(os.path.join(sd, 'meta'))
    if not m:
        return None
    n = lambda k: R.num(m.get(k))
    probe = int(m['probeRuleId']) if m.get('probeRuleId') else None
    frames = parse_frames(os.path.join(sd, 'frames'))
    # 정지 중 = [정지 완료, docker start 호출] · 복구 뒤 = [docker start 호출, 끝] — 준비(pg_isready) 시각은 확인 폴링의 1초 해상도라 경계로 쓰지 않는다
    stopped, started, ready, end = n('stoppedMs'), n('startMs'), n('readyMs'), n('endMs')
    st = parse_states(R.rd(os.path.join(sd, 'probe-state'), '')).get(probe, {})
    fb = R.num(st.get('first_breach_ts'))
    deb = next((r['debounceMs'] for r in rules if r.get('ruleId') == probe), None)
    due = fb + deb if (fb is not None and deb is not None) else None
    pev = [e for e in events_of(os.path.join(sd, 'probe-events.csv'))]
    a0, a1, am = (R.prom(os.path.join(sd, f'{x}.worker')) for x in ('m0', 'm1', 'mstop'))
    stop_frames = frames_between(frames, stopped, started) if (stopped and started) else None
    after = frames_between(frames, started, end, rule=probe, transition='OPENED') if (started and end) else None
    pg_fail_open = R.pdelta(a0, am, 'alm_pg_write_failures_total', op='open')
    v = {
        'probeRuleId': probe, 'stopS': n('stopS'),
        'window': {'stopIssued': R.iso(n('stopMs')), 'stopped': R.iso(stopped), 'started': R.iso(n('startMs')), 'ready': R.iso(ready), 'end': R.iso(end)},
        'probeFirstBreach': R.iso(fb), 'probeDue': R.iso(due), 'dueInsideOutage': None if (due is None or stopped is None or started is None) else (stopped <= due < started),
        'pendingBeforeStop': st.get('state') == 'PENDING',
        'probeEvents': len(pev), 'probeOccurred': R.iso(pev[0]['occurredMs']) if pev else None,
        'probeOccurredAfterStop': bool(pev) and pev[0]['occurredMs'] >= stopped,
        'framesDuringStop': None if stop_frames is None else len(stop_frames),
        'probeOpenedFramesAfter': None if after is None else len(after),
        'probeOpenedFramesDuringStop': None if stop_frames is None else sum(1 for f in stop_frames if f.get('ruleId') == probe),
        'pgWriteFailuresDuringStop': {op: R.pdelta(a0, am, 'alm_pg_write_failures_total', op=op) for op in ('open', 'close')},
        'metricsStop': alarm_metrics(a0, am), 'metricsAll': alarm_metrics(a0, a1),
        # 참고값 — 확인 폴링 1초 해상도 · 판정에 쓰지 않는다
        'confirmAfterReadyMs': (n('confirmMs') - ready) if (pev and ready and n('confirmMs')) else None,
        'confirmAfterStartMs': (pev[0]['occurredMs'] - started) if (pev and started) else None,
        'workerRunning': m.get('workerRunning') == 'true', 'restartDetected': R.restart_detected(a0, a1),
        'cacheTtlAtStopS': n('cacheTtlS'),
    }
    # AC-36 PostgreSQL 정지 — 이벤트 미확정 · 발행 0 · 복구 뒤 확정 1
    v['holds'] = bool(v['dueInsideOutage'] and v['pendingBeforeStop'] and (pg_fail_open or 0) >= 1 and v['probeEvents'] == 1
                      and v['probeOccurredAfterStop'] and v['framesDuringStop'] == 0 and v['probeOpenedFramesAfter'] == 1
                      and v['workerRunning'] and not v['restartDetected'])
    return v


def gap_line(ln):
    """로그 한 줄 → alarm_eval_gap 사전(없으면 None) — 평문 로거는 JSON 그대로 · JSON 로거면 message 문자열 안에 이스케이프돼 있다"""
    if 'alarm_eval_gap' not in ln:
        return None
    i = ln.find('{"event":"alarm_eval_gap"')
    if i >= 0:
        try:
            return json.loads(ln[i:ln.rfind('}') + 1])
        except json.JSONDecodeError:
            pass
    j = ln.find('{')
    if j >= 0:
        try:
            outer = json.loads(ln[j:ln.rfind('}') + 1])
            msg = outer.get('message') if isinstance(outer, dict) else None
            if isinstance(msg, str) and msg.startswith('{'):
                o = json.loads(msg)
                return o if o.get('event') == 'alarm_eval_gap' else None
        except json.JSONDecodeError:
            pass
    return None


def gap_log(p):
    """worker 로그의 alarm_eval_gap 구조화 줄 → 사유별 수 · 행 합(02_instrumentation §구간 기록 — 계수와 1:1) · 읽지 못한 줄 수"""
    by, rows, n, bad, ranges = {}, 0, 0, 0, []
    for ln in (R.rd(p, '') or '').splitlines():
        if 'alarm_eval_gap' not in ln:
            continue
        o = gap_line(ln)
        if o is None:
            bad += 1
            continue
        n += 1
        rows += o.get('rows') or 0
        by[o.get('reason')] = by.get(o.get('reason'), 0) + 1
        if o.get('ts_min') is not None and o.get('ts_max') is not None:
            ranges.append([int(o['ts_min']), int(o['ts_max'])])
    return {'events': n, 'rows': rows, 'byReason': by, 'unparsed': bad, 'ranges': ranges}


def faultch_view(d):
    sd = os.path.join(d, 'fault-ch')
    m = R.meta(os.path.join(sd, 'meta'))
    if not m:
        return None
    n = lambda k: R.num(m.get(k))
    frames = parse_frames(os.path.join(sd, 'frames'))
    hold, rel, end = n('holdMs'), n('releaseMs'), n('endMs')
    a0, am, a1 = (R.prom(os.path.join(sd, f'{x}.worker')) for x in ('m0', 'mmid', 'm1'))
    hold_m, all_m, after_m = alarm_metrics(a0, am), alarm_metrics(a0, a1), alarm_metrics(am, a1)
    g = gap_log(os.path.join(sd, 'gap.log'))
    fr = frames_between(frames, hold, rel) if (hold and rel) else []
    v = {
        'mode': m.get('mode'), 'holdS': n('holdS'), 'recoverS': n('recoverS'),
        'window': {'hold': R.iso(hold), 'release': R.iso(rel), 'end': R.iso(end)},
        'restored': m.get('restored') == '1',
        'gapLog': g, 'metricsHold': hold_m, 'metricsAll': all_m, 'metricsAfter': after_m,
        'framesDuringHold': len(fr),
        'framesByTransition': {t: sum(1 for f in fr if f.get('transition') == t) for t in ('OPENED', 'CLEARED')},
        'eventsOpenedInHold': R.num(m.get('pgOpenedInHold')), 'eventsClosedInHold': R.num(m.get('pgClosedInHold')),
    }
    gb = (all_m or {}).get('gapBatches')
    v['gapLogMatchesCounter'] = gb is not None and g['events'] == gb
    # AC-36 alarm_eval 실패 — 알람 발생 · 해제 · 발행 정상 · 무효 구간 계수 증가 · 적재 무영향
    v['holds'] = bool(v['restored'] and (gb or 0) > 0 and v['gapLogMatchesCounter']
                      and (hold_m or {}).get('opened', 0) > 0 and (hold_m or {}).get('closed', 0) > 0 and v['framesDuringHold'] > 0
                      and ((hold_m or {}).get('pgWriteFailures') or {}).get('open', 0) == 0 and (hold_m or {}).get('dlq', 0) == 0
                      and (hold_m or {}).get('rowsInserted', 0) > 0 and (after_m or {}).get('evalRowsInserted', 0) > 0
                      and not (all_m or {}).get('restartDetected'))
    return v


def replay_opens(rows, debounce_ms, events=()):
    """judge.ts 상태 머신(GT · 전이 8)을 alarm_eval 행으로 재생 → 예측 열림 ts 목록.
    ACTIVE의 해소 첫 감지에서 확인(ACKED) 경로를 탈지는 판정기가 그 순간 PostgreSQL acked_at으로 정한다 — 재생은 그 순간을 모르므로
    실측 이벤트가 바로 그 행 ts로 닫혔으면 확인 경로로 본다(닫힘 ts는 실측 · 열림 예측만 대조한다)."""
    by_occ = {e['occurredMs']: e for e in events}
    st, fb, fc, cur, opens = 'NORMAL', None, None, None, []
    for ts, b in rows:
        if st == 'NORMAL':
            if b:
                st, fb = 'PENDING', ts
        elif st == 'PENDING':
            if not b:
                st, fb = 'NORMAL', None
            elif ts - fb >= debounce_ms:
                st, cur = 'ACTIVE', by_occ.get(ts)
                opens.append(ts)
        elif st == 'ACTIVE':
            if b:
                continue
            if cur is not None and cur.get('clearedMs') == ts:
                st, fb, cur = 'NORMAL', None, None
            else:
                st, fc = 'CLEARING', ts
        elif st == 'CLEARING':
            if b:
                st, fc = 'ACTIVE', None
            elif ts - fc >= debounce_ms:
                st, fb, fc, cur = 'NORMAL', None, None, None
    return opens


def _inside(ts, spans):
    return any(a <= ts <= b for a, b in spans)


def completeness(rules, rows_by, events, exclusions):
    """AC-09 완전성 — 규칙별 재생 예측 열림 ts 집합 = alarm_event.occurred_at 집합(대조 구간 안).
    제외 구간(무효 구간 · 장애 주입 창)을 지나면 상태를 모르므로 다시 맞춘다: 그 시점에 실측 열린 이벤트가 있으면 그 닫힘 뒤부터,
    없으면 구간 뒤 첫 정상 행부터 NORMAL로 재생한다. 대조 구간 밖에서 열린 실측 이벤트는 제외 수로 센다."""
    out = {'rules': 0, 'predicted': 0, 'actual': 0, 'matched': 0, 'missing': [], 'extra': [], 'excludedEvents': 0,
           'exclusions': [list(x) for x in sorted(exclusions)]}
    for r in rules:
        rid = r['ruleId']
        rows = rows_by.get(rid) or []
        evs = sorted([e for e in events if e['ruleId'] == rid], key=lambda e: e['occurredMs'])
        out['rules'] += 1
        # 제외 구간으로 행을 조각낸다
        segs, cur = [], []
        for ts, b in rows:
            if _inside(ts, exclusions):
                if cur:
                    segs.append(cur)
                    cur = []
                continue
            cur.append((ts, b))
        if cur:
            segs.append(cur)
        windows = []
        for i, seg in enumerate(segs):
            start = seg[0][0]
            if i > 0 or (rows and _inside(rows[0][0], exclusions)):
                open_ev = next((e for e in evs if e['occurredMs'] <= start and (e['clearedMs'] is None or e['clearedMs'] >= start)), None)
                if open_ev is not None:
                    if open_ev['clearedMs'] is None:
                        continue
                    seg = [x for x in seg if x[0] > open_ev['clearedMs']]
                else:
                    k = next((j for j, x in enumerate(seg) if not x[1]), None)
                    seg = [] if k is None else seg[k:]
            if not seg:
                continue
            pred = set(replay_opens(seg, r['debounceMs'], evs))
            a, b = seg[0][0], seg[-1][0]
            act = {e['occurredMs'] for e in evs if a <= e['occurredMs'] <= b}
            windows.append((a, b))
            out['predicted'] += len(pred)
            out['actual'] += len(act)
            out['matched'] += len(pred & act)
            out['missing'] += [{'ruleId': rid, 'ts': t} for t in sorted(pred - act)]
            out['extra'] += [{'ruleId': rid, 'ts': t} for t in sorted(act - pred)]
        out['excludedEvents'] += sum(1 for e in evs if not any(a <= e['occurredMs'] <= b for a, b in windows))
    out['missing'], out['extra'] = out['missing'][:50], out['extra'][:50]
    out['holds'] = out['predicted'] == out['actual'] == out['matched']
    out['basis'] = 'open-set only · ACK branch decided by measured close time'
    out['limitation'] = ('열림 ts 집합만 대조한다 — 닫힘 ts는 대조하지 않는다. ACTIVE 해소 첫 행의 확인(ACKED) 분기는 판정 순간의 acked_at을 '
                         '재생할 수 없어 실측 이벤트가 그 행 ts로 닫혔는지로 정한다(리드 승인 조건 2026-09-27)')
    return out


def phase_spans(d):
    """이벤트 분류 · 제외 구간 — 정상 창 · PostgreSQL 정지(docker stop 호출 − 1 s ~ fault-pg 끝) · alarm_eval 보류(보류 ~ fault-ch 끝)
    PostgreSQL은 stop 호출 직후부터 연결을 거부한다 — 정지 완료(stoppedMs)부터 빼면 그 사이 확정 실패가 missing으로 오판된다(재검수 중간)"""
    out = {}
    w = R.meta(os.path.join(d, 'window', 'meta'))
    if w.get('winStartMs'):
        out['window'] = (int(w['winStartMs']), int(w['winEndMs']))
    p = R.meta(os.path.join(d, 'fault-pg', 'meta'))
    start = p.get('stopMs') or p.get('stoppedMs')
    if start and p.get('endMs'):
        out['faultPg'] = (int(start) - (FAULT_PG_LEAD_MS if p.get('stopMs') else 0), int(p['endMs']))
    c = R.meta(os.path.join(d, 'fault-ch', 'meta'))
    if c.get('holdMs') and c.get('endMs'):
        out['faultCh'] = (int(c['holdMs']), int(c['endMs']))
    return out


def by_phase(events, spans):
    out = {k: 0 for k in ('window', 'faultPg', 'faultCh', 'other')}
    for e in events:
        k = next((n for n in ('faultPg', 'faultCh', 'window') if n in spans and spans[n][0] <= e['occurredMs'] <= spans[n][1]), 'other')
        out[k] += 1
    return out


def final_view(d, rules):
    sd = os.path.join(d, 'final')
    if not os.path.isdir(sd):
        return None
    ids = {r['ruleId']: r for r in rules}
    events = [e for e in events_of(os.path.join(sd, 'events.csv')) if e['ruleId'] in ids]
    states = parse_states(R.rd(os.path.join(sd, 'states'), ''))
    ev = read_tsv(os.path.join(sd, 'eval.tsv'), (int, int, int))
    rb = rows_by_rule(ev)
    tier = lambda t: [r for r in rules if r['tier'] == t]
    # AC-09 미만 — 계층 S: 확정 0 · 위반 행 존재 · 상태 NORMAL 복귀(마지막 행이 이상치라 PENDING에 남은 규칙은 그 뜻을 따로 센다)
    s_ids = [r['ruleId'] for r in tier('S')]
    s_last_pending, s_bad_state = [], []
    for r in s_ids:
        st = states.get(r, {})
        if st.get('state') == 'NORMAL':
            continue
        if st.get('state') == 'PENDING' and st.get('first_breach_ts') and st.get('first_breach_ts') == st.get('last_ts'):
            s_last_pending.append(r)
        else:
            s_bad_state.append({'ruleId': r, 'state': st.get('state')})
    s_runs = [(e - s) for r in s_ids for s, e in breach_runs(rb.get(r, []))]
    s_breached = sum(b for r in s_ids for _, b in rb.get(r, []))
    s_deb = min(r['debounceMs'] for r in tier('S')) if tier('S') else None
    below = {
        'rules': len(s_ids), 'events': sum(1 for e in events if ids[e['ruleId']]['tier'] == 'S'),
        'breachedRows': s_breached, 'rulesWithBreach': sum(1 for r in s_ids if any(b for _, b in rb.get(r, []))),
        'maxRunMs': max(s_runs) if s_runs else None, 'debounceMs': s_deb,
        'normalAtEnd': sum(1 for r in s_ids if states.get(r, {}).get('state') == 'NORMAL'),
        'pendingByLastRow': s_last_pending, 'badState': s_bad_state,
    }
    below['holds'] = bool(below['events'] == 0 and s_breached > 0 and (below['maxRunMs'] is None or below['maxRunMs'] < s_deb) and not s_bad_state)
    # AC-09 이상 — 계층 B: 열림마다 위반 연속 ≥ 디바운스(무효 구간 · 창 밖은 unknown) · 규칙당 열린 행 ≤ 1(부분 유일 인덱스 없음 — 판정기 강제)
    b_events = [e for e in events if ids[e['ruleId']]['tier'] == 'B']
    open_by_rule = {}
    for e in events:
        if e['state'] == 'ACTIVE':
            open_by_rule[e['ruleId']] = open_by_rule.get(e['ruleId'], 0) + 1
    deb = {r['ruleId']: r['debounceMs'] for r in rules}
    spans = phase_spans(d)
    gl = gap_log(os.path.join(sd, 'gap.log'))
    excl = [spans[k] for k in ('faultPg', 'faultCh') if k in spans] + [tuple(x) for x in gl['ranges']]
    comp = completeness(rules, rb, events, excl)
    # 디바운스 short 판정은 completeness와 같은 제외 구간 밖의 열림만 — 장애 주입 · 무효 구간 안 열림은 따로 센다(재검수 낮음1)
    b_in = [e for e in b_events if not _inside(e['occurredMs'], excl)]
    b_out = [e for e in b_events if _inside(e['occurredMs'], excl)]
    above = {'events': len(b_events), 'closed': sum(1 for e in b_events if e['clearedMs'] is not None),
             'acked': sum(1 for e in b_events if e['ackedMs'] is not None),
             'ackedClosed': sum(1 for e in b_events if e['ackedMs'] is not None and e['clearedMs'] is not None),
             'debounce': debounce_check(b_in, rb, deb), 'debounceExcluded': debounce_check(b_out, rb, deb),
             'excludedEvents': len(b_out), 'maxOpenPerRule': max(open_by_rule.values(), default=0)}
    above['holds'] = bool(above['events'] > 0 and above['debounce']['short'] == 0 and above['maxOpenPerRule'] <= 1)
    above['byPhase'] = by_phase(b_events, spans)
    keys = R.num(R.rd(os.path.join(sd, 'keys')))
    judged = R.num(R.rd(os.path.join(sd, 'judged-rules')))
    audit = R.num(R.rd(os.path.join(sd, 'audit-rule-inserts')))
    base = R.jload(os.path.join(d, 'baseline-counts.json'), {}) or {}
    audit_diff = None if (audit is None or base.get('auditRuleInserts') is None) else audit - base['auditRuleInserts']
    pre = R.num(R.rd(os.path.join(d, 'kv', 'preexistingEvalRows')))
    return {
        'rulesCreated': len(rules), 'ruleSeedRowsBefore': R.num(R.rd(os.path.join(d, 'rules-before'))),
        # 규칙 POST 전 ts의 alarm_eval 행(대상 rule_id) — 판정 셈은 POST 시작 시각 이후 행만 읽어 이 행을 뺀다 · 0이 아니면 경고
        'preexistingEvalRows': pre,
        'preexistingWarning': None if not pre else f'대상 rule_id의 POST 전 alarm_eval 행 {int(pre)}개 — 스냅샷에 판정 전수가 남아 있다(셈에서 뺐다)',
        'baselineCounts': base or None, 'auditRuleInserts': audit, 'auditRuleInsertsDiff': audit_diff,
        'rulesViaSurface': None if audit_diff is None else audit_diff == len(rules),
        'completeness': comp, 'eventsByPhase': by_phase(events, spans),
        'stateKeys': keys, 'judgedRules': judged, 'keysEqJudgedRules': keys is not None and keys == judged == len(rules),
        'events': len(events), 'evalRowsRulesAll': len(ev),
        'belowDebounce': below, 'aboveDebounce': above,
        'finalStates': {s: sum(1 for r in ids if states.get(r, {}).get('state') == s) for s in ('NORMAL', 'PENDING', 'ACTIVE', 'CLEARING')},
        'gapLog': gl,
        'drainS': R.num(R.rd(os.path.join(d, 'kv', 'drainS'))),
    }


def rec(d):
    out = R.head(d, 'exp33-alarm')
    k = R.kv(d)
    params = json.loads(k.get('params') or '{}')
    rules = load_rules(d)
    plan_ = (R.env_conditions(d).get('INGEST_BATCH_PLAN') or 'A').upper()
    flush_ms = FLUSH_PERIOD_MS.get(plan_, 1000)
    wh = R.jload(os.path.join(d, 'health-worker.json'), {}) or {}
    c = out['conditions']
    c.update({'injectionMode': 'B', 'stage': 'S7', 'seed': params.get('seed'), 'signalProfile': params.get('mix'),
              'pps': params.get('pps'), 'generatorTierArg': params.get('tier'), 'batchPlan': plan_, 'flushPeriodMs': flush_ms,
              'rules': {'tiers': {t: {'n': sum(1 for r in rules if r['tier'] == t),
                                      'offset': params.get(t.lower() + 'Offset'), 'debounceMs': params.get(t.lower() + 'DebounceMs'),
                                      'severity': params.get(t.lower() + 'Severity')} for t in ('S', 'B', 'P')},
                        'list': rules, 'createdVia': 'POST /api/v1/alarms/rules', 'planCheck': R.jload(os.path.join(d, 'plan-check.json'))},
              'ackActorEmail': k.get('ackActor'), 'workerSwitches': {kk: (v.get('value') if isinstance(v, dict) else v) for kk, v in (wh.get('switches') or {}).items()} or None,
              'webBuild': k.get('webBuild'), 'pgRestartedByResume': (k.get('pgRestartedByResume') or '').split() or None, 'faultCh': 'RENAME TABLE plc.alarm_eval ↔ plc.alarm_eval_exp33_hold(05 §장애 주입 삽입 강제 실패 행의 수단 — 리드 판정 2026-09-27)'})
    gen = R.modeb_view(R.jload(os.path.join(d, 'modeb.json')))
    st_all = R.stats(os.path.join(d, 'window', 'stats'))
    dg_cpu = [s['cpu'] for s in st_all if s['name'] == 'db_study-datagen-lab' and s['cpu'] is not None]
    c['generatorCpuMax'] = max(dg_cpu) if dg_cpu else None
    out['generator'] = gen
    out['generatorSaturated'] = None if not gen else bool((gen.get('achievedRatio') or 0) < 0.99 or (gen.get('lateTicks') or 0) > 0)
    win = window_view(d, rules, flush_ms) if os.path.isdir(os.path.join(d, 'window')) else None
    out['window'] = win['window'] if win else None
    out['steady'] = win
    out['ack'] = ack_view(d)
    out['faultPg'] = faultpg_view(d, rules)
    out['faultCh'] = faultch_view(d)
    out['final'] = final_view(d, rules)
    out['judgement'] = judgement(out)
    return out


def judgement(o):
    """구조 판정(이 반복에서 성립 여부 — 3회 전부는 table이 본다) · 무엇이 빠졌는지 None으로 남긴다"""
    w, f, a = o.get('steady') or {}, o.get('final') or {}, o.get('ack') or {}
    three = w.get('threeStores') or {}
    fr = w.get('flushRelation') or {}
    trials = [t for t in (a.get('trials') or []) if t.get('status') == 200]
    ack_ok = None if not trials else all(t.get('withinBound') is True for t in trials) and \
        ((a.get('acksMetric') or {}).get('accepted') == len(trials))
    s = {
        'AC-35 evalGeConfirmed': three.get('evalGeConfirmed'),
        'AC-35 keysEqJudgedRules(window)': three.get('keysEqJudgedRules'),
        'AC-35 keysEqJudgedRules(final)': f.get('keysEqJudgedRules'),
        'AC-09 below(final)': (f.get('belowDebounce') or {}).get('holds'),
        'AC-09 above(final)': (f.get('aboveDebounce') or {}).get('holds'),
        'AC-09 completeness(final)': (f.get('completeness') or {}).get('holds'),
        'AC-36 postgres-stop': (o.get('faultPg') or {}).get('holds'),
        'AC-36 alarm_eval-fail': (o.get('faultCh') or {}).get('holds'),
        'relation evalP95<=flush': fr.get('holds'),
        'ack withinBound': ack_ok,
        'rules via surface': f.get('rulesViaSurface'),
        'steady gap 0': None if not w.get('metrics') else (w['metrics'].get('gapBatches') or 0) == 0,
        'no restart(window)': None if not w.get('metrics') else not w['metrics'].get('restartDetected'),
        'generator not saturated': None if o.get('generatorSaturated') is None else not o['generatorSaturated'],
    }
    return {'structure': s, 'allHold': all(v is True for v in s.values()), 'missing': [k for k, v in s.items() if v is None]}


# ── 표 — 반복 줄(보통 3) → 구조(3회 전부) · 분포(중앙값 · 편차 p50) 한 줄
DIST = (  # (이름, 단위, 꺼내기, 폐기 대상)
    ('evalRowsPerS', 'rows/s', lambda r: ((r.get('steady') or {}).get('metrics') or {}).get('evalRowsPerS'), True),
    ('evalBatchesPerS', 'batches/s', lambda r: ((r.get('steady') or {}).get('metrics') or {}).get('batchesPerS'), True),
    ('evalDurationTotalP50', 's', lambda r: _p(r, 'total', 'p50S'), True),
    ('handoffWaitP50', 's', lambda r: ((((r.get('steady') or {}).get('metrics') or {}).get('handoffWait')) or {}).get('p50S'), False),
    ('evalDurationTotalP95', 's', lambda r: _p(r, 'total', 'p95S'), False),
    ('handoffWaitP95', 's', lambda r: ((((r.get('steady') or {}).get('metrics') or {}).get('handoffWait')) or {}).get('p95S'), False),
    ('evalWithinFlushFraction', 'ratio', lambda r: ((r.get('steady') or {}).get('flushRelation') or {}).get('fractionWithin'), False),
    ('ackPropagationMedianMs', 'ms', lambda r: (r.get('ack') or {}).get('delayMedianMs'), False),
    ('ackSelfMedianMs', 'ms', lambda r: (r.get('ack') or {}).get('selfMedianMs'), False),
    ('pgStopConfirmAfterReadyMs', 'ms', lambda r: (r.get('faultPg') or {}).get('confirmAfterReadyMs'), False),
    ('chFailGapBatches', 'batches', lambda r: (((r.get('faultCh') or {}).get('metricsAll')) or {}).get('gapBatches'), False),
    ('chFailGapRows', 'rows', lambda r: (((r.get('faultCh') or {}).get('metricsAll')) or {}).get('gapRows'), False),
) + tuple((f'evalDuration{ph}P50', 's', (lambda ph: lambda r: _p(r, ph, 'p50S'))(ph), False) for ph in ('A1', 'A2', 'A3', 'A4', 'A5', 'A6'))
# 폐기 대상 밖(False) 사유 — p95 이상은 참고(04 §반복과 폐기) · ACK 지연은 B 탭 재조회 타이머(겹침 TTL 30초)의 위상을 잰다(측정 시점 성분 — 판정 요청)
# · 고장 주입 계수는 주입 창 길이 · 백오프 위상에 묶인다 · 하위 구간 A1~A6은 판정 구간의 분해(참고)
NON_DISCARD_REASON = {
    'handoffWaitP50': '대기 없음(0)이 첫 칸(≤ 0.5 ms)에 몰려 p50이 첫 칸 안 보간값으로 고정된다 — 카탈로그 순간값 · 양자화 불릿과 같은 성격(리드 판정 2026-09-27) · 참고',
    'evalDurationTotalP95': 'p95 참고(04 §반복과 폐기)', 'handoffWaitP95': 'p95 참고(04 §반복과 폐기)',
    'evalWithinFlushFraction': '구조 관계의 판독값(구조 판정)', 'ackPropagationMedianMs': 'B 탭 재조회 타이머 위상(겹침 TTL) — 측정 시점 성분 · 판정 요청',
    'ackSelfMedianMs': '참고', 'pgStopConfirmAfterReadyMs': '주입 복구 위상 — 참고', 'chFailGapBatches': '주입 창 · 백오프 위상 — 참고',
    'chFailGapRows': '주입 창 · 백오프 위상 — 참고',
}


def _p(r, ph, q):
    d = (((r.get('steady') or {}).get('metrics') or {}).get('duration') or {}).get(ph)
    return (d or {}).get(q)


def table_conditions(rows):
    keys = ('injectionMode', 'signalProfile', 'seed', 'pps', 'batchPlan', 'flushPeriodMs', 'storeResources')
    got = []
    for r in rows:
        c = r.get('conditions') or {}
        tiers = ((c.get('rules') or {}).get('tiers'))
        got.append({**{k: c.get(k) for k in keys}, 'ruleTiers': json.dumps(tiers, sort_keys=True), 'snapshot': r.get('snapshot'),
                    'commit': r.get('commit'), 'capacityTier': (r.get('run') or {}).get('capacityTier'),
                    'memoryProfile': (r.get('run') or {}).get('memoryProfile'), 'switches': json.dumps(r.get('switches'), sort_keys=True)})
    for key in got[0]:
        vals = [g[key] for g in got]
        if any(v is None for v in vals):
            raise SystemExit(f'EXP-33 조건 {key}가 비어 있는 반복이 있다 — 반복 {[r.get("rep") for r, v in zip(rows, vals) if v is None]}')
        if len(set(vals)) > 1:
            raise SystemExit(f'EXP-33 조건 {key}가 반복끼리 다르다 — {dict(zip([r.get("rep") for r in rows], vals))}')
    out = dict(got[0])
    out['ruleTiers'] = json.loads(out['ruleTiers'])
    out['switches'] = json.loads(out['switches'])
    return out


def table(rows):
    rows = sorted([r for r in rows if r.get('kind') == 'exp33-alarm'], key=lambda r: r.get('rep'))
    if not rows:
        raise SystemExit('EXP-33 반복 줄이 없다')
    reps = [r.get('rep') for r in rows]
    if len(set(reps)) != len(reps):
        raise SystemExit(f'EXP-33 반복 번호가 겹친다 — {reps}')
    cond = table_conditions(rows)
    names = list(rows[0]['judgement']['structure'])
    structure = []
    for n in names:
        vals = [(r.get('judgement') or {}).get('structure', {}).get(n) for r in rows]
        structure.append({'check': n, 'values': vals, 'allRuns': len(vals) >= MIN_RUNS and all(v is True for v in vals)})
    results, devs = [], []
    for name, unit, get, discard in DIST:
        vals = [get(r) for r in rows]
        got = [v for v in vals if v is not None]
        med = statistics.median(got) if len(got) >= MIN_RUNS else None
        dev = (max(got) - min(got)) / med if (med not in (None, 0)) else None
        row = {'metric': name, 'unit': unit, 'values': vals, 'median': med, 'deviation': dev, 'discardEligible': discard}
        if not discard:
            row['nonDiscardReason'] = NON_DISCARD_REASON.get(name, '하위 구간 — 참고')
        results.append(row)
        if discard and dev is not None:
            devs.append(dev)
    runs = len(rows)
    missing = [r['metric'] for r in results if r['discardEligible'] and r['median'] is None]
    worst = max(devs) if devs else None
    repeat = {'runs': runs, 'deviation': worst, 'threshold': DEVIATION_THRESHOLD, 'basis': 'p50 · 계수 처리량(04 §반복과 폐기)',
              'discard': runs < MIN_RUNS or bool(missing) or (worst is not None and worst > DEVIATION_THRESHOLD), 'missingMedians': missing}
    return {'kind': 'exp33-table', 'exp': 'EXP-33', 'slug': 'alarm-branch-partial-failure', 'reps': reps, 'conditions': cond,
            'structure': structure, 'structureAllRuns': all(s['allRuns'] for s in structure),
            'repeat': repeat, 'results': results,
            'windows': [{'rep': r.get('rep'), **(r.get('window') or {})} for r in rows]}


# ── 러너가 창 직후 읽는 한 줄(기록 아님)
def warm_print(d):
    rules = load_rules(d)
    w = window_view(d, rules, 1000)
    m = w['metrics'] or {}
    t = w['threeStores']
    print(json.dumps({'evalRowsPerS': m.get('evalRowsPerS'), 'batchesPerS': m.get('batchesPerS'),
                      'totalP50S': ((m.get('duration') or {}).get('total') or {}).get('p50S'),
                      'withinFlush': w['flushRelation']['fractionWithin'], 'handoffP50S': (m.get('handoffWait') or {}).get('p50S'),
                      'evalRows': t['evalRows'], 'opened': t['eventsOpened'], 'closed': t['eventsClosed'], 'keys': t['stateKeys'],
                      'judgedAll': t['judgedRulesAll'], 'gap': m.get('gapBatches'), 'debounceB': w['debounceB'],
                      'spike': w['spikeTier'], 'restart': m.get('restartDetected')}, ensure_ascii=False))


def main():
    cmd = sys.argv[1]
    if cmd == 'stamp':
        for ln in sys.stdin:
            ln = ln.strip()
            if ln.startswith('{'):
                sys.stdout.write(f'{int(time.time() * 1000)} {ln}\n')
                sys.stdout.flush()
        return
    if cmd == 'plan':
        tags = [int(x) for x in (R.rd(sys.argv[2], '') or '').split() if x.strip()]
        params = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
        with open(sys.argv[3], 'w') as f:
            json.dump(plan_rules(tags, params), f)
        return
    if cmd == 'check-plan':
        with open(sys.argv[2]) as f:
            plan = json.load(f)
        seed = int(sys.argv[4]) if len(sys.argv) > 4 else DEFAULTS['seed']
        r = check_values(plan, read_tsv(sys.argv[3], (int, int, float)), seed)
        print(json.dumps(r, ensure_ascii=False))
        sys.exit(0 if r['ok'] else 1)
    if cmd == 'warm-print':
        warm_print(sys.argv[2])
        return
    if cmd == 'rec':
        row = rec(sys.argv[2])
        with open(sys.argv[3], 'a') as f:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')
        print('원시 한 줄 추가 →', sys.argv[3], json.dumps({'rep': row.get('rep'), 'window': row.get('window'),
                                                          'judgement': row['judgement']}, ensure_ascii=False))
        return
    if cmd == 'table':
        rows = [json.loads(ln) for ln in (R.rd(sys.argv[2], '') or '').splitlines() if ln.strip()]
        out = table(rows)
        with open(sys.argv[3], 'a') as f:
            f.write(json.dumps(out, ensure_ascii=False) + '\n')
        print(json.dumps({'reps': out['reps'], 'structureAllRuns': out['structureAllRuns'], 'repeat': out['repeat']}, ensure_ascii=False))
        return
    raise SystemExit(f'모르는 하위 명령 {cmd}')


if __name__ == '__main__':
    main()
