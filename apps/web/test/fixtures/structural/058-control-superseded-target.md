# 058 — 059가 supersedes로 가리키는 대조 기록(원천에서 뺀다)

테스트 픽스처 — 수치는 형식 예시이며 측정값이 아니다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "058",
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
      "query": "Q3",
      "cache": "warm",
      "pgVariant": "I2",
      "crossover": [
        "10^5.75",
        "10^6"
      ],
      "undetermined": []
    }
  ]
}
```
