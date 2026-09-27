# 053 — 격자 2차 정밀화 모양(discarded · structuralRanges)

테스트 픽스처 — 수치는 형식 예시이며 측정값이 아니다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "053",
  "exp": [
    "EXP-01",
    "EXP-02",
    "EXP-03",
    "EXP-04",
    "EXP-05"
  ],
  "status": "discarded",
  "supersedes": null,
  "window": {
    "start": "2026-09-27T07:00:41.533Z",
    "end": "2026-09-27T09:21:32.963Z"
  },
  "run": {
    "commitHash": "c89b982",
    "memoryProfile": "load",
    "memoryLimitMb": null,
    "capacityTier": "해당 없음",
    "memoryLimitSource": "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음"
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
    "injectionMode": "D",
    "tieRule": "CH client median < 10 ms and |CH - PG| client median diff < 1 ms -> winner by server µs median"
  },
  "repeat": {
    "runs": 3,
    "deviation": 20.0352,
    "threshold": 0.2
  },
  "results": [],
  "points": [
    {
      "query": "Q1",
      "rows": 17780000,
      "stage": null,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1,
        2,
        3
      ],
      "median": 2,
      "resultMatch": true
    }
  ],
  "axes": [],
  "structuralRanges": [
    {
      "query": "Q1",
      "cache": "warm",
      "pgVariant": "I2",
      "crossover": null,
      "winner": "postgresql",
      "range": [
        "10^5",
        "10^9"
      ],
      "undetermined": []
    },
    {
      "query": "Q1",
      "cache": "cold",
      "pgVariant": "I2",
      "crossover": [
        "10^7",
        "10^7.25"
      ],
      "undetermined": []
    },
    {
      "query": "Q2",
      "cache": "warm",
      "pgVariant": "I2",
      "crossover": [
        "10^7.5",
        "10^8.25"
      ],
      "undetermined": [
        "10^8"
      ],
      "from": "postgresql",
      "to": "clickhouse"
    },
    {
      "query": "Q5",
      "cache": "warm",
      "pgVariant": "I1",
      "crossover": null,
      "winner": "clickhouse",
      "range": [
        "10^5.5",
        "10^9"
      ],
      "undetermined": [
        "10^5"
      ]
    },
    {
      "query": "Q9",
      "cache": "warm",
      "pgVariant": "I2",
      "crossover": null,
      "winner": "mysql",
      "range": [
        "10^5",
        "10^9"
      ],
      "undetermined": []
    },
    {
      "query": "Q3",
      "cache": "cold",
      "pgVariant": "I2",
      "crossover": [
        "1e7",
        "10^7.25"
      ],
      "undetermined": []
    },
    {
      "query": "Q4",
      "cache": "cold",
      "pgVariant": "I2",
      "crossover": [
        "10^6",
        "10^7"
      ],
      "winner": "clickhouse",
      "range": [
        "10^5",
        "10^9"
      ],
      "undetermined": []
    }
  ]
}
```
