# 050 — EXP-41 정정 픽스처

> 테스트 픽스처 — 측정값이 아니다(apps/web/test/evidence.test.ts 전용)

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "050",
  "exp": [
    "EXP-41"
  ],
  "status": "valid",
  "supersedes": "041",
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
      "exp": "EXP-41",
      "op": "point",
      "store": "postgresql",
      "variant": "pk_btree",
      "scale": 1000000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "read_rows",
      "unit": "rows",
      "values": [
        2,
        2,
        2
      ],
      "median": 2
    },
    {
      "exp": "EXP-41",
      "op": "point",
      "store": "clickhouse",
      "variant": "granularity_8192",
      "scale": 1000000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "read_rows",
      "unit": "rows",
      "values": [
        8192,
        8192,
        8192
      ],
      "median": 8192
    },
    {
      "exp": "EXP-41",
      "op": "point",
      "store": "clickhouse",
      "variant": "granularity_256",
      "scale": 1000000,
      "concurrency": 1,
      "rate": null,
      "read": null,
      "metric": "read_rows",
      "unit": "rows",
      "values": [
        256,
        256,
        256
      ],
      "median": 256
    },
    {
      "exp": "EXP-41",
      "op": "point",
      "store": "postgresql",
      "variant": "pk_btree",
      "scale": 1000000,
      "concurrency": 8,
      "rate": null,
      "read": null,
      "metric": "read_rows",
      "unit": "rows",
      "values": [
        1,
        1,
        1
      ],
      "median": 1
    },
    {
      "exp": "EXP-41",
      "op": "point",
      "store": "clickhouse",
      "variant": "granularity_8192",
      "scale": 1000000,
      "concurrency": 8,
      "rate": null,
      "read": null,
      "metric": "read_rows",
      "unit": "rows",
      "values": [
        8192,
        8192,
        8192
      ],
      "median": 8192
    },
    {
      "exp": "EXP-41",
      "op": "point",
      "store": "clickhouse",
      "variant": "granularity_256",
      "scale": 1000000,
      "concurrency": 8,
      "rate": null,
      "read": null,
      "metric": "read_rows",
      "unit": "rows",
      "values": [
        256,
        256,
        256
      ],
      "median": 256
    }
  ]
}
```

