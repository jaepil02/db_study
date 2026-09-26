#!/usr/bin/env python3
# S5 부하 러너 원시 줄 조립 — 상태 디렉터리($ST)의 파일에서 jsonl 한 줄(= 한 반복의 한 팔)을 만든다.
# 공통 필드: at · exp · rep · arm · window{start,end} · run · switches(health에서 복사 — 손으로 적지 않는다 · 04_experiment_protocol §조건 칸)
#           · commit · snapshot · conditions · baseline + 실험별 판정 지표 원값(편차 계산에 필요한 값 전부).
# 분위수 규칙(04 §반복과 폐기): k6 · quantilesExact는 정확 분위수(절대값) · 서버 히스토그램은 버킷 보간 p50 판정 · p95 이상은 참고로 싣는다.
# 사용: _rec.py <종류> <상태 디렉터리> <출력 jsonl>   · _rec.py step-summary <계단 디렉터리> (계단 직후 한 줄 요약 — 기록 아님)
import datetime
import gzip
import importlib.util
import json
import math
import os
import re
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('histdiff', os.path.join(HERE, '..', '..', 's2', 'hist-diff.py'))
histdiff = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(histdiff)

THRESHOLDS = {'caution': 20000, 'warning': 100000, 'danger': 180000}  # 부하 실험 프로파일 참고값 — 모드 B 출력이 있으면 그 값
TAGS_PER_DEVICE = {'S': 50, 'M': 200, 'M+': 200, 'L': 500}  # packages/shared tiers.ts
SECTIONS = {  # 지연 예산 구간(EXP-30) — 이름 정본 01_metrics_catalog
    '#2': 'col_modbus_rtt_seconds', '6a': 'ing_stream_residence_seconds', '6b': 'ing_decode_seconds',
    '6c': 'ing_fanin_wait_seconds', '#7': 'insert_duration',
}


# ── 읽기
def rd(p, default=None):
    try:
        with open(p) as f:
            return f.read().strip()
    except FileNotFoundError:
        return default


def jload(p, default=None):
    t = rd(p)
    if not t:
        return default
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        return default


def kv(d):
    out = {}
    kd = os.path.join(d, 'kv')
    if os.path.isdir(kd):
        for n in os.listdir(kd):
            out[n] = rd(os.path.join(kd, n), '')
    return out


def meta(p):
    out = {}
    for ln in (rd(p, '') or '').splitlines():
        if '=' in ln:
            k, v = ln.split('=', 1)
            out[k] = v
    return out


def num(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def e2e_of(j):
    """e2e_json 출력 [[p50, p95, p99], 행] — 행 0이면 분위수가 0으로 나오므로 None"""
    if not j or not num(j[1]):
        return {'p50Ms': None, 'p95Ms': None, 'p99Ms': None, 'rows': num(j[1]) if j else None} if j else None
    return {'p50Ms': j[0][0], 'p95Ms': j[0][1], 'p99Ms': j[0][2], 'rows': num(j[1])}


def iso(ms):
    if ms in (None, ''):
        return None
    return datetime.datetime.fromtimestamp(int(float(ms)) / 1000, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def prom(p):
    return histdiff.parse(p) if p and os.path.exists(p) else {}


def psum(d, name, **want):
    t = 0.0
    hit = False
    for (n, l), v in d.items():
        if n != name:
            continue
        lab = histdiff.labels(l)
        if all(lab.get(k) == str(val) for k, val in want.items()):
            t += v
            hit = True
    return t if hit else None


def pdelta(a, b, name, **want):
    x, y = psum(a, name, **want), psum(b, name, **want)
    return None if y is None else y - (x or 0.0)


def hist(a, b, name, **want):
    if not a or not b:
        return None
    h = histdiff.hist(a, b, name, {k: str(v) for k, v in want.items()})
    return h if h['count'] else None


def samples(p):
    """표본 줄: epoch lag glag pend heap rss [el_p95]"""
    rows = []
    for ln in (rd(p, '') or '').splitlines():
        f = ln.split()
        if len(f) < 2:
            continue
        rows.append([int(f[0])] + [num(x) if x != '-' else None for x in f[1:]])
    return rows


def col(rows, i):
    return [(r[0], r[i]) for r in rows if len(r) > i and r[i] is not None]


def stats(p):
    """docker stats 줄: epoch 이름 CPU% 사용량 / 상한"""
    out = []
    for ln in (rd(p, '') or '').splitlines():
        f = ln.split()
        if len(f) < 3:
            continue
        cpu = num(f[2].rstrip('%'))
        out.append({'t': int(f[0]), 'name': f[1], 'cpu': cpu, 'mem': ' '.join(f[3:])})
    return out


def cpu_summary(st, t0=None, t1=None):
    by = {}
    for s in st:
        if (t0 is not None and s['t'] < t0) or (t1 is not None and s['t'] > t1) or s['cpu'] is None:
            continue
        by.setdefault(s['name'], []).append(s['cpu'])
    return {n: {'n': len(v), 'median': statistics.median(v), 'max': max(v)} for n, v in by.items()}


def slope(pts):
    """최소제곱 기울기(단위/초) — 점 2개 미만이면 None"""
    if len(pts) < 2:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    den = sum((x - mx) ** 2 for x in xs)
    return None if den == 0 else sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den


def series_summary(pts):
    v = [p[1] for p in pts]
    if not v:
        return None
    return {'n': len(v), 'first': v[0], 'last': v[-1], 'min': min(v), 'median': statistics.median(v), 'max': max(v), 'slopePerS': slope(pts)}


def stage_of(x, th):
    if x is None:
        return None
    if x > th['danger']:
        return 3
    if x >= th['warning']:
        return 2
    if x >= th['caution']:
        return 1
    return 0


def exact_q(vals, p):
    """정확 분위수 — 정렬 뒤 ⌊p·n⌋번째(ClickHouse quantileExact와 같은 위치 규칙)"""
    if not vals:
        return None
    s = sorted(vals)
    return s[min(len(s) - 1, int(p * len(s)))]


def k6_raw(paths, name=None):
    """k6 --out json(gz) 원시에서 http_req_duration 표본 — 창 여럿을 합쳐 정확 분위수를 낸다(시나리오별)"""
    by = {}
    for p in paths:
        if not os.path.exists(p):
            continue
        with gzip.open(p, 'rt') as f:
            for ln in f:
                if '"http_req_duration"' not in ln or '"Point"' not in ln:
                    continue
                o = json.loads(ln)
                tags = o['data'].get('tags') or {}
                sc = tags.get('scenario') or tags.get('name') or 'default'
                if name and sc != name:
                    continue
                by.setdefault(sc, []).append((o['data']['value'], tags.get('status')))
    out = {}
    for sc, v in by.items():
        ms = [x for x, _ in v]
        ok = sum(1 for _, s in v if s == '200')
        out[sc] = {'count': len(ms), 'ok200': ok, 'p50Ms': exact_q(ms, 0.5), 'p95Ms': exact_q(ms, 0.95), 'p99Ms': exact_q(ms, 0.99), 'maxMs': max(ms)}
    return out


def k6_summary(p):
    """k6 --summary-export 요약 — 지표별 값 사전(분위수는 k6 정확 분위수)"""
    j = jload(p)
    if not j:
        return None
    m = j.get('metrics', {})
    out = {}
    for k, v in m.items():
        if k.startswith('http_req_duration') or k.startswith('checks') or k.startswith('bulk_') or k.startswith('ws_') \
                or k in ('http_reqs', 'iterations', 'dropped_iterations', 'vus_max', 'data_sent', 'data_received'):
            out[k] = v
    return out


def health(d):
    h = jload(os.path.join(d, 'health.json'), {}) or {}
    sw = h.get('switches') or {}
    switches = {k: (v.get('value') if isinstance(v, dict) else v) for k, v in sw.items()}
    return h.get('run'), switches or None


def env_conditions(d):
    out = {}
    for ln in (rd(os.path.join(d, 'env'), '') or '').splitlines():
        if '=' in ln:
            k, v = ln.split('=', 1)
            out[k] = v
    return out


def head(d, kind):
    k = kv(d)
    run, switches = health(d)
    return {
        'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
        'exp': k.get('exp'), 'rep': int(k.get('rep') or 0), 'arm': k.get('arm'), 'kind': kind,
        'window': None, 'run': run, 'switches': switches,
        'commit': k.get('commit'), 'snapshot': k.get('snapshot'),
        'conditions': {'env': env_conditions(d), 'lagSource': k.get('lagSrc'),
                       'storeResources': k.get('storeResources'), 'cpuset': 'standard' if k.get('storeResources') == 'clickhouse=5-8/5368709120 postgres=9-10/2147483648' else None, 'observability': k.get('observability', 'off'),
                       'observabilityMembers': k.get('observabilityMembers'),
                       'baselineWindow': {'start': k.get('baselineStart'), 'end': k.get('baselineEnd')}},
        'baseline': (rd(os.path.join(d, 'baseline'), '') or '').splitlines(),
    }


# ── 모드 B 출력 → 생성기 판정 ②③(05_load_scenarios §생성기 포화 판정)
def modeb_view(mb):
    if not mb:
        return None
    r = mb.get('result', {})
    o = mb.get('options', {})
    dur = o.get('durationSeconds') or 0
    pps = o.get('pps') or 0
    exp_pts = pps * dur
    return {
        'tier': o.get('tier'), 'pps': pps, 'durationS': dur, 'stepsPerSecond': o.get('stepsPerSecond'),
        'thresholds': o.get('thresholds'), 'maxlen': o.get('maxlen'),
        'generatedPoints': r.get('generatedPoints'), 'publishedPoints': r.get('publishedPoints'),
        'haltedPoints': r.get('haltedPoints'), 'dropoutPoints': r.get('dropoutPoints'),
        'xaddFailures': r.get('xaddFailures'), 'ticks': r.get('ticks'), 'lateTicks': r.get('lateTicks'),
        'maxBacklog': r.get('maxBacklog'), 'finalStage': r.get('finalStage'), 'workerUtilization': r.get('workerUtilization'),
        # ② 달성 조건 — 발생(생성) 포인트 ÷ 지정(pps × 지속) · 발행 pps
        'achievedRatio': (r.get('generatedPoints') or 0) / exp_pts if exp_pts else None,
        'publishedPps': (r.get('publishedPoints') or 0) / dur if dur else None,
        'run': mb.get('run'), 'switches': mb.get('switches'),
    }


def worker_view(a, b):
    """적재 프로세스 창 차 — 배치당 행 수 · 행 수 · DLQ · 재시도 · 구간 p50(버킷 보간 판정 · p95 참고)"""
    if not a or not b:
        return None
    bs = hist(a, b, 'batch_size')
    return {
        'rowsInserted': pdelta(a, b, 'rows_inserted'),
        'batchSize': bs,
        'dlq': pdelta(a, b, 'dlq_count'),
        'insertRetries': pdelta(a, b, 'ing_insert_retries_total'),
        'consumerPausedS': pdelta(a, b, 'ing_consumer_paused_seconds_total'),
        'sections': {k: hist(a, b, n) for k, n in SECTIONS.items()},
    }


def http_view(a, b, route=None):
    """설계 거절 제외 오류율(01_metrics_catalog §파생 지표) — (5xx − 설계 503) ÷ (요청 − 설계 거절)"""
    if not a or not b:
        return None
    want = {'route': route} if route else {}
    req = pdelta(a, b, 'http_requests_total', **want) or 0.0
    five = 0.0
    for (n, l), v in b.items():
        if n != 'http_requests_total':
            continue
        lab = histdiff.labels(l)
        if route and lab.get('route') != route:
            continue
        if lab.get('code', '').startswith('5'):
            five += v - a.get((n, l), 0.0)
    des = pdelta(a, b, 'http_designed_rejections_total', **want) or 0.0
    des503 = pdelta(a, b, 'http_designed_rejections_total', error_code='datagen.stream_full', **want) or 0.0
    den = req - des
    return {'requests': req, 'status5xx': five, 'designedRejections': des, 'designed503': des503,
            'errorRate': (five - des503) / den if den > 0 else None}


def fanout_pubsub(a, b):
    """발행 → 수신(EXP-30) — APP_ROLE all 한 프로세스에서만 성립 · 판정은 창 두 표본의 _sum · _count 차 평균(기록 025) · 버킷 분위수는 참고"""
    s = pdelta(a, b, 'rlt_fanout_delivery_seconds_sum', channel='pubsub')
    c = pdelta(a, b, 'rlt_fanout_delivery_seconds_count', channel='pubsub')
    h = hist(a, b, 'rlt_fanout_delivery_seconds', channel='pubsub')
    return {'channel': 'pubsub', 'count': c, 'sumS': s, 'meanS': (s / c) if (s is not None and c) else None,
            'judgement': 'mean(_sum/_count) — 기록 025', 'bucketRef': {'p50S': h['p50S'], 'p95S': h['p95S']} if h else None}


PUBLISH_TO_RECEIVE_ROLE_SPLIT = {'meanS': None, 'reason': '역할 분리 · 한 프로세스 전용 계측(기록 025)'}


def step_view(sd, route=None):
    """모드 B · C 계단 하나 — 판정 창 표본 · 생성기 판정 · 적재 · E2E · 무손실(범위 행 수)"""
    m = meta(os.path.join(sd, 'meta'))
    mb = modeb_view(jload(os.path.join(sd, 'modeb.json')))
    th = (mb or {}).get('thresholds') or THRESHOLDS
    trans = samples(os.path.join(sd, 'trans.samples'))
    win = samples(os.path.join(sd, 'win.samples'))
    st = stats(os.path.join(sd, 'stats'))
    w0, w1 = num(m.get('winStartMs')), num(m.get('winEndMs'))
    allrows = trans + win
    lag_all = col(allrows, 1)
    lag_win = col(win, 1)
    a0w, a1w = prom(os.path.join(sd, 'm0.worker')), prom(os.path.join(sd, 'm1.worker'))
    a0, a1 = prom(os.path.join(sd, 'm0.api')), prom(os.path.join(sd, 'm1.api'))
    ing0, ing1 = (a0w, a1w) if a0w else (a0, a1)
    e2e = jload(os.path.join(sd, 'e2e.json'))
    rows = num(rd(os.path.join(sd, 'rows')))
    published = None
    if mb:
        published = mb['publishedPoints']
    elif m.get('acceptedRows'):
        published = num(m.get('acceptedRows'))
    k6 = k6_summary(os.path.join(sd, 'k6.json'))
    stage_max = max([stage_of(v, th) for _, v in lag_all] or [None], key=lambda x: -1 if x is None else x)
    return {
        'label': m.get('label'), 'tier': m.get('tier'), 'pps': num(m.get('pps')), 'entriesPerRequest': num(m.get('entries')),
        'transS': num(m.get('transS')), 'winS': num(m.get('winS')),
        'window': {'start': iso(w0), 'end': iso(w1)},
        'loadRange': {'launch': iso(m.get('launchMs')), 'exit': iso(m.get('exitMs'))},
        'lag': series_summary(lag_win), 'lagAll': series_summary(lag_all),
        'lagGroup': series_summary(col(win, 2)), 'pending': series_summary(col(win, 3)),
        'stageMax': stage_max, 'thresholds': th,
        'ingestHeap': series_summary(col(win, 4)), 'ingestRss': series_summary(col(win, 5)), 'eventLoopP95S': series_summary(col(win, 6)),
        'cpu': cpu_summary(st, int(w0 / 1000) if w0 else None, int(w1 / 1000) if w1 else None),
        'generator': mb, 'k6': k6,
        'ingest': worker_view(ing0, ing1),
        'http': http_view(a0, a1, route),
        'e2e': e2e_of(e2e),
        'e2eGauge': {'p95S': psum(a1, 'e2e_latency', quantile='0.95'), 'rows': psum(a1, 'e2e_latency_rows')} if a1 else None,
        'lossless': {'published': published, 'rowsInRange': rows,
                     'diff': (published - rows) if (published is not None and rows is not None) else None},
        'streamTrimmedUnacked': pdelta(a0, a1, 'stream_trimmed_unacked'),
        # 모드 B · C는 api · worker 역할 분리 — 발행 도장과 수신이 다른 프로세스라 계측이 성립하지 않는다(모드 A는 rec_modea_steps가 덮어쓴다)
        'publishToReceive': PUBLISH_TO_RECEIVE_ROLE_SPLIT,
    }


def provisional_signals(s):
    """Breakpoint 실패 신호(러너의 잠정 규칙 — 판정은 리드 · 기록이 한다)
    적체 추세: 창 끝 − 창 시작 > 2 × 초당 엔트리(발행 묶음 2초분) 이고 기울기 > 0
    위험 단계: 표본 최대 단계 3 또는 발행 중단 포인트 > 0
    무손실 붕괴: 범위 행 수 차 ≠ 0(소진 뒤)
    오류율: DLQ 증가 > 0 또는 XADD 실패 > 0 또는 HTTP 오류율 > 0"""
    lag = s.get('lag') or {}
    gen = s.get('generator') or {}
    # 초당 엔트리 = pps ÷ 설비당 태그(엔트리 = 설비 하나의 시점 하나)
    eps = (s.get('pps') or 0) / TAGS_PER_DEVICE.get(s.get('tier') or 'M', 200)
    trend = None
    if lag:
        trend = bool((lag.get('slopePerS') or 0) > 0 and (lag['last'] - lag['first']) > 2 * max(eps, 1))
    ing = s.get('ingest') or {}
    err = bool((ing.get('dlq') or 0) > 0 or (gen.get('xaddFailures') or 0) > 0 or ((s.get('http') or {}).get('errorRate') or 0) > 0)
    diff = (s.get('lossless') or {}).get('diff')
    return {'backlogTrend': trend, 'dangerStage': bool((s.get('stageMax') or 0) >= 3 or (gen.get('haltedPoints') or 0) > 0),
            'losslessBroken': None if diff is None else diff != 0, 'errors': err,
            'generatorSaturated': None if not gen else bool((gen.get('achievedRatio') or 0) < 0.99 or (gen.get('lateTicks') or 0) > 0)}


def steps_in(d):
    root = os.path.join(d, 'steps')
    if not os.path.isdir(root):
        return []
    return [os.path.join(root, n) for n in sorted(os.listdir(root))]


def overall_window(views):
    ws = [v['window']['start'] for v in views if v.get('window') and v['window'].get('start')]
    we = [v['window']['end'] for v in views if v.get('window') and v['window'].get('end')]
    return {'start': min(ws), 'end': max(we)} if ws and we else None


# ── 종류별 조립
def rec_modeb_steps(d, route=None):
    out = head(d, 'modeb-steps')
    views = [step_view(sd, route) for sd in steps_in(d)]
    for v in views:
        v['signals'] = provisional_signals(v)
    out['window'] = overall_window(views)
    out['conditions']['injectionMode'] = 'B'
    out['steps'] = views
    fail = {}
    for key in ('backlogTrend', 'dangerStage', 'losslessBroken', 'errors'):
        first = next((v['pps'] for v in views if v['signals'].get(key)), None)
        fail[key] = first
    out['firstFailurePps'] = fail  # 잠정 규칙의 첫 pps — 생성기 판정(generatorSaturated)과 함께 읽는다
    out['segments'] = [jload(p) for p in sorted(os.path.join(d, n) for n in os.listdir(d) if n.startswith('segment-') and n.endswith('.json'))]
    return out


def rec_bulk(d):
    out = rec_modeb_steps(d, '/api/v1/ingest/bulk')
    out['kind'] = 'bulk'
    out['conditions']['injectionMode'] = 'C'
    out['conditions']['bulkGate'] = 'DATAGEN_BULK_ENABLED=true'
    for v in out['steps']:
        k6 = v.get('k6') or {}
        g = lambda n, f='count': (k6.get(n) or {}).get(f)
        dur = (v.get('transS') or 0) + (v.get('winS') or 0)
        v['bulk'] = {
            'requests202': g('bulk_202'), 'requests503': g('bulk_503'), 'requests4xx': g('bulk_4xx'), 'requestsOther': g('bulk_other'),
            'partialEntries503': g('bulk_503_partial_entries'), 'acceptedRows': g('bulk_accepted_rows'), 'sentRows': g('bulk_sent_rows'),
            'acceptedPps': (g('bulk_accepted_rows') or 0) / dur if dur else None,
            'droppedIterations': g('dropped_iterations'), 'bodyBytes': k6.get('bulk_body_bytes'),
            'reqDuration': k6.get('http_req_duration'),
        }
        v['signals']['generatorSaturated'] = bool((g('dropped_iterations') or 0) > 0)
    return out


def rec_modea_steps(d):
    out = head(d, 'modea-steps')
    views = []
    for sd in steps_in(d):
        m = meta(os.path.join(sd, 'meta'))
        s = step_view(sd)
        a0, a1 = prom(os.path.join(sd, 'm0.api')), prom(os.path.join(sd, 'm1.api'))
        vf = jload(os.path.join(sd, 'verify.json')) or {}
        xi = jload(os.path.join(sd, 'xinfo.json')) or {}
        polls = pdelta(a0, a1, 'col_polls_total')
        # 레이블 있는 계수기(device)는 첫 타임아웃 전에는 계열이 없다 — 폴링이 있으면 타임아웃 0으로 읽는다
        tos = pdelta(a0, a1, 'col_poll_timeouts_total')
        if tos is None and polls:
            tos = 0.0
        s['modeA'] = {
            'scanRateMs': num(m.get('scanRateMs')), 'health': jload(os.path.join(sd, 'health.json')),
            'pointsEmitted': pdelta(a0, a1, 'points_emitted'),
            'pollDuration': hist(a0, a1, 'poll_duration'), 'modbusRtt': hist(a0, a1, 'col_modbus_rtt_seconds'),
            'polls': polls, 'pollTimeouts': tos, 'timeoutRate': (tos / polls) if polls else None,
            'genWorkerUtilization': psum(a1, 'gen_worker_utilization', mode='A'),
            'apiCpuSecondsDelta': pdelta(a0, a1, 'process_cpu_seconds_total'),
            'eventLoopP95S': {'start': psum(a0, 'nodejs_eventloop_lag_p95_seconds'), 'end': psum(a1, 'nodejs_eventloop_lag_p95_seconds')},
            'fanout': hist(a0, a1, 'rlt_fanout_delivery_seconds'),
        }
        s['publishToReceive'] = fanout_pubsub(a0, a1)
        # 모드 A 무손실(S2 판정) — 정지 뒤 Stream 전 엔트리 디코딩 포인트 − tag_raw 행 · 트리밍이 없었을 때만 성립(entries-added = XLEN)
        ac01 = vf.get('ac01') or {}
        trimmed = None
        if xi.get('entriesAdded') is not None and xi.get('length') is not None:
            trimmed = int(xi['entriesAdded']) != int(xi['length'])
        s['lossless'] = {'streamPoints': ac01.get('streamPoints'), 'tagRawRows': ac01.get('tagRawRows'), 'diff': ac01.get('diff'),
                         'streamTrimmed': trimmed, 'xinfo': xi, 'lagZero': vf.get('lagZero'), 'ac02': vf.get('ac02')}
        if vf.get('e2e'):
            s['e2e'] = vf['e2e']
        s['k6'] = k6_summary(os.path.join(sd, 'q.json'))
        s['queryK6Raw'] = k6_raw([os.path.join(sd, 'q.jsonl.gz')]) or None
        s['queryHttp'] = http_view(a0, a1)
        views.append(s)
    out['window'] = overall_window(views)
    out['conditions']['injectionMode'] = 'A'
    out['steps'] = views
    return out


def rec_mix(d):
    out = head(d, 'mix')
    k = kv(d)
    wins = []
    for sd in steps_in(d):
        m = meta(os.path.join(sd, 'meta'))
        a0, a1 = prom(os.path.join(sd, 'm0.api')), prom(os.path.join(sd, 'm1.api'))
        w0, w1 = prom(os.path.join(sd, 'm0.worker')), prom(os.path.join(sd, 'm1.worker'))
        win = samples(os.path.join(sd, 'win.samples'))
        st = stats(os.path.join(sd, 'stats'))
        e2e = jload(os.path.join(sd, 'e2e.json'))
        t0, t1 = num(m.get('winStartMs')), num(m.get('winEndMs'))
        v = {
            'n': int(m.get('n') or 0), 'window': {'start': iso(t0), 'end': iso(t1)},
            'lag': series_summary(col(win, 1)), 'pending': series_summary(col(win, 3)),
            'ingestHeap': series_summary(col(win, 4)),
            'cpu': cpu_summary(st, int(t0 / 1000) if t0 else None, int(t1 / 1000) if t1 else None),
            'k6': k6_summary(os.path.join(sd, 'q.json')),
            'k6Raw': k6_raw([os.path.join(sd, 'q.jsonl.gz')]),
            'http': http_view(a0, a1),
            'serverLatency': {r: hist(a0, a1, 'http_request_duration_seconds', route=r, code='200')
                              for r in ('/api/v1/realtime/devices/:id/tags', '/api/v1/timeseries/query', '/api/v1/devices')},
            'ingest': worker_view(w0, w1),
            'e2e': e2e_of(e2e),
            'latest': {'lockWaitExhausted': pdelta(a0, a1, 'rlt_latest_lock_wait_exhausted_total'),
                       'restores': pdelta(a0, a1, 'rlt_latest_restores_total'),
                       'chPointQueries': num(rd(os.path.join(sd, 'chPointQueries')))},
            'cache': {'hit': pdelta(a0, a1, 'tsq_cache_requests_total', result='hit'), 'miss': pdelta(a0, a1, 'tsq_cache_requests_total', result='miss')},
            'obs': {'metricsResponseBytes': psum(a1, 'obs_metrics_response_bytes'),
                    'collectDuration': hist(a0, a1, 'obs_collect_duration_seconds'),
                    'collectErrors': pdelta(a0, a1, 'obs_collect_errors_total'),
                    'chQueryLog': jload(os.path.join(sd, 'chq.json')),
                    'redisStats': {'m0': jload(os.path.join(sd, 'redis0.json')), 'm1': jload(os.path.join(sd, 'redis1.json'))},
                    'scrape': jload(os.path.join(sd, 'scrape.json'))},
            'streamTrimmedUnacked': pdelta(a0, a1, 'stream_trimmed_unacked'),
        }
        wins.append(v)
    # 창 여럿의 조회 정확 분위수 — 원시를 합쳐 한 번에(창별 요약의 중앙값이 아니다)
    out['query'] = k6_raw([os.path.join(sd, 'q.jsonl.gz') for sd in steps_in(d)])
    out['windows'] = wins
    out['window'] = overall_window(wins)
    mb = modeb_view(jload(os.path.join(d, 'main.modeb')))
    rows = num(rd(os.path.join(d, 'rows')))
    out['generator'] = mb
    out['lossless'] = {'published': (mb or {}).get('publishedPoints'), 'rowsInRange': rows,
                       'diff': ((mb or {}).get('publishedPoints') - rows) if (mb and rows is not None) else None}
    out['drainS'] = num(k.get('drainS'))
    out['conditions']['injectionMode'] = 'B'
    out['conditions']['k6'] = {'script': k.get('k6Script'), 'rates': k.get('k6Rates')}
    return out


def rec_spike(d):
    out = head(d, 'spike')
    k = kv(d)
    ph = {}
    for name in ('pre', 'spike', 'post'):
        sd = os.path.join(d, 'phase-' + name)
        if not os.path.isdir(sd):
            continue
        m = meta(os.path.join(sd, 'meta'))
        mb = modeb_view(jload(os.path.join(sd, 'modeb.json')) or jload(os.path.join(d, 'post.modeb')))
        smp = samples(os.path.join(sd, 'samples'))
        rows = num(rd(os.path.join(sd, 'rows')))
        pub = (mb or {}).get('publishedPoints')
        ph[name] = {'launch': iso(m.get('launchMs')), 'exit': iso(m.get('exitMs')), 'generator': mb,
                    'lag': series_summary(col(smp, 1)), 'cpu': cpu_summary(stats(os.path.join(sd, 'stats'))),
                    'lossless': {'published': pub, 'rowsInRange': rows, 'diff': (pub - rows) if (pub is not None and rows is not None) else None}}
    allsmp = []
    for name in ('pre', 'spike', 'post', 'recover'):
        allsmp += samples(os.path.join(d, 'phase-' + name, 'samples'))
    th = ((ph.get('spike') or {}).get('generator') or {}).get('thresholds') or THRESHOLDS
    lag = col(allsmp, 1)
    pre_max = (ph.get('pre') or {}).get('lag', {}) or {}
    spike_exit = num(meta(os.path.join(d, 'phase-spike', 'meta')).get('exitMs'))
    rec_at = num(k.get('recoveredAtMs'))
    out['window'] = {'start': ph.get('spike', {}).get('launch'), 'end': iso(rec_at) if rec_at else None}  # 스파이크 시작 ~ 적체 복귀(과도 구간이 측정 대상)
    out['phases'] = ph
    out['backlogMax'] = max([v for _, v in lag] or [None], key=lambda x: -1 if x is None else x)
    out['stageMax'] = max([stage_of(v, th) for _, v in lag] or [None], key=lambda x: -1 if x is None else x)
    out['recovery'] = {'floor': pre_max.get('max'), 'recoveredAt': iso(rec_at),
                       'recoveryS': (rec_at - spike_exit) / 1000 if (rec_at and spike_exit) else None, 'observedUntil': iso(k.get('observedUntilMs'))}
    out['lossless'] = {'diffTotal': sum((p['lossless']['diff'] or 0) for p in ph.values()) if all(p['lossless']['diff'] is not None for p in ph.values()) else None}
    out['lagSeries'] = [[t, v] for t, v in lag]
    out['conditions']['injectionMode'] = 'B'
    return out


def rec_soak(d):
    out = head(d, 'soak')
    k = kv(d)
    warm = int(k.get('soakWarmS') or 600)
    t_load = int(num(k.get('dg.main.launchMs')) or 0) // 1000
    series = {}
    sd = os.path.join(d, 'soak')
    files = sorted(os.listdir(sd)) if os.path.isdir(sd) else []
    want = {
        'apiHeap': ('a', 'nodejs_heap_size_used_bytes', {}), 'workerHeap': ('w', 'nodejs_heap_size_used_bytes', {}),
        'workerRss': ('w', 'process_resident_memory_bytes', {}), 'lag': ('w', 'consumer_lag', {}),
        'activeParts': ('a', 'ch_active_parts', {'table': 'tag_raw'}), 'diskBytes': ('a', 'ch_parts_bytes_on_disk', {'table': 'tag_raw'}),
        'redisUsed': ('a', 'redis_used_memory_bytes', {}), 'e2eP95S': ('w', 'e2e_latency', {'quantile': '0.95'}),
    }
    for fn in files:
        mt = re.match(r'([aw])-(\d+)\.prom$', fn)
        if not mt:
            continue
        who, t = mt.group(1), int(mt.group(2))
        pm = prom(os.path.join(sd, fn))
        for key, (src, name, lab) in want.items():
            if src != who:
                continue
            v = psum(pm, name, **lab)
            if v is not None:
                series.setdefault(key, []).append((t, v))
    trends = {}
    for key, pts in series.items():
        pts.sort()
        kept = [p for p in pts if p[0] >= t_load + warm]
        s = series_summary(kept)
        if s:
            s['slopePerHour'] = s['slopePerS'] * 3600 if s['slopePerS'] is not None else None
        trends[key] = s
    # 호스트 표본(하위 명령 sample) — docker stats · system.parts · 디스크
    host = [jload(os.path.join(d, 'host', n)) for n in sorted(os.listdir(os.path.join(d, 'host')))] if os.path.isdir(os.path.join(d, 'host')) else []
    parts_pts = [(h['t'], h['parts'][0]) for h in host if h and h.get('parts') and h['t'] >= t_load + warm]
    disk_pts = [(h['t'], h['parts'][1]) for h in host if h and h.get('parts') and h['t'] >= t_load + warm]
    for key, pts in (('activePartsHost', parts_pts), ('diskBytesHost', disk_pts)):
        ss = series_summary(pts)
        if ss and ss['slopePerS'] is not None:
            ss['slopePerHour'] = ss['slopePerS'] * 3600
        trends[key] = ss
    out['window'] = {'start': iso((t_load + warm) * 1000) if t_load else None, 'end': iso(k.get('dg.main.exitMs'))}  # 전 구간 · 첫 워밍업 제외
    out['trends'] = trends
    out['samples'] = {'promFiles': len(files), 'hostSamples': len(host)}
    out['cpu'] = cpu_summary([s for h in host if h for s in h.get('stats', [])])
    mb = modeb_view(jload(os.path.join(d, 'main.modeb')))
    rows = num(rd(os.path.join(d, 'rows')))
    out['generator'] = mb
    out['query'] = k6_summary(os.path.join(d, 'k6-soak.json'))
    out['lossless'] = {'published': (mb or {}).get('publishedPoints'), 'rowsInRange': rows,
                       'diff': ((mb or {}).get('publishedPoints') - rows) if (mb and rows is not None) else None}
    out['conditions']['injectionMode'] = 'B'
    out['conditions']['soakWarmS'] = warm
    return out


def rec_ws(d):
    out = head(d, 'ws')
    k = kv(d)
    steps = []
    for sd in steps_in(d):
        m = meta(os.path.join(sd, 'meta'))
        a0, a1 = prom(os.path.join(sd, 'm0.api')), prom(os.path.join(sd, 'm1.api'))
        w = num(m.get('winS')) or 1
        conns = psum(a1, 'ws_connections')
        fr = pdelta(a0, a1, 'ws_frames_sent_total', channel='rt')
        steps.append({
            'targetConns': int(m.get('target') or 0), 'window': {'start': iso(m.get('winStartMs')), 'end': iso(m.get('winEndMs'))},
            'wsConnections': conns, 'framesRt': fr,
            'framesPerConnPerSec': (fr / max(1.0, conns) / w) if (fr is not None and conns) else None,
            'eventLoopP95S': psum(a1, 'nodejs_eventloop_lag_p95_seconds'),
            'throttleMerged': pdelta(a0, a1, 'rlt_throttle_merged_total'),
            'closes4413': pdelta(a0, a1, 'ws_closes_total', close_code='4413'),
            'closesByCode': {histdiff.labels(l).get('close_code'): v - a0.get((n, l), 0.0) for (n, l), v in a1.items() if n == 'ws_closes_total'},
            'subscriberDisconnects': pdelta(a0, a1, 'rlt_subscriber_disconnects_total'),
            'cpu': cpu_summary(stats(os.path.join(sd, 'stats'))),
        })
    out['steps'] = steps
    out['window'] = overall_window(steps)
    out['k6'] = {}
    for fn in sorted(os.listdir(d)):
        if fn.startswith('k6-ws-') and fn.endswith('.json'):
            k6 = k6_summary(os.path.join(d, fn)) or {}
            out['k6'][fn[len('k6-ws-'):-5]] = {n: k6.get(n) for n in ('ws_rt_frames', 'ws_closed_4413', 'ws_connect_failed', 'ws_opened', 'ws_sessions', 'vus_max')}
    reached = [s['targetConns'] for s in steps if s['wsConnections'] is not None and s['wsConnections'] >= s['targetConns']]
    out['maxHeldConnections'] = max(reached) if reached else None  # 목표 연결을 서버 게이지가 다 가진 가장 큰 계단(상한은 이 계단과 다음 계단 사이)
    out['conditions']['injectionMode'] = 'A'
    out['conditions']['wsThrottleMs'] = k.get('arm')
    return out


def rec_redismem(d):
    out = head(d, 'redismem')
    k = kv(d)
    r0 = jload(os.path.join(d, 'redis0.json')) or {}
    r1 = jload(os.path.join(d, 'redis1.json')) or {}
    mb = modeb_view(jload(os.path.join(d, 'main.modeb')))
    x0, x1 = num(r0.get('xlen')) or 0, num(r1.get('xlen')) or 0
    added = x1 - x0
    used = (num(r1.get('used_memory')) or 0) - (num(r0.get('used_memory')) or 0)
    su = num(r1.get('streamUsage'))
    pay = jload(os.path.join(d, 'payload.json'))
    out['tier'] = k.get('arm')
    out['generator'] = mb
    out['stream'] = {
        'entriesAdded': added, 'xlen': x1, 'streamMemoryUsage': su,
        'bytesPerEntryMemoryUsage': (su / x1) if (su and x1) else None,  # MEMORY USAGE SAMPLES 0 ÷ XLEN — Redis 안 크기(노드 · 리스트팩 포함)
        'bytesPerEntryUsedMemoryDelta': (used / added) if added else None,  # used_memory 증가 ÷ 추가 엔트리 — 다른 키 증가가 섞인 상계
        'payloadSample': {'entries': pay[0], 'bytes': pay[1], 'bytesPerEntry': pay[1] / pay[0] if pay and pay[0] else None} if pay else None,
        'tagsPerDevice': num(k.get('tagsPerDevice')),
    }
    dl = jload(os.path.join(d, 'dlq.json'))
    out['dlq'] = {'xlen': dl[0], 'memoryUsage': dl[1], 'bytesPerEntry': dl[1] / dl[0] if dl and dl[0] else None} if dl else None
    scan = jload(os.path.join(d, 'scan.json')) or []
    out['prefixFullScan'] = {scan[i]: {'keys': scan[i + 1], 'bytes': scan[i + 2]} for i in range(0, len(scan) - 2, 3)}
    out['redisInfo'] = {'m0': r0, 'm1': r1}
    out['window'] = {'start': iso(k.get('dg.main.launchMs')), 'end': iso(k.get('dg.main.exitMs'))}
    out['conditions']['injectionMode'] = 'B'
    out['conditions']['undecodableEvery'] = k.get('undecodableEvery')
    return out


def step_summary(sd):
    """계단 직후 사람이 읽는 한 줄 — 기록이 아니다(E2E · 무손실은 소진 뒤 stop이 채운다)"""
    v = step_view(sd)
    s = provisional_signals(v)
    g = v.get('generator') or {}
    lag = v.get('lag') or {}
    print(json.dumps({'label': v['label'], 'pps': v['pps'], 'lagFirst': lag.get('first'), 'lagLast': lag.get('last'), 'lagMax': lag.get('max'),
                      'lagSlopePerS': lag.get('slopePerS'), 'stageMax': v['stageMax'], 'achieved': g.get('achievedRatio'),
                      'lateTicks': g.get('lateTicks'), 'halted': g.get('haltedPoints'), 'genUtil': g.get('workerUtilization'),
                      'cpuMax': {n: c['max'] for n, c in (v.get('cpu') or {}).items()}, 'signals': s}, ensure_ascii=False))


# ── EXP-45 스트리밍 동시 적재(control-stream-ingest) — 정본 05_data_stores/10 §스트리밍 동시 적재 — EXP-45
# 싱크 시간은 계단 창 앞뒤 두 캡처의 버킷 차 분위수(누적 히스토그램을 그대로 읽으면 앞 계단 표본이 섞인다).
# 식은 apps/web/lib/compare.ts histQuantile · restartDetected와 같다(총량 = +Inf 칸 누적 · 빈 칸이면 윗경계 · +Inf 칸이면 마지막 유한 경계).
BATCH_PLAN_WINDOW_MS = {'A': 1000, 'B': 5000, 'C': 1000}  # apps/api/src/config/app-config.ts INGEST_BATCH_PLANS · COPY 타임아웃 = W ÷ 2(control-table-sink.port)
EXP45_CONTROL_RESOURCES = 'clickhouse=5-7/3758096384 postgres=8-10/3758096384'  # compose.control.yml(3584m · 5-7 · 8-10)


def bucket_quantile(a, b, name, q, **want):
    """버킷 차의 분위수(초) — 레이블 조합을 le별로 합친 뒤 선형 보간 · 표본 0이면 None(compare.ts histQuantile)"""
    def by_le(d):
        m = {}
        for (n, l), v in d.items():
            if n != f'{name}_bucket':
                continue
            lab = histdiff.labels(l)
            if 'le' not in lab or any(lab.get(k) != str(val) for k, val in want.items()):
                continue
            le = math.inf if lab['le'] == '+Inf' else float(lab['le'])
            m[le] = m.get(le, 0.0) + v
        return m
    ba, bb = by_le(a or {}), by_le(b or {})
    les = sorted(bb)
    cum = [bb[le] - ba.get(le, 0.0) for le in les]
    total = cum[-1] if cum else 0.0
    if total <= 0:
        return None
    rank = q * total
    for i, le in enumerate(les):
        if cum[i] >= rank:
            lo = 0.0 if i == 0 else les[i - 1]
            if math.isinf(le):
                return lo
            below = 0.0 if i == 0 else cum[i - 1]
            inb = cum[i] - below
            return le if inb <= 0 else lo + (le - lo) * ((rank - below) / inb)
    return None


def bucket_view(a, b, name, **want):
    """창 표본 수(+Inf 칸 누적 차) · p50 · p95 — 표본 0이면 None"""
    p50 = bucket_quantile(a, b, name, 0.5, **want)
    if p50 is None:
        return None
    return {'metric': name, 'count': pdelta(a, b, f'{name}_count', **want), 'p50S': p50,
            'p95S': bucket_quantile(a, b, name, 0.95, **want), 'basis': 'bucket-diff'}


def restart_detected(a, b):
    """재기동 감지 — 누적 계열(_total · _bucket · _count · _sum)이 하나라도 줄었다(compare.ts restartDetected)"""
    if not a or not b:
        return None
    for (n, l), v in b.items():
        if not re.search(r'_(total|bucket|count|sum)$', n):
            continue
        prev = a.get((n, l))
        if prev is not None and v < prev:
            return True
    return False


def _jdelta(a, b, key):
    x, y = num((a or {}).get(key)), num((b or {}).get(key))
    return None if x is None or y is None else y - x


def exp45_sync_commit(k):
    """대조군 COPY 세션의 유효 synchronous_commit — 연결 기동 인자(options '-c synchronous_commit=…')가 정한다
    기동 인자(PGC_S_CLIENT)는 역할 · DB 설정(pg_db_role_setting)과 서버 설정보다 앞서므로 그 셋은 참고 칸이다(세션 값은 밖에서 보이지 않는다).
    원천: start가 이미지 커밋의 control-table-sink.port.ts에서 읽은 options 문자열(kv controlCopyOptions)"""
    opts = k.get('controlCopyOptions')
    m = re.search(r'synchronous_commit=(\w+)', opts or '')
    eff = m.group(1) if m else None
    return {'effective': eff, 'off': None if eff is None else eff == 'off',
            'basis': 'startup options(control-table-sink.port.ts)', 'options': opts or None, 'imageCommit': k.get('commit'),
            'reference': jload_text(k.get('syncCommit'))}


def jload_text(t):
    try:
        return json.loads(t) if t else None
    except json.JSONDecodeError:
        return None


def exp45_step_view(sd, w_s, timeout_s):
    """EXP-45 계단 하나 — 두 싱크 창 분위수(버킷 차) · 행 처리율 · 랙 · 쓰기 비용 · 실패 · 구간 count"""
    m = meta(os.path.join(sd, 'meta'))
    a0w, a1w = prom(os.path.join(sd, 'm0.worker')), prom(os.path.join(sd, 'm1.worker'))
    a0, a1 = prom(os.path.join(sd, 'm0.api')), prom(os.path.join(sd, 'm1.api'))
    win = samples(os.path.join(sd, 'win.samples'))
    w0, w1 = num(m.get('winStartMs')), num(m.get('winEndMs'))
    secs = (w1 - w0) / 1000 if (w0 and w1) else None
    mb = modeb_view(jload(os.path.join(sd, 'modeb.json')))
    ins = bucket_view(a0w, a1w, 'insert_duration')
    cp = bucket_view(a0w, a1w, 'ing_control_copy_seconds')
    fails = pdelta(a0w, a1w, 'ing_control_copy_failures_total')
    ch_rows = pdelta(a0w, a1w, 'rows_inserted')
    pg_rows = pdelta(a0w, a1w, 'ing_control_copy_rows_total')
    pg0, pg1 = jload(os.path.join(sd, 'pg0.json')), jload(os.path.join(sd, 'pg1.json'))
    ch0, ch1 = jload(os.path.join(sd, 'parts0.json')), jload(os.path.join(sd, 'parts1.json'))
    pl = jload(os.path.join(sd, 'partlog.json'))
    cnt = jload(os.path.join(sd, 'counts.json'))
    restart = restart_detected(a0w, a1w) or restart_detected(a0, a1)
    rate = lambda x: (x / secs) if (x is not None and secs) else None
    pps = num(m.get('pps'))
    count_ok = None
    if cnt and cnt.get('tagRaw') is not None and cnt.get('control') is not None:
        count_ok = num(cnt['tagRaw']) == num(cnt['control'])
    v = {
        'label': m.get('label'), 'tier': m.get('tier'), 'pps': pps, 'transS': num(m.get('transS')), 'winS': num(m.get('winS')),
        'window': {'start': iso(w0), 'end': iso(w1)}, 'windowSeconds': secs,
        'loadRange': {'launch': iso(m.get('launchMs')), 'exit': iso(m.get('exitMs'))},
        'restartDetected': restart,
        'generator': mb,
        'generatorSaturated': None if not mb else bool((mb.get('achievedRatio') or 0) < 0.99 or (mb.get('lateTicks') or 0) > 0),
        'sinkTime': {'clickhouse': ins, 'postgresql': cp},
        'rows': {'clickhouse': ch_rows, 'postgresql': pg_rows,
                 'clickhouseRps': rate(ch_rows), 'postgresqlRps': rate(pg_rows),
                 'clickhouseAchieved': (rate(ch_rows) / pps) if (rate(ch_rows) is not None and pps) else None,
                 'postgresqlAchieved': (rate(pg_rows) / pps) if (rate(pg_rows) is not None and pps) else None,
                 'diff': (ch_rows - pg_rows) if (ch_rows is not None and pg_rows is not None) else None},
        'lag': series_summary(col(win, 1)), 'lagGroup': series_summary(col(win, 2)), 'pending': series_summary(col(win, 3)),
        'writeCost': {
            'postgresql': {'walBytes': _jdelta(pg0, pg1, 'walBytes'), 'walFpi': _jdelta(pg0, pg1, 'walFpi'), 'walRecords': _jdelta(pg0, pg1, 'walRecords'),
                           'autovacuum': _jdelta(pg0, pg1, 'autovacuum'), 'deadTuplesEnd': num((pg1 or {}).get('deadTuples')),
                           'deadTuplesDelta': _jdelta(pg0, pg1, 'deadTuples'), 'basis': 'pg_stat_wal · pg_stat_all_tables(대조군 잎 파티션) 창 경계 직접 조회',
                           'metricsRef': {'walBytes': pdelta(a0, a1, 'pg_wal_bytes_total'),
                                          'autovacuum': pdelta(a0, a1, 'pg_autovacuum_total', table='plc_tag_raw_control'),
                                          'note': 'OBS 수집 주기 15초의 거울 — 창 경계와 최대 15초 어긋난다(참고)'}},
            'clickhouse': {'activePartsStart': num((ch0 or [None])[0]), 'activePartsEnd': num((ch1 or [None])[0]),
                           'newParts': num(pl[0]) if pl else None, 'newPartBytes': num(pl[1]) if pl else None,
                           'merges': num(pl[2]) if pl else None, 'mergeWrittenBytes': num(pl[3]) if pl else None,
                           'mergeReadBytes': num(pl[4]) if pl else None, 'basis': 'system.part_log 창 [시작, 끝) · system.parts 창 경계'},
        },
        'failures': {'copyFailures': fails, 'dlq': pdelta(a0w, a1w, 'dlq_count'), 'insertRetries': pdelta(a0w, a1w, 'ing_insert_retries_total')},
        'intervalCount': {'tagRaw': num((cnt or {}).get('tagRaw')), 'control': num((cnt or {}).get('control')), 'match': count_ok},
    }
    # 판정 점 신호(정본 표) — ClickHouse 삽입 p95 > W · PostgreSQL COPY p95 > COPY 타임아웃 또는 실패 ≥ 1
    v['passed'] = {
        'clickhouse': None if not ins else bool(ins['p95S'] is not None and ins['p95S'] > w_s),
        'postgresql': None if (cp is None and fails is None) else bool((cp is not None and cp['p95S'] is not None and cp['p95S'] > timeout_s) or (fails or 0) > 0),
    }
    # ⑥ 구간 count가 어긋난 계단의 PostgreSQL 수치는 무효 · 재기동 창 · 생성기 포화 계단은 두 싱크의 상한으로 쓰지 않는다
    v['valid'] = {
        'clickhouse': not restart and not v['generatorSaturated'],
        'postgresql': not restart and not v['generatorSaturated'] and count_ok is True,
    }
    return v


def exp45_judgement(steps, w_s, timeout_s):
    """판정 점 — 계단 실행 순서대로 첫 계단 · 넘지 않으면 관측 범위(유효 계단의 최소 · 최대 pps)
    ClickHouse: 유효 계단 중 삽입 p95 > W인 첫 계단
    PostgreSQL: COPY 실패 ≥ 1인 첫 계단(행 수가 어긋나도 실패는 사실이다) 또는 유효 계단 중 COPY p95 > 타임아웃인 첫 계단"""
    def first(pred):
        return next((s['pps'] for s in steps if pred(s)), None)
    ok_ch = [s for s in steps if s['valid']['clickhouse']]
    ok_pg = [s for s in steps if s['valid']['postgresql']]
    ch = first(lambda s: s['valid']['clickhouse'] and s['passed']['clickhouse'])
    pg_fail = first(lambda s: not s['restartDetected'] and not s['generatorSaturated'] and (s['failures']['copyFailures'] or 0) > 0)
    pg_p95 = first(lambda s: s['valid']['postgresql'] and (s['sinkTime']['postgresql'] or {}).get('p95S') is not None
                   and s['sinkTime']['postgresql']['p95S'] > timeout_s)
    pg_first = None
    for s in steps:
        if s['pps'] in (pg_fail, pg_p95):
            pg_first = s['pps']
            break
    rng = lambda xs: {'minPps': min(s['pps'] for s in xs), 'maxPps': max(s['pps'] for s in xs)} if xs else None
    return {
        'windowS': w_s, 'copyTimeoutS': timeout_s,
        'clickhouse': {'firstPps': ch, 'rule': 'insert_duration p95 > W', 'observedRange': rng(ok_ch), 'notExceededInRange': ch is None and bool(ok_ch)},
        'postgresql': {'firstPps': pg_first, 'byFailure': pg_fail, 'byP95': pg_p95, 'rule': 'ing_control_copy_seconds p95 > COPY 타임아웃 또는 첫 실패',
                       'observedRange': rng(ok_pg), 'notExceededInRange': pg_first is None and bool(ok_pg)},
    }


def exp45_failure_log(p):
    """worker 로그의 control_copy_failed 구조화 이벤트 — 무효 구간(ts 범위)의 원천"""
    out = []
    for ln in (rd(p, '') or '').splitlines():
        i = ln.find('{')
        if i < 0 or 'control_copy_failed' not in ln:
            continue
        try:
            out.append(json.loads(ln[i:ln.rfind('}') + 1]))
        except json.JSONDecodeError:
            continue
    return out


def rec_exp45(d):
    out = head(d, 'exp45-control-stream')
    k = kv(d)
    plan = (env_conditions(d).get('INGEST_BATCH_PLAN') or 'A').upper()
    w_ms = num(k.get('windowMs')) or BATCH_PLAN_WINDOW_MS.get(plan, 1000)
    to_ms = num(k.get('copyTimeoutMs')) or math.floor(w_ms / 2)
    views = [exp45_step_view(sd, w_ms / 1000, to_ms / 1000) for sd in steps_in(d)]
    out['window'] = overall_window(views)
    c = out['conditions']
    c['injectionMode'] = 'B'
    c['cpuset'] = 'control-equalized' if k.get('storeResources') == EXP45_CONTROL_RESOURCES else None
    c['controlMemoryMb'] = {'clickhouse': 3584, 'postgres': 3584} if c['cpuset'] else None
    c['batchPlan'] = plan
    c['windowMs'] = w_ms
    c['copyTimeoutMs'] = to_ms
    c['indexVariant'] = k.get('indexVariant')
    c['controlCopySyncCommit'] = exp45_sync_commit(k)
    c['startCounts'] = jload_text(k.get('startCounts'))
    out['steps'] = views
    out['judgement'] = exp45_judgement(views, w_ms / 1000, to_ms / 1000)
    out['dailyCount'] = jload(os.path.join(d, 'daily-count.json'))
    out['copyFailureEvents'] = exp45_failure_log(os.path.join(d, 'copy-failures.log'))
    out['drainS'] = num(k.get('drainS'))
    out['drained'] = None if k.get('drainS') in (None, '') else k.get('drainS') != '-1'
    return out


EXP45_METRICS = (('clickhouse', 'insert_duration_seconds'), ('postgresql', 'control_copy_seconds'))  # 규약 이름(.omc/record-conventions · 웹 픽스처)
EXP45_DEVIATION_THRESHOLD = 0.2  # 04_experiment_protocol §반복과 폐기 — 현행 참고 20%(2계층)
EXP45_MIN_RUNS = 3               # 04 §반복과 폐기 — 반복 수 3(구조값)


def exp45_table_conditions(rows):
    """반복 줄들의 판정 기준 조건 — 반복끼리 다르거나 비어 있으면 멈춘다(같은 조건의 3회가 아니면 중앙값이 없다)"""
    def of(r):
        c = r.get('conditions') or {}
        w, to = num(c.get('windowMs')), num(c.get('copyTimeoutMs'))
        sc = c.get('controlCopySyncCommit')
        return {'flushWindowSeconds': None if w is None else w / 1000, 'copyTimeoutSeconds': None if to is None else to / 1000,
                'batchPlan': c.get('batchPlan'), 'controlCopySyncCommit': sc.get('effective') if isinstance(sc, dict) else sc}
    got = [of(r) for r in rows]
    if not got:
        raise SystemExit('EXP-45 반복 줄이 없다')
    for key in got[0]:
        vals = [g[key] for g in got]
        if any(v is None for v in vals):
            raise SystemExit(f'EXP-45 조건 {key}가 비어 있는 반복이 있다 — 반복 {[r.get("rep") for r, v in zip(rows, vals) if v is None]}')
        if len(set(vals)) > 1:
            raise SystemExit(f'EXP-45 조건 {key}가 반복끼리 다르다 — {dict(zip([r.get("rep") for r in rows], vals))}')
    # L3 — 배치 안 B의 COPY 타임아웃(W ÷ 2)은 보간 거짓 판정을 낸다 · EXP-45는 배치 안 A만 돈다(기록 조건)
    if got[0]['batchPlan'] != 'A':
        raise SystemExit(f'EXP-45는 배치 안 A만 기록한다 — batchPlan {got[0]["batchPlan"]}')
    return got[0]


def exp45_stream_steps(rows):
    """반복 원시 줄(보통 3) → 기계 판독 streamSteps(04_experiment_protocol) — 계단 pps마다 두 싱크의 p50 · p95 행
    values · failures는 반복 자리 단위 — 반복 번호 순(reps[i]의 값 · 그 반복에 계단이 없으면 None) · median은 유효 값이 3회 이상일 때만
    PostgreSQL 무효 반복(구간 count 불일치)의 값은 None · 재기동 · 생성기 포화 반복 자리는 두 싱크의 값과 failures가 None
    행 valid:false = 그 저장소 유효 반복 0(판독기가 판정 · 관측 범위에서 뺀다) — 유효 반복은 그 저장소 수치가 유효한 반복과
    PostgreSQL 실패 ≥ 1 반복(행 수가 어긋나도 실패는 사실이다 — exp45_judgement byFailure와 같다)"""
    reps = [r.get('rep') for r in rows]
    if len(set(reps)) != len(reps):
        raise SystemExit(f'EXP-45 반복 번호가 겹친다 — {reps}')
    order = sorted(reps)
    by = {}
    for r in rows:
        seen = set()
        for s in r.get('steps') or []:
            if s['pps'] in seen:
                raise SystemExit(f'EXP-45 반복 {r.get("rep")} 안에 같은 pps {s["pps"]} 계단이 둘이다')
            seen.add(s['pps'])
            by.setdefault(s['pps'], {})[order.index(r.get('rep'))] = s
    out = []
    for pps in sorted(by):
        ss = [by[pps].get(i) for i in range(len(order))]
        for store, metric in EXP45_METRICS:
            fails = []
            for s in ss:
                if s is None or s.get('restartDetected') or s.get('generatorSaturated'):
                    fails.append(None)
                else:
                    f = s.get('failures') or {}
                    fails.append(f.get('copyFailures') if store == 'postgresql' else f.get('dlq'))
            valid = any(s is not None and s['valid'][store] for s in ss) or (
                store == 'postgresql' and any(x is not None and x > 0 for x in fails))
            for q in ('p50', 'p95'):
                vals = []
                for s in ss:
                    h = (s.get('sinkTime') or {}).get(store) if s else None
                    vals.append(h.get(q + 'S') if (h and s['valid'][store]) else None)
                got = [x for x in vals if x is not None]
                out.append({'pps': pps, 'store': store, 'metric': f'{metric}_{q}', 'unit': 's', 'values': vals,
                            'median': statistics.median(got) if len(got) >= EXP45_MIN_RUNS else None, 'failures': fails, 'valid': valid})
    return order, out


def exp45_repeat(steps, runs):
    """repeat — 편차 = (최대 − 최소) ÷ 중앙값(04 §반복과 폐기) · 폐기 판정은 p50 행만(히스토그램 p95는 참고)
    반복 3 미만이면 폐기(discard True — 중앙값이 없어 편차도 없다) · 3 이상인데 편차를 낼 p50 행이 없으면 멈춘다(null 기록을 만들지 않는다)"""
    def dev(s):
        got = [x for x in s['values'] if x is not None]
        if s['median'] is None or not s['median']:
            return None
        return (max(got) - min(got)) / s['median']
    by = {'p50': [], 'p95': []}
    for s in steps:
        d = dev(s)
        if d is not None:
            by[s['metric'][-3:]].append({'pps': s['pps'], 'store': s['store'], 'metric': s['metric'], 'deviation': d})
    mx = lambda xs: max((x['deviation'] for x in xs), default=None)
    d50 = mx(by['p50'])
    if runs >= EXP45_MIN_RUNS and d50 is None:
        raise SystemExit(f'EXP-45 편차를 낼 p50 행이 없다 — 반복 {runs}회인데 중앙값이 있는(0이 아닌) p50 행 0(유효 반복 3 미만 계단뿐)')
    return {'runs': runs, 'deviation': d50, 'threshold': EXP45_DEVIATION_THRESHOLD,
            'discard': runs < EXP45_MIN_RUNS or d50 > EXP45_DEVIATION_THRESHOLD,
            'basis': 'p50(04 §반복과 폐기 — 히스토그램 p95는 참고)', 'deviationP95': mx(by['p95']),
            'byMetric': by['p50'] + by['p95']}


def rec_exp45_stream_steps(path):
    rows = [json.loads(ln) for ln in (rd(path, '') or '').splitlines() if ln.strip()]
    rows = [r for r in rows if r.get('kind') == 'exp45-control-stream']
    cond = exp45_table_conditions(rows)
    reps, steps = exp45_stream_steps(rows)
    by_rep = {r.get('rep'): r for r in rows}
    return {'kind': 'exp45-stream-steps', 'exp': 'EXP-45', 'reps': reps, 'conditions': cond,
            'repeat': exp45_repeat(steps, len(reps)), 'streamSteps': steps,
            'judgement': [{'rep': n, **(by_rep[n].get('judgement') or {})} for n in reps]}


def exp45_step_print(sd, w_ms=1000, to_ms=None):
    """계단 직후 사람이 읽는 한 줄 — 기록이 아니다(구간 count는 소진 뒤 stop이 채운다)"""
    to_ms = to_ms if to_ms is not None else math.floor(w_ms / 2)
    v = exp45_step_view(sd, w_ms / 1000, to_ms / 1000)
    ins, cp = v['sinkTime']['clickhouse'] or {}, v['sinkTime']['postgresql'] or {}
    g = v.get('generator') or {}
    lag = v.get('lag') or {}
    print(json.dumps({'pps': v['pps'], 'insertP50S': ins.get('p50S'), 'insertP95S': ins.get('p95S'), 'copyP50S': cp.get('p50S'), 'copyP95S': cp.get('p95S'),
                      'copyFailures': v['failures']['copyFailures'], 'rowsDiff': v['rows']['diff'], 'lagLast': lag.get('last'), 'lagMax': lag.get('max'),
                      'walBytes': v['writeCost']['postgresql']['walBytes'], 'achieved': g.get('achievedRatio'), 'restart': v['restartDetected'],
                      'saturated': v['generatorSaturated'], 'passed': v['passed']}, ensure_ascii=False))


KINDS = {'modeb-steps': rec_modeb_steps, 'bulk': rec_bulk, 'modea-steps': rec_modea_steps, 'mix': rec_mix,
         'spike': rec_spike, 'soak': rec_soak, 'ws': rec_ws, 'redismem': rec_redismem}
# EXP-45 — exp45: 상태 디렉터리 → 반복 한 줄 · exp45-stream-steps: <원시 jsonl>의 반복 줄들 → streamSteps 한 줄
KINDS['exp45'] = rec_exp45
KINDS['exp45-stream-steps'] = rec_exp45_stream_steps


def main():
    kind = sys.argv[1]
    if kind == 'step-summary':
        step_summary(sys.argv[2])
        return
    d, out = sys.argv[2], sys.argv[3]
    row = KINDS[kind](d)
    line = json.dumps(row, ensure_ascii=False)
    with open(out, 'a') as f:
        f.write(line + '\n')
    brief = {k: row.get(k) for k in ('exp', 'rep', 'arm', 'window')}
    print('원시 한 줄 추가 →', out, json.dumps(brief, ensure_ascii=False))


if __name__ == '__main__':
    main()
