# 047 — 블록 둘

> 테스트 픽스처 — 측정값이 아니다(apps/web/test/evidence.test.ts 전용)

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "047",
  "exp": [
    "EXP-44"
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
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 50,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "async_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 50,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 50,
      "read": null,
      "metric": "active_parts",
      "unit": "parts",
      "values": [
        100,
        100,
        100
      ],
      "median": 100
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "postgresql",
      "variant": "pg_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        20.0,
        20.0,
        20.0
      ],
      "median": 20.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "async_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "active_parts",
      "unit": "parts",
      "values": [
        400,
        400,
        400
      ],
      "median": 400
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "postgresql",
      "variant": "pg_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        50.0,
        50.0,
        50.0
      ],
      "median": 50.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "async_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "active_parts",
      "unit": "parts",
      "values": [
        1000,
        1000,
        1000
      ],
      "median": 1000
    }
  ]
}
```

```json
{
  "schema": "measurement/v1",
  "record": "047",
  "exp": [
    "EXP-44"
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
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 50,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "async_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 50,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 50,
      "read": null,
      "metric": "active_parts",
      "unit": "parts",
      "values": [
        100,
        100,
        100
      ],
      "median": 100
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "postgresql",
      "variant": "pg_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        20.0,
        20.0,
        20.0
      ],
      "median": 20.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "async_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 200,
      "read": null,
      "metric": "active_parts",
      "unit": "parts",
      "values": [
        400,
        400,
        400
      ],
      "median": 400
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "postgresql",
      "variant": "pg_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        50.0,
        50.0,
        50.0
      ],
      "median": 50.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "async_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "insert_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-44",
      "op": "insert",
      "store": "clickhouse",
      "variant": "sync_insert",
      "scale": 10000,
      "concurrency": 1,
      "rate": 500,
      "read": null,
      "metric": "active_parts",
      "unit": "parts",
      "values": [
        1000,
        1000,
        1000
      ],
      "median": 1000
    }
  ]
}
```

