# 042 — EXP-42 픽스처

> 테스트 픽스처 — 측정값이 아니다(apps/web/test/evidence.test.ts 전용)

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "042",
  "exp": [
    "EXP-42"
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
    "SW-09": "off",
    "SW-10": "off",
    "SW-11": "ingest"
  },
  "conditions": {
    "injectionMode": null,
    "observability": "off",
    "cpuset": "control-equalized",
    "seed": 42,
    "generatorCpuMax": null,
    "compression": "zstd",
    "swapUsed": false,
    "wslNetworking": "mirrored",
    "simFaultPlan": null
  },
  "repeat": {
    "runs": 3,
    "deviation": 0,
    "threshold": 0.2
  },
  "results": [],
  "reverse": [
    {
      "exp": "EXP-42",
      "op": "atomic",
      "store": "postgresql",
      "variant": "pg_tx",
      "scale": 10000,
      "concurrency": 2,
      "rate": null,
      "read": null,
      "metric": "partial_apply_count",
      "unit": "count",
      "values": [
        0,
        0,
        0
      ],
      "median": null,
      "structural": true
    },
    {
      "exp": "EXP-42",
      "op": "atomic",
      "store": "clickhouse",
      "variant": "lightweight_update",
      "scale": 10000,
      "concurrency": 2,
      "rate": null,
      "read": null,
      "metric": "partial_apply_count",
      "unit": "count",
      "values": [
        1,
        1,
        1
      ],
      "median": null,
      "structural": true
    },
    {
      "exp": "EXP-42",
      "op": "atomic",
      "store": "postgresql",
      "variant": "pg_tx",
      "scale": 10000,
      "concurrency": 2,
      "rate": null,
      "read": null,
      "metric": "race_violation_count",
      "unit": "count",
      "values": [
        0,
        0,
        0
      ],
      "median": null,
      "structural": true
    },
    {
      "exp": "EXP-42",
      "op": "atomic",
      "store": "clickhouse",
      "variant": "lightweight_update",
      "scale": 10000,
      "concurrency": 2,
      "rate": null,
      "read": null,
      "metric": "race_violation_count",
      "unit": "count",
      "values": [
        0,
        1,
        1
      ],
      "median": null,
      "structural": true
    }
  ]
}
```

