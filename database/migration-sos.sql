-- Migration: SOS Module (Location → SOS + Radar)
-- Database-first: Single Source of Truth

-- 1. SOS Categories
CREATE TABLE IF NOT EXISTS sos_categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Service Profiles (provider extension of users)
CREATE TABLE IF NOT EXISTS service_profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  is_provider TINYINT(1) DEFAULT 0,
  is_available TINYINT(1) DEFAULT 0,
  service_radius INT DEFAULT 1000, -- meters
  rating DECIMAL(2,1) DEFAULT 0.0,
  completed_jobs INT DEFAULT 0,
  verified_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_provider (is_provider, is_available),
  INDEX idx_radius (service_radius)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Provider ↔ Category join
CREATE TABLE IF NOT EXISTS service_profile_categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  profile_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES sos_categories(id) ON DELETE CASCADE,
  UNIQUE KEY uk_profile_cat (profile_id, category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SOS Requests
CREATE TABLE IF NOT EXISTS sos_requests (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  user_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) DEFAULT NULL,
  description TEXT NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  location_name VARCHAR(255) DEFAULT NULL,
  radius INT NOT NULL DEFAULT 1000, -- meters
  urgency ENUM('URGENT','TODAY','SCHEDULED') NOT NULL DEFAULT 'TODAY',
  status ENUM('OPEN','MATCHING','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  expires_at DATETIME DEFAULT NULL,
  closed_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES sos_categories(id) ON DELETE SET NULL,
  INDEX idx_sos_status (status),
  INDEX idx_sos_category (category_id),
  INDEX idx_sos_location (lat, lng),
  INDEX idx_sos_created (created_at DESC),
  INDEX idx_sos_expires (expires_at),
  INDEX idx_sos_urgency (urgency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SOS Media (camera-only, timestamped + geotagged)
CREATE TABLE IF NOT EXISTS sos_media (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  sos_id VARCHAR(36) NOT NULL,
  url VARCHAR(500) NOT NULL,
  lat DECIMAL(10,7) DEFAULT NULL,
  lng DECIMAL(10,7) DEFAULT NULL,
  location_name VARCHAR(255) DEFAULT NULL,
  captured_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sos_id) REFERENCES sos_requests(id) ON DELETE CASCADE,
  INDEX idx_sos_media (sos_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. SOS Responses (provider offers help)
CREATE TABLE IF NOT EXISTS sos_responses (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  sos_id VARCHAR(36) NOT NULL,
  provider_id VARCHAR(36) NOT NULL,
  message TEXT DEFAULT NULL,
  status ENUM('PENDING','ACCEPTED','DECLINED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sos_id) REFERENCES sos_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_response (sos_id, provider_id),
  INDEX idx_resp_sos (sos_id),
  INDEX idx_resp_provider (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. SOS Status History (audit trail)
CREATE TABLE IF NOT EXISTS sos_status_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  sos_id VARCHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL,
  note TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sos_id) REFERENCES sos_requests(id) ON DELETE CASCADE,
  INDEX idx_history_sos (sos_id),
  INDEX idx_history_time (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Seed categories
INSERT IGNORE INTO sos_categories (id, name, icon, description, sort_order) VALUES
  ('cat-sua-xe', 'Sửa xe', 'construct-outline', 'Sửa chữa xe máy, ô tô tại chỗ', 1),
  ('cat-cuu-ho', 'Cứu hộ', 'fitness-outline', 'Cứu hộ khẩn cấp, tai nạn', 2),
  ('cat-dien', 'Điện', 'flash-outline', 'Sửa điện, điện nước tại nhà', 3),
  ('cat-y-te', 'Y tế', 'medkit-outline', 'Cấp cứu y tế, sơ cứu', 4),
  ('cat-an-ninh', 'An ninh', 'shield-outline', 'Hỗ trợ an ninh, báo động', 5),
  ('cat-van-chuyen', 'Vận chuyển', 'car-outline', 'Cần chở hàng, đi nhờ xe', 6),
  ('cat-khac', 'Khác', 'ellipsis-horizontal-outline', 'Yêu cầu hỗ trợ khác', 99);

-- 9. Extend notifications type enum
ALTER TABLE notifications MODIFY COLUMN type ENUM('message','like','comment','friend_request','nearby','system','sos') NOT NULL;