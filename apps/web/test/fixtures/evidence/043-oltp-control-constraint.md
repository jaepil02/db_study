# 043 — EXP-43 픽스처

> 테스트 픽스처 — 측정값이 아니다(apps/web/test/evidence.test.ts 전용)

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "043",
  "exp": [
    "EXP-43"
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
    "deviation": 0.05,
    "threshold": 0.2
  },
  "results": [],
  "reverse": [
    {
      "exp": "EXP-43",
      "op": "duplicate_order_no",
      "store": "postgresql",
      "variant": "pg_unique",
      "scale": 10000,
      "concurrency": 8,
      "rate": null,
      "read": null,
      "metric": "accepted_count",
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
      "exp": "EXP-43",
      "op": "duplicate_order_no",
      "store": "clickhouse",
      "variant": "mergetree",
      "scale": 10000,
      "concurrency": 8,
      "rate": null,
      "read": null,
      "metric": "accepted_count",
      "unit": "count",
      "values": [
        8,
        8,
        8
      ],
      "median": null,
      "structural": true
    },
    {
      "exp": "EXP-43",
      "op": "duplicate_order_no",
      "store": "clickhouse",
      "variant": "rmt",
      "scale": 10000,
      "concurrency": 8,
      "rate": null,
      "read": null,
      "metric": "accepted_count",
      "unit": "count",
      "values": [
        8,
        8
      ],
      "median": null,
      "structural": true
    },
    {
      "exp": "EXP-43",
      "op": "final_read",
      "store": "clickhouse",
      "variant": "rmt",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "final_query_ms",
      "unit": "ms",
      "values": [
        3.0,
        3.2,
        2.9
      ],
      "median": 3.0
    },
    {
      "exp": "EXP-43",
      "op": "final_read",
      "store": "clickhouse",
      "variant": "rmt_no_final",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "final_query_ms",
      "unit": "ms",
      "values": [
        1.0,
        1.1,
        0.9
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "postgresql",
      "variant": "pg_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 50,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        1,
        1,
        1
      ],
      "median": 1
    }
  ]
}
```

