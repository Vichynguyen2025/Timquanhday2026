-- Migration: Block user + Delete message + Delete conversation
-- Start transaction
START TRANSACTION;

-- 1. User blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  id VARCHAR(36) PRIMARY KEY,
  blocker_id VARCHAR(36) NOT NULL,
  blocked_id VARCHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_block (blocker_id, blocked_id),
  INDEX idx_blocker (blocker_id),
  INDEX idx_blocked (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add deleted_at to messages (soft delete)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(36) DEFAULT NULL;

-- 3. Add deleted_at to conversation_members (per-member delete)
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL;

COMMIT;