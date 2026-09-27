"""oltp.py 단위 테스트 — 요약(3회 중앙값 · 편차 · 구조 지표 3회 전부 · 포화 반복 제외 · 재실행 덮기) · 인자 합치기 · 규모 파싱 · run 거부 조건.

표준 라이브러리 unittest만 쓴다. 저장소를 부르는 함수(chq · pgq · executor · lab_dbs_present)와 출력(emit)은 가짜로 바꾼다.
import 부작용: oltp.py는 import 때 OLTP_DIR 환경변수로 경로만 정하고 파일을 쓰거나 저장소에 접속하지 않는다 —
그래도 import 전에 OLTP_DIR을 임시 디렉터리로 두고, 테스트마다 oltp.OLTP_DIR · oltp.STATE를 바꾼다.
실행: PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/lab/s5/oltp/test_oltp.py
"""
from __future__ import annotations

import atexit
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
_IMPORT_DIR = tempfile.mkdtemp(prefix='oltp-test-import-')
atexit.register(shutil.rmtree, _IMPORT_DIR, True)
with mock.patch.dict(os.environ, {'OLTP_DIR': _IMPORT_DIR}):
    _spec = importlib.util.spec_from_file_location('oltp_under_test', HERE / 'oltp.py')
    oltp = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(oltp)


def m(metric: str, value, rep: int, **kw) -> dict:
    base = {'kind': 'measure', 'exp': 'EXP-40', 'op': 'update', 'store': 'clickhouse', 'variant': 'ch_lwu', 'scale': 10000,
            'concurrency': 1, 'rate': None, 'read': None, 'metric': metric, 'unit': 'ms', 'value': value, 'rep': rep}
    return {**base, **kw}


class SummarizeTest(unittest.TestCase):
    def test_median_and_spread(self) -> None:
        rows = oltp.summarize([m('update_latency_p50', v, r) for r, v in enumerate([1.0, 1.1, 0.9])])
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertEqual(r['values'], [1.0, 1.1, 0.9])
        self.assertEqual(r['median'], 1.0)
        self.assertAlmostEqual(r['spread'], 0.2)
        self.assertNotIn('spreadExceeded', r)   # 기준은 초과만(20% 경계는 통과)

    def test_spread_exceeded(self) -> None:
        r = oltp.summarize([m('update_latency_p50', v, i) for i, v in enumerate([1.0, 2.0, 1.5])])[0]
        self.assertTrue(r['spreadExceeded'])

    def test_structural_has_no_median(self) -> None:
        rows = oltp.summarize([m('partial_apply_count', v, i, structural=True, unit='count', exp='EXP-42', op='atomic')
                               for i, v in enumerate([0, 0, 3])])
        r = rows[0]
        self.assertTrue(r['structural'])
        self.assertIsNone(r['median'])          # 0 · 0 · 3의 중앙값 0이 3건을 숨기지 않게(04_experiment_protocol A형)
        self.assertEqual(r['values'], [0, 0, 3])

    def test_bool_unit_not_summarized_as_distribution(self) -> None:
        # 옛 원시의 converged(unit bool) 행 — 분포(중앙값 · 편차)로 요약하지 않고 3회 전부(N1)
        rows = oltp.summarize([m('converged', v, i, unit='bool', read='after_wait') for i, v in enumerate([1, 0, 1])])
        r = rows[0]
        self.assertTrue(r['structural'])
        self.assertIsNone(r['median'])
        self.assertNotIn('spread', r)
        self.assertEqual(r['values'], [1, 0, 1])

    def test_missing_rep_is_null(self) -> None:
        r = oltp.summarize([m('update_latency_p50', 1.0, 0), m('update_latency_p50', 2.0, 2)])[0]
        self.assertEqual(r['values'], [1.0, None, 2.0])
        self.assertEqual(r['median'], 1.5)
        self.assertIsNone(r['spread'])          # 3회가 모이기 전에는 편차를 내지 않는다

    def test_rerun_overrides_same_rep(self) -> None:
        r = oltp.summarize([m('update_latency_p50', 9.0, 0), m('update_latency_p50', 1.0, 0),
                            m('update_latency_p50', 1.0, 1), m('update_latency_p50', 1.0, 2)])[0]
        self.assertEqual(r['values'], [1.0, 1.0, 1.0])

    def test_groups_split_by_read_and_variant(self) -> None:
        ms = [m('visible_after_ack_p50', 1.0, 0, read='on_fly_0'), m('visible_after_ack_p50', 2.0, 0, read='on_fly_1'),
              m('visible_after_ack_p50', 3.0, 0, variant='pg', store='postgresql', read='default')]
        self.assertEqual(len(oltp.summarize(ms)), 3)

    def test_saturated_rep_excluded(self) -> None:
        kw = {'exp': 'EXP-41', 'op': 'point', 'variant': 'pg', 'store': 'postgresql', 'concurrency': 32}
        ms = [m('latency_p50', v, i, **kw) for i, v in enumerate([1.0, 5.0, 1.2])]
        ms += [m('tool_cpu', c, i, unit='ratio', **kw) for i, c in enumerate([0.3, 0.95, 0.3])]
        lat = next(r for r in oltp.summarize(ms) if r['metric'] == 'latency_p50')
        self.assertEqual(lat['saturatedReps'], [1])
        self.assertEqual(lat['median'], 1.1)

    def test_spread_zero_median(self) -> None:
        self.assertEqual(oltp.spread([0, 0, 0]), 0.0)
        self.assertIsNone(oltp.spread([0, 0, 1]))
        self.assertIsNone(oltp.spread([1.0]))


class ArgsTest(unittest.TestCase):
    def test_run_args_caller_wins(self) -> None:
        a = oltp.run_args('exp40', 'ch_lwu', ['--n', '10'])
        self.assertEqual(a[:2], ['--n', '10'])
        self.assertEqual(a.count('--n'), 1)
        self.assertIn('--poll-max', a)

    def test_run_args_variant_specific(self) -> None:
        a = oltp.run_args('exp40', 'ch_rmt', [])
        self.assertEqual(a[a.index('--poll-max') + 1], '200')
        b = oltp.run_args('exp44', 'pg', ['--rate', '50'])
        self.assertEqual(b[b.index('--duration') + 1], '60')

    def test_exp40_sample_defaults(self) -> None:
        # 기록 040 폐기 뒤(2026-09-27) — R2 50회 · 예열 1회 · N 300(ch_rmt는 폴링 예산 때문에 N 50 그대로 · R2 · 예열은 같다)
        a = oltp.run_args('exp40', 'pg', [])
        self.assertEqual((a[a.index('--n') + 1], a[a.index('--r2-repeat') + 1], a[a.index('--read-warmup') + 1]), ('300', '50', '1'))
        b = oltp.run_args('exp40', 'ch_rmt', [])
        self.assertEqual((b[b.index('--n') + 1], b[b.index('--r2-repeat') + 1], b[b.index('--read-warmup') + 1]), ('50', '50', '1'))
        for v in ('ch_alter_async', 'ch_alter_sync', 'ch_lwu'):   # PostgreSQL과 같은 표본(공정성 규칙 1)
            c = oltp.run_args('exp40', v, [])
            self.assertEqual(c[c.index('--n') + 1], '300')
            self.assertEqual(c[c.index('--r2-repeat') + 1], '50')

    def test_exp41_queries_by_concurrency(self) -> None:
        # c8 · c32는 2만 건(측정 창 약 1초) · c1은 2,000 그대로 · 두 저장소 같은 값 · 호출자 인자가 이긴다
        for v in ('pg', 'ch_g8192', 'ch_g256'):
            for conc, q in ((1, '2000'), (8, '20000'), (32, '20000')):
                a = oltp.run_args('exp41', v, ['--concurrency', str(conc)], conc)
                self.assertEqual((a[a.index('--queries') + 1], a[a.index('--warmup') + 1]), (q, q))
                self.assertEqual(a.count('--queries'), 1)
                self.assertEqual(a[a.index('--explain-sample') + 1], '20')
        b = oltp.run_args('exp41', 'pg', ['--concurrency', '8', '--queries', '500'], 8)
        self.assertEqual(b[b.index('--queries') + 1], '500')
        self.assertEqual(b.count('--queries'), 1)
        self.assertEqual(b[b.index('--warmup') + 1], '20000')

    def test_memory_source(self) -> None:
        r = oltp.with_memory_source({'commitHash': 'abc', 'memoryLimitMb': None})
        self.assertIsNone(r['memoryLimitMb'])                        # 값은 null 그대로(추정 채움 금지)
        self.assertIn('cgroup max', r['memoryLimitSource'])
        self.assertIn('oltp-lab', r['memoryLimitSource'])
        self.assertNotIn('memoryLimitSource', oltp.with_memory_source({'memoryLimitMb': 2048}))   # 상한이 있으면 붙이지 않는다
        self.assertIsNone(oltp.with_memory_source(None))
        self.assertNotIn('memoryLimitSource', oltp.with_memory_source({'commitHash': 'abc'}))   # 키가 없으면 붙이지 않는다(r-oltp3 4)
        self.assertEqual(oltp.with_run_source({'kind': 'settle'}), {'kind': 'settle'})

    def test_parse_scale(self) -> None:
        self.assertEqual(oltp.parse_scale('100_000'), 100_000)
        with self.assertRaises(SystemExit):
            oltp.parse_scale('1000')

    def test_resources(self) -> None:
        ok = {'clickhouse': {'cpuset': '5-7', 'memBytes': 3584 * 2**20}, 'postgres': {'cpuset': '8-10', 'memBytes': 3584 * 2**20}}
        self.assertEqual(oltp.control_resources_ok(ok), [])
        bad = {**ok, 'postgres': {'cpuset': '9-10', 'memBytes': 2 * 2**30}}
        self.assertEqual(len(oltp.control_resources_ok(bad)), 1)


class RunGuardTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix='oltp-test-')
        self.dir = Path(self._tmp.name)
        self.emitted: list[dict] = []
        self.calls: list[list[str]] = []
        for p in [mock.patch.object(oltp, 'OLTP_DIR', self.dir), mock.patch.object(oltp, 'STATE', self.dir / 'state.json'),
                  mock.patch.object(oltp, 'emit', lambda line: self.emitted.append(line)),
                  mock.patch.object(oltp, 'guard_clean_schema', lambda: None),
                  mock.patch.object(oltp, 'git_head', lambda: {'commitHash': 'abc', 'dirty': False}),
                  mock.patch.object(oltp, 'pg_state', lambda: {'tables': {'work_order': {'deadTup': 7}}, 'walBytes': 1}),
                  mock.patch.object(oltp, 'executor', self.fake_executor)]:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self._tmp.cleanup)
        oltp.save_state({'seed': 42, 'inProgress': 0.5, 'scales': {'10000': {'filled': True, 'chDirty': False}}, 'runs': {}})

    def fake_executor(self, args: list[str], timeout: int = 0):
        self.calls.append(args)
        return ([{'kind': 'measure', 'metric': 'x', 'value': 1, 'unit': 'ms', 'read': None, 'rep': 0},
                 {'kind': 'detail', 'runId': 'r1'}], 0, 1.0)

    def test_needs_filled(self) -> None:
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp40', 'pg', '100000', '0'])

    def test_marks_ch_dirty_and_blocks_next_exp40(self) -> None:
        oltp.cmd_run(['exp42', 'ch_lwu', '10000', '0', '--update-parallel-mode', 'auto'])
        self.assertTrue(oltp.load_state()['scales']['10000']['chDirty'])
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp40', 'ch_lwu', '10000', '0'])
        oltp.cmd_run(['exp40', 'pg', '10000', '0'])          # PostgreSQL 변형은 ClickHouse 상태와 무관

    def test_detail_run_carries_memory_source(self) -> None:
        with mock.patch.object(oltp, 'executor', lambda args, timeout=0: (
                [{'kind': 'detail', 'runId': 'r1', 'run': {'commitHash': 'abc', 'memoryLimitMb': None, 'capacityTier': '해당 없음'}}], 0, 1.0)):
            oltp.cmd_run(['exp40', 'pg', '10000', '0'])
        det = [e for e in self.emitted if e.get('kind') == 'detail'][-1]
        self.assertEqual(det['run']['memoryLimitSource'], oltp.MEMORY_LIMIT_SOURCE)
        self.assertIsNone(det['run']['memoryLimitMb'])

    def test_collect_run_carries_memory_source(self) -> None:
        oltp.save_state({**oltp.load_state(), 'run': {'commitHash': 'abc', 'memoryProfile': 'load', 'memoryLimitMb': None}})
        with mock.patch.dict(os.environ, {'OUT': str(self.dir / 'raw.jsonl')}):
            (self.dir / 'raw.jsonl').write_text(json.dumps(m('update_latency_p50', 1.0, 0)) + '\n')
            oltp.cmd_collect([])
        out = json.loads((self.dir / 'oltp-summary.json').read_text())
        self.assertEqual(out['run']['memoryLimitSource'], oltp.MEMORY_LIMIT_SOURCE)
        self.assertEqual(out['run']['capacityTier'], '해당 없음')

    def test_collect_event_loop_recorded_not_judged(self) -> None:
        kw = {'exp': 'EXP-41', 'op': 'point', 'variant': 'pg', 'store': 'postgresql', 'concurrency': 32}
        lines = [m('latency_p50', v, i, **kw) for i, v in enumerate([1.0, 1.05, 1.1])]
        lines += [{'kind': 'detail', 'key': f'exp41:pg:10000:c32:r-:{i}', 'exp': 'EXP-41', 'variant': 'pg', 'scale': 10000,
                   'concurrency': 32, 'rep': i, 'detail': {'eventLoop': {'utilization': u}}} for i, u in enumerate([0.95, 0.5, 0.97])]
        with mock.patch.dict(os.environ, {'OUT': str(self.dir / 'raw.jsonl')}):
            (self.dir / 'raw.jsonl').write_text(''.join(json.dumps(x) + '\n' for x in lines))
            oltp.cmd_collect([])
        out = json.loads((self.dir / 'oltp-summary.json').read_text())
        te = out['toolEventLoop']
        self.assertFalse(te['appliedToJudgement'])
        self.assertEqual(te['aboveCandidate'], 2)
        self.assertEqual([r['utilization'] for r in te['rows']], [0.95, 0.5, 0.97])
        lat = next(r for r in out['reverse'] if r['metric'] == 'latency_p50')
        self.assertNotIn('saturatedReps', lat)          # 판정(포화 창 제외)에는 아직 쓰지 않는다
        self.assertEqual(lat['median'], 1.05)

    def test_exp41_concurrency_required_and_passed(self) -> None:
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp41', 'pg', '10000', '0'])
        oltp.cmd_run(['exp41', 'pg', '10000', '0', '--concurrency', '8'])
        a = self.calls[-1]
        self.assertEqual(a[0], 'exp41')
        self.assertEqual(a[a.index('--concurrency') + 1], '8')
        self.assertEqual(a[a.index('--seed') + 1], '42')

    def test_rerun_refused(self) -> None:
        oltp.cmd_run(['exp43', 'pg', '10000', '1'])
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp43', 'pg', '10000', '1'])
        keys = json.loads((self.dir / 'state.json').read_text())['runs']
        self.assertIn('exp43:pg:10000:c-:r-:1', keys)

    def test_exp42_ch_needs_arm_and_key_has_it(self) -> None:
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp42', 'ch_lwu', '10000', '0'])
        oltp.cmd_run(['exp42', 'ch_lwu', '10000', '0', '--update-parallel-mode', 'sync'])
        oltp.cmd_run(['exp42', 'ch_lwu', '10000', '0', '--update-parallel-mode', 'auto'])   # 두 팔은 다른 key
        keys = oltp.load_state()['runs']
        self.assertIn('exp42:ch_lwu:sync:10000:c-:r-:0', keys)
        self.assertIn('exp42:ch_lwu:auto:10000:c-:r-:0', keys)
        oltp.cmd_run(['exp42', 'pg', '10000', '0'])   # PostgreSQL은 팔 없음

    def test_dedup_variant_defaults(self) -> None:
        oltp.cmd_run(['exp43', 'ch_mt_dedup', '10000', '0'])
        a = self.calls[-1]
        self.assertEqual(a[a.index('--dedup-window') + 1], '100')

    def test_exp44_same_connections_both_stores(self) -> None:
        for v in ('pg', 'ch_sync'):
            oltp.cmd_run(['exp44', v, '10000', '0', '--rate', '50'])
            a = self.calls[-1]
            self.assertEqual((a[a.index('--concurrency') + 1], a[a.index('--inflight') + 1]), ('16', '64'))

    def test_collect_conditions_capacity_tier(self) -> None:
        with mock.patch.dict(os.environ, {'OUT': str(self.dir / 'raw.jsonl')}):
            (self.dir / 'raw.jsonl').write_text(json.dumps(m('update_latency_p50', 1.0, 0)) + '\n')
            oltp.cmd_collect([])
        out = json.loads((self.dir / 'oltp-summary.json').read_text())
        self.assertEqual(out['run']['capacityTier'], '해당 없음')
        self.assertEqual(out['conditions']['capacityTier'], '해당 없음')

    def test_converge_both_and_budget_passed(self) -> None:
        for v in ('ch_lwu', 'ch_rmt'):
            oltp.cmd_run(['exp40', v, '10000', '0'])
            a = self.calls[-1]
            self.assertEqual(a[a.index('--converge') + 1], 'both')        # 한 호출에 두 라벨(M1)
            self.assertEqual(int(a[a.index('--budget-sec') + 1]), oltp.EXP40_BUDGET_SEC)
            oltp.save_state({**oltp.load_state(), 'scales': {'10000': {'filled': True, 'chDirty': False}}})
        oltp.cmd_run(['exp43', 'ch_rmt', '10000', '0'])
        a = self.calls[-1]
        self.assertEqual(a[a.index('--converge') + 1], 'both')
        det = [e for e in self.emitted if e.get('kind') == 'detail']
        self.assertEqual(det[0]['budgetCheck']['ok'], True)
        self.assertLessEqual(oltp.EXP40_BUDGET_SEC + oltp.CONTAINER_OVERHEAD_SEC, oltp.CALL_LIMIT_SEC)

    def test_budget_over_call_limit_refused(self) -> None:
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp40', 'pg', '10000', '0', '--budget-sec', str(oltp.CALL_LIMIT_SEC)])
        self.assertEqual(self.calls, [])

    def test_pg_dirty_warns_and_records(self) -> None:
        oltp.cmd_run(['exp40', 'pg', '10000', '0'])
        first = [e for e in self.emitted if e.get('kind') == 'detail'][-1]['pgDirty']
        self.assertFalse(first['dirty'])
        self.assertEqual(first['state']['tables']['work_order']['deadTup'], 7)
        with mock.patch('sys.stderr') as err:
            oltp.cmd_run(['exp42', 'pg', '10000', '0'])      # 앞 PostgreSQL 실행 위 — 막지 않고 경고 + 기록
        second = [e for e in self.emitted if e.get('kind') == 'detail'][-1]['pgDirty']
        self.assertTrue(second['dirty'])
        self.assertEqual(second['by'], 'exp40:pg:10000:c-:r-:0')
        self.assertIn('경고', ''.join(c.args[0] for c in err.write.call_args_list))
        # ClickHouse 변형은 PostgreSQL 상태를 읽지 않는다
        oltp.cmd_run(['exp42', 'ch_lwu', '10000', '0', '--update-parallel-mode', 'auto'])
        self.assertIsNone([e for e in self.emitted if e.get('kind') == 'detail'][-1]['pgDirty'])

    def test_bad_variant(self) -> None:
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp44', 'ch_lwu', '10000', '0', '--rate', '50'])
        with self.assertRaises(SystemExit):
            oltp.cmd_run(['exp44', 'ch_sync', '10000', '0', '--rate', '75'])


class AdoptTest(unittest.TestCase):
    """adopt — 앞 실행의 채움 스냅샷을 재측정의 채움으로(스키마 · 채움 경로 불변 · 복원 뒤 실행기 verify 내용 대조)."""

    FP_OK = {'kind': 'verify', 'match': True, 'run': {'memoryLimitMb': None}}

    def fake_executor(self, args: list[str], timeout: int = 0):
        self.exec_calls.append(args)
        if args[0] == 'verify':
            return [self.fp], (0 if self.fp.get('match') else 2), 1.0
        return [{'kind': 'settle', 'converged': True}], 0, 1.0

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix='oltp-adopt-')
        self.dir = Path(self._tmp.name)
        self.emitted: list[dict] = []
        self.ran: list[list[str]] = []
        self.changed: list[str] = []
        self.fp = dict(self.FP_OK)
        self.exec_calls: list[list[str]] = []
        for p in [mock.patch.object(oltp, 'OLTP_DIR', self.dir), mock.patch.object(oltp, 'STATE', self.dir / 'state.json'),
                  mock.patch.object(oltp, 'emit', lambda line: self.emitted.append(line)),
                  mock.patch.object(oltp, 'guard_clean_schema', lambda: None),
                  mock.patch.object(oltp, 'snapshot_commit', lambda name: '19f8861'),
                  mock.patch.object(oltp, 'fill_inputs_changed', lambda commit: self.changed),
                  mock.patch.object(oltp, 'pg_vacuum_analyze', lambda: 0.1),
                  mock.patch.object(oltp, 'run', lambda cmd, **kw: self.ran.append(cmd)),
                  mock.patch.object(oltp, 'executor', self.fake_executor)]:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self._tmp.cleanup)
        oltp.save_state({'seed': 42, 'inProgress': 0.5, 'scales': {}, 'runs': {}})

    def test_adopt_marks_filled(self) -> None:
        oltp.cmd_adopt(['10000', 'oltp-s10000-19f8861'])
        s = oltp.load_state()['scales']['10000']
        self.assertTrue(s['filled'])
        self.assertEqual(s['snapshot'], 'oltp-s10000-19f8861')        # reset all이 이 스냅샷으로 복원한다
        self.assertEqual(s['adoptedFrom']['commit'], '19f8861')
        self.assertEqual(self.ran, [['task', 'restore', 'NAME=oltp-s10000-19f8861']])
        self.assertEqual(self.exec_calls[0][:3], ['verify', '--scale', '10000'])          # 복원 뒤 내용 대조 → settle
        self.assertEqual(self.exec_calls[0][self.exec_calls[0].index('--seed') + 1], '42')
        self.assertEqual(self.exec_calls[1][0], 'settle')
        self.assertTrue(self.emitted[-1]['ok'])
        self.assertIn('memoryLimitSource', self.emitted[-1]['verify']['run'])

    def test_adopt_refused_when_fill_inputs_changed(self) -> None:
        self.changed = ['infra/clickhouse/ddl/009_business_control.sql']
        with self.assertRaises(SystemExit):
            oltp.cmd_adopt(['10000', 'oltp-s10000-19f8861'])
        self.assertEqual(self.ran, [])                                  # 복원 전에 멈춘다
        self.assertNotIn('10000', {k for k, v in oltp.load_state()['scales'].items() if v.get('filled')})

    def test_adopt_mismatch_not_filled(self) -> None:
        self.fp = {'kind': 'verify', 'match': False}
        with self.assertRaises(SystemExit):
            oltp.cmd_adopt(['10000', 'oltp-s10000-19f8861'])
        self.assertFalse(self.emitted[-1]['ok'])
        self.assertEqual([c[0] for c in self.exec_calls], ['verify'])                   # 어긋나면 settle 전에 멈춘다
        self.assertFalse(oltp.load_state()['scales'].get('10000', {}).get('filled'))

    def test_rows_not_path_guarded(self) -> None:
        # 행 벡터 파일은 경로가 아니라 verify 내용 대조로 본다(대상 창 개정이 스냅샷 재사용을 막지 않게)
        self.assertNotIn('apps/api/src/modules/datagen/oltp-lab/oltp-rows.ts', oltp.FILL_INPUTS)
        self.assertIn('infra/clickhouse/ddl', oltp.FILL_INPUTS)

    def test_force_readopt_mismatch_leaves_state_unfilled(self) -> None:
        # 채움이 있던 규모를 FORCE로 다시 adopt — 복원은 됐는데 verify가 어긋나면 state가 옛 채움을 믿지 않는다(r-oltp3 2)
        oltp.save_state({**oltp.load_state(), 'scales': {'10000': {'filled': True, 'snapshot': 'old', 'chDirty': False, 'pgDirty': False}}})
        self.fp = {'kind': 'verify', 'match': False, 'reasons': ['logs.pgProductionLog']}
        with mock.patch.dict(os.environ, {'FORCE': '1'}), self.assertRaises(SystemExit):
            oltp.cmd_adopt(['10000', 'oltp-s10000-19f8861'])
        s = oltp.load_state()['scales']['10000']
        self.assertFalse(s['filled'])
        self.assertTrue(s['chDirty'] and s['pgDirty'])
        self.assertEqual(s['adoptPending'], 'oltp-s10000-19f8861')
        self.assertEqual(self.ran, [['task', 'restore', 'NAME=oltp-s10000-19f8861']])
        with self.assertRaises(SystemExit):                              # 채움 없음이라 run이 막힌다
            oltp.cmd_run(['exp40', 'pg', '10000', '0'])

    def test_adopt_success_clears_pending(self) -> None:
        oltp.cmd_adopt(['10000', 'oltp-s10000-19f8861'])
        s = oltp.load_state()['scales']['10000']
        self.assertNotIn('adoptPending', s)
        self.assertFalse(s['chDirty'] or s['pgDirty'])

    def test_adopt_refused_when_already_filled(self) -> None:
        oltp.save_state({**oltp.load_state(), 'scales': {'10000': {'filled': True, 'snapshot': 'x'}}})
        with self.assertRaises(SystemExit):
            oltp.cmd_adopt(['10000', 'oltp-s10000-19f8861'])
        self.assertEqual(self.ran, [])


class ExecutorSalvageTest(unittest.TestCase):
    """실행기 한도 초과 · 실패 — 받은 줄을 원시에 남기고 멈춘다(원시 소실 금지 · M3)."""

    def setUp(self) -> None:
        self.emitted: list[dict] = []
        for p in [mock.patch.object(oltp, 'emit', lambda line: self.emitted.append(line)),
                  mock.patch.object(oltp, 'compose_cmd', lambda: ['docker', 'compose'])]:
            p.start()
            self.addCleanup(p.stop)

    def test_timeout_keeps_partial(self) -> None:
        exc = oltp.subprocess.TimeoutExpired(['x'], 5, output=b'{"kind":"measure","metric":"a"}\nnoise\n')
        with mock.patch.object(oltp, 'run', side_effect=exc), self.assertRaises(SystemExit):
            oltp.executor(['exp40'], timeout=5)
        self.assertEqual(self.emitted[0]['kind'], 'executor_timeout')
        self.assertEqual(self.emitted[0]['partial'], [{'kind': 'measure', 'metric': 'a'}])
        self.assertEqual(self.emitted[0]['skippedLines'], 0)

    def test_timeout_keeps_lines_around_truncated(self) -> None:
        # 한도에 끊긴 줄(잘린 JSON)이 앞의 온전한 줄까지 버리게 하지 않는다 — 건너뛰고 수를 센다(N4)
        out = b'{"kind":"measure","metric":"a"}\n{"kind":"measure","met\n{"kind":"measure","metric":"b"}\n{"kind":"mea'
        exc = oltp.subprocess.TimeoutExpired(['x'], 5, output=out)
        with mock.patch.object(oltp, 'run', side_effect=exc), self.assertRaises(SystemExit):
            oltp.executor(['exp40'], timeout=5)
        e = self.emitted[0]
        self.assertEqual([x['metric'] for x in e['partial']], ['a', 'b'])
        self.assertEqual(e['skippedLines'], 2)

    def test_failure_recorded(self) -> None:
        cp = oltp.subprocess.CompletedProcess(['x'], 1, stdout='', stderr='boom')
        with mock.patch.object(oltp, 'run', return_value=cp), mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            oltp.executor(['exp40'])
        self.assertEqual(self.emitted[0]['kind'], 'executor_failed')
        self.assertEqual(self.emitted[0]['stderrTail'], 'boom')


if __name__ == '__main__':
    unittest.main()
