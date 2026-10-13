-- 008 — tag_raw 보존 7일 → 60일(사용자 결정 2026-10-12 — 직접 비교 넣기를 건수 단위로 · 10억까지 · 날짜를 더 과거로 · PostgreSQL 쪽은 마이그레이션 011)
-- 카드 라인 30대 10억 행은 약 50일치라 넣기 창이 UTC D−52부터다. 002를 고쳐도 이미 있는 표에는 닿지 않아(IF NOT EXISTS) 여기서 TTL만 바꾼다.
-- 매 migrate마다 다시 돈다(멱등 — 같은 식) · 기존 파트를 TTL로 다시 쓰지 않는다(materialize_ttl_after_modify = 0 — 7일 TTL로 이미 지운 행은 돌아오지 않는다)
ALTER TABLE plc.tag_raw MODIFY TTL toDateTime(ts) + INTERVAL 60 DAY DELETE SETTINGS materialize_ttl_after_modify = 0;
