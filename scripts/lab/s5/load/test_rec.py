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


if __name__ == '__main__':
    unittest.main()
