# 045 — EXP-45 픽스처

> 테스트 픽스처 — 측정값이 아니다(apps/web/test/evidence.test.ts 전용)
>
> 러너 table 출력 모양(scripts/lab/s5/load/_rec.py exp45-stream-steps) — conditions 4키 · 행 valid · 100,000 계단 반복 2 재기동(반복 자리 null) · 150,000 계단 전 반복 재기동(valid false)

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "045",
  "exp": [
    "EXP-45"
  ],
  "status": "valid",
  "supersedes": null,
  "window": {
    "start": "2026-10-01T00:00:00.000Z",
    "end": "2026-10-01T01:00:00.000Z"
  },
  "run": {
    "commitHash": "f1x7ure",
    "memoryProfile": "control",
    "memoryLimitMb": 3584,
    "capacityTier": "n/a"
  },
  "switches": {
    "SW-01": "on",
    "SW-02": "on",
    "SW-03": "on",
    "SW-04": "on",
    "SW-05": "on",
    "SW-06": "on",
    "SW-07": 100,
    "SW-08": "on",
    "SW-09": "on",
    "SW-10": "off",
    "SW-11": "ingest"
  },
  "conditions": {
    "injectionMode": "B",
    "observability": "off",
    "cpuset": "control-equalized",
    "seed": 42,
    "generatorCpuMax": null,
    "compression": "zstd",
    "swapUsed": false,
    "wslNetworking": "mirrored",
    "simFaultPlan": null,
    "copyTimeoutSeconds": 0.5,
    "flushWindowSeconds": 1,
    "batchPlan": "A",
    "controlCopySyncCommit": "off"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.05,
    "threshold": 0.2
  },
  "results": [],
  "streamSteps": [
    {
      "pps": 10000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p95",
      "unit": "s",
      "values": [
        0.2,
        0.2,
        0.2
      ],
      "median": 0.2,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 10000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p50",
      "unit": "s",
      "values": [
        0.1,
        0.1,
        0.1
      ],
      "median": 0.1,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 10000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p95",
      "unit": "s",
      "values": [
        0.05,
        0.05,
        0.05
      ],
      "median": 0.05,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 10000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p50",
      "unit": "s",
      "values": [
        0.025,
        0.025,
        0.025
      ],
      "median": 0.025,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 50000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p95",
      "unit": "s",
      "values": [
        1.5,
        1.5,
        1.5
      ],
      "median": 1.5,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 50000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p50",
      "unit": "s",
      "values": [
        0.75,
        0.75,
        0.75
      ],
      "median": 0.75,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 50000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p95",
      "unit": "s",
      "values": [
        0.1,
        0.1,
        0.1
      ],
      "median": 0.1,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 50000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p50",
      "unit": "s",
      "values": [
        0.05,
        0.05,
        0.05
      ],
      "median": 0.05,
      "failures": [
        0,
        0,
        0
      ],
      "valid": true
    },
    {
      "pps": 100000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p95",
      "unit": "s",
      "values": [
        3.0,
        null,
        3.0
      ],
      "median": null,
      "failures": [
        0,
        null,
        1
      ],
      "valid": true
    },
    {
      "pps": 100000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p50",
      "unit": "s",
      "values": [
        1.5,
        null,
        1.5
      ],
      "median": null,
      "failures": [
        0,
        null,
        1
      ],
      "valid": true
    },
    {
      "pps": 100000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p95",
      "unit": "s",
      "values": [
        0.2,
        null,
        0.2
      ],
      "median": null,
      "failures": [
        0,
        null,
        0
      ],
      "valid": true
    },
    {
      "pps": 100000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p50",
      "unit": "s",
      "values": [
        0.1,
        null,
        0.1
      ],
      "median": null,
      "failures": [
        0,
        null,
        0
      ],
      "valid": true
    },
    {
      "pps": 150000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p95",
      "unit": "s",
      "values": [
        null,
        null,
        null
      ],
      "median": null,
      "failures": [
        null,
        null,
        null
      ],
      "valid": false
    },
    {
      "pps": 150000,
      "store": "postgresql",
      "metric": "control_copy_seconds_p50",
      "unit": "s",
      "values": [
        null,
        null,
        null
      ],
      "median": null,
      "failures": [
        null,
        null,
        null
      ],
      "valid": false
    },
    {
      "pps": 150000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p95",
      "unit": "s",
      "values": [
        null,
        null,
        null
      ],
      "median": null,
      "failures": [
        null,
        null,
        null
      ],
      "valid": false
    },
    {
      "pps": 150000,
      "store": "clickhouse",
      "metric": "insert_duration_seconds_p50",
      "unit": "s",
      "values": [
        null,
        null,
        null
      ],
      "median": null,
      "failures": [
        null,
        null,
        null
      ],
      "valid": false
    }
  ]
}
```

