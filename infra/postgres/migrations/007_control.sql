-- 007 — 대조군 plc_tag_raw_control(정본 docs/05_data_stores/10_olap_vs_rdb_control.md §동형 설계 DDL · §인덱스 변형 I1)
-- 컬럼 순서는 정렬 여백 0(8바이트 4 → 4바이트 2 → 2바이트 1) · PK · UNIQUE · FK 없음(비교 축 오염 방지)
-- 일 파티션 · 경계 Asia/Seoul 자정(DB 기본 timezone) · 보존 tag_raw와 같은 7일 · 파티션 DROP(08_retention_lifecycle #12 · 정리 주체 app_owner)
-- 인덱스 변형 I2(btree device_id · tag_id · ts)는 실험 조건이라 여기서 만들지 않는다.

-- Up Migration
SET ROLE app_owner;

CREATE TABLE plc_tag_raw_control (
  ts          timestamptz      NOT NULL,
  value       double precision NOT NULL,
  scan_seq    bigint           NOT NULL,
  ingested_at timestamptz      NOT NULL DEFAULT now(),
  device_id   integer          NOT NULL,
  tag_id      integer          NOT NULL,
  quality     smallint         NOT NULL
) PARTITION BY RANGE (ts);

CREATE INDEX plc_tag_raw_control_ts_brin ON plc_tag_raw_control USING brin (ts);

SELECT partman.create_parent(
  p_parent_table => 'public.plc_tag_raw_control',
  p_control      => 'ts',
  p_interval     => '1 day'
);
UPDATE partman.part_config
   SET retention = '7 days', retention_keep_table = false
 WHERE parent_table = 'public.plc_tag_raw_control';

-- 권한 — 대조군은 app_rw INSERT · SELECT만(02_postgresql_constraints §가드 트리거와 DB 권한). 001의 기본 권한이 UPDATE까지 주므로 뺀다.
-- 부모로 접근하면 부모 권한만 본다 · 자식 파티션을 이름으로 직접 고치는 경로는 한계로 남는다(partman 권한 상속 끔)
REVOKE UPDATE ON plc_tag_raw_control FROM app_rw;

RESET ROLE;
