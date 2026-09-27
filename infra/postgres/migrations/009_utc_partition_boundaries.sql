-- 009 — alarm_event 월 · 대조군 일 파티션 UTC 경계 재구성(ADR-27 · 절차 정본 docs/05_data_stores/09_migrations_seed.md §DB 시간대 전환 · 구현 목록 #5)
-- 004 · 007 머리 주석의 "경계 Asia/Seoul"은 적용된 순번이라 고치지 않는다(구현 목록 #9) — 두 세트의 경계는 이 순번 뒤 UTC 월 1일 · UTC 자정이다.
-- DB 처리 시간대가 UTC로 바뀌어도 pg_partman 세트는 만든 세션의 경계(KST 15:00Z)를 그대로 갖고, 설정만 바꾼 채 유지 작업이 돌면
-- 일 세트는 하루 틈 · 월 세트는 30일로 밀린 경계가 생긴다(확인한 사실 #10) — 그래서 세트를 다시 세운다.
-- 부모마다: 경계 판정(자식 하한이 UTC 자정 · 월초가 아니면 대상 · 이미 UTC면 건너뛴다 — 빈 볼륨은 004 · 007이 UTC 세션에서 서서 건너뛴다)
--   → 자식 전부(기본 포함) DETACH · 이름 바꿈 → part_config 행 삭제 → create_parent(같은 간격 · 시작 = 옛 행 최솟값을 UTC 간격으로 내린 값 · 행 없으면 현재)
--   → 보존 설정 복원 → 옛 자식 행 재삽입(IDENTITY는 OVERRIDING SYSTEM VALUE로 event_id 보존) → 행 수 대조 → 옛 자식 DROP
-- migrate 실행 하나가 대기 순번 전체를 한 트랜잭션으로 감싼다(migrate.ts singleTransaction) — 부모 둘이 함께 커밋 · 함께 되돌려진다.
-- 저장값(timestamptz = 내부 UTC)은 바뀌지 않는다 — 옮겨지는 것은 파티션 경계뿐이다.
-- 재구성했으면(= KST 시대 볼륨) 이력 pgmigrations.run_on(timestamp — 세션 timezone 벽시계)도 KST 벽시계 → UTC 벽시계로 옮긴다.
-- node-pg-migrate는 이력을 run_on 순으로 읽어 순서를 검사한다(checkOrder) — 옮기지 않으면 마지막 순번 적용 뒤 9시간 안에 돈 이 순번의 행(UTC 벽시계)이
-- 앞 행(KST 벽시계)보다 앞에 놓여 이후 모든 migrate가 "Not run migration … is preceding already run migration"으로 실패한다(2026-09-28 임시 컨테이너 실측).
-- 이 트랜잭션이 넣은 행(대기 순번 · run_on = NOW()의 UTC 벽시계)은 이미 UTC라 뺀다.

-- Up Migration
SET ROLE app_owner;
-- 이 트랜잭션 안에서만 — create_parent가 경계를 세션 timezone으로 계산한다(확인한 사실 #9)
SET LOCAL timezone = 'UTC';

DO $$
DECLARE
  cfg        record;
  kid        record;
  unit       text;
  misaligned integer;
  olds       text[];
  cols       text;
  overriding text;
  min_ts     timestamptz;
  n_old      bigint;
  n_new      bigint;
  n          bigint;
  t          text;
  rebuilt    boolean := false;
BEGIN
  FOR cfg IN
    SELECT * FROM partman.part_config
     WHERE parent_table IN ('public.alarm_event', 'public.plc_tag_raw_control')
     ORDER BY parent_table
  LOOP
    unit := CASE cfg.partition_interval::interval
              WHEN interval '1 day' THEN 'day'
              WHEN interval '1 month' THEN 'month'
            END;
    IF unit IS NULL THEN
      RAISE EXCEPTION '009 — % 간격 %은 이 순번의 대상이 아니다', cfg.parent_table, cfg.partition_interval;
    END IF;

    -- 경계 판정 — 기본 파티션을 뺀 자식의 하한이 UTC 간격 경계가 아니면 대상
    SELECT count(*) INTO misaligned
      FROM (SELECT substring(pg_get_expr(c.relpartbound, c.oid) FROM $re$FROM \('([^']+)'\)$re$)::timestamptz AS lo
              FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
             WHERE i.inhparent = cfg.parent_table::regclass) b
     WHERE b.lo IS NOT NULL AND b.lo <> date_trunc(unit, b.lo);
    IF misaligned = 0 THEN
      RAISE NOTICE '009 — % 경계가 이미 UTC · 건너뜀', cfg.parent_table;
      CONTINUE;
    END IF;

    -- 자식 전부(기본 포함) 분리 · 이름 바꿈 — create_parent가 같은 이름(UTC 날짜 · _default)을 다시 쓴다
    olds := '{}';
    FOR kid IN
      SELECT n.nspname AS sch, c.relname AS rel
        FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE i.inhparent = cfg.parent_table::regclass
       ORDER BY c.relname
    LOOP
      EXECUTE format('ALTER TABLE %s DETACH PARTITION %I.%I', cfg.parent_table, kid.sch, kid.rel);
      EXECUTE format('ALTER TABLE %I.%I RENAME TO %I', kid.sch, kid.rel, kid.rel || '_tzkst');
      olds := olds || format('%I.%I', kid.sch, kid.rel || '_tzkst');
    END LOOP;

    -- 옛 행 최솟값 · 행 수
    min_ts := NULL;
    n_old := 0;
    FOREACH t IN ARRAY olds LOOP
      EXECUTE format('SELECT count(*) FROM %s', t) INTO n;
      n_old := n_old + n;
    END LOOP;
    EXECUTE (SELECT format('SELECT min(%I) FROM (%s) u', cfg.control,
                           string_agg(format('SELECT min(%I) AS %I FROM %s', cfg.control, cfg.control, o), ' UNION ALL '))
               FROM unnest(olds) o)
       INTO min_ts;

    DELETE FROM partman.part_config WHERE parent_table = cfg.parent_table;
    IF min_ts IS NULL THEN
      PERFORM partman.create_parent(
        p_parent_table => cfg.parent_table, p_control => cfg.control,
        p_interval => cfg.partition_interval, p_premake => cfg.premake);
    ELSE
      PERFORM partman.create_parent(
        p_parent_table => cfg.parent_table, p_control => cfg.control,
        p_interval => cfg.partition_interval, p_premake => cfg.premake,
        p_start_partition => date_trunc(unit, min_ts)::text);
    END IF;

    -- 보존 설정 복원(alarm_event 2 years · 분리 보존 · 대조군 7 days · 삭제 — 004 · 007이 준 값을 옛 행에서 그대로 옮긴다)
    UPDATE partman.part_config
       SET retention = cfg.retention,
           retention_keep_table = cfg.retention_keep_table,
           retention_keep_index = cfg.retention_keep_index,
           infinite_time_partitions = cfg.infinite_time_partitions,
           automatic_maintenance = cfg.automatic_maintenance
     WHERE parent_table = cfg.parent_table;

    -- 재삽입 — 컬럼 목록은 부모 정의 순서 · IDENTITY가 있으면 기존 값을 그대로(event_id 보존 · 다음 IDENTITY 값은 시퀀스가 잇는다)
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
           CASE WHEN bool_or(a.attidentity <> '') THEN 'OVERRIDING SYSTEM VALUE' ELSE '' END
      INTO cols, overriding
      FROM pg_attribute a
     WHERE a.attrelid = cfg.parent_table::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    FOREACH t IN ARRAY olds LOOP
      EXECUTE format('INSERT INTO %s (%s) %s SELECT %s FROM %s', cfg.parent_table, cols, overriding, cols, t);
    END LOOP;

    EXECUTE format('SELECT count(*) FROM %s', cfg.parent_table) INTO n_new;
    IF n_new <> n_old THEN
      RAISE EXCEPTION '009 — % 행 수 불일치(옛 % · 새 %)', cfg.parent_table, n_old, n_new;
    END IF;

    FOREACH t IN ARRAY olds LOOP
      EXECUTE format('DROP TABLE %s', t);
    END LOOP;
    rebuilt := true;
    RAISE NOTICE '009 — % UTC 경계로 재구성(행 % · 시작 %)', cfg.parent_table, n_old, coalesce(date_trunc(unit, min_ts)::text, '현재');
  END LOOP;

  IF rebuilt THEN
    UPDATE pgmigrations
       SET run_on = (run_on AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC'
     WHERE run_on <> (now() AT TIME ZONE 'UTC');
  END IF;
END
$$;

RESET ROLE;
