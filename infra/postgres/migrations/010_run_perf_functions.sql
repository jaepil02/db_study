-- 010 — 라이브 perf 실행 수명 객체 run_perf_raw의 생성 · 정리 함수(정본 docs/05_data_stores/10_olap_vs_rdb_control.md §실행 수명 객체 · 06_pipeline/10 §성능 비교 실행 — perf)
-- 런타임(app_rw)은 DDL 권한을 갖지 않는다(001 · 12_security) — DDL은 app_owner 소유 SECURITY DEFINER 함수 두 개로만 연다.
-- app_rw는 이 두 함수만 부르고, 채우기(INSERT … SELECT generate_series) · ANALYZE · 쿼리는 app_rw 권한으로 한다(SELECT · INSERT · MAINTAIN).
-- 객체 이름은 하나로 고정(동시 실행 1 · 부팅 정리가 이름으로 찾는다). 일 파티션 경계는 UTC 자정(ADR-27 · 대조군과 같은 경계식).

-- Up Migration
SET ROLE app_owner;

-- 부모(대조군 plc_tag_raw_control과 컬럼 · 컬럼 순서 동형 · RANGE(ts)) + [p_from, p_to)를 덮는 UTC 일 파티션 + I2(BRIN(ts) + btree(device_id, tag_id, ts)).
-- IF NOT EXISTS — 규모를 올릴 때 다시 불러 파티션을 더할 수 있다. 반환은 [p_from, p_to)를 덮는 일 파티션 수.
-- 구간 상한 1일 — 화이트리스트 최대(10^8행 = 10^4초)의 기간을 넉넉히 넘는 호출은 거절한다(디스크 소모 방어).
CREATE FUNCTION run_perf_create(p_from timestamptz, p_to timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d    timestamp;
  part text;
  n    integer := 0;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'run_perf_create — 구간 [%, %)가 비었다', p_from, p_to;
  END IF;
  IF p_to - p_from > interval '1 day' THEN
    RAISE EXCEPTION 'run_perf_create — 구간 %가 상한 1일을 넘는다', p_to - p_from;
  END IF;
  CREATE TABLE IF NOT EXISTS run_perf_raw (LIKE plc_tag_raw_control INCLUDING DEFAULTS) PARTITION BY RANGE (ts);
  CREATE INDEX IF NOT EXISTS run_perf_raw_ts_brin ON run_perf_raw USING brin (ts);
  CREATE INDEX IF NOT EXISTS run_perf_raw_key_btree ON run_perf_raw (device_id, tag_id, ts);
  GRANT SELECT, INSERT, MAINTAIN ON run_perf_raw TO app_rw;
  -- 날짜 산술은 UTC 벽시계(timestamp)로 한다 — 세션 시간대와 무관한 경계
  d := date_trunc('day', p_from AT TIME ZONE 'UTC');
  WHILE (d AT TIME ZONE 'UTC') < p_to LOOP
    part := 'run_perf_raw_p' || to_char(d, 'YYYYMMDD');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF run_perf_raw FOR VALUES FROM (%L) TO (%L)',
      part, d AT TIME ZONE 'UTC', (d + interval '1 day') AT TIME ZONE 'UTC'
    );
    EXECUTE format('GRANT SELECT, INSERT, MAINTAIN ON %I TO app_rw', part);
    n := n + 1;
    d := d + interval '1 day';
  END LOOP;
  RETURN n;
END
$$;

-- 종결(완료 · 중단 · 실패) · 부팅 정리 — 이미 없어도 실패하지 않는다(파티션 함께)
CREATE FUNCTION run_perf_drop() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DROP TABLE IF EXISTS run_perf_raw CASCADE;
END
$$;

REVOKE ALL ON FUNCTION run_perf_create(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION run_perf_drop() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION run_perf_create(timestamptz, timestamptz) TO app_rw;
GRANT EXECUTE ON FUNCTION run_perf_drop() TO app_rw;

RESET ROLE;
