#!/usr/bin/env python3
# EXP-33 판독 · 판정 · 표 계산 단위 테스트 — 저장소 · docker 없이 합성 상태 디렉터리로 돈다.
# 실행: python3 -m unittest scripts/lab/s5/alarm/test_alarm.py
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _alarm as A  # noqa: E402

T0 = 1_790_000_000_000  # 합성 시각 기준(epoch ms)


def prom_text(counters=None, hists=None):
    """counters: {(이름, 레이블 문자열): 값} · hists: {(이름, 레이블 문자열): {le: 누적}} → /metrics 원문"""
    out = []
    for (n, lab), v in (counters or {}).items():
        out.append(f'{n}{lab} {v}')
    for (n, lab), b in (hists or {}).items():
        inner = lab[1:-1] if lab else ''
        total = 0
        for le, c in b.items():
            sep = ',' if inner else ''
            out.append(f'{n}_bucket{{{inner}{sep}le="{le}"}} {c}')
            total = c
        out.append(f'{n}_count{lab} {total}')
        out.append(f'{n}_sum{lab} 0')
    return '\n'.join(out) + '\n'


def write(p, text):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(text)


def worker_metrics(ev_v, ev_n, opened, closed, gap_b=0, gap_r=0, pg_open=0, pg_close=0, rows=0, dlq=0, inserted=0,
                   total_buckets=None, handoff=None, restart_marker=100):
    c = {
        ('alm_evaluations_total', '{result="violation"}'): ev_v, ('alm_evaluations_total', '{result="normal"}'): ev_n,
        ('alm_events_opened_total', ''): opened, ('alm_events_closed_total', ''): closed,
        ('alm_eval_gap_batches_total', ''): gap_b, ('alm_eval_gap_rows_total', ''): gap_r,
        ('alm_pg_write_failures_total', '{op="open"}'): pg_open, ('alm_pg_write_failures_total', '{op="close"}'): pg_close,
        ('alm_state_write_failures_total', ''): 0, ('alm_eval_rows_inserted_total', ''): inserted,
        ('rows_inserted', ''): rows, ('dlq_count', ''): dlq, ('process_cpu_seconds_total', ''): restart_marker,
    }
    h = {}
    for ph in ('A1', 'total'):
        h[('alm_eval_duration_seconds', f'{{phase="{ph}"}}')] = total_buckets or {'0.1': 0, '1': 0, '+Inf': 0}
    h[('alm_handoff_wait_seconds', '')] = handoff or {'0.001': 0, '+Inf': 0}
    return prom_text(c, h)


class TestSpikeBase(unittest.TestCase):
    def test_matches_node(self):
        # node로 rng.ts와 같은 식을 돌린 값(2026-09-27)
        want = {1: 58.21209975518286, 2: 76.4438405353576, 250: 50.891984519548714, 5001: 52.89403658360243,
                9999: 63.143958048895, 10000: 40.1768288994208}
        for tag, v in want.items():
            self.assertAlmostEqual(A.spike_base(42, tag), v, places=9)
        self.assertAlmostEqual(A.uniform(42, 7, 123, 60), 0.4977675215341151, places=12)


class TestSpikeValue(unittest.TestCase):
    # node(rng.ts · profiles.ts 식 그대로)로 뽑은 행 값 — k = floor(ts ÷ 1000) · 마지막은 이상치 시점
    NODE = [[1, 1790000000000, 57.39761068626057], [1, 1790000001000, 56.41570801106359], [4861, 1790000123000, 68.08713657345331],
            [9721, 1790000000000, 47.7908683782581], [1, 1790000026000, 157.52309417746085]]

    def test_matches_node(self):
        for tag, ts, v in self.NODE:
            self.assertLessEqual(abs(A.spike_value(42, tag, ts) - v), 1e-9)

    def test_check_values(self):
        plan = [{'tagId': 1}, {'tagId': 4861}]
        rows = [(t, ts, v) for t, ts, v in self.NODE if t in (1, 4861)] + [(9721, 1790000000000, 0.0)]
        r = A.check_values(plan, rows)
        self.assertTrue(r['ok'], r)
        self.assertEqual(r['rows'], 4)  # 계획 밖 태그 행은 보지 않는다
        bad = rows[:1] + [(1, 1790000001000, 56.41570801106359 + 1e-5)] + rows[2:]
        r = A.check_values(plan, bad)
        self.assertFalse(r['ok'])
        self.assertEqual(r['mismatchCount'], 1)
        r = A.check_values(plan + [{'tagId': 5}], rows)
        self.assertEqual(r['missingTags'], [5])
        self.assertFalse(r['ok'])
        self.assertFalse(A.check_values(plan, [])['ok'])


class TestReplay(unittest.TestCase):
    def rows(self, bits, t0=0):
        return [(t0 + i * 1000, b) for i, b in enumerate(bits)]

    def test_open_clear_reopen(self):
        # 위반 3연속(디바운스 2000) → 열림 · 정상 3연속 → CLEARING 뒤 닫힘 · 다시 위반 3연속 → 열림
        r = self.rows([1, 1, 1, 0, 0, 0, 1, 1, 1])
        self.assertEqual(A.replay_opens(r, 2000), [2000, 8000])

    def test_clearing_reviolation_keeps_open(self):
        r = self.rows([1, 1, 1, 0, 1, 0, 0, 1, 1, 1])
        self.assertEqual(A.replay_opens(r, 2000), [2000])  # CLEARING → ACTIVE — 새 열림 없음

    def test_pending_reset(self):
        self.assertEqual(A.replay_opens(self.rows([1, 1, 0, 1, 1, 0]), 2000), [])

    def test_ack_path(self):
        # 확인된 열림 — 해소 첫 행(3000)에서 곧바로 닫힘(실측 cleared = 3000) → 다음 위반 3연속으로 다시 열림
        r = self.rows([1, 1, 1, 0, 1, 1, 1])
        ev = [{'occurredMs': 2000, 'clearedMs': 3000}]
        self.assertEqual(A.replay_opens(r, 2000, ev), [2000, 6000])
        self.assertEqual(A.replay_opens(r, 2000), [2000])  # 확인 모르면 CLEARING — 재위반은 같은 열림

    def test_completeness_with_exclusion(self):
        rule = {'ruleId': 3, 'debounceMs': 2000}
        rows = {3: self.rows([1, 1, 1, 0, 0, 0] + [1, 1, 1, 1] + [0, 1, 1])}
        # 제외 구간 6000~9000(열림 8000은 그 안) · 뒤 조각: 실측 열린 이벤트가 11000에 닫힘 → 그 뒤부터 재생
        ev = [{'eventId': 1, 'ruleId': 3, 'occurredMs': 2000, 'clearedMs': 5000},
              {'eventId': 2, 'ruleId': 3, 'occurredMs': 8000, 'clearedMs': 10000}]
        c = A.completeness([rule], rows, ev, [(6000, 9000)])
        self.assertTrue(c['holds'], c)
        self.assertEqual(c['excludedEvents'], 1)
        self.assertEqual(c['matched'], 1)
        # 실측에 없는 예측 열림 → missing
        c = A.completeness([rule], rows, ev[1:], [(6000, 9000)])
        self.assertFalse(c['holds'])
        self.assertEqual(c['missing'], [{'ruleId': 3, 'ts': 2000}])
        # 예측에 없는 실측 열림 → extra
        c = A.completeness([rule], rows, ev + [{'eventId': 3, 'ruleId': 3, 'occurredMs': 4000, 'clearedMs': 4500}], [(6000, 9000)])
        self.assertEqual(c['extra'], [{'ruleId': 3, 'ts': 4000}])

    def test_completeness_resync_normal(self):
        rule = {'ruleId': 4, 'debounceMs': 2000}
        # 제외 뒤 조각이 위반으로 시작 — 첫 정상 행부터 재생(그 위반 연속의 시작을 모른다)
        rows = {4: self.rows([0, 0, 1, 1, 1, 1, 0, 1, 1, 1])}
        c = A.completeness([rule], rows, [{'eventId': 9, 'ruleId': 4, 'occurredMs': 9000, 'clearedMs': None}], [(0, 2500)])
        self.assertTrue(c['holds'], c)

    def test_fault_pg_exclusion_starts_before_stop_call(self):
        """재검수 중간 — 위반 10 s부터 · 디바운스 2 s · PG는 stop 호출(13 s) 직후 연결 거부 → 12 s 예측 열림이 실패하고 복구 뒤 31 s에 열림"""
        rule = {'ruleId': 5, 'debounceMs': 2000}
        rows = {5: self.rows([0] * 10 + [1] * 25)}  # 0~9 s 정상 · 10~34 s 위반
        ev = [{'eventId': 1, 'ruleId': 5, 'occurredMs': 31000, 'clearedMs': None}]
        old = A.completeness([rule], rows, ev, [(13000, 30000)])  # 정지 완료부터 뺀 옛 구간 — 오판
        self.assertEqual(old['missing'], [{'ruleId': 5, 'ts': 12000}])
        d = tempfile.mkdtemp()
        try:
            write(os.path.join(d, 'fault-pg', 'meta'), 'stopMs=13000\nstoppedMs=14500\nendMs=30000\n')
            spans = A.phase_spans(d)
            self.assertEqual(spans['faultPg'], (12000, 30000))
            c = A.completeness([rule], rows, ev, [spans['faultPg']])
            self.assertTrue(c['holds'], c)
            self.assertEqual(c['excludedEvents'], 1)
            self.assertIn('open-set only', c['basis'])
            self.assertIn('ACKED', c['limitation'])
            # stopMs가 없는 옛 상태 — 정지 완료부터(여유 없음)
            write(os.path.join(d, 'fault-pg', 'meta'), 'stoppedMs=14500\nendMs=30000\n')
            self.assertEqual(A.phase_spans(d)['faultPg'], (14500, 30000))
        finally:
            shutil.rmtree(d)

    def test_by_phase(self):
        spans = {'window': (0, 10), 'faultPg': (20, 30), 'faultCh': (40, 50)}
        evs = [{'occurredMs': x} for x in (5, 25, 45, 60)]
        self.assertEqual(A.by_phase(evs, spans), {'window': 1, 'faultPg': 1, 'faultCh': 1, 'other': 1})


class TestRedisUrl(unittest.TestCase):
    def test_rc_pre(self):
        """러너의 RC_PRE — 비밀번호는 REDISCLI_AUTH로만 · 명령줄 인자에 없다"""
        txt = A.R.rd(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp33-alarm.sh')) + '\n'
        rc = txt[txt.index("RC_PRE='") + len("RC_PRE='"):]
        rc = rc[:rc.index("\n'\n") + 1]
        cases = {'redis://:fakepw@redis:6379': ('-h redis -p 6379', 'fakepw'),
                 'redis://default:fakepw@redis:6379/0': ('-h redis -p 6379 --user default -n 0', 'fakepw'),
                 'redis://redis': ('-h redis -p 6379', ''),
                 'redis://:fa%40k@redis:6379': ('-u redis://:fa%40k@redis:6379', '')}
        for url, (conn, pw) in cases.items():
            out = subprocess.run(['sh', '-c', rc + 'printf "%s|%s" "$CONN" "${REDISCLI_AUTH:-}"'], env={'REDIS_URL': url, 'PATH': os.environ['PATH']},
                                 capture_output=True, text=True).stdout
            self.assertEqual(out, f'{conn}|{pw}', url)


class TestPlan(unittest.TestCase):
    def test_tiers_and_thresholds(self):
        plan = A.plan_rules(range(1, 10001))
        self.assertEqual([r['tier'] for r in plan].count('S'), 20)
        self.assertEqual([r['tier'] for r in plan].count('B'), 20)
        self.assertEqual([r['tier'] for r in plan].count('P'), 1)
        self.assertEqual(len({r['tagId'] for r in plan}), 41)
        self.assertEqual(plan[1]['tagId'] - plan[0]['tagId'], 10000 // 41)
        for r in plan:
            off = {'S': 25.0, 'B': -1.0, 'P': -10.0}[r['tier']]
            self.assertAlmostEqual(r['threshold'], round(r['base'] + off, 3), places=6)
            self.assertEqual(r['conditionType'], 'GT')
        self.assertEqual({r['debounceMs'] for r in plan if r['tier'] == 'S'}, {5000})
        self.assertEqual({r['debounceMs'] for r in plan if r['tier'] == 'B'}, {2000})

    def test_override_and_too_few(self):
        plan = A.plan_rules(range(1, 101), {'nS': 2, 'nB': 3})
        self.assertEqual(len(plan), 6)
        with self.assertRaises(SystemExit):
            A.plan_rules(range(1, 5))



class TestParsers(unittest.TestCase):
    def test_states(self):
        s = A.parse_states('== 3\nstate\nPENDING\nfirst_breach_ts\n100\n== 4\n== 5\nstate\nNORMAL\n')
        self.assertEqual(s[3], {'state': 'PENDING', 'first_breach_ts': '100'})
        self.assertEqual(s[4], {})
        self.assertEqual(s[5]['state'], 'NORMAL')

    def test_frames(self):
        d = tempfile.mkdtemp()
        try:
            p = os.path.join(d, 'f')
            write(p, f'{T0} {{"type":"alarm","ruleId":1,"transition":"OPENED"}}\nbad\n{T0 + 5} {{"type":"alarm","ruleId":2,"transition":"CLEARED"}}\n')
            fr = A.parse_frames(p)
            self.assertEqual(len(fr), 2)
            self.assertEqual(len(A.frames_between(fr, T0, T0 + 10)), 2)
            self.assertEqual(len(A.frames_between(fr, T0, T0 + 10, rule=1, transition='OPENED')), 1)
            self.assertEqual(len(A.frames_between(fr, T0 + 1, T0 + 4)), 0)
        finally:
            shutil.rmtree(d)

    def test_gap_log(self):
        d = tempfile.mkdtemp()
        try:
            p = os.path.join(d, 'g')
            plain = '[Nest] 1 - ERROR [AlarmEval] {"event":"alarm_eval_gap","reason":"queue_full","rows":40,"rules":40}'
            jsonmode = json.dumps({'level': 'error', 'message': json.dumps({'event': 'alarm_eval_gap', 'reason': 'retry_exhausted', 'rows': 38})})
            write(p, '\n'.join([plain, jsonmode, 'noise alarm_eval_gap {broken']) + '\n')
            g = A.gap_log(p)
            self.assertEqual(g['events'], 2)
            self.assertEqual(g['rows'], 78)
            self.assertEqual(g['byReason'], {'queue_full': 1, 'retry_exhausted': 1})
            self.assertEqual(g['unparsed'], 1)
        finally:
            shutil.rmtree(d)


class TestDebounce(unittest.TestCase):
    def test_runs(self):
        self.assertEqual(A.breach_runs([(1, 1), (2, 1), (3, 0), (4, 1)]), [(1, 2), (4, 4)])
        self.assertEqual(A.breach_runs([(1, 0)]), [])

    def test_check(self):
        rows = {7: [(0, 0), (1000, 1), (2000, 1), (3000, 1), (4000, 0), (5000, 1), (6000, 1)]}
        deb = {7: 2000}
        ok = A.debounce_check([{'eventId': 1, 'ruleId': 7, 'occurredMs': 3000}], rows, deb)
        self.assertEqual((ok['ok'], ok['short'], ok['unknown']), (1, 0, 0))
        short = A.debounce_check([{'eventId': 2, 'ruleId': 7, 'occurredMs': 6000}], rows, deb)
        self.assertEqual(short['short'], 1)
        self.assertEqual(short['shortEvents'][0]['runMs'], 1000)
        unk = A.debounce_check([{'eventId': 3, 'ruleId': 7, 'occurredMs': 6500}, {'eventId': 4, 'ruleId': 8, 'occurredMs': 1}], rows, deb)
        self.assertEqual(unk['unknown'], 2)
        # 창 첫 행부터 위반 — 창 안 길이가 디바운스 이상이면 ok · 미만이면 unknown(시작점 모름)
        head = {9: [(0, 1), (1000, 1), (2000, 1)]}
        self.assertEqual(A.debounce_check([{'eventId': 5, 'ruleId': 9, 'occurredMs': 2000}], head, {9: 2000})['ok'], 1)
        self.assertEqual(A.debounce_check([{'eventId': 6, 'ruleId': 9, 'occurredMs': 1000}], head, {9: 2000})['unknown'], 1)


class TestHistogram(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.d)

    def pair(self, b0, b1):
        p0, p1 = os.path.join(self.d, 'a'), os.path.join(self.d, 'b')
        write(p0, worker_metrics(0, 0, 0, 0, total_buckets=b0))
        write(p1, worker_metrics(0, 0, 0, 0, total_buckets=b1))
        return A.R.prom(p0), A.R.prom(p1)

    def test_le_fraction_exact(self):
        a, b = self.pair({'0.1': 10, '1': 20, '+Inf': 20}, {'0.1': 100, '1': 206, '+Inf': 210})
        # 창 차 — le=1 누적 186 ÷ 190
        self.assertAlmostEqual(A.le_fraction(a, b, 'alm_eval_duration_seconds', 1.0, phase='total'), 186 / 190)
        r = A.flush_relation(a, b, 1000)
        self.assertTrue(r['holds'])
        a, b = self.pair({'0.1': 0, '1': 0, '+Inf': 0}, {'0.1': 10, '1': 90, '+Inf': 100})
        self.assertFalse(A.flush_relation(a, b, 1000)['holds'])
        # 플러시 주기 경계가 버킷에 없으면 판정하지 않는다(보간 금지)
        self.assertIsNone(A.flush_relation(a, b, 5000)['holds'])

    def test_empty(self):
        a, b = self.pair({'0.1': 0, '1': 0, '+Inf': 0}, {'0.1': 0, '1': 0, '+Inf': 0})
        self.assertIsNone(A.le_fraction(a, b, 'alm_eval_duration_seconds', 1.0, phase='total'))


class TestAckBound(unittest.TestCase):
    def test_bound(self):
        # 응답 시각 100,000 · 겹침 TTL 30,000 — 70,000 이후 첫 프레임 80,000 → 재조회 110,000 → 상한 10,000
        self.assertEqual(A.ack_bound_ms(100_000, [10_000, 80_000, 95_000]), 10_000)
        self.assertEqual(A.ack_bound_ms(100_000, [120_000]), 50_000)
        self.assertIsNone(A.ack_bound_ms(100_000, [1_000]))

    def test_bound_list_fetch_base(self):
        # 응답 전 마지막 목록 응답 90,000 — 그 전 프레임(80,000)은 이미 재조회로 정리 · 기준점 뒤 첫 프레임 95,000 → 상한 25,000
        self.assertEqual(A.ack_bound_ms(100_000, [80_000, 95_000], [60_000, 90_000]), 25_000)
        # 응답 뒤 목록 응답은 기준점에 들지 않는다
        self.assertEqual(A.ack_bound_ms(100_000, [80_000], [105_000]), 10_000)
        self.assertIsNone(A.ack_bound_ms(100_000, [80_000], [90_000]))


def build_state(d, rep=1, ev_rate=40, ack_delay=12_000, fault_ok=True, spike_event=False, b_short=False, frame_after_start=False):
    """rec()가 읽는 상태 디렉터리 한 벌 — 규칙 S 2 · B 2 · P 1"""
    kv = {'exp': 'exp33', 'rep': str(rep), 'arm': 'alarm', 'commit': 'abc1234', 'snapshot': 's7a-seed-m', 'lagSrc': 'worker',
          'storeResources': 'clickhouse=5-8/5368709120 postgres=9-10/2147483648', 'ackActor': 'learner@localhost', 'drainS': '3',
          'params': json.dumps({**A.DEFAULTS, 'nS': 2, 'nB': 2})}
    for k, v in kv.items():
        write(os.path.join(d, 'kv', k), v)
    write(os.path.join(d, 'env'), 'CAPACITY_TIER=M\nINGEST_BATCH_PLAN=A\n')
    sw = {f'SW-{i:02d}': {'value': 'on'} for i in range(1, 12)}
    write(os.path.join(d, 'health.json'), json.dumps({'run': {'commitHash': 'abc1234', 'memoryProfile': 'load', 'memoryLimitMb': 4096, 'capacityTier': 'M'}, 'switches': sw}))
    write(os.path.join(d, 'health-worker.json'), json.dumps({'switches': sw}))
    rules = [
        {'tier': 'S', 'tagId': 1, 'base': 50, 'threshold': 75, 'debounceMs': 5000, 'severity': 1, 'ruleId': 1},
        {'tier': 'S', 'tagId': 2, 'base': 50, 'threshold': 75, 'debounceMs': 5000, 'severity': 1, 'ruleId': 2},
        {'tier': 'B', 'tagId': 3, 'base': 50, 'threshold': 49, 'debounceMs': 2000, 'severity': 2, 'ruleId': 3},
        {'tier': 'B', 'tagId': 4, 'base': 50, 'threshold': 49, 'debounceMs': 2000, 'severity': 2, 'ruleId': 4},
        {'tier': 'P', 'tagId': 5, 'base': 50, 'threshold': 40, 'debounceMs': 30000, 'severity': 3, 'ruleId': 5, 'createdMs': T0 + 190_000},
    ]
    write(os.path.join(d, 'rules.json'), json.dumps(rules))
    write(os.path.join(d, 'rules-before'), '0')
    write(os.path.join(d, 'baseline-counts.json'), json.dumps({'auditRuleInserts': 7, 'alarmEvents': 0}))
    write(os.path.join(d, 'plan-check.json'), json.dumps({'ok': True}))
    write(os.path.join(d, 'modeb.json'), json.dumps({'options': {'tier': 'M', 'pps': 10000, 'durationSeconds': 100}, 'result': {'generatedPoints': 1_000_000, 'publishedPoints': 1_000_000, 'lateTicks': 0}}))
    # 창 — 10초 · 규칙 4 · 1 Hz
    w = os.path.join(d, 'window')
    w0, w1 = T0, T0 + 10_000
    write(os.path.join(w, 'meta'), f'winS=10\nwinStartMs={w0}\nwinEndMs={w1}\n')
    write(os.path.join(w, 'm0.worker'), worker_metrics(0, 0, 0, 0, total_buckets={'0.1': 0, '1': 0, '+Inf': 0}, handoff={'0.001': 0, '+Inf': 0}))
    write(os.path.join(w, 'm1.worker'), worker_metrics(ev_rate * 5, ev_rate * 5, 1, 0, total_buckets={'0.1': 9, '1': 10, '+Inf': 10}, handoff={'0.001': 10, '+Inf': 10}))
    rows = []
    for t in range(-60, 10):
        ts = T0 + t * 1000
        rows.append((1, ts, 1 if t == 3 else 0))
        rows.append((2, ts, 0))
        rows.append((3, ts, 1 if t >= 2 else 0))
        rows.append((4, ts, 0))
    write(os.path.join(w, 'eval.tsv'), ''.join(f'{r}\t{ts}\t{b}\n' for r, ts, b in rows))
    occ = T0 + (5000 if b_short else 4000)
    if b_short:
        write(os.path.join(w, 'eval.tsv'), ''.join(f'{r}\t{ts}\t{1 if (r == 3 and ts >= T0 + 4000) else (b if r != 3 else 0)}\n' for r, ts, b in rows))
    ev = [f'10,3,{occ},,,ACTIVE']
    if spike_event:
        ev.append(f'11,1,{T0 + 3000},{T0 + 4000},,CLEARED')
    write(os.path.join(w, 'events.csv'), '\n'.join(ev) + '\n')
    write(os.path.join(w, 'keys'), '4')
    write(os.path.join(w, 'judged-rules'), '4')
    write(os.path.join(w, 'win.samples'), f'{w0 // 1000} 0 0 0 1 1 0.01\n')
    write(os.path.join(w, 'stats'), f'{w0 // 1000} db_study-datagen-lab 55.0% 1GiB / 2GiB\n')
    # ACK
    ak = os.path.join(d, 'ack')
    resp = T0 + 100_000
    write(os.path.join(ak, 'ack.json'), json.dumps({'method': 'x', 'url': 'u', 'trials': [
        {'eventId': 10, 'ruleId': 3, 'status': 200, 'clickMs': resp - 100, 'respMs': resp, 'aDomMs': resp + 200, 'bFetchMs': resp + ack_delay - 100, 'bDomMs': resp + ack_delay, 'waitedMs': ack_delay},
        {'eventId': 12, 'ruleId': 4, 'status': 409, 'clickMs': resp, 'respMs': resp + 50}],
        'framesA': [resp - 5000], 'framesB': [resp - 20_000, resp + 5_000],
        'framesDetailB': [[resp - 20_000, 10, 'OPENED'], [resp + 5_000, 13, 'CLEARED']],
        'listFetchesB': [[resp - 40_000, 200, 3], [resp + ack_delay - 100, 200, 3]]}))
    write(os.path.join(ak, 'm0.api'), prom_text({('alm_acks_total', '{result="accepted"}'): 0, ('alm_acks_total', '{result="rejected"}'): 0}))
    write(os.path.join(ak, 'm1.api'), prom_text({('alm_acks_total', '{result="accepted"}'): 1, ('alm_acks_total', '{result="rejected"}'): 1}))
    write(os.path.join(ak, 'meta'), 'webBuild=b7l\nwebDirty=false\n')
    # PostgreSQL 정지
    fp = os.path.join(d, 'fault-pg')
    stopped, ready = T0 + 200_000, T0 + 262_000
    write(os.path.join(fp, 'meta'), f'stopS=60\nprobeRuleId=5\ncreateMs={T0 + 190_000}\nstopMs={stopped - 1000}\nstoppedMs={stopped}\nstartMs={ready - 2000}\nreadyMs={ready}\nconfirmMs={ready + 1500}\nendMs={ready + 8000}\nworkerRunning=true\ncacheTtlS=280\n')
    write(os.path.join(fp, 'probe-state'), f'== 5\nstate\nPENDING\nfirst_breach_ts\n{T0 + 191_000}\n')
    write(os.path.join(fp, 'probe-events.csv'), f'20,5,{ready + 1000},,,ACTIVE\n')
    frames = [f'{stopped - 5000} {{"ruleId":3,"transition":"CLEARED"}}', f'{ready + 1600} {{"ruleId":5,"transition":"OPENED"}}']
    if not fault_ok:
        frames.append(f'{stopped + 1000} {{"ruleId":4,"transition":"OPENED"}}')
    if frame_after_start:  # docker start 호출 뒤 · 준비 전 — 복구 뒤 창이라 정지 중 발행이 아니다
        frames.append(f'{ready - 1500} {{"ruleId":4,"transition":"OPENED"}}')
    write(os.path.join(fp, 'frames'), '\n'.join(frames) + '\n')
    write(os.path.join(fp, 'm0.worker'), worker_metrics(0, 0, 0, 0))
    write(os.path.join(fp, 'mstop.worker'), worker_metrics(10, 10, 0, 0, pg_open=3, pg_close=1))
    write(os.path.join(fp, 'm1.worker'), worker_metrics(20, 20, 1, 0, pg_open=3, pg_close=1))
    # alarm_eval 강제 실패
    fc = os.path.join(d, 'fault-ch')
    hold, rel = T0 + 400_000, T0 + 460_000
    write(os.path.join(fc, 'meta'), f'mode=rename\nholdS=60\nrecoverS=45\nholdMs={hold}\nreleaseMs={rel}\nendMs={rel + 45_000}\nrestored=1\npgOpenedInHold=2\npgClosedInHold=1\n')
    write(os.path.join(fc, 'frames'), f'{hold + 10_000} {{"ruleId":3,"transition":"OPENED"}}\n{hold + 20_000} {{"ruleId":4,"transition":"CLEARED"}}\n')
    write(os.path.join(fc, 'm0.worker'), worker_metrics(0, 0, 0, 0, rows=0, inserted=100))
    write(os.path.join(fc, 'mmid.worker'), worker_metrics(100, 100, 2, 1, gap_b=5, gap_r=200, rows=600_000, inserted=100))
    write(os.path.join(fc, 'm1.worker'), worker_metrics(200, 200, 3, 2, gap_b=6, gap_r=240, rows=1_000_000, inserted=300))
    write(os.path.join(fc, 'gap.log'), ''.join('x {"event":"alarm_eval_gap","reason":"%s","rows":40}\n' % r for r in ['retry_exhausted'] + ['queue_full'] * 5))
    # 마감
    fn = os.path.join(d, 'final')
    write(os.path.join(fn, 'keys'), '5')
    write(os.path.join(fn, 'judged-rules'), '5')
    write(os.path.join(fn, 'audit-rule-inserts'), '12')  # 기준선 7 + 규칙 5
    write(os.path.join(fn, 'states'), f'== 1\nstate\nNORMAL\n== 2\nstate\nPENDING\nfirst_breach_ts\n{T0 + 9000}\nlast_ts\n{T0 + 9000}\n== 3\nstate\nACTIVE\n== 4\nstate\nNORMAL\n== 5\nstate\nACTIVE\n')
    write(os.path.join(fn, 'events.csv'), A.R.rd(os.path.join(w, 'events.csv')) + '\n' + f'20,5,{ready + 1000},,,ACTIVE\n')
    write(os.path.join(fn, 'eval.tsv'), A.R.rd(os.path.join(w, 'eval.tsv')) + '\n' + f'2\t{T0 + 9000}\t1\n')
    write(os.path.join(fn, 'gap.log'), '')
    return d


class TestRecord(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.root)

    def rec(self, rep=1, **kw):
        d = build_state(os.path.join(self.root, f'r{rep}'), rep=rep, **kw)
        return A.rec(d)

    def test_all_hold(self):
        r = self.rec()
        s = r['judgement']['structure']
        self.assertTrue(r['judgement']['allHold'], s)
        w = r['steady']
        self.assertEqual(w['threeStores']['evalRows'], 40)
        self.assertEqual(w['threeStores']['eventsOpened'], 1)
        self.assertTrue(w['threeStores']['keysEqJudgedRules'])
        self.assertEqual(w['metrics']['evalRowsPerS'], 40)
        self.assertEqual(w['debounceB']['ok'], 1)
        self.assertEqual(w['spikeTier']['maxRunMs'], 0)
        self.assertEqual(r['conditions']['generatorCpuMax'], 55.0)
        self.assertEqual(r['ack']['delayMedianMs'], 12_000)
        self.assertEqual(r['ack']['trials'][0]['boundMs'], 10_000)  # 응답 − 30초 뒤 첫 프레임(응답 − 20초) + 30초 → 응답 + 10초
        self.assertTrue(r['faultPg']['holds'])
        self.assertTrue(r['faultCh']['holds'])
        self.assertEqual(r['final']['belowDebounce']['pendingByLastRow'], [2])
        self.assertTrue(r['final']['completeness']['holds'], r['final']['completeness'])
        self.assertEqual(r['final']['completeness']['excludedEvents'], 1)  # 탐침 열림은 fault-pg 구간
        self.assertEqual(r['final']['eventsByPhase'], {'window': 1, 'faultPg': 1, 'faultCh': 0, 'other': 0})
        self.assertEqual(r['final']['auditRuleInsertsDiff'], 5)
        self.assertTrue(r['final']['rulesViaSurface'])
        self.assertEqual(r['ack']['framesBByTransition'], {'OPENED': 1, 'CLEARED': 1})
        self.assertIsNotNone(r['faultPg']['confirmAfterStartMs'])

    def test_ack_over_bound(self):
        r = self.rec(ack_delay=40_000)
        self.assertFalse(r['ack']['trials'][0]['withinBound'])
        self.assertFalse(r['judgement']['structure']['ack withinBound'])

    def test_fault_pg_frame_during_stop(self):
        r = self.rec(fault_ok=False)
        self.assertEqual(r['faultPg']['framesDuringStop'], 1)
        self.assertFalse(r['faultPg']['holds'])

    def test_spike_event_breaks_below(self):
        r = self.rec(spike_event=True)
        self.assertFalse(r['final']['belowDebounce']['holds'])
        self.assertFalse(r['judgement']['allHold'])

    def test_short_debounce_event(self):
        r = self.rec(b_short=True)
        self.assertEqual(r['steady']['debounceB']['short'], 1)
        self.assertFalse(r['final']['aboveDebounce']['holds'])
        self.assertFalse(r['final']['completeness']['holds'])

    def test_short_open_inside_fault_excluded(self):
        """재검수 낮음1 — 제외 구간(fault-pg) 안의 짧은 열림은 short 판정에서 빼고 따로 센다"""
        d = build_state(os.path.join(self.root, 'fx'))
        fn = os.path.join(d, 'final')
        stopped = T0 + 200_000
        # 규칙 4 — fault-pg 구간 안에서 위반 1행 만에 열린 것처럼 보이는 이벤트(복구 뒤 확정 등)
        write(os.path.join(fn, 'eval.tsv'), A.R.rd(os.path.join(fn, 'eval.tsv')) + f'\n4\t{stopped + 5000}\t0\n4\t{stopped + 6000}\t1\n')
        write(os.path.join(fn, 'events.csv'), A.R.rd(os.path.join(fn, 'events.csv')) + f'\n30,4,{stopped + 6000},{stopped + 9000},,CLEARED\n')
        r = A.rec(d)
        ab = r['final']['aboveDebounce']
        self.assertEqual(ab['excludedEvents'], 1)
        self.assertEqual(ab['debounceExcluded']['short'], 1)
        self.assertEqual(ab['debounce']['short'], 0)
        self.assertTrue(ab['holds'])
        self.assertTrue(r['final']['completeness']['holds'], r['final']['completeness'])

    def test_preexisting_eval_rows(self):
        d = build_state(os.path.join(self.root, 'pre'))
        self.assertIsNone(A.rec(d)['final']['preexistingWarning'])
        write(os.path.join(d, 'kv', 'preexistingEvalRows'), '12')
        f = A.rec(d)['final']
        self.assertEqual(f['preexistingEvalRows'], 12)
        self.assertIn('12', f['preexistingWarning'])

    def test_fault_ch_not_restored(self):
        d = build_state(os.path.join(self.root, 'nr'))
        p = os.path.join(d, 'fault-ch', 'meta')
        write(p, A.R.rd(p).replace('restored=1', 'restored=0'))
        v = A.rec(d)['faultCh']
        self.assertFalse(v['restored'])
        self.assertFalse(v['holds'])

    def test_fault_ch_log_counter_mismatch(self):
        d = build_state(os.path.join(self.root, 'lm'))
        write(os.path.join(d, 'fault-ch', 'gap.log'), 'x {"event":"alarm_eval_gap","reason":"queue_full","rows":40}\n')
        v = A.rec(d)['faultCh']
        self.assertFalse(v['gapLogMatchesCounter'])  # 로그 1 · 계수 6
        self.assertFalse(v['holds'])

    def test_fault_ch_no_open_close_in_hold(self):
        d = build_state(os.path.join(self.root, 'oc'))
        fc = os.path.join(d, 'fault-ch')
        write(os.path.join(fc, 'mmid.worker'), worker_metrics(100, 100, 0, 0, gap_b=5, gap_r=200, rows=600_000, inserted=100))
        v = A.rec(d)['faultCh']
        self.assertEqual((v['metricsHold']['opened'], v['metricsHold']['closed']), (0, 0))
        self.assertFalse(v['holds'])
        # 열림만 있고 닫힘 0이어도 불성립
        write(os.path.join(fc, 'mmid.worker'), worker_metrics(100, 100, 2, 0, gap_b=5, gap_r=200, rows=600_000, inserted=100))
        self.assertFalse(A.rec(d)['faultCh']['holds'])

    def test_fault_pg_windows_use_start_call(self):
        # docker start 호출 뒤 · 준비 전 프레임은 복구 뒤 창 — 정지 중 발행이 아니다
        r = self.rec(frame_after_start=True)
        self.assertEqual(r['faultPg']['framesDuringStop'], 0)
        self.assertTrue(r['faultPg']['holds'])

    def test_fault_pg_due_after_start_call(self):
        d = build_state(os.path.join(self.root, 'due'))
        p = os.path.join(d, 'fault-pg', 'probe-state')
        # 확정 예정 = 첫 위반 + 30초가 docker start 호출 뒤 → 정지 중 확정 시도가 없었다 → 불성립
        write(p, f'== 5\nstate\nPENDING\nfirst_breach_ts\n{T0 + 231_000}\n')
        r = A.rec(d)
        self.assertFalse(r['faultPg']['dueInsideOutage'])
        self.assertFalse(r['faultPg']['holds'])

    def test_audit_diff_without_baseline(self):
        d = build_state(os.path.join(self.root, 'nb'))
        os.remove(os.path.join(d, 'baseline-counts.json'))
        r = A.rec(d)
        self.assertIsNone(r['final']['auditRuleInsertsDiff'])
        self.assertIsNone(r['final']['rulesViaSurface'])
        self.assertIn('rules via surface', r['judgement']['missing'])

    def test_ack_in_progress_trial(self):
        d = build_state(os.path.join(self.root, 'ip'))
        p = os.path.join(d, 'ack', 'ack.json')
        j = json.loads(A.R.rd(p))
        j['trials'].append({'eventId': 30, 'ruleId': 3, 'status': 200, 'clickMs': T0, 'respMs': T0 + 50, 'inProgress': True})
        j['error'] = 'limit 420000 ms'
        write(p, json.dumps(j))
        r = A.rec(d)
        t = r['ack']['trials'][-1]
        self.assertIsNone(t['delayMs'])
        self.assertIsNone(t['withinBound'])
        self.assertEqual(r['ack']['error'], 'limit 420000 ms')

    def test_table(self):
        rows = [self.rec(rep=i) for i in (1, 2, 3)]
        t = A.table(rows)
        self.assertTrue(t['structureAllRuns'])
        self.assertEqual(t['reps'], [1, 2, 3])
        m = {x['metric']: x for x in t['results']}
        self.assertEqual(m['evalRowsPerS']['median'], 40)
        self.assertEqual(m['evalRowsPerS']['deviation'], 0)
        self.assertFalse(m['ackPropagationMedianMs']['discardEligible'])
        self.assertFalse(m['handoffWaitP50']['discardEligible'])
        self.assertIn('첫 칸', m['handoffWaitP50']['nonDiscardReason'])
        self.assertFalse(t['repeat']['discard'])

    def test_table_deviation_and_structure_fail(self):
        rows = [self.rec(rep=1), self.rec(rep=2, ev_rate=60), self.rec(rep=3, spike_event=True)]
        t = A.table(rows)
        self.assertFalse(t['structureAllRuns'])
        self.assertTrue(t['repeat']['discard'])  # 처리량 40 · 60 · 40 → 편차 0.5
        self.assertAlmostEqual(t['repeat']['deviation'], 0.5)

    def test_table_condition_mismatch(self):
        rows = [self.rec(rep=i) for i in (1, 2, 3)]
        rows[2]['commit'] = 'zzz'
        with self.assertRaises(SystemExit):
            A.table(rows)
        rows[2]['commit'] = 'abc1234'
        rows[1]['rep'] = 1
        with self.assertRaises(SystemExit):
            A.table(rows)

    def test_table_too_few(self):
        t = A.table([self.rec(rep=1), self.rec(rep=2)])
        self.assertTrue(t['repeat']['discard'])
        self.assertFalse(t['structureAllRuns'])

    def test_missing_parts(self):
        d = build_state(os.path.join(self.root, 'm'))
        shutil.rmtree(os.path.join(d, 'ack'))
        shutil.rmtree(os.path.join(d, 'fault-ch'))
        r = A.rec(d)
        self.assertIsNone(r['ack'])
        self.assertIn('ack withinBound', r['judgement']['missing'])
        self.assertIn('AC-36 alarm_eval-fail', r['judgement']['missing'])
        self.assertFalse(r['judgement']['allHold'])


if __name__ == '__main__':
    unittest.main()
