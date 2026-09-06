CREATE TABLE IF NOT EXISTS message_reactions (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  emoji VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_reaction (message_id, user_id, emoji),
  INDEX idx_message (message_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

ALTER TABLE messages ADD COLUMN reply_to_id VARCHAR(36) DEFAULT NULL AFTER metadata;
ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER reply_to_id;
ALTER TABLE messages ADD COLUMN edited_at DATETIME DEFAULT NULL AFTER is_deleted;
ALTER TABLE messages ADD FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;