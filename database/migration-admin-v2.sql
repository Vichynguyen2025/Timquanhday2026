-- CMS Phase 2: Enhanced admin tables
-- collation uses utf8mb4_unicode_ci to match existing users table

ALTER TABLE users
  ADD COLUMN is_locked tinyint(1) NOT NULL DEFAULT 0
  AFTER is_online;

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(36) PRIMARY KEY,
  reporter_id VARCHAR(36) NOT NULL,
  reported_user_id VARCHAR(36) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  type VARCHAR(50),
  status ENUM('PENDING','REVIEWING','RESOLVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  moderator_id VARCHAR(36),
  resolution_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reporter (reporter_id),
  INDEX idx_reported (reported_user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at),
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;