-- 009 — 비교 사본 plc_tag_raw_control을 TimescaleDB hypertable · 열 압축(columnstore)으로 바꾼다(ADR-32 · 정본 docs/05_data_stores/10_olap_vs_rdb_control.md §지금 모양)
-- 직접 비교의 PostgreSQL 쪽이 "일반 PostgreSQL"에서 "PostgreSQL + TimescaleDB"가 된다. 컬럼 7 · 순서 · 키 · 참조 · 값 규칙(007)은 그대로다.
-- 바뀌는 것 — ① 일 파티션: pg_partman 선언 분할 → hypertable 칸(chunk · 1일 · 경계 UTC 자정 · 넣을 때 스스로 생긴다)
--             ② 보존 7일: partman retention → TimescaleDB 보존 정책(app_owner 작업)
--             ③ 압축: 없음 → 넣기 검증 단계가 그 구간 칸을 열 압축한다(control_compress_range · 자동 압축 정책은 두지 않는다 — 넣는 도중 칸이 압축되면 넣기 시간이 흔들린다)
-- 선언 분할 표는 hypertable로 바꿀 수 없어 표를 다시 만든다 — 비교 사본 행은 지운다(넣기가 다시 채운다 · 007과 같은 판단).
-- 확장 생성은 migrate 관리자 단계(timescaledb · shared_preload_libraries 필요 — infra/postgres/postgresql.conf)

-- Up Migration
SET ROLE app_owner;

-- partman 관리에서 뺀다(빈 볼륨 재생에서도 004가 등록한 행) — 백그라운드 워커가 없는 표를 돌보지 않게
DELETE FROM partman.part_config WHERE parent_table = 'public.plc_tag_raw_control';
DROP TABLE IF EXISTS partman.template_public_plc_tag_raw_control;

DROP FUNCTION control_prepare_range(timestamptz, timestamptz);
DROP TABLE plc_tag_raw_control;

CREATE TABLE plc_tag_raw_control (
  ts          timestamptz      NOT NULL,
  value       double precision NOT NULL,
  scan_seq    bigint           NOT NULL,
  ingested_at timestamptz      NOT NULL DEFAULT now(),
  device_id   integer          NOT NULL,
  tag_id      integer          NOT NULL,
  quality     smallint         NOT NULL,
  CONSTRAINT plc_tag_raw_control_pkey PRIMARY KEY (device_id, tag_id, ts),
  CONSTRAINT plc_tag_raw_control_device_fk FOREIGN KEY (device_id) REFERENCES device ON DELETE RESTRICT,
  CONSTRAINT plc_tag_raw_control_value_number CHECK (value <> 'NaN'::double precision),
  CONSTRAINT plc_tag_raw_control_value_range CHECK (value BETWEEN -1e12 AND 1e12),
  CONSTRAINT plc_tag_raw_control_quality CHECK (quality IN (0, 1, 2, 3, 4, 5, 9))
);

-- 칸 1일 — 경계는 epoch 기준 하루 배수라 UTC 자정이다(ClickHouse toYYYYMMDD(ts)와 같은 날) · 기본 ts 인덱스는 만들지 않는다(키 하나만 — 007과 같은 모양)
SELECT create_hypertable('plc_tag_raw_control', by_range('ts', interval '1 day'), create_default_indexes => false);

-- 열 압축 — 설비 · 태그별로 묶고(segmentby) 묶음 안은 시각순(orderby). 조회 대결의 PostgreSQL 질의가 묶음 단위로 건너뛴다
ALTER TABLE plc_tag_raw_control SET (
  timescaledb.enable_columnstore,
  timescaledb.segmentby = 'device_id, tag_id',
  timescaledb.orderby = 'ts'
);

-- 보존 — tag_raw TTL과 같은 7일 · 칸 통째 삭제(작업 주체 app_owner)
SELECT add_retention_policy('plc_tag_raw_control', drop_after => interval '7 days');

-- 권한 — app_rw INSERT · SELECT만(004와 같다). 001의 기본 권한이 UPDATE까지 주므로 뺀다
REVOKE UPDATE ON plc_tag_raw_control FROM app_rw;

-- 구간 비우기 — 구간이 칸을 통째로 덮으면 drop_chunks · 걸치기만 하면 그 칸 안 구간만 DELETE.
-- 압축된 칸의 DELETE는 풀어서 지운다 — 한 번에 푸는 행 상한(기본 10만)을 이 함수 안에서만 없앤다
CREATE OR REPLACE FUNCTION control_clear_range(p_start timestamptz, p_end timestamptz) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
SET timescaledb.max_tuples_decompressed_per_dml_transaction = 0
AS $$
DECLARE
  c record;
BEGIN
  PERFORM control_check_range(p_start, p_end);
  FOR c IN SELECT format('%I.%I', chunk_schema, chunk_name) AS rel, range_start, range_end
             FROM timescaledb_information.chunks
            WHERE hypertable_schema = 'public' AND hypertable_name = 'plc_tag_raw_control'
              AND range_start < p_end AND range_end > p_start LOOP
    IF c.range_start >= p_start AND c.range_end <= p_end THEN
      PERFORM drop_chunks('plc_tag_raw_control', older_than => c.range_end, newer_than => c.range_start);
    ELSE
      EXECUTE format('DELETE FROM %s WHERE ts >= $1 AND ts < $2', c.rel)
        USING greatest(p_start, c.range_start), least(p_end, c.range_end);
    END IF;
  END LOOP;
END
$$;

-- 구간 압축 — 구간에 걸친 칸 중 아직 압축하지 않은 것만(이미 압축된 칸은 건너뛴다) · 압축한 칸 수.
-- 압축한 칸이 있으면 통계를 다시 모은다 — 압축 직후 행 수 추정(approximate_row_count)이 0으로 보이지 않게(현황 · 지표)
CREATE FUNCTION control_compress_range(p_start timestamptz, p_end timestamptz) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  c record;
  n integer := 0;
BEGIN
  PERFORM control_check_range(p_start, p_end);
  FOR c IN SELECT format('%I.%I', chunk_schema, chunk_name)::regclass AS rel
             FROM timescaledb_information.chunks
            WHERE hypertable_schema = 'public' AND hypertable_name = 'plc_tag_raw_control'
              AND range_start < p_end AND range_end > p_start AND NOT is_compressed LOOP
    CALL convert_to_columnstore(c.rel, if_not_columnstore => true);   -- 2.18부터 compress_chunk를 대체한 이름
    n := n + 1;
  END LOOP;
  IF n > 0 THEN
    ANALYZE plc_tag_raw_control;
  END IF;
  RETURN n;
END
$$;

REVOKE ALL ON FUNCTION control_compress_range(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control_compress_range(timestamptz, timestamptz) TO app_rw;

RESET ROLE;
