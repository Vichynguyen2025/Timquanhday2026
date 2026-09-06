-- Migration: Add media JSON column for multiple images
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media JSON DEFAULT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT NULL;

-- Update seed posts with location data (Hà Nội area)
UPDATE posts SET lat = 21.0285, lng = 105.8542, location_name = 'Hồ Hoàn Kiếm, Hà Nội' WHERE id = 'feed-post-1';
UPDATE posts SET lat = 21.0300, lng = 105.8500, location_name = 'Phố cổ Hà Nội' WHERE id = 'feed-post-2';
UPDATE posts SET lat = 21.0330, lng = 105.8480, location_name = 'Phố cổ Hà Nội' WHERE id = 'feed-post-3';
UPDATE posts SET lat = 16.4637, lng = 107.5909, location_name = 'Sông Hương, Huế' WHERE id = 'feed-post-4';
UPDATE posts SET lat = 21.0250, lng = 105.8560, location_name = 'Hà Nội' WHERE id = 'feed-post-5';
UPDATE posts SET lat = 21.0320, lng = 105.8450, location_name = 'Phố ẩm thực, Hà Nội' WHERE id = 'feed-post-6';