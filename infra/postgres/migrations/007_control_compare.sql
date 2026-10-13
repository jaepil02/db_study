-- 007 — 비교 사본 plc_tag_raw_control을 "RDB를 제대로 쓰면"의 모양으로 고친다(D-16 · 정본 docs/05_data_stores/10_olap_vs_rdb_control.md §지금 모양 — 직접 비교(D-16))
-- 옛 BRIN 대조군(004 — 키 · 참조 · 값 규칙 없음)은 측정 도구와 함께 쓸 일이 없어졌다. 직접 비교 실행(runs compare)이 같은 센서 배치를
-- Redis Stream으로 ClickHouse tag_raw와 이 테이블에 함께 싣고(SW-09 gated) 넣기 · 조회 · 무결성을 잰다.
-- 키 (device_id, tag_id, ts) · 설비 참조 · 값 · 품질 규칙은 무결성 시험(중복 · 없는 설비 · 고장 값)을 PostgreSQL이 막는 근거다 — ClickHouse에는 없다.
-- 일 파티션 · 경계 UTC 자정 · 보존 7일(004 partman 설정)은 그대로다.
-- app_rw는 DDL · DELETE · TRUNCATE 권한이 없다 — 과거 일 파티션 만들기 · 구간 비우기 · 전체 비우기는 app_owner 소유 SECURITY DEFINER 함수 셋으로만 한다
-- (search_path 고정 · pg_temp 마지막 · timezone UTC 고정 — 날짜 경계가 세션 설정에 흔들리지 않는다).

-- Up Migration
SET ROLE app_owner;

-- 옛 대조군 행은 키 · 참조 규칙을 모른 채 쌓였다(같은 키 두 번이 있을 수 있다) — 비교 사본은 실행이 다시 채우므로 비우고 시작한다
TRUNCATE plc_tag_raw_control;

DROP INDEX IF EXISTS plc_tag_raw_control_ts_brin;

-- 키 — 같은 (설비 · 태그 · 시각)은 한 번만. 파티션 키 ts를 포함해야 분할 테이블에 기본 키를 둘 수 있다
ALTER TABLE plc_tag_raw_control
  ADD CONSTRAINT plc_tag_raw_control_pkey PRIMARY KEY (device_id, tag_id, ts);

-- 참조 — 등록된 설비만(물리 삭제 표면이 없으므로 RESTRICT)
ALTER TABLE plc_tag_raw_control
  ADD CONSTRAINT plc_tag_raw_control_device_fk FOREIGN KEY (device_id) REFERENCES device ON DELETE RESTRICT;

-- 값 — 숫자만(NaN 아님) · 정상 범위 ±1조 안(FLOAT32 최댓값 같은 고장 표지 · 무한대를 막는다 — 누적 UINT32 최댓값 약 43억도 안에 든다)
ALTER TABLE plc_tag_raw_control
  ADD CONSTRAINT plc_tag_raw_control_value_number CHECK (value <> 'NaN'::double precision),
  ADD CONSTRAINT plc_tag_raw_control_value_range CHECK (value BETWEEN -1e12 AND 1e12),
  ADD CONSTRAINT plc_tag_raw_control_quality CHECK (quality IN (0, 1, 2, 3, 4, 5, 9));

-- 허용 구간 — 길이 8일 이하 · 보존(7일) 안 과거부터 하루 뒤까지. 표면이 아니라 함수가 마지막으로 막는다(app_rw가 남의 날을 비우지 못한다)
CREATE FUNCTION control_check_range(p_start timestamptz, p_end timestamptz) RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start
     OR p_end - p_start > interval '8 days'
     OR p_start < now() - interval '7 days'
     OR p_end > now() + interval '1 day' THEN
    RAISE EXCEPTION 'plc_tag_raw_control: 허용 구간 밖 [%, %)', p_start, p_end
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
END
$$;

-- 구간이 걸친 UTC 일 파티션 중 없는 것을 만든다(partman — 보존 7일 안 과거 날도) · 만든 수
CREATE FUNCTION control_prepare_range(p_start timestamptz, p_end timestamptz) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, partman, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  d timestamptz;
  missing timestamptz[] := '{}';
BEGIN
  PERFORM control_check_range(p_start, p_end);
  FOR d IN SELECT generate_series(date_trunc('day', p_start), p_end - interval '1 microsecond', interval '1 day') LOOP
    IF to_regclass(format('public.plc_tag_raw_control_p%s', to_char(d, 'YYYYMMDD'))) IS NULL THEN
      missing := missing || d;
    END IF;
  END LOOP;
  IF cardinality(missing) > 0 THEN
    PERFORM partman.create_partition_time('public.plc_tag_raw_control', missing);
  END IF;
  RETURN cardinality(missing);
END
$$;

-- 구간 [p_start, p_end) 비우기 — 구간이 하루를 다 덮는 파티션은 TRUNCATE · 걸치기만 한 파티션은 그 구간만 DELETE · 기본 파티션도 구간만
CREATE FUNCTION control_clear_range(p_start timestamptz, p_end timestamptz) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  d timestamptz;
  part regclass;
BEGIN
  PERFORM control_check_range(p_start, p_end);
  FOR d IN SELECT generate_series(date_trunc('day', p_start), p_end - interval '1 microsecond', interval '1 day') LOOP
    part := to_regclass(format('public.plc_tag_raw_control_p%s', to_char(d, 'YYYYMMDD')));
    CONTINUE WHEN part IS NULL;
    IF d >= p_start AND d + interval '1 day' <= p_end THEN
      EXECUTE format('TRUNCATE %s', part);
    ELSE
      EXECUTE format('DELETE FROM %s WHERE ts >= $1 AND ts < $2', part)
        USING greatest(p_start, d), least(p_end, d + interval '1 day');
    END IF;
  END LOOP;
  part := to_regclass('public.plc_tag_raw_control_default');
  IF part IS NOT NULL THEN
    EXECUTE format('DELETE FROM %s WHERE ts >= $1 AND ts < $2', part) USING p_start, p_end;
  END IF;
END
$$;

-- 센서 데이터 지우기(D-16 결정 5) — 비교 사본 전부(모든 파티션 · 기본 파티션). 설비 · 태그 · 업무 · 실행 결과는 다른 테이블이라 남는다
CREATE FUNCTION control_purge() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  TRUNCATE plc_tag_raw_control;
END
$$;

REVOKE ALL ON FUNCTION control_check_range(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION control_prepare_range(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION control_clear_range(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION control_purge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control_prepare_range(timestamptz, timestamptz) TO app_rw;
GRANT EXECUTE ON FUNCTION control_clear_range(timestamptz, timestamptz) TO app_rw;
GRANT EXECUTE ON FUNCTION control_purge() TO app_rw;

RESET ROLE;
