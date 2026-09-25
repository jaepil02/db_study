"""grid.py 단위 테스트 — match 판정(avg 상계식 · count 정확 · Q4 롤업 대조) · budget 적재 시간 추정.

표준 라이브러리 unittest만 쓴다. 저장소를 부르는 함수(chq · pgq · run · ch_parts_totals)와 출력(emit)은 가짜로 바꾼다.
import 부작용: grid.py는 import 때 GRID_DIR 환경변수(기본 snapshots/lab-s5-grid)로 경로만 정하고 파일을 쓰거나 저장소에 접속하지 않는다.
그래도 테스트가 저장소 상태 디렉터리를 건드리지 않게 import 전에 GRID_DIR을 임시 디렉터리로 두고, 테스트마다 grid.GRID_DIR · grid.STATE를 바꾼다.
실행: PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/lab/s5/grid/test_grid.py
"""
from __future__ import annotations

import atexit
import datetime as dt
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
_IMPORT_DIR = tempfile.mkdtemp(prefix='grid-test-import-')
atexit.register(shutil.rmtree, _IMPORT_DIR, True)
with mock.patch.dict(os.environ, {'GRID_DIR': _IMPORT_DIR}):
    _spec = importlib.util.spec_from_file_location('grid_under_test', HERE / 'grid.py')
    grid = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(grid)

UTC = dt.timezone.utc


class GridDirCase(unittest.TestCase):
    """GRID_DIR을 테스트마다 새 임시 디렉터리로 · emit은 받아 적기만 한다."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix='grid-test-')
        self.dir = Path(self._tmp.name)
        self.emitted: list[dict] = []
        patches = [
            mock.patch.object(grid, 'GRID_DIR', self.dir),
            mock.patch.object(grid, 'STATE', self.dir / 'state.json'),
            mock.patch.object(grid, 'emit', lambda line, default_out='grid.jsonl': self.emitted.append(line)),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self._tmp.cleanup)

    def write_state(self, st: dict) -> None:
        (self.dir / 'state.json').write_text(json.dumps(st))


# ───────────────────────── 순수 도우미 ─────────────────────────

class TsAndGammaTest(unittest.TestCase):
    def test_ts_ms_offsets(self) -> None:
        base = int(dt.datetime(2026, 9, 26, 5, 0, tzinfo=UTC).timestamp()) * 1000   # 14:00 KST
        self.assertEqual(grid.ts_ms('2026-09-26 14:00:00'), base)                  # 시간대 없음 = KST(ClickHouse TSV)
        self.assertEqual(grid.ts_ms('2026-09-26 14:00:00+09'), base)               # PostgreSQL timestamptz
        self.assertEqual(grid.ts_ms('2026-09-26 14:00:00.5+09'), base + 500)
        self.assertEqual(grid.ts_ms('2026-09-26 14:00:00.123456+09:00'), base + 123)
        self.assertEqual(grid.ts_ms('2026-09-26 05:00:00+00'), base)
        self.assertEqual(grid.ts_ms('2026-09-26 10:30:00+0530'), base)

    def test_ts_ms_rejects_other_shapes(self) -> None:
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.ts_ms('2026-09-26T14:00:00Z')

    def test_gamma(self) -> None:
        u = 2.0 ** -53
        self.assertEqual(grid.gamma(0), 0.0)
        self.assertAlmostEqual(grid.gamma(3600) / (3600 * u), 1.0, places=9)


# ───────────────────────── match ─────────────────────────

END = '2026-09-26T05:00:00.000Z'   # 14:00 KST


def tsv(rows: list[list]) -> str:
    return ''.join('\t'.join(str(x) for x in r) + '\n' for r in rows)


class MatchTest(GridDirCase):
    STAGE = 2

    def setUp(self) -> None:
        super().setUp()
        self.write_state({'end': END, 'params': {'device': 7, 'tag': 1401, 'v': 12.5},
                          'stages': {str(self.STAGE): {'rows': 1_000_000}}})
        self.aux = ''
        self.rollup = ''
        self.chq_calls: list[tuple[str, dict]] = []

        def fake_chq(sql: str, params: dict | None = None, fmt: str = 'TSV', extra=None) -> str:
            self.chq_calls.append((sql, params or {}))
            if sql == grid.CH_ROLLUP_Q4:
                return self.rollup
            if sql in grid.CH_AUX.values():
                return self.aux
            raise AssertionError(f'예상 밖 조회: {sql[:60]}')
        p = mock.patch.object(grid, 'chq', fake_chq)
        p.start()
        self.addCleanup(p.stop)

    def put(self, q: str, ch: list[list], pg: list[list]) -> None:
        for store, rows in (('clickhouse', ch), ('postgresql', pg)):
            f = grid.result_file(self.STAGE, q, store)
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(tsv(rows))

    def match(self, q: str) -> dict:
        grid.cmd_match([str(self.STAGE), q])
        saved = json.loads((self.dir / 'match' / f's{self.STAGE}-{q}.json').read_text())
        self.assertEqual(self.emitted[-1]['resultMatch'], saved['resultMatch'])
        self.assertEqual(self.emitted[-1]['rows'], 1_000_000)
        return saved

    # Q2: 키(시 버킷) 뒤 avg · min · max · count / aux: 키 · n · S=Σ|v|
    N, S = 3600, 3600 * 100.0          # 평균 절대값 100 → 상계 2·γ(n)·S/n ≈ 8.0e-11

    def bound(self) -> float:
        return 2 * grid.gamma(self.N) * self.S / self.N

    def q2(self, pg_avg: float, *, pg_min: str = '-5', pg_max: str = '105', pg_count: int | None = None,
           aux_n: int | None = None) -> dict:
        self.aux = tsv([['2026-09-26 13:00:00', aux_n or self.N, self.S]])
        self.put('Q2', [['2026-09-26 13:00:00', repr(100.0), '-5', '105', self.N]],
                 [['2026-09-26 13:00:00+09', repr(pg_avg), pg_min, pg_max, pg_count or self.N]])
        return self.match('Q2')

    def test_avg_inside_bound_matches(self) -> None:
        r = self.q2(100.0 + self.bound() * 0.5)
        self.assertTrue(r['resultMatch'])
        self.assertEqual(r['mismatchGroups'], 0)
        self.assertGreater(r['maxAvgDiffOverBound'], 0.0)
        self.assertLessEqual(r['maxAvgDiffOverBound'], 1.0)
        # 보조 조회는 CH_AUX[Q2]를 상태의 params · end(KST 문자열)로 부른다
        sql, params = self.chq_calls[0]
        self.assertEqual(sql, grid.CH_AUX['Q2'])
        self.assertEqual(params, {'device': 7, 'tag': 1401, 'end': '2026-09-26 14:00:00.000'})

    def test_avg_outside_bound_mismatches(self) -> None:
        r = self.q2(100.0 + self.bound() * 4)
        self.assertFalse(r['resultMatch'])
        self.assertEqual(r['mismatchGroups'], 1)
        self.assertGreater(r['maxAvgDiffOverBound'], 1.0)

    def test_identical_avg_is_zero_over_bound(self) -> None:
        r = self.q2(100.0)
        self.assertTrue(r['resultMatch'])
        self.assertEqual(r['maxAvgDiffOverBound'], 0.0)

    def test_count_must_be_exact_and_equal_aux_n(self) -> None:
        self.assertFalse(self.q2(100.0, pg_count=self.N - 1)['resultMatch'])     # 두 저장소 count가 다르다
        self.assertFalse(self.q2(100.0, aux_n=self.N + 1)['resultMatch'])        # 둘은 같지만 tag_raw 원시 n과 다르다

    def test_min_max_must_be_exact(self) -> None:
        self.assertFalse(self.q2(100.0, pg_min='-5.000000000000001')['resultMatch'])
        self.assertFalse(self.q2(100.0, pg_max='105.00000000000001')['resultMatch'])
        self.assertTrue(self.q2(100.0, pg_min='-5.0', pg_max='1.05e2')['resultMatch'])   # 표기만 다른 같은 값

    def test_key_set_difference_mismatches(self) -> None:
        self.aux = tsv([['2026-09-26 13:00:00', self.N, self.S], ['2026-09-26 12:00:00', self.N, self.S]])
        self.put('Q2', [['2026-09-26 13:00:00', '100', '-5', '105', self.N], ['2026-09-26 12:00:00', '100', '-5', '105', self.N]],
                 [['2026-09-26 13:00:00+09', '100', '-5', '105', self.N]])
        r = self.match('Q2')
        self.assertFalse(r['resultMatch'])
        self.assertEqual(r['keyDiff'], 1)

    def test_q3_column_order(self) -> None:
        # Q3 키 = tag_id(정수 · 시각 아님) · 열 순서는 Q2와 같다
        self.aux = tsv([[1401, 86400, 86400 * 3.0]])
        self.put('Q3', [[1401, '3', '1', '5', 86400]], [[1401, '3', '1', '5', 86400]])
        self.assertTrue(self.match('Q3')['resultMatch'])

    def test_q5_exact_count_text(self) -> None:
        self.put('Q5', [[123]], [[123]])
        r = self.match('Q5')
        self.assertTrue(r['resultMatch'])
        self.assertEqual((r['countCh'], r['countPg']), ('123', '123'))
        self.put('Q5', [[123]], [[124]])
        self.assertFalse(self.match('Q5')['resultMatch'])

    def test_q1_rows_by_position(self) -> None:
        ch = [['2026-09-26 13:59:59.000', '1.5', '0'], ['2026-09-26 13:59:58.000', '2.5', '4']]
        pg = [['2026-09-26 13:59:59+09', '1.5', '0'], ['2026-09-26 13:59:58+09', '2.5', '4']]
        self.put('Q1', ch, pg)
        self.assertTrue(self.match('Q1')['resultMatch'])
        self.put('Q1', ch, [pg[0], ['2026-09-26 13:59:58+09', '2.5', '2']])      # quality가 다르다
        self.assertFalse(self.match('Q1')['resultMatch'])
        self.put('Q1', ch, pg[:1])                                                # 행 수가 다르다
        self.assertFalse(self.match('Q1')['resultMatch'])

    # Q4: 키(분 버킷 · device · tag) 뒤 count · avg · min · max · bad — 롤업(tag_1m -Merge)도 같은 열 순서
    def q4(self, *, rollup_avg: float = 100.0, rollup_bad: int = 3, rollup_count: int = 60,
           rollup_extra: bool = False) -> dict:
        key = ['2026-09-26 13:59:00', 7, 1401]
        self.aux = tsv([key + [60, 6000.0]])
        self.put('Q4', [key + [60, '100', '90', '110', 3]], [['2026-09-26 13:59:00+09', 7, 1401, 60, '100', '90', '110', 3]])
        rows = [key + [rollup_count, repr(rollup_avg), '90', '110', rollup_bad]]
        if rollup_extra:
            rows.append(['2026-09-26 13:58:00', 7, 1401, 60, '100', '90', '110', 3])
        self.rollup = tsv(rows)
        return self.match('Q4')

    def test_q4_rollup_match(self) -> None:
        r = self.q4()
        self.assertTrue(r['resultMatch'])
        self.assertTrue(r['rollupMatch'])
        self.assertEqual(r['rollupMismatchGroups'], 0)
        self.assertEqual(self.chq_calls[-1][0], grid.CH_ROLLUP_Q4)
        self.assertEqual(self.chq_calls[-1][1], {'end': '2026-09-26 14:00:00.000'})    # Q4는 params 없이도 돈다

    def test_q4_rollup_avg_within_and_beyond_bound(self) -> None:
        tol = 2 * grid.gamma(60) * 6000.0 / 60
        self.assertTrue(self.q4(rollup_avg=100.0 + tol * 0.5)['rollupMatch'])
        r = self.q4(rollup_avg=100.0 + tol * 4)
        self.assertFalse(r['rollupMatch'])
        self.assertTrue(r['resultMatch'])            # CH ↔ PG 대조와 롤업 대조는 따로 판정한다

    def test_q4_rollup_count_bad_and_keys_exact(self) -> None:
        self.assertFalse(self.q4(rollup_count=59)['rollupMatch'])
        self.assertFalse(self.q4(rollup_bad=2)['rollupMatch'])
        r = self.q4(rollup_extra=True)               # 롤업에만 있는 키
        self.assertFalse(r['rollupMatch'])
        self.assertEqual(r['rollupMismatchGroups'], 1)

    def test_q4_bad_count_between_stores(self) -> None:
        key = ['2026-09-26 13:59:00', 7, 1401]
        self.aux = tsv([key + [60, 6000.0]])
        self.rollup = tsv([key + [60, '100', '90', '110', 3]])
        self.put('Q4', [key + [60, '100', '90', '110', 3]], [['2026-09-26 13:59:00+09', 7, 1401, 60, '100', '90', '110', 2]])
        self.assertFalse(self.match('Q4')['resultMatch'])


# ───────────────────────── budget ─────────────────────────

class BudgetTest(GridDirCase):
    NOW = dt.datetime(2026, 9, 26, 12, 0, tzinfo=UTC)
    END_T = dt.datetime(2026, 9, 26, 5, 0, tzinfo=UTC)
    VM_TOTAL_K, VM_FREE_K, HOST_FREE_K = 200_000_000, 100_000_000, 150_000_000
    DU_K = (1000, 2000, 3000, 4000)
    MAX_WAL = 1 << 30

    def setUp(self) -> None:
        super().setUp()
        self.ch_totals = {'rows': 10_000_000, 'bytesOnDisk': 50_000_000}   # 행당 5 B 실측

        def fake_run(cmd: list[str], *, input_text=None, check=True):
            if cmd[:2] == ['df', '-k']:
                out = f'Filesystem 1024-blocks Used Available\n/dev/disk3 999 1 {self.HOST_FREE_K} 1% /\n'
            elif cmd[:4] == ['docker', 'exec', grid.CH, 'df']:
                out = f'Filesystem 1K-blocks Used Available Use% Mounted\noverlay {self.VM_TOTAL_K} 1 {self.VM_FREE_K} 1% /var/lib/clickhouse\n'
            elif cmd[:2] == ['docker', 'run'] and 'du' in cmd:
                out = ''.join(f'{k}\t/v/x{i}\n' for i, k in enumerate(self.DU_K))
            else:
                raise AssertionError(f'예상 밖 명령: {cmd[:5]}')
            return mock.Mock(stdout=out, returncode=0)

        def fake_chq(sql: str, params=None, fmt='TSV', extra=None) -> str:
            self.assertIn('engine_full', sql)
            return "MergeTree PARTITION BY toYYYYMMDD(ts) ORDER BY (device_id, tag_id, ts) TTL toDateTime(ts) + toIntervalDay(7)\n"

        for name, fake in (('run', fake_run), ('chq', fake_chq), ('pgq', lambda sql: f'{self.MAX_WAL}\n'),
                           ('ch_parts_totals', lambda table='tag_raw': self.ch_totals), ('now_utc', lambda: self.NOW)):
            p = mock.patch.object(grid, name, fake)
            p.start()
            self.addCleanup(p.stop)

    def budget(self, k: int, stages: dict) -> dict:
        self.write_state({'end': grid.iso(self.END_T), 'stages': stages})
        grid.cmd_budget([str(k)])
        self.assertEqual(len(self.emitted), 1)
        return self.emitted[0]

    def remain(self, k: int) -> float:
        head = self.END_T - dt.timedelta(seconds=grid.d_sec(k)) + dt.timedelta(days=7)
        return (head - self.NOW).total_seconds()

    def test_stage_estimate_is_prev_elapsed_times_row_ratio(self) -> None:
        # 앞 단계(3): 10^7행 · firstAt~lastAt 1000초 · 채우기 속도 5만 행/초 → 4단계 10^8행
        prev = {'rows': 10 ** 7, 'firstAt': '2026-09-26T10:00:00.000Z', 'lastAt': '2026-09-26T10:16:40.000Z',
                'lastWallRowsPerSec': 50_000}
        t = self.budget(4, {'3': prev})['time']
        self.assertEqual(t['prevStageElapsedSec'], 1000)
        self.assertEqual(t['estStageSec'], 10_000)                       # 1000 × (10^8 ÷ 10^7)
        self.assertEqual(t['estFillSec'], 1800)                          # (10^8 − 10^7) ÷ 5만
        self.assertEqual(t['dSec'], 10 ** 4)
        self.assertEqual(t['retentionSec'], 7 * 86400)
        self.assertEqual(t['budgetSec'], 7 * 86400 - 10 ** 4)
        self.assertEqual(t['remainingSec'], round(self.remain(4)))
        self.assertEqual(t['marginSec'], round(self.remain(4) - 10_000))   # 둘 중 큰 값(단계 추정)을 쓴다
        self.assertTrue(t['ok'])

    def test_fill_estimate_wins_when_larger(self) -> None:
        prev = {'rows': 10 ** 7, 'firstAt': '2026-09-26T10:00:00.000Z', 'lastAt': '2026-09-26T10:00:10.000Z',
                'lastWallRowsPerSec': 1000}
        t = self.budget(4, {'3': prev})['time']
        self.assertEqual(t['estStageSec'], 100)
        self.assertEqual(t['estFillSec'], 90_000)
        self.assertEqual(t['marginSec'], round(self.remain(4) - 90_000))

    def test_no_prev_activity_falls_back_to_fill_estimate(self) -> None:
        prev = {'rows': 10 ** 7, 'lastWallRowsPerSec': 50_000}          # firstAt · lastAt 없음
        t = self.budget(4, {'3': prev})['time']
        self.assertIsNone(t['prevStageElapsedSec'])
        self.assertIsNone(t['estStageSec'])
        self.assertEqual(t['marginSec'], round(self.remain(4) - 1800))

    def test_stage1_has_no_estimate(self) -> None:
        t = self.budget(1, {})['time']
        self.assertIsNone(t['estFillSec'])
        self.assertIsNone(t['estStageSec'])
        self.assertEqual(t['marginSec'], round(self.remain(1)))

    def test_remaining_exhausted_is_not_ok(self) -> None:
        prev = {'rows': 10 ** 7, 'firstAt': '2026-09-25T00:00:00.000Z', 'lastAt': '2026-09-26T10:00:00.000Z'}
        t = self.budget(4, {'3': prev})['time']                          # 34시간(122400초) × 10 > 남은 시간(7일 − 7시간 − 10^4초)
        self.assertEqual(t['estStageSec'], 1_224_000)
        self.assertLess(t['marginSec'], 0)
        self.assertFalse(t['ok'])

    def test_disk_formula(self) -> None:
        d = self.budget(4, {'3': {'rows': 10 ** 7}})['disk']
        r_next, r_cur = 10 ** 8, 10 ** 7
        need = {'controlHeap': (r_next - r_cur) * 76, 'i2Btree': r_next * 30,
                'clickhouse': (r_next - r_cur) * 5, 'walMargin': self.MAX_WAL}
        need['total'] = sum(need.values())
        self.assertEqual(d['need'], need)
        self.assertEqual(d['chBytesPerRow'], 5.0)
        free = min(self.HOST_FREE_K, self.VM_FREE_K) * 1024
        lhs = free - int(0.2 * self.VM_TOTAL_K * 1024) - sum(self.DU_K) * 1024
        self.assertEqual(d['lhsBytes'], lhs)
        self.assertEqual(d['ok'], lhs >= need['total'])


if __name__ == '__main__':
    unittest.main()
