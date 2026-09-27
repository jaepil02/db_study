-- 011 — run_perf_create · run_perf_drop의 search_path에 pg_temp를 끝에 명시(검수 r-code-api L1 · 010은 적용된 순번이라 고치지 않는다)
-- SECURITY DEFINER 함수의 search_path에 pg_temp가 없으면 PostgreSQL은 pg_temp를 맨 앞에서 먼저 찾는다 — 호출자(app_rw)가 만든
-- 임시 테이블(plc_tag_raw_control · run_perf_raw 같은 이름)이 한정 없는 이름을 가로챌 수 있다. pg_temp를 끝에 두면 public이 먼저다.
-- 본문 · 반환 · 권한은 010과 같다 — CREATE OR REPLACE는 소유자 · 권한을 유지하고, REVOKE · GRANT는 재적용해도 같은 상태다(멱등).

-- Up Migration
SET ROLE app_owner;

-- 부모(대조군 plc_tag_raw_control과 컬럼 · 컬럼 순서 동형 · RANGE(ts)) + [p_from, p_to)를 덮는 UTC 일 파티션 + I2(BRIN(ts) + btree(device_id, tag_id, ts)).
-- IF NOT EXISTS — 규모를 올릴 때 다시 불러 파티션을 더할 수 있다. 반환은 [p_from, p_to)를 덮는 일 파티션 수.
-- 구간 상한 1일 — 화이트리스트 최대(10^8행 = 10^4초)의 기간을 넉넉히 넘는 호출은 거절한다(디스크 소모 방어).
CREATE OR REPLACE FUNCTION run_perf_create(p_from timestamptz, p_to timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
CREATE OR REPLACE FUNCTION run_perf_drop() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DROP TABLE IF EXISTS run_perf_raw CASCADE;
END
$$;

REVOKE ALL ON FUNCTION run_perf_create(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION run_perf_drop() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION run_perf_create(timestamptz, timestamptz) TO app_rw;
GRANT EXECUTE ON FUNCTION run_perf_drop() TO app_rw;

RESET ROLE;
