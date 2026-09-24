#!/usr/bin/env python3
# /metrics 두 캡처의 차로 판정 창 히스토그램을 만든다 — 누적 카운터라 창 = 끝 − 시작(10_observability/04 §초기 상태 메트릭 누적값).
# 분위수는 버킷 선형 보간 추정이다(버킷 경계가 해상도) — 기록에는 버킷 추정임을 적는다.
# 사용: hist-diff.py <시작 캡처> <끝 캡처> <메트릭 이름 …> [--label key=value]  → JSON 한 줄
import json
import re
import sys

LINE = re.compile(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(\S+)$')


def parse(path):
    out = {}
    with open(path) as f:
        for ln in f:
            if ln.startswith('#'):
                continue
            m = LINE.match(ln.strip())
            if m:
                out[(m.group(1), m.group(2) or '')] = float(m.group(3))
    return out


def labels(s):
    return dict(re.findall(r'(\w+)="([^"]*)"', s))


def hist(a, b, name, want):
    buckets = {}
    total = sm = 0.0
    for (n, l), v in b.items():
        lab = labels(l)
        if any(lab.get(k) != val for k, val in want.items()):
            continue
        d = v - a.get((n, l), 0.0)
        if n == f'{name}_bucket':
            le = lab['le']
            buckets[float('inf') if le == '+Inf' else float(le)] = buckets.get(
                float('inf') if le == '+Inf' else float(le), 0.0) + d
        elif n == f'{name}_count':
            total += d
        elif n == f'{name}_sum':
            sm += d
    edges = sorted(buckets)

    def q(p):
        if total <= 0:
            return None
        target = p * total
        prev_le, prev_c = 0.0, 0.0
        for le in edges:
            c = buckets[le]
            if c >= target:
                if le == float('inf'):
                    return prev_le
                span = c - prev_c
                return prev_le + (le - prev_le) * ((target - prev_c) / span if span else 0)
            prev_le, prev_c = le, c
        return prev_le

    return {
        'metric': name,
        'count': total,
        'meanS': sm / total if total else None,
        'p50S': q(0.5),
        'p95S': q(0.95),
        'p99S': q(0.99),
    }


def main():
    args = sys.argv[1:]
    want = {}
    if '--label' in args:
        i = args.index('--label')
        for kv in args[i + 1:]:
            k, v = kv.split('=', 1)
            want[k] = v
        args = args[:i]
    a, b = parse(args[0]), parse(args[1])
    print(json.dumps([hist(a, b, n, want) for n in args[2:]], ensure_ascii=False))


if __name__ == '__main__':
    main()
