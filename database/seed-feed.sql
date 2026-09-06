-- Seed posts for Feed (Instagram-style)
-- Uses existing user IDs from the database

INSERT INTO posts (id, user_id, content, image_url, type, like_count, comment_count, created_at) VALUES
('feed-post-1', 'u-demo-1', 'Buổi sáng bên hồ Hoàn Kiếm thật yên bình ☀️ Trời trong xanh, gió nhẹ. Hãy tận hưởng những khoảnh khắc đẹp của cuộc sống!', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'image', 24, 5, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
('feed-post-2', 'u-demo-2', 'Cà phê sáng cùng view cực chill 🍂', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800', 'image', 18, 3, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('feed-post-3', 'u-demo-3', 'Khám phá một quán cà phê mới ở phố cổ. Không gian vintage, nhạc jazz nhẹ nhàng 🎷', 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800', 'image', 31, 8, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
('feed-post-4', 'u-demo-4', 'Chiều hoàng hôn trên sông Hương 🌅 Một màu cam rực rỡ phủ khắp mặt nước. Thật đẹp và bình yên.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', 'image', 45, 12, DATE_SUB(NOW(), INTERVAL 7 HOUR)),
('feed-post-5', 'u-demo-1', 'Mới sưu tầm được một cuốn sách hay. Có ai muốn đọc cùng không? 📚', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800', 'image', 12, 2, DATE_SUB(NOW(), INTERVAL 10 HOUR)),
('feed-post-6', 'u-demo-2', 'Street food tour hôm nay! Bún chả Hà Nội là nhất 🍜', 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800', 'image', 56, 15, DATE_SUB(NOW(), INTERVAL 15 HOUR))
ON DUPLICATE KEY UPDATE content = VALUES(content), image_url = VALUES(image_url), like_count = VALUES(like_count), comment_count = VALUES(comment_count);

-- Seed some likes for the posts
INSERT IGNORE INTO post_likes (post_id, user_id) VALUES
('feed-post-1', 'u-demo-2'),
('feed-post-1', 'u-demo-3'),
('feed-post-2', 'u-demo-1'),
('feed-post-2', 'u-demo-4'),
('feed-post-3', 'u-demo-1'),
('feed-post-3', 'u-demo-2'),
('feed-post-3', 'u-demo-4'),
('feed-post-4', 'u-demo-1'),
('feed-post-4', 'u-demo-3'),
('feed-post-5', 'u-demo-2'),
('feed-post-5', 'u-demo-4'),
('feed-post-6', 'u-demo-1'),
('feed-post-6', 'u-demo-3'),
('feed-post-6', 'u-demo-4');