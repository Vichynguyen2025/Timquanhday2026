-- CMS Admin: Admin roles
CREATE TABLE IF NOT EXISTS admin_roles (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(200),
  permissions JSON NOT NULL DEFAULT ('[]'),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CMS Admin: Admin users (linked to app users)
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  role_id VARCHAR(36) NOT NULL,
  created_by VARCHAR(36),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE RESTRICT,
  INDEX idx_role (role_id),
  INDEX idx_active (is_active)
);

-- CMS Admin: Audit log
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  admin_user_id VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36),
  before_state JSON,
  after_state JSON,
  ip VARCHAR(45),
  user_agent VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_user_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
);

-- Seed: default admin roles
INSERT IGNORE INTO admin_roles (id, name, description, permissions) VALUES
  ('role-super-admin', 'SUPER_ADMIN', 'Full system access', '["*"]'),
  ('role-admin', 'ADMIN', 'Administrative access', '["users:read","users:write","sos:read","sos:write","messages:read","notifications:read","reports:read","reports:write"]'),
  ('role-moderator', 'MODERATOR', 'Content moderation', '["users:read","posts:read","posts:write","messages:read","reports:read","reports:write"]'),
  ('role-sos-operator', 'SOS_OPERATOR', 'SOS management', '["sos:read","sos:write"]');