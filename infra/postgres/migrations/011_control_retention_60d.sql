-- 011 — 직접 비교 넣기를 건수 단위(10만 ~ 10억)로 바꾼다(사용자 결정 2026-10-12 — 시간 구간 대신 건수 · 10억까지 · 날짜를 더 과거로)
-- 카드 라인 30대는 초당 231행이라 10억이면 약 50일치다 — 넣기 창이 UTC D−52 00:00부터 · 비우기는 D−52 ~ D−1(51일 통째)이 된다.
-- 바뀌는 것 — ① 보존 7일 → 60일(TimescaleDB 보존 정책 · ClickHouse tag_raw TTL은 DDL 008이 같은 값으로)
--             ② 허용 구간(control_check_range) — 길이 8일 → 61일 · 시작 ≥ now − 7일 → now − 60일
--             ③ 넣는 도중 압축(control_compress_days) — 7일치를 넘는 넣기는 압축 전 크기(약 117 B/행)가 디스크 여유를 넘어
--                다 들어간 지난 날 칸부터 압축하며 넣는다. 통계는 다시 모으지 않는다(칸이 수십 개면 ANALYZE가 매번 표 전체를 돈다 —
--                넣기가 끝난 뒤 control_compress_range가 한 번 모은다)

-- Up Migration
SET ROLE app_owner;

SELECT remove_retention_policy('plc_tag_raw_control', if_exists => true);
SELECT add_retention_policy('plc_tag_raw_control', drop_after => interval '60 days');

-- 허용 구간 — 길이 61일 이하 · 보존(60일) 안 과거부터 하루 뒤까지(007의 규칙에서 값만 바꾼다)
CREATE OR REPLACE FUNCTION control_check_range(p_start timestamptz, p_end timestamptz) RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start
     OR p_end - p_start > interval '61 days'
     OR p_start < now() - interval '60 days'
     OR p_end > now() + interval '1 day' THEN
    RAISE EXCEPTION 'plc_tag_raw_control: 허용 구간 밖 [%, %)', p_start, p_end
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
END
$$;

-- 넣는 도중 압축 — 구간에 걸친 칸 중 아직 압축하지 않은 것만(control_compress_range와 같고 ANALYZE만 없다) · 압축한 칸 수
CREATE FUNCTION control_compress_days(p_start timestamptz, p_end timestamptz) RETURNS integer
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
    CALL convert_to_columnstore(c.rel, if_not_columnstore => true);
    n := n + 1;
  END LOOP;
  RETURN n;
END
$$;

REVOKE ALL ON FUNCTION control_compress_days(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control_compress_days(timestamptz, timestamptz) TO app_rw;

RESET ROLE;
