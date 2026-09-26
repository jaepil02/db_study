# 049 — 편차 초과

> 테스트 픽스처 — 측정값이 아니다(apps/web/test/evidence.test.ts 전용)

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "049",
  "exp": [
    "EXP-40"
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
    "deviation": 0.3,
    "threshold": 0.2
  },
  "results": [],
  "reverse": [
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "postgresql",
      "variant": "pg_update",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "update_latency_p95",
      "unit": "ms",
      "values": [
        1.0,
        1.1,
        0.9
      ],
      "median": 1.0
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "alter_update_async",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "update_latency_p95",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        5.0
      ],
      "median": 5.0
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "lightweight_update",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "update_latency_p95",
      "unit": "ms",
      "values": [
        2.0,
        2.0,
        2.0
      ],
      "median": 2.0
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "postgresql",
      "variant": "pg_update",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "visible_after_ack",
      "unit": "ms",
      "values": [
        0.3,
        0.2,
        0.4
      ],
      "median": 0.3
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "alter_update_async",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": "apply_mutations_on_fly=0",
      "metric": "visible_after_ack",
      "unit": "ms",
      "values": [
        null,
        null,
        null
      ],
      "median": null
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "alter_update_async",
      "scale": 10000,
      "concurrency": 1,
      "rate": null,
      "read": "apply_mutations_on_fly=1",
      "metric": "visible_after_ack",
      "unit": "ms",
      "values": [
        0.5,
        0.6,
        0.5
      ],
      "median": 0.5
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "postgresql",
      "variant": "pg_update",
      "scale": 100000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "update_latency_p95",
      "unit": "ms",
      "values": [
        1.2,
        1.32,
        1.08
      ],
      "median": 1.2
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "alter_update_async",
      "scale": 100000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "update_latency_p95",
      "unit": "ms",
      "values": [
        40.0,
        40.0,
        40.0
      ],
      "median": 40.0
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "lightweight_update",
      "scale": 100000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "update_latency_p95",
      "unit": "ms",
      "values": [
        2.5,
        2.5,
        2.5
      ],
      "median": 2.5
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "postgresql",
      "variant": "pg_update",
      "scale": 100000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "visible_after_ack",
      "unit": "ms",
      "values": [
        0.3,
        0.2,
        0.4
      ],
      "median": 0.3
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "alter_update_async",
      "scale": 100000,
      "concurrency": 1,
      "rate": null,
      "read": "apply_mutations_on_fly=0",
      "metric": "visible_after_ack",
      "unit": "ms",
      "values": [
        null,
        null,
        null
      ],
      "median": null
    },
    {
      "exp": "EXP-40",
      "op": "update",
      "store": "clickhouse",
      "variant": "alter_update_async",
      "scale": 100000,
      "concurrency": 1,
      "rate": null,
      "read": "apply_mutations_on_fly=1",
      "metric": "visible_after_ack",
      "unit": "ms",
      "values": [
        0.5,
        0.6,
        0.5
      ],
      "median": 0.5
    }
  ]
}
```

