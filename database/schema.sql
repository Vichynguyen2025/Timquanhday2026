-- TimQuanhDay Web App - Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS timquanhday CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE timquanhday;

-- Users
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(500),
  bio TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_phone (phone)
) ENGINE=InnoDB;

-- User Sessions
CREATE TABLE user_sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  refresh_token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_token (refresh_token(255))
) ENGINE=InnoDB;

-- User Locations (persistent storage)
CREATE TABLE user_locations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) UNIQUE NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  accuracy DECIMAL(10,2),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_location (lat, lng)
) ENGINE=InnoDB;

-- Conversations
CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  type ENUM('private', 'group') DEFAULT 'private',
  name VARCHAR(200),
  avatar VARCHAR(500),
  last_message TEXT,
  last_message_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_last_msg (last_message_at DESC)
) ENGINE=InnoDB;

-- Conversation Members
CREATE TABLE conversation_members (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  conversation_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_member (conversation_id, user_id),
  INDEX idx_user (user_id),
  INDEX idx_conv (conversation_id)
) ENGINE=InnoDB;

-- Messages
CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT,
  type ENUM('text', 'image', 'location', 'system') DEFAULT 'text',
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation (conversation_id, created_at DESC),
  INDEX idx_sender (sender_id)
) ENGINE=InnoDB;

-- Message Read Status
CREATE TABLE message_reads (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  message_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_read (message_id, user_id)
) ENGINE=InnoDB;

-- Posts (for feed/nearby)
CREATE TABLE posts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('text', 'image', 'location') DEFAULT 'text',
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_location (lat, lng),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB;

-- Post Likes
CREATE TABLE post_likes (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_like (post_id, user_id)
) ENGINE=InnoDB;

-- Notifications
CREATE TABLE notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  type ENUM('message', 'like', 'comment', 'friend_request', 'nearby', 'system') NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB;

-- Friend Requests
CREATE TABLE friend_requests (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  sender_id VARCHAR(36) NOT NULL,
  receiver_id VARCHAR(36) NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_request (sender_id, receiver_id)
) ENGINE=InnoDB;

-- Seed: Create coffee user for testing
INSERT INTO users (id, name, email, phone, password, bio) VALUES
('seed-user-1', 'Nguyễn Văn A', 'test@timquanhday.de', '+84911111111', '$2b$10$8KzQMGx5K5G5G5G5G5G5Gu5G5G5G5G5G5G5G5G5G5G5G5G5G5G', 'Quản trị viên'),
('seed-user-2', 'Trần Thị B', 'test2@timquanhday.de', '+84922222222', '$2b$10$8KzQMGx5K5G5G5G5G5G5Gu5G5G5G5G5G5G5G5G5G5G5G5G5G5G', 'Người dùng');

-- Note: password hash above is for "test123456" - generate proper hash on first run