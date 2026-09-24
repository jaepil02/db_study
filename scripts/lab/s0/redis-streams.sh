#!/usr/bin/env bash
# S0 실습 ① — Redis Stream 명령 7개(XADD · XGROUP · XREADGROUP · XPENDING · XACK · XAUTOCLAIM · XINFO)
# 목표: at-least-once의 실체가 PEL이라는 것을 눈으로 본다(docs/01_overview/05_priorities_roadmap.md S0).
# 키는 실제 설계 이름(docs/05_data_stores/05_redis_keyspace.md) — stream:plc:raw · grp:ingest. 끝에 DEL로 치운다.
# 페이로드는 실습용 평문 필드다(실제 계약은 MessagePack 컬럼 배열 — docs/06_pipeline/12_data_contract.md).
source "$(dirname "$0")/_lib.sh"
K=stream:plc:raw
G=grp:ingest

step "0. 빈 상태 확인"
r EXISTS $K

step "1. XADD — 스캔 사이클 5개를 발행한다(MAXLEN ~ 근사 트리밍)"
for i in 1 2 3 4 5; do r XADD $K MAXLEN '~' 1000 '*' d 1 s $i va "1.$i"; done
r XLEN $K

step "2. XGROUP CREATE — 처음부터(0) 읽는 컨슈머 그룹"
r XGROUP CREATE $K $G 0

step "3. XREADGROUP — c1이 3개를 가져간다(> = 아직 누구에게도 전달되지 않은 것)"
r XREADGROUP GROUP $G c1 COUNT 3 STREAMS $K '>'

step "4. XPENDING — 가져갔지만 XACK하지 않은 엔트리가 PEL에 남는다"
r XPENDING $K $G
r XPENDING $K $G - + 10

step "5. XACK — 하나만 확인한다(= ClickHouse 삽입 성공 뒤에만 하는 동작)"
first=$(docker exec "$RD" redis-cli XPENDING $K $G - + 1 | head -1)
r XACK $K $G "$first"
r XPENDING $K $G

step "6. XAUTOCLAIM — c1이 죽었다고 보고 c2가 1초 넘게 묵은 PEL을 회수한다"
sleep 1.2
r XAUTOCLAIM $K $G c2 1000 0-0 COUNT 10
r XPENDING $K $G - + 10     # 소유자 c2 · 전달 횟수 2

step "7. XINFO — 스트림 · 그룹(lag · entries-read) · 컨슈머"
r XINFO STREAM $K
r XINFO GROUPS $K
r XINFO CONSUMERS $K $G

step "8. 트리밍 실험 — 미확인 엔트리를 MAXLEN으로 잘라도 PEL 항목은 남는다(stream_trimmed_unacked)"
r XADD $K MAXLEN = 2 '*' d 1 s 6 va 1.6
r XLEN $K
r XPENDING $K $G - + 10     # 잘린 엔트리 ID가 여전히 PEL에 있다
r XRANGE $K - +
sleep 1.2
r XAUTOCLAIM $K $G c3 1000 0-0 COUNT 10   # 셋째 원소 = 스트림에서 사라져 PEL에서 지운 ID
r XPENDING $K $G

step "9. 정리"
r DEL $K
r DBSIZE
