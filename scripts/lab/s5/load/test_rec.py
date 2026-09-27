"""_rec.py 단위 테스트 — exact_q(정확 분위수 위치 규칙) · step_view(무손실 차 · 판정 창 · 창 CPU · 오류율).

표준 라이브러리 unittest만 쓴다. step_view는 상태 디렉터리의 파일만 읽으므로 임시 디렉터리에 가짜 계단 파일을 둔다.
import 부작용: _rec.py는 import 때 ../../s2/hist-diff.py를 모듈로 읽을 뿐(main은 __name__ 가드) 저장소 접속 · 파일 쓰기가 없다.
실행: PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/lab/s5/load/test_rec.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('rec_under_test', HERE / '_rec.py')
rec = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rec)


class ExactQTest(unittest.TestCase):
    """ClickHouse quantileExact와 같은 위치 — 정렬 뒤 ⌊p·n⌋번째(0부터) · p=1이면 마지막."""

    def test_empty_is_none(self) -> None:
        self.assertIsNone(rec.exact_q([], 0.5))

    def test_position_rule(self) -> None:
        v = [40, 10, 30, 20]                        # 정렬 [10, 20, 30, 40]
        self.assertEqual(rec.exact_q(v, 0.0), 10)
        self.assertEqual(rec.exact_q(v, 0.25), 20)  # ⌊1.0⌋ = 1
        self.assertEqual(rec.exact_q(v, 0.5), 30)   # ⌊2.0⌋ = 2 — 보간 중앙값(25)이 아니다
        self.assertEqual(rec.exact_q(v, 0.74), 30)  # ⌊2.96⌋ = 2
        self.assertEqual(rec.exact_q(v, 0.75), 40)
        self.assertEqual(rec.exact_q(v, 1.0), 40)   # 끝으로 자른다

    def test_hundred_values(self) -> None:
        v = list(range(100, 0, -1))                 # 1..100 역순
        self.assertEqual(rec.exact_q(v, 0.5), 51)
        self.assertEqual(rec.exact_q(v, 0.95), 96)
        self.assertEqual(rec.exact_q(v, 0.99), 100)

    def test_value_from_sample_and_input_untouched(self) -> None:
        v = [0.3, 0.1, 0.2]
        self.assertIn(rec.exact_q(v, 0.5), v)       # 표본 값 그대로(보간 없음)
        self.assertEqual(v, [0.3, 0.1, 0.2])        # 입력을 정렬해 바꾸지 않는다

    def test_single(self) -> None:
        for p in (0.0, 0.5, 0.99, 1.0):
            self.assertEqual(rec.exact_q([7], p), 7)


W0 = 1_790_000_000_000          # 판정 창 시작(ms)
W1 = W0 + 60_000                # 끝 — 60초


def prom_text(req200: float, req503: float, req500: float, des503: float, des429: float, req429: float) -> str:
    return '\n'.join([
        '# TYPE http_requests_total counter',
        f'http_requests_total{{route="/a",method="POST",code="202"}} {req200}',
        f'http_requests_total{{route="/a",method="POST",code="503"}} {req503}',
        f'http_requests_total{{route="/a",method="POST",code="500"}} {req500}',
        f'http_requests_total{{route="/a",method="POST",code="429"}} {req429}',
        f'http_designed_rejections_total{{route="/a",error_code="datagen.stream_full"}} {des503}',
        f'http_designed_rejections_total{{route="/a",error_code="common.rate_limited"}} {des429}',
        'stream_trimmed_unacked 5',
        '',
    ])


class StepViewTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix='rec-step-')
        self.addCleanup(self._tmp.cleanup)
        self.d = Path(self._tmp.name)

    def w(self, name: str, text: str) -> None:
        (self.d / name).write_text(text)

    def base(self, *, modeb: dict | None = None, rows: str | None = '1799990', accepted: str | None = None) -> None:
        meta = ['label=s1', 'tier=M', 'pps=20000', 'entries=100', 'transS=30', 'winS=60',
                f'winStartMs={W0}', f'winEndMs={W1}', f'launchMs={W0 - 30_000}', f'exitMs={W1 + 5_000}']
        if accepted is not None:
            meta.append(f'acceptedRows={accepted}')
        self.w('meta', '\n'.join(meta) + '\n')
        if modeb is not None:
            self.w('modeb.json', json.dumps(modeb))
        if rows is not None:
            self.w('rows', rows + '\n')
        s0 = W0 // 1000
        # 표본: epoch lag glag pend heap rss [el_p95] — 과도 구간 lag는 판정 창보다 크다
        self.w('trans.samples', f'{s0 - 20} 150000 1 2 3 4\n{s0 - 10} 90000 1 2 3 4\n')
        self.w('win.samples', f'{s0} 1000 10 5 100 200 0.01\n{s0 + 30} 3000 20 6 110 210 0.02\n{s0 + 60} 2000 30 - 120 220 0.03\n')
        # docker stats: epoch 이름 CPU% 사용량 / 상한 — 창 밖(앞 · 뒤) 줄은 CPU 요약에서 빠진다
        self.w('stats', '\n'.join([
            f'{s0 - 1} clickhouse 900.0% 1GiB / 5GiB',
            f'{s0} clickhouse 100.0% 1GiB / 5GiB',
            f'{s0 + 60} clickhouse 300.0% 1GiB / 5GiB',
            f'{s0 + 61} clickhouse 800.0% 1GiB / 5GiB',
            f'{s0 + 30} api 50.0% 1GiB / 2GiB',
        ]) + '\n')

    MODEB = {'options': {'tier': 'M', 'pps': 20000, 'durationSeconds': 90,
                         'thresholds': {'caution': 20000, 'warning': 100000, 'danger': 180000}},
             'result': {'generatedPoints': 1_800_000, 'publishedPoints': 1_800_000, 'haltedPoints': 0},
             'run': {'commitHash': 'abc'}, 'switches': {'SW-01': 'on'}}

    def test_lossless_diff_from_modeb_published(self) -> None:
        self.base(modeb=self.MODEB, rows='1799990')
        v = rec.step_view(str(self.d))
        self.assertEqual(v['lossless'], {'published': 1_800_000, 'rowsInRange': 1_799_990.0, 'diff': 10.0})
        self.assertEqual(v['generator']['achievedRatio'], 1.0)          # 1.8M ÷ (2만 × 90)

    def test_lossless_zero_diff(self) -> None:
        self.base(modeb=self.MODEB, rows='1800000')
        self.assertEqual(rec.step_view(str(self.d))['lossless']['diff'], 0.0)

    def test_lossless_from_accepted_rows_without_modeb(self) -> None:
        # 모드 C(벌크)는 모드 B 출력이 없다 — meta acceptedRows가 발행 수다
        self.base(modeb=None, rows='499000', accepted='500000')
        v = rec.step_view(str(self.d))
        self.assertIsNone(v['generator'])
        self.assertEqual(v['lossless'], {'published': 500000.0, 'rowsInRange': 499000.0, 'diff': 1000.0})

    def test_lossless_accepted_zero_is_zero_not_none(self) -> None:
        self.base(modeb=None, rows='0', accepted='0')
        self.assertEqual(rec.step_view(str(self.d))['lossless'], {'published': 0.0, 'rowsInRange': 0.0, 'diff': 0.0})

    def test_lossless_diff_none_when_a_side_missing(self) -> None:
        self.base(modeb=self.MODEB, rows=None)
        self.assertIsNone(rec.step_view(str(self.d))['lossless']['diff'])
        self.base(modeb=None, rows='10')                                  # 발행 수 없음(modeb · acceptedRows 둘 다 없음)
        (self.d / 'modeb.json').unlink()
        self.assertEqual(rec.step_view(str(self.d))['lossless'], {'published': None, 'rowsInRange': 10.0, 'diff': None})

    def test_window_and_load_range(self) -> None:
        self.base(modeb=self.MODEB)
        v = rec.step_view(str(self.d))
        self.assertEqual(v['window'], {'start': rec.iso(W0), 'end': rec.iso(W1)})
        self.assertEqual(v['window']['start'], '2026-09-21T14:13:20.000Z')
        self.assertEqual(v['window']['end'], '2026-09-21T14:14:20.000Z')
        self.assertEqual(v['loadRange'], {'launch': rec.iso(W0 - 30_000), 'exit': rec.iso(W1 + 5_000)})
        self.assertEqual((v['transS'], v['winS'], v['pps']), (30.0, 60.0, 20000.0))

    def test_cpu_only_inside_window_inclusive(self) -> None:
        self.base(modeb=self.MODEB)
        cpu = rec.step_view(str(self.d))['cpu']
        self.assertEqual(cpu['clickhouse'], {'n': 2, 'median': 200.0, 'max': 300.0})   # 900 · 800(창 밖)은 빠진다
        self.assertEqual(cpu['api'], {'n': 1, 'median': 50.0, 'max': 50.0})

    def test_lag_window_vs_all_and_stage(self) -> None:
        self.base(modeb=self.MODEB)
        v = rec.step_view(str(self.d))
        self.assertEqual(v['lag']['n'], 3)                     # 판정 창 표본만
        self.assertEqual(v['lag']['max'], 3000.0)
        self.assertEqual(v['lagAll']['n'], 5)                  # 과도 + 창
        self.assertEqual(v['lagAll']['max'], 150000.0)
        self.assertEqual(v['stageMax'], 2)                     # 150000 ≥ warning(10만) · ≤ danger(18만)
        self.assertEqual(v['pending']['n'], 2)                 # '-'는 빈 값으로 빠진다
        self.assertEqual(v['eventLoopP95S']['max'], 0.03)

    def test_http_error_rate_excludes_designed_rejections(self) -> None:
        self.base(modeb=self.MODEB)
        self.w('m0.api', prom_text(100, 10, 1, 10, 3, 3))
        # 창 증가: 202 +70 · 503 +20 · 500 +2 · 429 +8 · 설계 503 +18 · 설계 429 +8
        self.w('m1.api', prom_text(170, 30, 3, 28, 11, 11))
        h = rec.step_view(str(self.d))['http']
        self.assertEqual(h['requests'], 100.0)
        self.assertEqual(h['status5xx'], 22.0)
        self.assertEqual(h['designedRejections'], 26.0)
        self.assertEqual(h['designed503'], 18.0)
        self.assertAlmostEqual(h['errorRate'], (22 - 18) / (100 - 26))
        # api 창 차는 워커 캡처가 없을 때 적재 지표에도 쓰인다
        self.assertEqual(rec.step_view(str(self.d))['streamTrimmedUnacked'], 0.0)

    def test_no_prom_capture_is_none(self) -> None:
        self.base(modeb=self.MODEB)
        v = rec.step_view(str(self.d))
        self.assertIsNone(v['http'])
        self.assertIsNone(v['ingest'])
        self.assertIsNone(v['e2eGauge'])



# ── EXP-45 — 버킷 차 분위수(compare.ts histQuantile과 같은 식) · 재기동 감지 · 판정 점
LE = ['0.1', '0.25', '0.5', '1', '1.5', '+Inf']


def hist_text(name: str, cum: list[float], extra: str = '') -> str:
    """누적 버킷 줄(le 순) + _count · _sum — cum[-1]이 +Inf(= count)"""
    lines = [f'{name}_bucket{{le="{le}"}} {c}' for le, c in zip(LE, cum)]
    lines += [f'{name}_count {cum[-1]}', f'{name}_sum 0']
    return '\n'.join(lines) + '\n' + extra


def parse_text(tmp: Path, name: str, text: str) -> dict:
    p = tmp / name
    p.write_text(text)
    return rec.prom(str(p))


class BucketQuantileTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix='rec-bq-')
        self.addCleanup(self._tmp.cleanup)
        self.t = Path(self._tmp.name)

    def test_window_diff_excludes_previous_step(self) -> None:
        # 앞 계단 표본 100개(전부 0.1 이하)가 누적에 있다 — 창 차는 새 표본 100개만: 0.1~0.25 50개 · 0.25~0.5 50개
        a = parse_text(self.t, 'a', hist_text('h', [100, 100, 100, 100, 100, 100]))
        b = parse_text(self.t, 'b', hist_text('h', [100, 150, 200, 200, 200, 200]))
        self.assertAlmostEqual(rec.bucket_quantile(a, b, 'h', 0.5), 0.25)              # 순위 50 = 첫 칸(0.1~0.25) 끝
        self.assertAlmostEqual(rec.bucket_quantile(a, b, 'h', 0.95), 0.25 + 0.25 * (45 / 50))
        # 누적 그대로 읽으면(시작 캡처 없음) 앞 계단 표본이 섞여 p50이 0.1이 된다
        self.assertAlmostEqual(rec.bucket_quantile({}, b, 'h', 0.5), 0.1)

    def test_inf_bucket_returns_last_finite_edge(self) -> None:
        a = parse_text(self.t, 'a', hist_text('h', [0, 0, 0, 0, 0, 0]))
        b = parse_text(self.t, 'b', hist_text('h', [0, 0, 0, 10, 10, 100]))           # 90%가 1.5초 초과
        self.assertEqual(rec.bucket_quantile(a, b, 'h', 0.95), 1.5)

    def test_empty_bucket_hit_returns_upper_edge(self) -> None:
        # 순위 0(q=0)이 빈 첫 칸에 걸리면 compare.ts는 윗경계를 돌려준다(inBucket ≤ 0)
        a = parse_text(self.t, 'a', hist_text('h', [0, 0, 0, 0, 0, 0]))
        b = parse_text(self.t, 'b', hist_text('h', [0, 4, 4, 4, 4, 4]))
        self.assertEqual(rec.bucket_quantile(a, b, 'h', 0.0), 0.1)

    def test_no_samples_is_none(self) -> None:
        a = parse_text(self.t, 'a', hist_text('h', [5, 5, 5, 5, 5, 5]))
        self.assertIsNone(rec.bucket_quantile(a, a, 'h', 0.5))
        self.assertIsNone(rec.bucket_view(a, a, 'h'))
        self.assertIsNone(rec.bucket_quantile(a, a, 'missing', 0.5))

    def test_labels_merged_by_le(self) -> None:
        txt_a = 'h_bucket{x="1",le="1"} 0\nh_bucket{x="1",le="+Inf"} 0\nh_bucket{x="2",le="1"} 0\nh_bucket{x="2",le="+Inf"} 0\n'
        txt_b = 'h_bucket{x="1",le="1"} 10\nh_bucket{x="1",le="+Inf"} 10\nh_bucket{x="2",le="1"} 0\nh_bucket{x="2",le="+Inf"} 10\n'
        a, b = parse_text(self.t, 'a', txt_a), parse_text(self.t, 'b', txt_b)
        self.assertAlmostEqual(rec.bucket_quantile(a, b, 'h', 0.5), 1.0)              # 합 20 · 순위 10 = le 1 끝
        self.assertAlmostEqual(rec.bucket_quantile(a, b, 'h', 0.5, x='1'), 0.5)       # x=1만 — 10개 전부 0~1 · 순위 5


class RestartDetectedTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix='rec-rs-')
        self.addCleanup(self._tmp.cleanup)
        self.t = Path(self._tmp.name)

    def test_counter_decrease_is_restart(self) -> None:
        a = parse_text(self.t, 'a', 'ing_control_copy_rows_total 5000\nconsumer_lag 10\n')
        b = parse_text(self.t, 'b', 'ing_control_copy_rows_total 120\nconsumer_lag 10\n')
        self.assertTrue(rec.restart_detected(a, b))

    def test_bucket_decrease_is_restart(self) -> None:
        a = parse_text(self.t, 'a', hist_text('insert_duration', [5, 6, 7, 8, 9, 9]))
        b = parse_text(self.t, 'b', hist_text('insert_duration', [1, 2, 3, 4, 5, 5]))
        self.assertTrue(rec.restart_detected(a, b))

    def test_gauge_decrease_and_growth_are_not_restart(self) -> None:
        a = parse_text(self.t, 'a', 'rows_inserted 100\nconsumer_lag 9000\nnew_total 1\n')
        b = parse_text(self.t, 'b', 'rows_inserted 200\nconsumer_lag 10\n')     # 게이지 감소 · 계열 사라짐은 재기동 아님
        self.assertFalse(rec.restart_detected(a, b))
        self.assertIsNone(rec.restart_detected({}, b))

    def test_prom_client_gauge_named_total_is_not_restart(self) -> None:
        a = parse_text(self.t, 'a', 'nodejs_active_resources_total 19\ning_control_copy_rows_total 100\n')
        b = parse_text(self.t, 'b', 'nodejs_active_resources_total 16\ning_control_copy_rows_total 200\n')   # EXP-45 반복 1 100k 오판
        self.assertFalse(rec.restart_detected(a, b))


def worker_text(ins: list[float], cp: list[float], rows: float, cprows: float, fails: float) -> str:
    return (hist_text('insert_duration', ins) + hist_text('ing_control_copy_seconds', cp)
            + f'rows_inserted {rows}\ning_control_copy_rows_total {cprows}\ning_control_copy_failures_total {fails}\n'
            + 'dlq_count{reason="decode"} 0\n')


class Exp45Test(unittest.TestCase):
    """계단 디렉터리 셋 — 10k(둘 다 안 넘음) · 20k(COPY 실패 1 · 행 수 어긋남) · 50k(삽입 p95 > W)"""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix='rec-exp45-')
        self.addCleanup(self._tmp.cleanup)
        self.d = Path(self._tmp.name)
        (self.d / 'kv').mkdir()
        for k, v in {'exp': 'exp45', 'rep': '1', 'arm': 'stream', 'windowMs': '1000', 'copyTimeoutMs': '500',
                     'storeResources': rec.EXP45_CONTROL_RESOURCES, 'indexVariant': 'I1', 'drainS': '12',
                     'syncCommit': json.dumps({'user': 'app_rw', 'server': 'on', 'roleDb': None, 'role': None, 'db': None}),
                     'controlCopyOptions': '-c synchronous_commit=off', 'commit': 'abc1234',
                     'startCounts': '{"tagRaw": 0, "control": 0}'}.items():
            (self.d / 'kv' / k).write_text(v)
        self.step('01-10000', 10000, ins=[0, 90, 100, 100, 100, 100], cp=[0, 50, 100, 100, 100, 100], rows=1_800_000, fails=0, counts=(10, 10))
        self.step('02-20000', 20000, ins=[0, 90, 100, 100, 100, 100], cp=[0, 0, 60, 99, 99, 99], rows=3_600_000, fails=1, counts=(20, 19))
        self.step('03-50000', 50000, ins=[0, 0, 0, 50, 100, 100], cp=[0, 0, 100, 100, 100, 100], rows=9_000_000, fails=0, counts=(30, 30))

    def step(self, name: str, pps: int, *, ins: list, cp: list, rows: float, fails: float, counts: tuple) -> None:
        sd = self.d / 'steps' / name
        sd.mkdir(parents=True)
        (sd / 'meta').write_text('\n'.join([f'label={pps}', 'tier=M', f'pps={pps}', 'transS=60', 'winS=180',
                                            f'winStartMs={W0}', f'winEndMs={W0 + 180_000}', f'launchMs={W0 - 60_000}', f'exitMs={W0 + 185_000}']) + '\n')
        (sd / 'm0.worker').write_text(worker_text([0] * 6, [0] * 6, 0, 0, 0))
        (sd / 'm1.worker').write_text(worker_text(ins, cp, rows, rows - (1000 if fails else 0), fails))
        (sd / 'm0.api').write_text('pg_wal_bytes_total 100\n')
        (sd / 'm1.api').write_text('pg_wal_bytes_total 900\n')
        (sd / 'pg0.json').write_text('{"walBytes": 1000, "walFpi": 1, "walRecords": 10, "autovacuum": 2, "deadTuples": 0, "liveTuples": 0}')
        (sd / 'pg1.json').write_text('{"walBytes": 51000, "walFpi": 3, "walRecords": 90, "autovacuum": 3, "deadTuples": 5, "liveTuples": 9}')
        (sd / 'parts0.json').write_text('["4", "0", "0", "0"]')
        (sd / 'parts1.json').write_text('["7", "0", "0", "0"]')
        (sd / 'partlog.json').write_text('["12", "1000", "3", "5000", "4000"]')
        (sd / 'counts.json').write_text(json.dumps({'fromMs': 0, 'toMs': 1, 'tagRaw': counts[0], 'control': counts[1]}))
        (sd / 'modeb.json').write_text(json.dumps({'options': {'tier': 'M', 'pps': pps, 'durationSeconds': 245},
                                                   'result': {'generatedPoints': pps * 245, 'publishedPoints': pps * 245, 'lateTicks': 0}}))
        s0 = W0 // 1000
        (sd / 'win.samples').write_text(f'{s0} 100 90 10 1 1 0.01\n{s0 + 90} 300 250 50 1 1 0.01\n')

    def test_step_view_window_values(self) -> None:
        v = rec.exp45_step_view(str(self.d / 'steps' / '01-10000'), 1.0, 0.5)
        self.assertAlmostEqual(v['sinkTime']['clickhouse']['p50S'], 0.1 + 0.15 * 50 / 90)   # 순위 50 — 0.1~0.25 칸(90개) 안 보간
        self.assertAlmostEqual(v['sinkTime']['postgresql']['p50S'], 0.25)             # 순위 50 = 0.1~0.25 칸 끝
        self.assertEqual(v['sinkTime']['postgresql']['count'], 100.0)
        self.assertEqual(v['rows']['clickhouseRps'], 10000.0)                         # 1.8M ÷ 180초
        self.assertEqual(v['rows']['clickhouseAchieved'], 1.0)
        self.assertEqual(v['rows']['diff'], 0.0)
        pg = v['writeCost']['postgresql']
        self.assertEqual((pg['walBytes'], pg['autovacuum'], pg['deadTuplesEnd'], pg['deadTuplesDelta']), (50000.0, 1.0, 5.0, 5.0))
        self.assertEqual(pg['metricsRef']['walBytes'], 800.0)
        ch = v['writeCost']['clickhouse']
        self.assertEqual((ch['activePartsStart'], ch['activePartsEnd'], ch['merges'], ch['mergeWrittenBytes']), (4.0, 7.0, 3.0, 5000.0))
        self.assertEqual(v['lag']['max'], 300.0)
        self.assertFalse(v['restartDetected'])
        self.assertFalse(v['generatorSaturated'])
        self.assertEqual(v['passed'], {'clickhouse': False, 'postgresql': False})
        self.assertEqual(v['valid'], {'clickhouse': True, 'postgresql': True})

    def test_failure_step_is_pg_invalid_but_passes(self) -> None:
        v = rec.exp45_step_view(str(self.d / 'steps' / '02-20000'), 1.0, 0.5)
        self.assertEqual(v['failures']['copyFailures'], 1.0)
        self.assertEqual(v['rows']['diff'], 1000.0)                                    # 실패 배치 행 = 두 행 처리율의 차
        self.assertFalse(v['intervalCount']['match'])
        self.assertFalse(v['valid']['postgresql'])                                     # ⑥ 어긋난 계단의 PG 수치는 무효
        self.assertTrue(v['passed']['postgresql'])

    def test_judgement_points(self) -> None:
        j = rec.exp45_judgement([rec.exp45_step_view(str(p), 1.0, 0.5) for p in rec.steps_in(str(self.d))], 1.0, 0.5)
        self.assertEqual(j['clickhouse']['firstPps'], 50000.0)                        # 50k — 삽입 p95 1.45초 > W 1초
        self.assertEqual(j['postgresql']['firstPps'], 20000.0)
        self.assertEqual(j['postgresql']['byFailure'], 20000.0)
        self.assertIsNone(j['postgresql']['byP95'])
        self.assertEqual(j['postgresql']['observedRange'], {'minPps': 10000.0, 'maxPps': 50000.0})

    def test_ch_p95_over_w(self) -> None:
        # 50k 계단: 1초 이하 50 · 1~1.5초 50 — p95 순위 95 = 1 + 0.5 × 45/50 = 1.45 > W
        v = rec.exp45_step_view(str(self.d / 'steps' / '03-50000'), 1.0, 0.5)
        self.assertAlmostEqual(v['sinkTime']['clickhouse']['p95S'], 1.45)
        self.assertTrue(v['passed']['clickhouse'])
        # W를 2초로 두면(배치 안 B의 절반 규칙과 무관한 가정) 넘지 않는다 — 판정은 인자 W를 따른다
        self.assertFalse(rec.exp45_step_view(str(self.d / 'steps' / '03-50000'), 2.0, 1.0)['passed']['clickhouse'])

    def test_restart_invalidates_step(self) -> None:
        sd = self.d / 'steps' / '01-10000'
        # 창 안에서 worker가 재기동 — 누적 계열(ing_control_copy_rows_total)이 줄었다
        (sd / 'm0.worker').write_text(worker_text([0, 90, 100, 100, 100, 100], [0, 50, 100, 100, 100, 100], 9_999_999, 9_999_999, 0))
        (sd / 'm1.worker').write_text(worker_text([0, 90, 100, 100, 100, 100], [0, 50, 100, 100, 100, 100], 10, 10, 0))
        v = rec.exp45_step_view(str(sd), 1.0, 0.5)
        self.assertTrue(v['restartDetected'])
        self.assertEqual(v['valid'], {'clickhouse': False, 'postgresql': False})

    def test_not_exceeded_reports_range(self) -> None:
        import shutil
        shutil.rmtree(self.d / 'steps' / '02-20000')
        shutil.rmtree(self.d / 'steps' / '03-50000')
        j = rec.exp45_judgement([rec.exp45_step_view(str(p), 1.0, 0.5) for p in rec.steps_in(str(self.d))], 1.0, 0.5)
        self.assertIsNone(j['postgresql']['firstPps'])
        self.assertTrue(j['postgresql']['notExceededInRange'])
        self.assertEqual(j['clickhouse']['observedRange'], {'minPps': 10000.0, 'maxPps': 10000.0})

    def test_rec_line_and_stream_steps(self) -> None:
        row = rec.rec_exp45(str(self.d))
        self.assertEqual(row['kind'], 'exp45-control-stream')
        self.assertEqual(row['conditions']['cpuset'], 'control-equalized')
        self.assertEqual(row['conditions']['controlMemoryMb'], {'clickhouse': 3584, 'postgres': 3584})
        self.assertEqual((row['conditions']['windowMs'], row['conditions']['copyTimeoutMs']), (1000.0, 500.0))
        self.assertEqual(row['conditions']['batchPlan'], 'A')
        sc = row['conditions']['controlCopySyncCommit']
        # 기동 인자가 역할 · DB · 서버 설정보다 앞선다 — 서버 값 on은 참고 칸에만 남는다(H1)
        self.assertEqual((sc['effective'], sc['off']), ('off', True))
        self.assertEqual((sc['basis'], sc['imageCommit']), ('startup options(control-table-sink.port.ts)', 'abc1234'))
        self.assertEqual(sc['reference']['server'], 'on')
        self.assertTrue(row['drained'])
        t = rec.rec_exp45_stream_steps(self.raw([row, {**row, 'rep': 3}, {**row, 'rep': 2}]))
        self.assertEqual(t['reps'], [1, 2, 3])
        self.assertEqual(t['conditions'], {'flushWindowSeconds': 1.0, 'copyTimeoutSeconds': 0.5, 'batchPlan': 'A', 'controlCopySyncCommit': 'off'})
        self.assertEqual(len(t['streamSteps']), 3 * 2 * 2)                             # 계단 3 × 싱크 2 × p50 · p95
        self.assertEqual({s['metric'] for s in t['streamSteps']},
                         {'insert_duration_seconds_p50', 'insert_duration_seconds_p95', 'control_copy_seconds_p50', 'control_copy_seconds_p95'})
        pg20 = self.pick(t, 20000.0, 'postgresql', 'control_copy_seconds_p95')
        self.assertEqual(pg20['values'], [None, None, None])                           # 무효 계단 값은 싣지 않는다
        self.assertIsNone(pg20['median'])
        self.assertEqual(pg20['failures'], [1.0, 1.0, 1.0])                            # 구간 count 불일치여도 실패는 사실이다
        self.assertTrue(pg20['valid'])                                                 # 실패 ≥ 1 반복은 유효 — 판정 점(byFailure)이 표에서 빠지지 않는다
        ch10 = self.pick(t, 10000.0, 'clickhouse', 'insert_duration_seconds_p50')
        self.assertAlmostEqual(ch10['median'], 0.1 + 0.15 * 50 / 90)
        self.assertEqual(ch10['failures'], [0.0, 0.0, 0.0])
        self.assertEqual((t['repeat']['runs'], t['repeat']['deviation'], t['repeat']['threshold'], t['repeat']['discard']), (3, 0.0, 0.2, False))
        self.assertEqual([j['rep'] for j in t['judgement']], [1, 2, 3])

    def raw(self, rows: list) -> str:
        out = self.d / 'raw.jsonl'
        out.write_text(''.join(json.dumps(r) + '\n' for r in rows))
        return str(out)

    @staticmethod
    def pick(t: dict, pps: float, store: str, metric: str) -> dict:
        return next(s for s in t['streamSteps'] if s['pps'] == pps and s['store'] == store and s['metric'] == metric)

    def test_sync_commit_without_options_is_unknown(self) -> None:
        (self.d / 'kv' / 'controlCopyOptions').unlink()
        sc = rec.rec_exp45(str(self.d))['conditions']['controlCopySyncCommit']
        self.assertEqual((sc['effective'], sc['off']), (None, None))                  # 역할 · 서버 값으로 메우지 않는다
        with self.assertRaises(SystemExit):
            rec.rec_exp45_stream_steps(self.raw([{**rec.rec_exp45(str(self.d)), 'rep': n} for n in (1, 2, 3)]))

    def test_table_stops_on_condition_mismatch(self) -> None:
        row = rec.rec_exp45(str(self.d))
        other = json.loads(json.dumps(row))
        other['rep'] = 2
        other['conditions']['copyTimeoutMs'] = 250
        with self.assertRaises(SystemExit) as e:
            rec.rec_exp45_stream_steps(self.raw([row, other]))
        self.assertIn('copyTimeoutSeconds', str(e.exception))
        b = json.loads(json.dumps(row))
        b['conditions']['batchPlan'] = 'B'
        with self.assertRaises(SystemExit):                                            # L3 — 배치 안 A만
            rec.rec_exp45_stream_steps(self.raw([{**b, 'rep': n} for n in (1, 2, 3)]))

    def test_values_indexed_by_rep_and_gaps(self) -> None:
        row = rec.rec_exp45(str(self.d))
        r2 = json.loads(json.dumps(row))
        r2['rep'] = 2
        r2['steps'] = [s for s in r2['steps'] if s['pps'] != 50000.0]                  # 반복 2는 50k 계단을 돌지 않았다
        t = rec.rec_exp45_stream_steps(self.raw([{**row, 'rep': 3}, r2, row]))
        ch50 = self.pick(t, 50000.0, 'clickhouse', 'insert_duration_seconds_p95')
        self.assertEqual(ch50['values'], [1.45, None, 1.45])                           # 자리 = 반복 번호 순 · 빈 자리 None
        self.assertEqual(ch50['failures'], [0.0, None, 0.0])
        self.assertIsNone(ch50['median'])                                              # L2 — 유효 2회 < 3
        with self.assertRaises(SystemExit):                                            # 반복 번호 중복
            rec.rec_exp45_stream_steps(self.raw([row, row, {**row, 'rep': 2}]))
        dup = json.loads(json.dumps(row))
        dup['steps'].append(dup['steps'][0])
        with self.assertRaises(SystemExit):                                            # 한 반복 안 같은 pps 둘
            rec.rec_exp45_stream_steps(self.raw([dup, {**row, 'rep': 2}, {**row, 'rep': 3}]))

    def test_restart_or_saturation_voids_failures(self) -> None:
        row = rec.rec_exp45(str(self.d))
        r2, r3 = json.loads(json.dumps(row)), json.loads(json.dumps(row))
        r2['rep'], r3['rep'] = 2, 3
        r2['steps'][1]['restartDetected'] = True                                      # 20k 계단 재기동
        r3['steps'][1]['generatorSaturated'] = True                                   # 20k 계단 생성기 포화
        t = rec.rec_exp45_stream_steps(self.raw([row, r2, r3]))
        self.assertEqual(self.pick(t, 20000.0, 'postgresql', 'control_copy_seconds_p50')['failures'], [1.0, None, None])
        self.assertEqual(self.pick(t, 20000.0, 'clickhouse', 'insert_duration_seconds_p50')['failures'], [0.0, None, None])
        self.assertTrue(self.pick(t, 20000.0, 'clickhouse', 'insert_duration_seconds_p50')['valid'])  # 유효 반복 1 — 행은 유효

    def test_all_reps_invalid_row_is_valid_false(self) -> None:
        row = rec.rec_exp45(str(self.d))
        rows = [json.loads(json.dumps(row)) for _ in range(3)]
        for n, r in enumerate(rows, 1):
            r['rep'] = n
            r['steps'][2].update({'restartDetected': True, 'valid': {'clickhouse': False, 'postgresql': False}})  # 50k 전 반복 재기동
            r['steps'][1]['failures']['copyFailures'] = 0.0                            # 20k — 행 수 어긋남 · 실패 0
        t = rec.rec_exp45_stream_steps(self.raw(rows))
        for store, metric in rec.EXP45_METRICS:
            for q in ('p50', 'p95'):
                s50 = self.pick(t, 50000.0, store, f'{metric}_{q}')
                self.assertEqual((s50['values'], s50['median'], s50['failures'], s50['valid']), ([None] * 3, None, [None] * 3, False))
        pg20 = self.pick(t, 20000.0, 'postgresql', 'control_copy_seconds_p50')
        self.assertEqual((pg20['failures'], pg20['valid']), ([0.0] * 3, False))       # 수치 무효 · 실패 0 — 유효 반복 0
        self.assertTrue(self.pick(t, 20000.0, 'clickhouse', 'insert_duration_seconds_p50')['valid'])
        self.assertTrue(all(s['valid'] for s in t['streamSteps'] if s['pps'] == 10000.0))

    def test_repeat_short_runs_discard_and_no_deviation_stops(self) -> None:
        row = rec.rec_exp45(str(self.d))
        rp = rec.rec_exp45_stream_steps(self.raw([row, {**row, 'rep': 2}]))['repeat']
        self.assertEqual((rp['runs'], rp['deviation'], rp['discard']), (2, None, True))  # 반복 3 미만 — 폐기
        rows = [json.loads(json.dumps(row)) for _ in range(3)]
        for n, r in enumerate(rows, 1):
            r['rep'] = n
        for s in rows[2]['steps']:
            s['valid'] = {'clickhouse': False, 'postgresql': False}                   # 반복 3 전 계단 무효 → 중앙값 있는 p50 행 0
        with self.assertRaises(SystemExit) as e:
            rec.rec_exp45_stream_steps(self.raw(rows))
        self.assertIn('p50', str(e.exception))

    def test_repeat_deviation_discards_on_p50_only(self) -> None:
        row = rec.rec_exp45(str(self.d))
        rows = [json.loads(json.dumps(row)) for _ in range(3)]
        for n, r in enumerate(rows, 1):
            r['rep'] = n
        # 10k ClickHouse — p50 0.20 · 0.21 · 0.22(편차 0.02 ÷ 0.21) · p95 0.5 · 0.9 · 1.3(편차 0.8 ÷ 0.9 — 참고)
        for r, p50, p95 in zip(rows, (0.20, 0.21, 0.22), (0.5, 0.9, 1.3)):
            r['steps'][0]['sinkTime']['clickhouse'].update({'p50S': p50, 'p95S': p95})
        rp = rec.rec_exp45_stream_steps(self.raw(rows))['repeat']
        self.assertAlmostEqual(rp['deviation'], 0.02 / 0.21)
        self.assertAlmostEqual(rp['deviationP95'], 0.8 / 0.9)
        self.assertFalse(rp['discard'])                                                # p95 편차 초과는 폐기하지 않는다
        for r, p50 in zip(rows, (0.1, 0.2, 0.3)):
            r['steps'][0]['sinkTime']['clickhouse']['p50S'] = p50
        rp = rec.rec_exp45_stream_steps(self.raw(rows))['repeat']
        self.assertAlmostEqual(rp['deviation'], 1.0)
        self.assertTrue(rp['discard'])

    def test_failure_log_parse(self) -> None:
        (self.d / 'copy-failures.log').write_text(
            '[Nest] 1 - 09/26/2026 ERROR [ControlTableSink] {"event":"control_copy_failed","ts_min":1,"ts_max":2,"rows":1000,"token":"t","error":"COPY 타임아웃 500 ms"}\n'
            'garbage line\n')
        ev = rec.exp45_failure_log(str(self.d / 'copy-failures.log'))
        self.assertEqual(len(ev), 1)
        self.assertEqual((ev[0]['rows'], ev[0]['ts_min']), (1000, 1))


if __name__ == '__main__':
    unittest.main()
