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
        tos = pdelta(a0, a1, 'col_poll_timeouts_total')
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


KINDS = {'modeb-steps': rec_modeb_steps, 'bulk': rec_bulk, 'modea-steps': rec_modea_steps, 'mix': rec_mix,
         'spike': rec_spike, 'soak': rec_soak, 'ws': rec_ws, 'redismem': rec_redismem}


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
