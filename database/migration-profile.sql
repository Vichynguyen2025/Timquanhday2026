-- Profile: Add location_enabled preference
ALTER TABLE users
  ADD COLUMN location_enabled tinyint(1) NOT NULL DEFAULT 1
  AFTER bio;

-- Index for user_blocks (already exists but ensure)
ALTER TABLE user_blocks ADD INDEX idx_blocker (blocker_id);
ALTER TABLE user_blocks ADD INDEX idx_blocked (blocked_id);