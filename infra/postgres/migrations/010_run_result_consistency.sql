-- 010 — 직접 비교 ③을 무결성 규칙 시험(integrity)에서 데이터 정합성 대조(consistency)로 바꾼다(사용자 결정 2026-10-12 · 정본 docs/07_api/09_datagen.md §데이터 정합성)
-- 같은 센서 데이터를 두 저장소에 넣은 뒤 1분 칸마다 행 수 · 값 체크섬을 맞춰 보는 읽기 전용 부분이다 — 규칙 시험 3종은 지웠다.
-- 옛 integrity 결과 행은 지운다 — 지운 실험의 시연값이라 다시 읽을 화면 · 표면이 없고(측정 기록 아님), 남기면 part 값 집합이 둘로 갈린다.

-- Up Migration
SET ROLE app_owner;

DELETE FROM run_result WHERE part = 'integrity';

ALTER TABLE run_result DROP CONSTRAINT run_result_part_check;
ALTER TABLE run_result
  ADD CONSTRAINT run_result_part_check CHECK (part IN ('ingest', 'query', 'consistency'));

RESET ROLE;
