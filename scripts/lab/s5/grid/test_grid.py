"""grid.py 단위 테스트 — match 판정(avg 상계식 · count 정확 · Q4 롤업 대조) · budget 적재 시간 추정 ·
격자 2차(미래 방향 구간 · S 선택 · 정밀화 점 계산 · 반올림 · 스냅샷 · 복원 · 서버 시간 해상도 · 1~5단계 조각 불변 · 결함 회귀).

표준 라이브러리 unittest만 쓴다. 저장소를 부르는 함수(chq · pgq · run · ch_parts_totals)와 출력(emit)은 가짜로 바꾼다.
import 부작용: grid.py는 import 때 GRID_DIR 환경변수(기본 snapshots/lab-s5-grid)로 경로만 정하고 파일을 쓰거나 저장소에 접속하지 않는다.
그래도 테스트가 저장소 상태 디렉터리를 건드리지 않게 import 전에 GRID_DIR을 임시 디렉터리로 두고, 테스트마다 grid.GRID_DIR · grid.STATE를 바꾼다.
실행: PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/lab/s5/grid/test_grid.py
"""
from __future__ import annotations

import atexit
import datetime as dt
import importlib.util
import io
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
START2 = '2026-09-26T04:58:20.000Z'  # S ≡ 20초 · 2단계 end = S + 100초 = 14:00:00 KST


def fwd_state(start: str, stages: dict, **kw) -> dict:
    return {'direction': 'forward', 'start': start, 'startKst': '', 'headExpiresAt': '', 'seed': 42, 'mix': 'mixed',
            'stages': stages, 'snapshots': {}, 'i2': None, **kw}


def tsv(rows: list[list]) -> str:
    return ''.join('\t'.join(str(x) for x in r) + '\n' for r in rows)


class MatchTest(GridDirCase):
    STAGE = 2

    def setUp(self) -> None:
        super().setUp()
        self.write_state(fwd_state(START2, {str(self.STAGE): {'rows': 1_000_000, 'checked': True}},
                                   params={'device': 7, 'tag': 1401, 'v': 12.5}, tableAt=str(self.STAGE)))
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
            f = grid.result_file(str(self.STAGE), q, store)
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
    START_T = dt.datetime(2026, 9, 25, 1, 6, 20, tzinfo=UTC)
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
        self.write_state(fwd_state(grid.iso(self.START_T), stages))
        grid.cmd_budget([str(k)])
        self.assertEqual(len(self.emitted), 1)
        return self.emitted[0]

    def remain(self, k: int) -> float:
        """미래 방향 — 머리는 모든 점에서 S다(단계와 무관)."""
        head = self.START_T + dt.timedelta(days=7)
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
        t = self.budget(4, {'3': prev})['time']                          # 34시간(122400초) × 10 > 남은 시간(S + 7일 − 지금)
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


# ───────────────────────── 격자 2차 — 미래 방향 기하 ─────────────────────────

S = dt.datetime(2026, 9, 25, 1, 6, 20, tzinfo=UTC)     # KST 2026-09-25 10:06:20 · S ≡ 20초


def geo(stages: dict | None = None) -> dict:
    return fwd_state(grid.iso(S), stages or {})


class StartRuleTest(unittest.TestCase):
    def test_default_start_rule(self) -> None:
        now = dt.datetime(2026, 9, 27, 3, 0, tzinfo=UTC)   # KST 09-27 12:00
        s = grid.default_start(now)
        self.assertEqual(int(s.timestamp()) % 60, grid.START_MOD)
        self.assertLessEqual(s + dt.timedelta(seconds=10 ** 5), now - dt.timedelta(seconds=60))
        midnight = s + dt.timedelta(seconds=grid.START_SPLIT_SEC)
        k = midnight.astimezone(grid.KST)
        self.assertEqual((k.hour, k.minute, k.second), (0, 0, 0))
        # 가장 늦은 자정 — 하루 뒤 자정이면 5단계 end가 지금 − 60초를 넘는다
        later = s + dt.timedelta(days=1)
        self.assertGreater(later + dt.timedelta(seconds=10 ** 5), now - dt.timedelta(seconds=60))
        self.assertEqual(grid.start_problems(s, now), [])

    def test_default_start_splits_stage5_at_midnight(self) -> None:
        days = grid.kst_day_split(S, S + dt.timedelta(seconds=10 ** 5))
        self.assertEqual([d['sec'] for d in days], [50_020, 49_980])

    def test_start_problems(self) -> None:
        now = dt.datetime(2026, 9, 27, 3, 0, tzinfo=UTC)
        self.assertTrue(any('mod 60' in p for p in grid.start_problems(S + dt.timedelta(seconds=1), now)))
        self.assertTrue(any('미래' in p for p in grid.start_problems(now - dt.timedelta(seconds=10 ** 5 - 40), now)))
        old = S - dt.timedelta(days=5)
        self.assertTrue(any('머리 만료' in p for p in grid.start_problems(old, now)))

    def test_stage_ends_minute_aligned_where_needed(self) -> None:
        st = geo()
        for k in (2, 3, 4, 5):   # 10^2 · 10^3 · 10^4 · 10^5 + 20초 — 4 · 5단계는 필수(D > 1시간)
            self.assertEqual(int(grid.point_end(st, str(k)).timestamp()) % 60, 0, k)
        self.assertNotEqual(int(grid.point_end(st, '1').timestamp()) % 60, 0)   # D 10초 ≤ 1시간 — 불필요


class ForwardGeometryTest(unittest.TestCase):
    def test_stage_fill_ranges_are_forward_and_contiguous(self) -> None:
        st = geo()
        prev_end = S
        for k in grid.STAGES:
            a, b = grid.fill_range(st, str(k))
            self.assertEqual(a, prev_end)
            self.assertEqual(b, S + dt.timedelta(seconds=10 ** k))
            prev_end = b

    def test_stage_chunks_unchanged_from_first_pass(self) -> None:
        # 1~5단계 조각 크기 · 수 · 채우는 초는 1차와 같다(방향만 바뀐다)
        st = geo()
        expect = {1: (10, 1), 2: (90, 1), 3: (900, 1), 4: (3000, 3), 5: (3600, 25)}
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('FILL_CHUNK_SEC', None)
            for k, (sec, n) in expect.items():
                self.assertEqual(grid.default_chunk_sec(st, str(k)), sec)
                ch = grid.chunks_of(st, str(k), sec)
                self.assertEqual(len(ch), n)
                self.assertEqual(sum((b - a).total_seconds() for a, b in ch), 10 ** k - (10 ** (k - 1) if k > 1 else 0))
                self.assertTrue(all(x[1] == y[0] for x, y in zip(ch, ch[1:])))

    def test_pid_parse_and_stage_value(self) -> None:
        self.assertEqual(grid.parse_pid('3'), '3')
        self.assertEqual(grid.parse_pid('r8.5'), 'r8.5')
        for bad in ('6', 'r9.5', 'r4.5', 'r8.3', 'x'):
            with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
                grid.parse_pid(bad)
        self.assertEqual(grid.stage_num('4'), 4)
        self.assertEqual(grid.stage_num('r8.5'), 4.5)
        self.assertEqual(grid.stage_num('r5.25'), 1.25)
        self.assertEqual(grid.refine_pid(4, None), 'r8.5')
        self.assertEqual(grid.refine_pid(4, 'lower'), 'r8.25')
        self.assertEqual(grid.refine_pid(1, 'upper'), 'r5.75')


class RefinePointTest(unittest.TestCase):
    def test_refine_d_rounding(self) -> None:
        # D* ≤ 1시간 → 가장 가까운 정수 초 · D* > 1시간 → S + D가 분 경계(S ≡ 20 → D ≡ 40 mod 60)인 가장 가까운 값
        cases = {5.5: 32, 5.25: 18, 5.75: 56, 6.5: 316, 7.5: 3162, 7.75: 5620, 8.25: 17_800, 8.5: 31_600, 8.75: 56_260}
        for e, d in cases.items():
            self.assertEqual(grid.refine_d(e, S), d, e)
        for e in (7.75, 8.25, 8.5, 8.75):
            d = grid.refine_d(e, S)
            self.assertEqual(int((S + dt.timedelta(seconds=d)).timestamp()) % 60, 0)
            self.assertLessEqual(abs(d - 10 ** (e - 4)), 30)

    def test_refine_points_are_log_midpoints(self) -> None:
        # m1 = 구간 로그 중점 · m2 = 반쪽의 로그 중점 — 공칭 지수는 a + 1/2 · a + 1/4 · a + 3/4
        st = geo()
        for side, frac in ((None, 0.5), ('lower', 0.25), ('upper', 0.75)):
            pid = grid.register_refine(st, 4, side)
            self.assertEqual(st['stages'][pid]['refine']['nominalExp'], 8 + frac)
            self.assertAlmostEqual(st['stages'][pid]['refine']['rowsExp'], 8 + frac, places=3)
            self.assertLess(10 ** 8, st['stages'][pid]['d'] * grid.TAGS_M)
            self.assertLess(st['stages'][pid]['d'] * grid.TAGS_M, 10 ** 9)

    def test_refine_bases_and_chain(self) -> None:
        st = geo()
        m1 = grid.register_refine(st, 4, None)
        lo = grid.register_refine(st, 4, 'lower')
        up = grid.register_refine(st, 4, 'upper')
        self.assertEqual(grid.point_base(st, m1), '4')
        self.assertEqual(grid.point_base(st, lo), '4')          # lower는 단계 4 스냅샷에서 다시
        self.assertEqual(grid.point_base(st, up), m1)           # upper는 m1에서 이어 채움
        self.assertEqual(grid.point_chain(st, up), [up, m1, '4', '3', '2', '1'])
        a, b = grid.fill_range(st, up)
        self.assertEqual(a, S + dt.timedelta(seconds=31_600))
        self.assertEqual(b, S + dt.timedelta(seconds=56_260))
        # 조각 ≤ 3600초 · 고르게
        os.environ.pop('FILL_CHUNK_SEC', None)
        ch = grid.chunks_of(st, up, grid.default_chunk_sec(st, up))
        self.assertTrue(all((y - x).total_seconds() <= 3600 for x, y in ch))
        self.assertEqual(ch[0][0], a)
        self.assertEqual(ch[-1][1], b)

    def test_register_keeps_first_d(self) -> None:
        st = geo()
        pid = grid.register_refine(st, 4, None)
        st['stages'][pid]['d'] = 12345
        grid.register_refine(st, 4, None)
        self.assertEqual(st['stages'][pid]['d'], 12345)

    def test_point_fields(self) -> None:
        st = geo()
        pid = grid.register_refine(st, 1, None)
        f = grid.point_fields(st, pid)
        self.assertEqual((f['stage'], f['point']), (1.5, 'r5.5'))
        self.assertEqual(f['refine']['interval'], [1, 2])
        self.assertEqual(f['refine']['step'], 1)
        self.assertNotIn('refine', grid.point_fields(st, '3'))
        self.assertEqual(grid.point_fields(st, '3')['stage'], 3)


class PlanCommandTest(GridDirCase):
    def test_plan_refine_without_state_is_pure(self) -> None:
        out = io.StringIO()
        with mock.patch('sys.stdout', out):
            grid.cmd_plan_refine(['4', 'upper', grid.iso(S)])
        text = out.getvalue()
        self.assertIn('r8.75', text)
        self.assertIn('D 56260초', text)
        self.assertIn('base r8.5', text)
        self.assertFalse((self.dir / 'state.json').exists())

    def test_plan_uses_state_start(self) -> None:
        self.write_state(geo())
        out = io.StringIO()
        with mock.patch('sys.stdout', out):
            grid.cmd_plan([])
        self.assertIn(f'S = {grid.iso(S)}', out.getvalue())


class LegacyStateTest(GridDirCase):
    def test_first_pass_state_is_rejected(self) -> None:
        self.write_state({'end': END, 'stages': {}})
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.load_state()


# ───────────────────────── fill · 테이블 상태 ─────────────────────────

MODE_D_OUT = {'totals': {'chRows': 100_000, 'controlRows': 100_000, 'chInsertSec': 0.5, 'controlCopySec': 0.7, 'rollupSec': 0.1},
              'days': [{'day': '20260925', 'match': True, 'rollupCount': 100_000, 'rollupRawCount': 100_000}],
              'run': {'commitHash': 'abc1234', 'memoryProfile': 'load', 'memoryLimitMb': None, 'capacityTier': None},
              'switches': {'SW-09': 'on'}, 'options': {}}


class FillTest(GridDirCase):
    def setUp(self) -> None:
        super().setUp()
        self.calls: list[tuple] = []
        for name, fake in (('chq', lambda *a, **k: '2026-09-27 00:00:00.000000\n'), ('pg_counters', lambda: {'checkpointsDone': 1}),
                           ('mode_d', self.fake_mode_d)):
            p = mock.patch.object(grid, name, fake)
            p.start()
            self.addCleanup(p.stop)
        os.environ.pop('FILL_CHUNK_SEC', None)

    def fake_mode_d(self, a, b, **kw):
        self.calls.append((a, b, kw))
        return MODE_D_OUT, 1.0, 0

    def test_stage1_fill_sets_table_and_run_fields(self) -> None:
        self.write_state(geo() | {'tableAt': None})
        with mock.patch('sys.stderr'):
            grid.cmd_fill(['1'])
        st = json.loads((self.dir / 'state.json').read_text())
        self.assertEqual(st['tableAt'], '1')
        a, b, kw = self.calls[0]
        self.assertEqual((a, b), (S, S + dt.timedelta(seconds=10)))
        self.assertNotIn('capacity_tier', kw)                       # 격자는 CAPACITY_TIER를 주지 않는다
        line = self.emitted[-1]
        self.assertEqual((line['kind'], line['stage'], line['point']), ('fill', 1, '1'))
        self.assertEqual(line['run']['capacityTier'], '해당 없음')
        self.assertIsNone(line['run']['memoryLimitMb'])             # 값은 바꾸지 않는다
        self.assertIn('cgroup max', line['run']['memoryLimitSource'])    # 04 §조건 칸 — run 안의 선택 키
        self.assertIn('티어 해당 없음', line['runNotes']['capacityTierSource'])
        self.assertIsNone(line['modeDRun']['capacityTier'])

    def test_fill_refuses_other_table_state(self) -> None:
        st = geo({'1': {'checked': True, 'rows': 100_000}, '2': {'checked': True, 'rows': 1_000_000}})
        st['tableAt'] = '2'
        grid.register_refine(st, 1, None)
        self.write_state(st)
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_fill(['r5.5'])                                  # base 1인데 테이블은 2 — restore 1이 먼저
        st['tableAt'] = '1'
        self.write_state(st)
        with mock.patch('sys.stderr'):
            grid.cmd_fill(['r5.5'])
        a, b, _ = self.calls[0]
        self.assertEqual((a, b), (S + dt.timedelta(seconds=10), S + dt.timedelta(seconds=32)))
        self.assertEqual(self.emitted[-1]['stage'], 1.5)
        self.assertEqual(self.emitted[-1]['refine']['nominalExp'], 5.5)

    def test_unregistered_refine_point(self) -> None:
        self.write_state(geo() | {'tableAt': '4'})
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_fill(['r8.5'])

    def test_chunk_over_call_limit_is_refused(self) -> None:
        st = geo({'4': {'checked': True, 'rows': 10 ** 8}})
        st['tableAt'] = '4'
        st['stages']['4']['lastWallRowsPerSec'] = 50_000              # 3.6 × 10^7행 ÷ 5만 = 720초 > 540
        self.write_state(st)
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_fill(['5'])
        self.assertEqual(self.calls, [])


class ModeDCommandTest(unittest.TestCase):
    def cmd(self, **kw) -> list[str]:
        seen = {}

        def fake_run(cmd, *, input_text=None, check=True):
            seen['cmd'] = cmd
            return mock.Mock(returncode=0, stdout=json.dumps(MODE_D_OUT) + '\n', stderr='')
        with mock.patch.object(grid, 'run', fake_run), mock.patch.dict(os.environ, {'GCOMPOSE': 'docker compose -f a.yml'}):
            grid.mode_d(S, S + dt.timedelta(seconds=10), control='on', mix='mixed', profile=None, seed=42, compose_var='GCOMPOSE', **kw)
        return seen['cmd']

    def test_capacity_tier_env_only_when_given(self) -> None:
        c = self.cmd()
        self.assertNotIn('-e', c)
        c = self.cmd(capacity_tier='M')
        i = c.index('-e')
        self.assertEqual(c[i + 1], 'CAPACITY_TIER=M')
        self.assertLess(i, c.index('datagen-d', c.index('run')))    # 서비스 이름 앞(compose run 옵션)


# ───────────────────────── 스냅샷 · 복원 · refine ─────────────────────────

class SnapshotRestoreTest(GridDirCase):
    def setUp(self) -> None:
        super().setUp()
        self.snaps = self.dir / 'snaps'
        self.cmds: list[list[str]] = []
        self.counts = {'ch': 10 ** 8, 'pg': 10 ** 8, 'out': 0}

        def fake_run(cmd, *, input_text=None, check=True):
            self.cmds.append(cmd)
            if cmd[:2] == ['task', 'snapshot']:
                d = self.snaps / cmd[2].split('=', 1)[1]
                d.mkdir(parents=True)
                (d / 'pgdata.tar.gz').write_bytes(b'x' * 1000)
            return mock.Mock(returncode=0, stdout='', stderr='')

        def fake_chq(sql, params=None, fmt='TSV', extra=None):
            return f"{self.counts['out'] if 'OR ts >=' in sql else self.counts['ch']}\n"
        ctl = {'cpuset': '5-7', 'memBytes': 3584 * 2 ** 20, 'state': 'running'}
        self.sizes = {'pgdata': 7 * 2 ** 30, 'chdata': 2 ** 30, 'redisdata': 2 ** 20, 'spooldata': 2 ** 20}
        for name, fake in (('run', fake_run), ('volume_sizes', lambda: self.sizes), ('wait_stores', lambda limit=180: 3.0),
                           ('btree_present', lambda: False), ('chq', fake_chq), ('pgq', lambda sql: f"{self.counts['pg']}\n"),
                           ('container_res', lambda n: {**ctl, 'cpuset': '5-7' if n == grid.CH else '8-10'}),
                           ('snapshot_dir', lambda name: self.snaps / name)):
            p = mock.patch.object(grid, name, fake)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch.dict(os.environ, {'GCOMPOSE': 'docker compose -f a.yml'})
        p.start()
        self.addCleanup(p.stop)

    def stage4_state(self, **kw) -> dict:
        st = geo({str(k): {'checked': True, 'rows': 10 ** (k + 4), 'axes': {'at': 'x'}} for k in (1, 2, 3, 4)})
        st.update({'tableAt': '4', **kw})
        return st

    def test_snapshot_name_rule(self) -> None:
        self.assertEqual(grid.snapshot_name(4), f'{self.dir.name}-s4')

    def test_snapshot_records_and_restarts_stores(self) -> None:
        self.write_state(self.stage4_state())
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4'])
        st = json.loads((self.dir / 'state.json').read_text())
        snap = st['snapshots']['4']
        self.assertEqual(snap['name'], grid.snapshot_name(4))
        self.assertEqual(snap['rows'], 10 ** 8)
        self.assertEqual(snap['archiveBytes'], 1000)
        self.assertIn(['task', 'snapshot', f'NAME={grid.snapshot_name(4)}'], self.cmds)
        self.assertIn(['docker', 'start', *grid.STORE_CONTAINERS], self.cmds)
        rm = [c for c in self.cmds if c[-3:] == ['rm', '-sf', 'api']]
        self.assertTrue(rm and self.cmds.index(rm[0]) < self.cmds.index(['task', 'snapshot', f'NAME={grid.snapshot_name(4)}']))
        self.assertEqual(self.emitted[-1]['kind'], 'snapshot')

    def test_snapshot_guards(self) -> None:
        with mock.patch('sys.stderr'):
            self.write_state(self.stage4_state(tableAt='3'))
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4'])      # 테이블이 4가 아니다
            st = self.stage4_state()
            st['stages']['4'].pop('axes')
            self.write_state(st)
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4'])      # 축 측정 전
            self.write_state(self.stage4_state())
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['5'])      # 5단계 스냅샷 없음
        self.sizes = {'pgdata': 30 * 2 ** 30}                            # 볼륨 하나가 768초 — 볼륨별로도 안 된다
        with mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4'])
        self.assertFalse(any(c[:2] == ['task', 'snapshot'] for c in self.cmds))

    def test_restore_verifies_rows_and_sets_table(self) -> None:
        st = self.stage4_state(tableAt='5')
        st['snapshots'] = {'4': {'name': 'g-s4', 'rows': 10 ** 8, 'volumeBytes': 2 ** 30}}
        (self.snaps / 'g-s4').mkdir(parents=True)
        self.write_state(st)
        with mock.patch('sys.stderr'):
            grid.cmd_restore(['4'])
        self.assertIn(['task', 'restore', 'NAME=g-s4'], self.cmds)
        self.assertEqual(json.loads((self.dir / 'state.json').read_text())['tableAt'], '4')
        self.assertTrue(self.emitted[-1]['ok'])
        self.counts['out'] = 5                                          # 구간 밖 행이 남았다
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_restore(['4'])
        self.assertIsNone(json.loads((self.dir / 'state.json').read_text())['tableAt'])

    def test_refine_order(self) -> None:
        st = self.stage4_state()
        st['stages']['5'] = {'checked': True, 'rows': 10 ** 9}
        self.write_state(st)
        with mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.cmd_refine, ['4'])           # 스냅샷 없음
            st['snapshots'] = {'4': {'name': 'g-s4'}}
            self.write_state(st)
            self.assertRaises(SystemExit, grid.cmd_refine, ['4', 'upper'])  # m1 전
            grid.cmd_refine(['4'])
        st = json.loads((self.dir / 'state.json').read_text())
        self.assertEqual(st['stages']['r8.5']['d'], 31_600)
        self.assertEqual(self.emitted[-1]['kind'], 'refine')
        st['stages']['r8.5'].update({'checked': True, 'axes': {'at': 'x'}})
        self.write_state(st)
        with mock.patch('sys.stderr'):
            grid.cmd_refine(['4', 'lower'])
        st = json.loads((self.dir / 'state.json').read_text())
        self.assertEqual(st['stages']['r8.25']['base'], '4')


# ───────────────────────── check · axes 결함 회귀 ─────────────────────────

class CheckChainTest(GridDirCase):
    def test_refine_check_uses_chain_ranges(self) -> None:
        st = geo()
        for k in (1, 2):
            a, b = grid.fill_range(st, str(k))
            st['stages'][str(k)] = {'checked': True, 'rows': 10 ** (k + 4), 'chunks': [
                {'i': 0, 'from': grid.iso(a), 'to': grid.iso(b), 'status': 'done', 'modeD': {'days': []}}]}
        pid = grid.register_refine(st, 1, None)
        a, b = grid.fill_range(st, pid)
        st['stages'][pid]['chunks'] = [{'i': 0, 'from': grid.iso(a), 'to': grid.iso(b), 'status': 'done', 'modeD': {'days': []}}]
        st['tableAt'] = pid
        self.write_state(st)
        seen = []

        def fake_chq(sql, params=None, fmt='TSV', extra=None):
            seen.append(sql)
            if 'OR ts >=' in sql:
                return '0\n'
            if 'countMerge' in sql:
                return '320000\n'
            return '100000\n' if "'2026-09-25 10:06:20.000'" in sql else '220000\n'
        with mock.patch.object(grid, 'chq', fake_chq), \
                mock.patch.object(grid, 'pgq', lambda sql: '0\n' if 'OR ts >=' in sql else ('100000\n' if "'2026-09-25 10:06:20.000+09'" in sql else '220000\n')):
            grid.cmd_check([pid])
        line = self.emitted[-1]
        self.assertEqual(line['chain'], ['r5.5', '1'])                  # 단계 2의 조각은 세지 않는다(복원으로 빠졌다)
        self.assertTrue(line['rangesCoverWindow'])
        self.assertTrue(line['match'])
        self.assertEqual(line['rows'], 320_000)
        self.assertEqual(line['window']['end'], grid.iso(S + dt.timedelta(seconds=32)))


class AxesKindTest(GridDirCase):
    def test_axis_lines_keep_kind(self) -> None:
        st = geo({'1': {'checked': True, 'settled': True, 'rows': 100_000, 'chFillStart': '2026-09-27 00:00:00.000000',
                        'baseline': {'walBytes': 0, 'walFpi': 0, 'lsn': '0/0', 'autovacuumCount': 0, 'vacuumCount': 0,
                                     'autoanalyzeCount': 0},
                        'chunks': [{'modeD': {'totals': {'chRows': 100_000, 'chInsertSec': 1.0, 'controlRows': 100_000,
                                                         'controlCopySec': 2.0}}}]}})
        st['tableAt'] = '1'
        self.write_state(st)
        fakes = {'btree_present': lambda: False,
                 'chq': lambda sql, params=None, fmt='TSV', extra=None: '{"data": [[10, 20, 1, 1, 0]]}' if 'part_log' in sql else '',
                 'ch_parts_totals': lambda table='tag_raw': {'bytesOnDisk': 500_000, 'parts': 1, 'partTypes': ['Wide'],
                                                            'pkBytesInMemory': 10, 'marksBytes': 20},
                 'pg_sizes': lambda: {'totalBytes': 9_000_000, 'tableBytes': 8_000_000, 'heapMainBytes': 7_900_000,
                                      'indexesBytes': 100, 'brinBytes': 24_576, 'maxRelfrozenxidAge': 5},
                 'pg_counters': lambda: {'walBytes': 1000, 'walFpi': 0, 'lsn': '0/10', 'autovacuumCount': 0, 'vacuumCount': 0,
                                         'autoanalyzeCount': 0},
                 'lsn_diff': lambda a, b: 16}
        for name, fake in fakes.items():
            p = mock.patch.object(grid, name, fake)
            p.start()
            self.addCleanup(p.stop)
        grid.cmd_axes(['1'])
        self.assertEqual(len(self.emitted), 10)
        self.assertTrue(all(x['kind'] == 'axis' for x in self.emitted))
        brin = [x for x in self.emitted if x['axis'] == 'index_bytes' and x['store'] == 'postgresql']
        self.assertEqual(brin[0]['indexKind'], 'BRIN(ts)')
        self.assertEqual(brin[0]['value'], 24_576)
        self.assertEqual({x['stage'] for x in self.emitted}, {1})


# ───────────────────────── 쿼리 시간 해상도 ─────────────────────────

class PgServerTimingTest(unittest.TestCase):
    def out(self, execs: list[tuple[float, dict]]) -> str:
        """execs[i] = (클라이언트 ms, 표본 i+1의 {queryid: (calls, total)}) — 표본 0은 빈 값에서 시작."""
        lines = ['PSS\t0\t111\t5\t100.0', 'PSS\t0\t222\t5\t300.0']
        for i, (ms, snap) in enumerate(execs, 1):
            lines.append(f'Time: {ms:.3f} ms')
            lines += [f'PSS\t{i}\t{q}\t{c}\t{t}' for q, (c, t) in snap.items()]
        return '\n'.join(lines) + '\n'

    def test_min_delta_of_single_call_rows(self) -> None:
        # 111 = 중첩된 준비 문장(실행 0.25 ms) · 222 = 감싼 EXECUTE(0.4 ms) — 작은 쪽이 서버 실행 시간
        text = self.out([(0.512, {'111': (6, 100.25), '222': (6, 300.4)}),
                         (0.498, {'111': (7, 100.5), '222': (7, 300.8)})])
        client, server = grid.parse_pg_timed(text, 2)
        self.assertEqual(client, [0.512, 0.498])
        self.assertEqual(server, [0.25, 0.25])

    def test_new_entry_and_missing(self) -> None:
        text = self.out([(1.0, {'111': (5, 100.0), '333': (1, 0.125)}),   # 새 항목(표본 0에 없음)
                         (1.0, {'111': (5, 100.0), '333': (1, 0.125)})])  # 늘어난 항목 없음 → null
        _, server = grid.parse_pg_timed(text, 2)
        self.assertEqual(server, [0.125, None])

    def test_timing_line_count_must_match(self) -> None:
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.parse_pg_timed('Time: 1.000 ms\n', 2)

    def test_script_puts_snapshots_outside_timing(self) -> None:
        st = fwd_state(START2, {'2': {'rows': 10 ** 6}}, params={'device': 1, 'tag': 1, 'v': '58'})
        sc = grid.pg_timed_script(st, 'Q5', 2, '2').splitlines()
        self.assertEqual(sum(1 for x in sc if x.startswith('EXECUTE')), 2)
        self.assertEqual(sum(1 for x in sc if x.startswith("SELECT 'PSS'")), 3)
        for i, x in enumerate(sc):
            if x.startswith("SELECT 'PSS'"):
                self.assertEqual(sc[i - 2:i], ['\\timing off', '\\o'])
            if x.startswith('EXECUTE'):
                self.assertEqual(sc[i - 1], '\\timing on')

    def test_timing_fields(self) -> None:
        f = grid.timing_fields('clickhouse', [2.0, 3.0, 2.0], [2.105, 2.2, 2.115])
        self.assertEqual(f['medianBasis'], 'client')
        self.assertEqual(f['clientResolutionMs'], 1.0)
        self.assertEqual(f['server']['median'], 2.115)
        self.assertEqual(f['spread']['client'], 0.5)                   # 1 ms 해상도가 만드는 거짓 편차
        self.assertAlmostEqual(f['spread']['server'], (2.2 - 2.105) / 2.115, places=6)
        self.assertIsNone(grid.timing_fields('postgresql', [1.0], [None])['server']['median'])


# ───────────────────────── 볼륨별 스냅샷 · 복원(리드 판정 3) ─────────────────────────

class VolumePathTest(GridDirCase):
    """전체 추정 > 540초면 볼륨 하나 = 호출 하나 — 산출 형식은 Taskfile과 같다(manifest · {볼륨}.tar.gz)."""

    def setUp(self) -> None:
        super().setUp()
        self.snaps = self.dir / 'snaps'
        self.cmds: list[list[str]] = []
        self.absent = {'spooldata'}
        self.sizes = {'pgdata': 20 * 2 ** 30, 'chdata': 2 * 2 ** 30, 'redisdata': 2 ** 20}   # 합 563초 > 540 · 볼륨 하나 ≤ 512초

        def fake_run(cmd, *, input_text=None, check=True):
            self.cmds.append(cmd)
            rc, out = 0, ''
            if cmd[:3] == ['docker', 'volume', 'inspect']:
                rc = 1 if cmd[3].removeprefix('db_study_') in self.absent else 0
            elif cmd[:2] == ['docker', 'run'] and 'tar' in cmd and '-czf' in cmd:
                out_dir = next(x.split(':')[0] for x in cmd if x.endswith(':/out'))
                Path(out_dir, cmd[cmd.index('-czf') + 1].removeprefix('/out/')).write_bytes(b'y' * 10)
            elif cmd[:2] == ['git', 'rev-parse']:
                out = 'abc1234\n'
            elif cmd[:2] == ['docker', 'inspect']:
                out = 'img mem=1 cpuset=5-7\n'
            return mock.Mock(returncode=rc, stdout=out, stderr='')
        ctl = {'memBytes': 3584 * 2 ** 20, 'state': 'running'}
        for name, fake in (('run', fake_run), ('volume_sizes', lambda: self.sizes), ('wait_stores', lambda limit=180: 3.0),
                           ('btree_present', lambda: False), ('snapshot_dir', lambda name: self.snaps / name),
                           ('chq', lambda sql, params=None, fmt='TSV', extra=None: '0\n' if 'OR ts >=' in sql else f'{10 ** 8}\n'),
                           ('pgq', lambda sql: f'{10 ** 8}\n'),
                           ('container_res', lambda n: {**ctl, 'cpuset': '5-7' if n == grid.CH else '8-10'})):
            p = mock.patch.object(grid, name, fake)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch.dict(os.environ, {'GCOMPOSE': 'docker compose -f a.yml'})
        p.start()
        self.addCleanup(p.stop)
        st = geo({str(k): {'checked': True, 'rows': 10 ** (k + 4), 'axes': {'at': 'x'}} for k in (1, 2, 3, 4)})
        st['tableAt'] = '4'
        self.write_state(st)

    def state(self) -> dict:
        return json.loads((self.dir / 'state.json').read_text())

    def test_snapshot_by_volume(self) -> None:
        name = grid.snapshot_name(4)
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4'])
        op = self.state()['volumeOp']
        self.assertEqual((op['op'], op['k'], op['done']), ('snapshot', 4, []))
        self.assertIn(['docker', 'compose', '-f', 'a.yml', 'stop'], self.cmds)
        self.assertFalse(any(c[:1] == ['task'] for c in self.cmds))
        man = (self.snaps / name / 'manifest.txt').read_text()
        self.assertIn(f'name={name}', man)
        self.assertIn('container.postgres=img mem=1 cpuset=5-7', man)
        # 진행 중에는 다른 하위 명령 거부 · 순서 밖 볼륨 호출 거부
        with mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.guard_volume_op, 'fill')
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4'])
            self.assertRaises(SystemExit, grid.cmd_restore, ['4', '--volume', 'pgdata'])
        grid.guard_volume_op('status')
        for v in grid.VOLUMES:
            self.assertIsNone(self.state()['snapshots'].get('4'))
            with mock.patch('sys.stderr'):
                grid.cmd_snapshot(['4', '--volume', v])
        st = self.state()
        self.assertIsNone(st['volumeOp'])
        self.assertEqual(st['snapshots']['4']['path'], 'volume')
        self.assertEqual(st['snapshots']['4']['volumeSizes'], self.sizes)
        man = (self.snaps / name / 'manifest.txt').read_text()
        self.assertIn('volume.pgdata=archived 10B', man)
        self.assertIn('volume.spooldata=absent', man)
        self.assertEqual(sorted(f.name for f in (self.snaps / name).glob('*.tar.gz')),
                         ['chdata.tar.gz', 'pgdata.tar.gz', 'redisdata.tar.gz'])
        self.assertEqual(self.cmds[-1], ['docker', 'start', *grid.STORE_CONTAINERS])
        self.assertEqual(self.emitted[-1]['kind'], 'snapshot')
        grid.guard_volume_op('fill')                                   # 끝나면 풀린다

    def test_restore_by_volume(self) -> None:
        st = self.state()
        st['tableAt'] = '5'
        st['snapshots'] = {'4': {'name': 'g-s4', 'rows': 10 ** 8, 'volumeBytes': 22 * 2 ** 30, 'volumeSizes': self.sizes}}
        self.write_state(st)
        d = self.snaps / 'g-s4'
        d.mkdir(parents=True)
        for v in ('pgdata', 'chdata', 'redisdata'):
            (d / f'{v}.tar.gz').write_bytes(b'z')
        (d / 'manifest.txt').write_text('name=g-s4\nvolume.spooldata=absent\n')
        self.absent = set()                                           # 지금은 spooldata가 있다 → 비워야 한다
        with mock.patch('sys.stderr'):
            grid.cmd_restore(['4'])
            self.assertEqual(self.state()['volumeOp']['volumes'], ['chdata', 'pgdata', 'redisdata'])
            self.assertRaises(SystemExit, grid.cmd_restore, ['4', '--volume', 'spooldata'])   # 스냅샷에 없다
            for v in ('pgdata', 'chdata', 'redisdata'):
                grid.cmd_restore(['4', '--volume', v])
        st = self.state()
        self.assertEqual(st['tableAt'], '4')
        self.assertIsNone(st['volumeOp'])
        self.assertTrue(self.emitted[-1]['ok'])
        self.assertEqual(self.emitted[-1]['path'], 'volume')
        self.assertTrue(any('db_study_spooldata:/v' in c and 'find' in c for c in self.cmds))
        untar = [c for c in self.cmds if c[:2] == ['docker', 'run'] and any('-xzpf' in x for x in c)]
        self.assertEqual(len(untar), 3)


# ───────────────────────── 편차 판정 기준(리드 판정 1) ─────────────────────────

class JudgmentSpreadTest(GridDirCase):
    def test_basis_from_first_ch_line(self) -> None:
        st = geo({'3': {'rows': 10 ** 7}})
        b = grid.set_judgment_basis(st, '3', 'Q1', 'warm', 4.0, 1)
        self.assertEqual(b['basis'], 'server')
        grid.set_judgment_basis(st, '3', 'Q1', 'warm', 40.0, 2)      # 한 번 정하면 반복 · 저장소가 같이 쓴다
        self.assertEqual(grid.judgment_basis(st, '3', 'Q1', 'warm')['basis'], 'server')
        self.assertEqual(grid.set_judgment_basis(st, '3', 'Q1', 'cold', 10.0, 1)['basis'], 'client')   # 10 ms는 양자화 아님
        self.assertIsNone(grid.judgment_basis(st, '3', 'Q2', 'warm'))

    def test_spread_values(self) -> None:
        server = {'basis': 'server', 'chClientMedianMs': 2.0}
        j = grid.judgment_spread(server, [2.0, 3.0, 2.0], [2.1, 2.2, 2.1])
        self.assertEqual(j['basis'], 'server')
        self.assertAlmostEqual(j['value'], 0.1 / 2.1, places=6)
        j = grid.judgment_spread(server, [2.0, 3.0, 2.0], [2.1, None, 2.1])   # PG server null → client · 표지
        self.assertEqual((j['basis'], j['serverNull'], j['value']), ('client', True, 0.5))
        j = grid.judgment_spread({'basis': 'client', 'chClientMedianMs': 50.0}, [50.0, 55.0, 50.0], [49.0, 54.0, 49.0])
        self.assertEqual((j['basis'], j['value']), ('client', 0.1))
        self.assertTrue(grid.judgment_spread(None, [1.0], [1.0])['basisUnknown'])

    def test_postgres_before_clickhouse_is_refused(self) -> None:
        st = geo({'3': {'rows': 10 ** 7, 'checked': True}})
        st.update({'tableAt': '3', 'params': {'device': 1, 'tag': 1, 'v': '58'}})
        self.write_state(st)
        with mock.patch.object(grid, 'chq', lambda *a, **k: f'{10 ** 7}\n'), mock.patch.object(grid, 'btree_present', lambda: False), \
                mock.patch.object(grid, 'pg_timed', side_effect=AssertionError('재지 않는다')), mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.cmd_query, ['3', 'postgresql', 'I1', '1', 'Q1', 'warm'])

    def test_query_lines_carry_judgment_spread(self) -> None:
        st = geo({'3': {'rows': 10 ** 7, 'checked': True}})
        st.update({'tableAt': '3', 'params': {'device': 1, 'tag': 1, 'v': '58'}})
        self.write_state(st)
        ql = [{'serverUs': u} for u in (2500, 2100, 2200, 2100)]
        with mock.patch.object(grid, 'chq', lambda *a, **k: f'{10 ** 7}\n'), mock.patch.object(grid, 'btree_present', lambda: False), \
                mock.patch.object(grid, 'ch_timed', lambda sql, params, n, tag: ([3.0, 2.0, 3.0, 2.0], ['a', 'b', 'c', 'd'])), \
                mock.patch.object(grid, 'ch_query_log', lambda ids: ql), \
                mock.patch.object(grid, 'pg_timed', lambda st_, q, n, pid: ([1.5, 1.2, 1.3, 1.25], [1.0, 0.9, 0.95, 0.92])):
            grid.cmd_query(['3', 'clickhouse', '-', '1', 'Q1', 'warm'])
            grid.cmd_query(['3', 'postgresql', 'I1', '1', 'Q1', 'warm'])
        ch, pg, pair = self.emitted
        self.assertEqual(pair['kind'], 'pair')
        self.assertTrue(pair['tieWithinResolution'])                   # CH 2.0 < 10 · |2.0 − 1.25| < 1 ms
        self.assertEqual((pair['chServerMedianMs'], pair['pgServerMedianMs']), (2.1, 0.92))
        self.assertIn('track_planning off', ch['conditions']['serverTimeAsymmetry'])
        self.assertEqual(ch['median'], 2.0)                            # 대표값은 client ms 그대로
        self.assertEqual(ch['judgmentSpread']['basis'], 'server')
        self.assertAlmostEqual(ch['judgmentSpread']['value'], (2.2 - 2.1) / 2.1, places=6)
        self.assertEqual(pg['judgmentSpread']['basis'], 'server')
        self.assertEqual(pg['judgmentSpread']['chClientMedianMs'], 2.0)
        self.assertAlmostEqual(pg['judgmentSpread']['value'], (0.95 - 0.9) / 0.92, places=6)


class Exp35RunTest(unittest.TestCase):
    def test_memory_source_inside_run(self) -> None:
        r = grid.with_memory_source({'commitHash': 'a', 'memoryProfile': 'load', 'memoryLimitMb': None, 'capacityTier': 'M'})
        self.assertIsNone(r['memoryLimitMb'])
        self.assertIn('cgroup max', r['memoryLimitSource'])
        r = grid.with_memory_source({'memoryLimitMb': 4096})
        self.assertNotIn('memoryLimitSource', r)
        self.assertIsNone(grid.with_memory_source(None))


# ───────────────────────── r-grid2 재검수 대응(M1 · M2 · M3 · L1 · 빠진 경계) ─────────────────────────

class CheckCoverTest(GridDirCase):
    """사슬 조각이 [S, end)를 빈틈 · 겹침 없이 덮지 않으면 check는 실패한다."""

    def run_check(self, bounds: list[tuple[int, int]]) -> dict:
        st = geo()
        st['stages']['1'] = {'chunks': [{'i': i, 'from': grid.iso(S + dt.timedelta(seconds=a)), 'to': grid.iso(S + dt.timedelta(seconds=b)),
                                         'status': 'done', 'modeD': {'days': []}} for i, (a, b) in enumerate(bounds)]}
        st['tableAt'] = '1'
        self.write_state(st)
        with mock.patch.object(grid, 'chq', lambda sql, params=None, fmt='TSV', extra=None:
                               '0\n' if 'OR ts >=' in sql else ('100000\n' if 'countMerge' in sql else '50000\n')), \
                mock.patch.object(grid, 'pgq', lambda sql: '0\n' if 'OR ts >=' in sql else '50000\n'), \
                mock.patch('sys.stderr'):
            try:
                grid.cmd_check(['1'])
            except SystemExit:
                pass
        return self.emitted[-1]

    def test_contiguous_passes(self) -> None:
        line = self.run_check([(0, 5), (5, 10)])
        self.assertTrue(line['rangesCoverWindow'])
        self.assertTrue(line['match'])

    def test_gap_fails(self) -> None:
        line = self.run_check([(0, 4), (5, 10)])
        self.assertFalse(line['rangesCoverWindow'])
        self.assertFalse(line['match'])

    def test_overlap_fails(self) -> None:
        line = self.run_check([(0, 6), (5, 10)])
        self.assertFalse(line['rangesCoverWindow'])
        self.assertFalse(line['match'])

    def test_short_of_end_fails(self) -> None:
        self.assertFalse(self.run_check([(0, 5), (5, 9)])['rangesCoverWindow'])


class SnapshotGuardFillTest(GridDirCase):
    """검수 M1 — 단계 k(1~4) 스냅샷 없이 k+1 fill 거부 · FORCE 우회."""

    def setUp(self) -> None:
        super().setUp()
        self.calls = []
        for name, fake in (('chq', lambda *a, **k: '2026-09-27 00:00:00.000000\n'), ('pg_counters', lambda: {'checkpointsDone': 1}),
                           ('mode_d', lambda a, b, **kw: (self.calls.append((a, b)) or MODE_D_OUT, 1.0, 0))):
            p = mock.patch.object(grid, name, fake)
            p.start()
            self.addCleanup(p.stop)
        os.environ.pop('FILL_CHUNK_SEC', None)
        st = geo({'1': {'checked': True, 'rows': 100_000, 'lastWallRowsPerSec': 10 ** 6}})
        st['tableAt'] = '1'
        self.write_state(st)

    def test_refused_without_snapshot(self) -> None:
        err = io.StringIO()
        with mock.patch('sys.stderr', err), self.assertRaises(SystemExit):
            grid.cmd_fill(['2'])
        self.assertIn('grid.sh snapshot 1', err.getvalue())
        self.assertEqual(self.calls, [])

    def test_force_bypasses(self) -> None:
        with mock.patch.dict(os.environ, {'FORCE': '1'}), mock.patch('sys.stderr'):
            grid.cmd_fill(['2'])
        self.assertEqual(len(self.calls), 1)

    def test_allowed_with_snapshot(self) -> None:
        st = json.loads((self.dir / 'state.json').read_text())
        st['snapshots'] = {'1': {'name': 'g-s1'}}
        self.write_state(st)
        with mock.patch('sys.stderr'):
            grid.cmd_fill(['2'])
        self.assertEqual(len(self.calls), 1)

    def test_stage5_needs_no_stage5_snapshot(self) -> None:
        st = geo({'4': {'checked': True, 'rows': 10 ** 8, 'lastWallRowsPerSec': 10 ** 6}})
        st.update({'tableAt': '4', 'snapshots': {'4': {'name': 'g-s4'}}})
        self.write_state(st)
        with mock.patch('sys.stderr'):
            grid.cmd_fill(['5'])
        self.assertEqual(len(self.calls), 1)


class VolumeOpRecoveryTest(VolumePathTest):
    """검수 M2 — 도중 실패 뒤 --finish · --abort로 풀린다 · 재기동 · 확인 실패에도 상태가 해제 가능한 모양."""

    def test_snapshot_restart_failure_then_finish(self) -> None:
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4'])
            for v in grid.VOLUMES[:-1]:
                grid.cmd_snapshot(['4', '--volume', v])
            with mock.patch.object(grid, 'wait_stores', side_effect=SystemExit(1)):
                self.assertRaises(SystemExit, grid.cmd_snapshot, ['4', '--volume', grid.VOLUMES[-1]])
        op = self.state()['volumeOp']
        self.assertEqual(op['done'], list(grid.VOLUMES))                # 볼륨은 다 묶였고 volumeOp는 남았다
        self.assertIsNone(self.state()['snapshots'].get('4'))
        with mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4', '--volume', 'pgdata'])   # 이미 묶음
            grid.cmd_snapshot(['4', '--finish'])
        st = self.state()
        self.assertIsNone(st['volumeOp'])
        self.assertEqual(st['snapshots']['4']['path'], 'volume')

    def test_finish_refused_while_volumes_left(self) -> None:
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4'])
            grid.cmd_snapshot(['4', '--volume', 'pgdata'])
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4', '--finish'])
        self.assertIsNotNone(self.state()['volumeOp'])

    def test_snapshot_abort_cleans_partial_dir(self) -> None:
        name = grid.snapshot_name(4)
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4'])
            grid.cmd_snapshot(['4', '--volume', 'pgdata'])
        self.assertTrue((self.snaps / name).exists())
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4', '--abort'])
        self.assertFalse((self.snaps / name).exists())
        self.assertIsNone(self.state()['volumeOp'])
        self.assertEqual(self.cmds[-1], ['docker', 'start', *grid.STORE_CONTAINERS])
        self.assertEqual(self.emitted[-1]['kind'], 'snapshot-abort')
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4'])                                    # 다시 시작할 수 있다
        self.assertEqual(self.state()['volumeOp']['op'], 'snapshot')

    def test_task_snapshot_failure_keeps_op_for_abort(self) -> None:
        self.sizes = {'pgdata': 2 ** 30}                                # 한 호출 경로(task)
        real = grid.run

        def failing(cmd, **kw):
            if cmd[:2] == ['task', 'snapshot']:
                raise SystemExit(1)
            return real(cmd, **kw)
        with mock.patch.object(grid, 'run', failing), mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4'])
            self.assertRaises(SystemExit, grid.guard_volume_op, 'fill')
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4', '--volume', 'pgdata'])   # task 경로
        self.assertEqual(self.state()['volumeOp']['path'], 'task')
        with mock.patch('sys.stderr'):
            grid.cmd_snapshot(['4', '--abort'])
        self.assertIsNone(self.state()['volumeOp'])

    def restore_setup(self) -> None:
        st = self.state()
        st['tableAt'] = '5'
        st['snapshots'] = {'4': {'name': 'g-s4', 'rows': 10 ** 8, 'volumeBytes': 22 * 2 ** 30, 'volumeSizes': self.sizes}}
        self.write_state(st)
        d = self.snaps / 'g-s4'
        d.mkdir(parents=True)
        for v in ('pgdata', 'chdata', 'redisdata'):
            (d / f'{v}.tar.gz').write_bytes(b'z')
        (d / 'manifest.txt').write_text('name=g-s4\nvolume.spooldata=absent\n')

    def test_restore_verify_failure_releases_op(self) -> None:
        self.restore_setup()
        with mock.patch('sys.stderr'):
            grid.cmd_restore(['4'])
            self.assertIsNone(self.state()['tableAt'])                 # 복원 시작 = 테이블 상태 모름
            for v in ('pgdata', 'chdata'):
                grid.cmd_restore(['4', '--volume', v])
            with mock.patch.object(grid, 'pgq', lambda sql: '5\n'):   # 행 수 불일치
                self.assertRaises(SystemExit, grid.cmd_restore, ['4', '--volume', 'redisdata'])
        st = self.state()
        self.assertIsNone(st['volumeOp'])                             # 확인 실패여도 해제 — restore를 다시 부를 수 있다
        self.assertIsNone(st['tableAt'])
        self.assertFalse(self.emitted[-1]['ok'])

    def test_restore_restart_failure_then_finish(self) -> None:
        self.restore_setup()
        with mock.patch('sys.stderr'):
            grid.cmd_restore(['4'])
            for v in ('pgdata', 'chdata'):
                grid.cmd_restore(['4', '--volume', v])
            with mock.patch.object(grid, 'wait_stores', side_effect=SystemExit(1)):
                self.assertRaises(SystemExit, grid.cmd_restore, ['4', '--volume', 'redisdata'])
            self.assertIsNotNone(self.state()['volumeOp'])
            grid.cmd_restore(['4', '--finish'])
        st = self.state()
        self.assertEqual(st['tableAt'], '4')
        self.assertEqual(st['lastRestore']['k'], '4')
        self.assertIsNone(st['volumeOp'])

    def test_restore_abort(self) -> None:
        self.restore_setup()
        with mock.patch('sys.stderr'):
            grid.cmd_restore(['4'])
            grid.cmd_restore(['4', '--volume', 'pgdata'])
            grid.cmd_restore(['4', '--abort'])
        st = self.state()
        self.assertIsNone(st['volumeOp'])
        self.assertIsNone(st['tableAt'])
        self.assertEqual(self.emitted[-1]['kind'], 'restore-abort')
        self.assertTrue((self.snaps / 'g-s4' / 'pgdata.tar.gz').exists())   # 복원 원천은 지우지 않는다

    def test_flags_are_exclusive(self) -> None:
        with mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.cmd_snapshot, ['4', '--finish', '--abort'])


class RefillTest(GridDirCase):
    """검수 M3 · L3 — 복원 뒤 정밀화 점 재채움: 앞 채움 보관 · 초기화 · refill-reset 한 줄."""

    def setUp(self) -> None:
        super().setUp()
        st = geo({str(k): {'checked': True, 'rows': 10 ** (k + 4)} for k in (1, 2)})
        pid = grid.register_refine(st, 1, None)
        st['stages'][pid].update({'chunks': [{'i': 0, 'from': 'a', 'to': 'b', 'status': 'done'}], 'chunkSec': 22,
                                  'baseline': {'walBytes': 1}, 'chFillStart': 'x', 'firstAt': '2026-09-27T00:00:00.000Z',
                                  'lastAt': '2026-09-27T01:00:00.000Z', 'checked': True, 'rows': 320_000, 'axes': {'at': 'x'},
                                  'judgmentBasis': {'Q1|warm': {'basis': 'server'}}, 'lastWallRowsPerSec': 5.0})
        st['tableAt'] = '2'
        self.write_state(st)
        for sub in ('results', 'explain'):
            (self.dir / sub / 'sr5.5').mkdir(parents=True)
        (self.dir / 'match').mkdir()
        (self.dir / 'match' / 'sr5.5-Q1.json').write_text('{}')

    def state(self) -> dict:
        return json.loads((self.dir / 'state.json').read_text())

    def test_refused_unless_table_at_base(self) -> None:
        with mock.patch('sys.stderr'):
            self.assertRaises(SystemExit, grid.cmd_refill, ['r5.5'])   # 테이블 2
            self.assertRaises(SystemExit, grid.cmd_refill, ['3'])      # 채운 적 없는 단계
        self.assertIn('chunks', self.state()['stages']['r5.5'])

    def test_fill_after_restore_requires_refill(self) -> None:
        st = self.state()
        st['tableAt'] = '1'
        self.write_state(st)
        err = io.StringIO()
        with mock.patch('sys.stderr', err), self.assertRaises(SystemExit):
            grid.cmd_fill(['r5.5'])
        self.assertIn('refill r5.5', err.getvalue())

    def test_refill_archives_and_resets(self) -> None:
        st = self.state()
        st['tableAt'] = '1'
        st['lastRestore'] = {'k': '1', 'name': 'g-s1', 'at': 'x', 'path': 'task'}
        self.write_state(st)
        with mock.patch('sys.stderr'):
            grid.cmd_refill(['r5.5'])
        s = self.state()['stages']['r5.5']
        for k in ('chunks', 'baseline', 'chFillStart', 'firstAt', 'checked', 'axes', 'judgmentBasis', 'lastWallRowsPerSec'):
            self.assertNotIn(k, s)
        self.assertEqual((s['d'], s['base']), (32, '1'))               # 점 정의는 그대로
        self.assertEqual(s['history'][0]['n'], 1)
        self.assertEqual(s['history'][0]['firstAt'], '2026-09-27T00:00:00.000Z')
        self.assertTrue((self.dir / 'results' / 'sr5.5.refill-1').exists())
        self.assertTrue((self.dir / 'match' / 'sr5.5-Q1.json.refill-1').exists())
        self.assertFalse((self.dir / 'match' / 'sr5.5-Q1.json').exists())
        line = self.emitted[-1]
        self.assertEqual((line['kind'], line['point'], line['n']), ('refill-reset', 'r5.5', 1))
        self.assertEqual(line['previous']['chunksDone'], 1)
        # 초기화 뒤 fill이 새 baseline · firstAt으로 다시 채운다 — budget이 오래된 firstAt을 쓰지 않는다(L3)
        calls = []
        with mock.patch.object(grid, 'chq', lambda *a, **k: 'now\n'), mock.patch.object(grid, 'pg_counters', lambda: {'checkpointsDone': 9}), \
                mock.patch.object(grid, 'mode_d', lambda a, b, **kw: (calls.append((a, b)) or MODE_D_OUT, 1.0, 0)), mock.patch('sys.stderr'):
            grid.cmd_fill(['r5.5'])
        s = self.state()['stages']['r5.5']
        self.assertEqual(s['baseline'], {'checkpointsDone': 9})
        self.assertNotEqual(s['firstAt'], '2026-09-27T00:00:00.000Z')
        self.assertEqual(s['restoredFrom']['name'], 'g-s1')
        self.assertEqual(calls[0], (S + dt.timedelta(seconds=10), S + dt.timedelta(seconds=32)))

    def test_fill_conditions_record_restore_and_bounds(self) -> None:
        st = self.state()
        st['stages']['r5.5']['restoredFrom'] = {'k': '1', 'name': 'g-s1'}
        c = grid.fill_conditions(st, 'r5.5')
        self.assertEqual(c['fillChain'], ['r5.5', '1'])
        self.assertEqual(c['chunkBounds'], ['a', 'b'])
        self.assertIn('g-s1', c['fillNote'])
        self.assertEqual(grid.fill_conditions(st, '2'), {})


class BoundaryTest(unittest.TestCase):
    def test_default_start_midnight_boundary(self) -> None:
        m = dt.datetime(2026, 9, 26, 15, 0, tzinfo=UTC)                 # KST 2026-09-27 00:00
        s = grid.default_start(m + dt.timedelta(seconds=50_040))       # S + 10^5 = 지금 − 60초 — 이 자정을 쓸 수 있는 첫 순간
        self.assertEqual(s, m - dt.timedelta(seconds=50_020))
        s = grid.default_start(m + dt.timedelta(seconds=50_039))       # 1초 이르면 하루 앞 자정
        self.assertEqual(s, m - dt.timedelta(days=1, seconds=50_020))

    def test_judgment_basis_cold_single_value(self) -> None:
        st = geo({'3': {'rows': 10 ** 7}})
        b = grid.set_judgment_basis(st, '3', 'Q5', 'cold', 7.0, 1)       # 콜드는 값 하나 — 그 값이 중앙값
        self.assertEqual(b['basis'], 'server')
        self.assertIn('Q5|cold', st['stages']['3']['judgmentBasis'])
        self.assertIsNone(grid.judgment_basis(st, '3', 'Q5', 'warm'))    # 캐시별 키
        j = grid.judgment_spread(b, [7.0], [6.512])
        self.assertEqual(j['basis'], 'server')
        self.assertIsNone(j['value'])                                   # 값 하나 — 줄 안 편차 없음(반복 간 편차는 기록 작성자가 basis로)

    def test_parse_pg_timed_multiple_candidates_and_double_calls(self) -> None:
        text = '\n'.join([
            'PSS\t0\t111\t5\t100.0', 'PSS\t0\t222\t5\t300.0', 'PSS\t0\t333\t2\t10.0',
            'Time: 1.000 ms',
            'PSS\t1\t111\t6\t100.3', 'PSS\t1\t222\t6\t300.5', 'PSS\t1\t333\t4\t10.05',   # 333은 calls +2 — 제외
            'PSS\t1\t444\t1\t0.4',                                                      # 새 항목 +1 후보
        ]) + '\n'
        _, server = grid.parse_pg_timed(text, 1)
        self.assertEqual(server, [0.3])                                 # 후보 0.3 · 0.5 · 0.4 중 최소 · 0.05(+2)는 빠진다


class StageRefillTest(GridDirCase):
    """검수 R1 — 단계 점 실패 → restore base → refill → fill 경로 · 1단계 빈 테이블 조건 · base 스냅샷 없음 거부."""

    def setUp(self) -> None:
        super().setUp()
        self.calls = []
        self.out = MODE_D_OUT
        self.rc = 0
        self.counts = (0, 0)
        for name, fake in (('chq', lambda sql, *a, **k: f'{self.counts[0]}\n' if 'count()' in sql else 'now\n'),
                           ('pgq', lambda sql: f'{self.counts[1]}\n'),
                           ('pg_counters', lambda: {'checkpointsDone': len(self.calls)}),
                           ('mode_d', lambda a, b, **kw: (self.calls.append((a, b)) or self.out, 1.0, self.rc))):
            p = mock.patch.object(grid, name, fake)
            p.start()
            self.addCleanup(p.stop)
        os.environ.pop('FILL_CHUNK_SEC', None)
        self.snaps = self.dir / 'snaps'
        p = mock.patch.object(grid, 'snapshot_dir', lambda name: self.snaps / name)
        p.start()
        self.addCleanup(p.stop)

    def state(self) -> dict:
        return json.loads((self.dir / 'state.json').read_text())

    def test_stage5_failure_restore_refill_fill(self) -> None:
        st = geo({str(k): {'checked': True, 'rows': 10 ** (k + 4), 'lastWallRowsPerSec': 10 ** 6} for k in (1, 2, 3, 4)})
        st.update({'tableAt': '4', 'snapshots': {'4': {'name': 'g-s4'}}})
        self.write_state(st)
        self.out = {**MODE_D_OUT, 'totals': {**MODE_D_OUT['totals'], 'controlRows': 1}}   # 불일치 적재
        err = io.StringIO()
        with mock.patch('sys.stderr', err), self.assertRaises(SystemExit):
            grid.cmd_fill(['5'])
        self.assertIn('grid.sh restore 4 → grid.sh refill 5 → grid.sh fill 5 next', err.getvalue())
        self.assertEqual(self.state()['stages']['5']['chunks'][0]['status'], 'failed')
        # restore 4 뒤(tableAt 4 · lastRestore) — refill 없이 fill은 FORCE여도 거부
        st = self.state()
        st.update({'tableAt': '4', 'lastRestore': {'k': '4', 'name': 'g-s4', 'at': 'x', 'path': 'task'}})
        self.write_state(st)
        with mock.patch.dict(os.environ, {'FORCE': '1'}), mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_fill(['5'])
        with mock.patch('sys.stderr'):
            grid.cmd_refill(['5'])
        s5 = self.state()['stages']['5']
        self.assertNotIn('chunks', s5)
        self.assertEqual(s5['history'][0]['chunks'][0]['status'], 'failed')
        self.assertEqual(self.emitted[-1]['kind'], 'refill-reset')
        self.assertEqual(self.emitted[-1]['stage'], 5)
        self.out = MODE_D_OUT
        with mock.patch('sys.stderr'):
            grid.cmd_fill(['5'])
        s5 = self.state()['stages']['5']
        self.assertEqual(s5['chunks'][0]['status'], 'done')
        self.assertEqual(len(s5['chunks']), 25)
        self.assertEqual(s5['restoredFrom']['name'], 'g-s4')
        self.assertEqual(self.calls[-1][0], S + dt.timedelta(seconds=10 ** 4))

    def test_stage_refill_requires_base_snapshot(self) -> None:
        st = geo({'3': {'checked': True, 'rows': 10 ** 7}, '4': {'chunks': [{'i': 0, 'status': 'failed'}]}})
        st['tableAt'] = '3'
        self.write_state(st)
        err = io.StringIO()
        with mock.patch('sys.stderr', err), self.assertRaises(SystemExit):
            grid.cmd_refill(['4'])
        self.assertIn('채움 스냅샷이 상태에 없다', err.getvalue())
        self.assertIn('chunks', self.state()['stages']['4'])

    def test_stage_refill_moves_old_own_snapshot(self) -> None:
        st = geo({'2': {'checked': True, 'rows': 10 ** 6}, '3': {'checked': True, 'rows': 10 ** 7, 'chunks': [{'i': 0, 'status': 'done'}]}})
        st.update({'tableAt': '2', 'snapshots': {'2': {'name': 'g-s2'}, '3': {'name': 'g-s3'}}})
        self.write_state(st)
        (self.snaps / 'g-s3').mkdir(parents=True)
        with mock.patch('sys.stderr'):
            grid.cmd_refill(['3'])
        st = self.state()
        self.assertNotIn('3', st['snapshots'])                          # 새 스냅샷 3을 뜰 수 있다
        self.assertIn('2', st['snapshots'])
        self.assertTrue((self.snaps / 'g-s3.refill-1').exists())
        self.assertEqual(st['stages']['3']['history'][0]['snapshot']['name'], 'g-s3')

    def test_stage1_refill_needs_empty_tables(self) -> None:
        # 1단계 조각 실패 뒤 tableAt은 '1' — 빈 스냅샷 복원(task restore)은 러너 밖이라 실제 0행 확인이 조건이다
        st = geo({'1': {'chunks': [{'i': 0, 'status': 'failed'}]}})
        st['tableAt'] = '1'
        self.write_state(st)
        self.counts = (5, 0)
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_refill(['1'])                                      # 부분 적재가 남았다
        self.assertIn('chunks', self.state()['stages']['1'])
        self.counts = (0, 3)
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_refill(['1'])                                      # 대조군에 남았다
        self.counts = (0, 0)
        with mock.patch('sys.stderr'):
            grid.cmd_refill(['1'])
        st = self.state()
        self.assertNotIn('chunks', st['stages']['1'])
        self.assertIsNone(st['tableAt'])
        with mock.patch('sys.stderr'):
            grid.cmd_fill(['1'])                                        # 빈 테이블에서 다시
        self.assertEqual(self.calls[-1], (S, S + dt.timedelta(seconds=10)))

    def test_refine_upper_failure_path_message(self) -> None:
        st = geo({'4': {'checked': True, 'rows': 10 ** 8}})
        grid.register_refine(st, 4, None)
        grid.register_refine(st, 4, 'upper')
        self.assertEqual(grid.refill_path(st, 'r8.75'),
                         'grid.sh restore 4 → refill r8.5 → r8.5 다시 채움 → grid.sh refill r8.75 → grid.sh fill r8.75 next')
        self.assertEqual(grid.refill_path(st, '1'), '빈 스냅샷 task restore → grid.sh refill 1 → grid.sh fill 1 next')


class Stage1ParamsResetTest(StageRefillTest):
    """리드 판정 — refill 1이 params를 보관 · 비우고, check 1 뒤 params가 FORCE 없이 새로 정해지며 paramsChanged를 남긴다."""

    def test_refill1_resets_params_and_params_reports_change(self) -> None:
        old = {'device': 1, 'tag': 1, 'v': '58', 'q5SelectivityStage1': 0.5, 'rule': 'r'}
        st = geo({'1': {'checked': True, 'rows': 100_000, 'chunks': [{'i': 0, 'status': 'done'}]}})
        st.update({'tableAt': '1', 'params': old})
        self.write_state(st)
        self.counts = (0, 0)
        with mock.patch('sys.stderr'):
            grid.cmd_refill(['1'])
        st = self.state()
        self.assertIsNone(st['params'])
        self.assertEqual(st['paramsHistory'][0]['params'], old)
        self.assertEqual(st['stages']['1']['history'][0]['params'], old)
        # 새 1단계 적재 · check 뒤(상태만 흉내) — FORCE 없이 params
        st['stages']['1'].update({'checked': True, 'rows': 100_000})
        st['tableAt'] = '1'
        self.write_state(st)
        answers = {'quantileExact': '61\n', 'GROUP BY device_id': '1\t1\n', 'countIf': '0.49\n'}
        fake = lambda sql, *a, **k: next(v for key, v in answers.items() if key in sql)
        with mock.patch.object(grid, 'chq', fake), mock.patch.dict(os.environ, {'FORCE': ''}):
            grid.cmd_params([])
        line = self.emitted[-1]
        self.assertEqual(line['kind'], 'params')
        self.assertTrue(line['paramsChanged']['changed'])
        self.assertEqual((line['paramsChanged']['previous']['v'], line['paramsChanged']['new']['v']), ('58', '61'))

    def test_refill1_refused_when_later_points_filled(self) -> None:
        st = geo({'1': {'chunks': [{'i': 0, 'status': 'done'}]}, '2': {'chunks': [{'i': 0, 'status': 'done'}]}})
        st.update({'tableAt': '2', 'params': {'device': 1}})
        self.write_state(st)
        with mock.patch('sys.stderr'), self.assertRaises(SystemExit):
            grid.cmd_refill(['1'])
        self.assertEqual(self.state()['params'], {'device': 1})


class ParamsLaterCheckTest(GridDirCase):
    """검수 L5 — params는 뒤 점이 "항목만" 있으면 막지 않고, todo가 아닌 조각이 있으면 막는다(refill 1과 같은 조건)."""

    def run_params(self, later: dict) -> None:
        st = geo({'1': {'checked': True, 'rows': 100_000}, **later})
        st['tableAt'] = '1'
        self.write_state(st)
        answers = {'quantileExact': '58\n', 'GROUP BY device_id': '1\t1\n', 'countIf': '0.5\n'}
        with mock.patch.object(grid, 'chq', lambda sql, *a, **k: next(v for key, v in answers.items() if key in sql)), \
                mock.patch('sys.stderr'):
            grid.cmd_params([])

    def test_todo_only_later_point_does_not_block(self) -> None:
        self.run_params({'2': {'chunks': [{'i': 0, 'status': 'todo'}], 'chunkSec': 90}, '3': {}})
        self.assertEqual(self.emitted[-1]['kind'], 'params')
        self.assertEqual(json.loads((self.dir / 'state.json').read_text())['params']['v'], '58')

    def test_started_later_point_blocks(self) -> None:
        with self.assertRaises(SystemExit):
            self.run_params({'2': {'chunks': [{'i': 0, 'status': 'failed'}]}})
        self.assertEqual(self.emitted, [])


class PgssKeyTest(unittest.TestCase):
    """같은 queryid에 toplevel이 다른 두 행이 있어도 증분을 잃지 않는다(키 = userid:queryid:toplevel)."""

    def test_duplicate_queryid_rows_keep_increment(self) -> None:
        out = "\n".join([
            "PSS\t0\t10:77:false\t16\t50.0", "PSS\t0\t10:77:true\t1\t7.0",
            "Time: 5.0 ms",
            "PSS\t1\t10:77:false\t17\t53.5", "PSS\t1\t10:77:true\t1\t7.0",
        ])
        times, server = grid.parse_pg_timed(out, 1)
        self.assertEqual(times, [5.0])
        self.assertEqual(server, [3.5])


if __name__ == '__main__':
    unittest.main()
