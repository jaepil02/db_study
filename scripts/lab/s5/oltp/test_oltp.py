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
