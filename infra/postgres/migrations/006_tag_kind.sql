-- 006 — tag_master.tag_kind 태그 종류(D-16 결정 3 · 카드 라인 시드 · 정본 docs/05_data_stores/01_postgresql_schema.md §tag_master)
-- 값 집합은 packages/shared/src/card-line.ts TAG_KINDS 8과 같다 — 온도 · 압력 · 속도 · 전류 · 진동 · 수량 · 상태 · 기타.
-- NULL 허용 — S2 슬라이스 · 시연 설비(DEMO-FLOW-DEV) · 마스터 표면으로 만든 태그는 종류가 없다(가상 PLC는 종류가 없으면 GEN_PROFILE 구성을 쓴다).
-- 기존 행은 건드리지 않는다(종류는 시드가 채운다) · 001의 기본 권한(app_rw SELECT · INSERT · UPDATE)이 새 컬럼에도 그대로 걸린다.

-- Up Migration
SET ROLE app_owner;

ALTER TABLE tag_master
  ADD COLUMN tag_kind text
  CHECK (tag_kind IN ('TEMP', 'PRESSURE', 'SPEED', 'CURRENT', 'VIBRATION', 'COUNT', 'STATE', 'OTHER'));

RESET ROLE;
