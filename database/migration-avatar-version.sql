-- Profile: Add avatar_version for cache invalidation
ALTER TABLE users
  ADD COLUMN avatar_version INT NOT NULL DEFAULT 0
  AFTER avatar;

-- Existing avatars: initialize version based on file mtime for existing rows
-- (optional; new uploads will increment)