-- 006 — 가드 트리거 · 추가 전용 권한 · 인덱스(정본 docs/05_data_stores/02_postgresql_constraints.md §가드 트리거와 DB 권한 · §인덱스 9)
-- 트리거는 서비스 거절(master.scale_change_forbidden/409)의 백스톱이다 — 수동 SQL이 과거 값의 공학 단위 의미를 바꾸지 못하게 한다.

-- Up Migration
SET ROLE app_owner;

CREATE FUNCTION reject_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'tag_master: tag_id · device_id · scale · offset_value는 갱신하지 않는다 — 새 태그를 발급한다'
    USING ERRCODE = 'check_violation';
END
$$;

CREATE TRIGGER tag_master_guard_immutable
  BEFORE UPDATE OF tag_id, device_id, scale, offset_value ON tag_master
  FOR EACH ROW WHEN (OLD.tag_id IS DISTINCT FROM NEW.tag_id
                  OR OLD.device_id IS DISTINCT FROM NEW.device_id
                  OR OLD.scale IS DISTINCT FROM NEW.scale
                  OR OLD.offset_value IS DISTINCT FROM NEW.offset_value)
  EXECUTE FUNCTION reject_update();

-- 추가 전용 — 권한으로 막는다(트리거는 소유자가 끌 수 있지만 부여하지 않은 권한은 코드가 우회하지 못한다)
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log, tag_master_history FROM app_rw;

CREATE INDEX tag_master_device_active_idx      ON tag_master (device_id, is_active);
CREATE INDEX alarm_event_rule_occurred_idx     ON alarm_event (rule_id, occurred_at DESC);
CREATE INDEX work_order_line_status_idx        ON work_order (line_id, status);
CREATE INDEX alarm_event_open_idx              ON alarm_event (occurred_at DESC) WHERE state = 'ACTIVE';
CREATE INDEX alarm_event_unacked_idx           ON alarm_event (occurred_at DESC) WHERE acked_at IS NULL;
CREATE INDEX production_log_order_recorded_idx ON production_log (order_id, recorded_at);
CREATE INDEX audit_log_target_idx              ON audit_log (target_table, target_key, acted_at);
CREATE INDEX audit_log_acted_idx               ON audit_log (acted_at);
CREATE INDEX tag_master_history_old_idx        ON tag_master_history (old_tag_id);

RESET ROLE;
