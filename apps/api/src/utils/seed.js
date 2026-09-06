import 'dotenv/config';
import { getPool } from '../models/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function seed() {
  const pool = await getPool();
  console.log('[Seed] Connected to MySQL');

  const users = [
    { id: 'u-demo-1', name: 'Nguyễn Văn An', email: 'demo@timquanhday.de', phone: '+84910000001', password: 'demo123456', bio: 'Developer tại Hà Nội 🚀', lat: 21.0285, lng: 105.8542 },
    { id: 'u-demo-2', name: 'Trần Thị Bích', email: 'admin@timquanhday.de', phone: '+84910000002', password: 'admin123456', bio: 'Designer - Yêu thích cà phê ☕', lat: 21.0333, lng: 105.8467 },
    { id: 'u-demo-3', name: 'Lê Hoàng Nam', email: 'nam@timquanhday.de', phone: '+84910000003', password: 'demo123456', bio: 'Sinh viên Bách Khoa 🎓', lat: 21.0050, lng: 105.8430 },
    { id: 'u-demo-4', name: 'Phạm Minh Châu', email: 'chau@timquanhday.de', phone: '+84910000004', password: 'demo123456', bio: 'Freelancer - Nhiếp ảnh 📸', lat: 21.0380, lng: 105.8400 },
  ];

  const now = new Date();
  const conn = await pool.getConnection();

  try {
    // 1. Create users
    await conn.query('DELETE FROM message_reads');
    await conn.query('DELETE FROM messages');
    await conn.query('DELETE FROM conversation_members');
    await conn.query('DELETE FROM conversations');
    await conn.query('DELETE FROM post_likes');
    await conn.query('DELETE FROM posts');
    await conn.query('DELETE FROM notifications');
    await conn.query('DELETE FROM friend_requests');
    await conn.query('DELETE FROM user_locations');
    await conn.query('DELETE FROM user_sessions');
    await conn.query('DELETE FROM users WHERE id NOT LIKE "seed-%"');
    
    console.log('[Seed] Cleared existing data');

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      await conn.query(
        'INSERT INTO users (id, name, email, phone, password, bio, is_online, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [u.id, u.name, u.email, u.phone, hash, u.bio, true, now]
      );
    }
    console.log('[Seed] ✅ 4 users created');

    // 2. Locations
    for (const u of users) {
      await conn.query(
        'INSERT INTO user_locations (user_id, lat, lng) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE lat = ?, lng = ?',
        [u.id, u.lat, u.lng, u.lat, u.lng]
      );
    }
    console.log('[Seed] ✅ Locations added');

    // 3. Conversations + Messages
    const conversations = [
      { id: 'conv-1', user1: 'u-demo-1', user2: 'u-demo-2', name: 'Trần Thị Bích' },
      { id: 'conv-2', user1: 'u-demo-1', user2: 'u-demo-3', name: 'Lê Hoàng Nam' },
      { id: 'conv-3', user1: 'u-demo-1', user2: 'u-demo-4', name: 'Phạm Minh Châu' },
    ];

    for (const c of conversations) {
      await conn.query('INSERT INTO conversations (id, type, name, last_message_at) VALUES (?, "private", ?, ?)', 
        [c.id, c.name, now]);
      await conn.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', 
        [c.id, c.user1, c.id, c.user2]);
    }
    console.log('[Seed] ✅ 3 conversations created');

    // Messages
    const messages = [
      { conv: 'conv-1', from: 'u-demo-2', text: 'Chào An! Bạn khoẻ không?', time: new Date(now - 3600000 * 2) },
      { conv: 'conv-1', from: 'u-demo-1', text: 'Chào Bích! Mình khoẻ, cảm ơn bạn 😊', time: new Date(now - 3600000 * 1.9) },
      { conv: 'conv-1', from: 'u-demo-2', text: 'Cuối tuần này đi cà phê không? Mình biết quán mới ở Hồ Gươm', time: new Date(now - 3600000 * 1.8) },
      { conv: 'conv-1', from: 'u-demo-1', text: 'Ok bạn! Thứ 7 10h sáng nhé ☕', time: new Date(now - 3600000 * 1) },
      { conv: 'conv-2', from: 'u-demo-3', text: 'Anh ơi, em hỏi tí về React với Socket.IO được không?', time: new Date(now - 7200000) },
      { conv: 'conv-2', from: 'u-demo-1', text: 'Được em, có gì cứ hỏi nhé!', time: new Date(now - 7000000) },
      { conv: 'conv-2', from: 'u-demo-3', text: 'Em đang làm realtime chat, mà không biết cách sync giữa các tab ạ', time: new Date(now - 6800000) },
      { conv: 'conv-3', from: 'u-demo-4', text: 'Anh An ơi, em vừa chụp mấy tấm ảnh ở hồ Hoàn Kiếm, đẹp lắm! 📸', time: new Date(now - 1800000) },
      { conv: 'conv-3', from: 'u-demo-1', text: 'Cho em xem với! Anh cũng thích chụp ảnh lắm', time: new Date(now - 1700000) },
      { conv: 'conv-3', from: 'u-demo-4', text: 'Đây ạ! Em gửi anh xem nè 🖼️', time: new Date(now - 1600000) },
    ];

    for (const m of messages) {
      await conn.query(
        'INSERT INTO messages (conversation_id, sender_id, content, type, created_at) VALUES (?, ?, ?, "text", ?)',
        [m.conv, m.from, m.text, m.time]
      );
    }
    
    // Update last_message on conversations
    await conn.query('UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?', 
      ['Ok bạn! Thứ 7 10h sáng nhé ☕', 'conv-1']);
    await conn.query('UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?',
      ['Em đang làm realtime chat...', 'conv-2']);
    await conn.query('UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?',
      ['Đây ạ! Em gửi anh xem nè 🖼️', 'conv-3']);

    // Mark all messages as read
    for (const m of messages) {
      const otherUser = m.from === 'u-demo-1' ? 'u-demo-2' : (m.from === 'u-demo-3' ? 'u-demo-1' : 'u-demo-4');
      // Just mark the last few as unread
    }

    console.log('[Seed] ✅ Messages created');

    // 4. Posts
    const posts = [
      { id: 'post-1', user: 'u-demo-2', text: 'Sáng nay đi dạo Hồ Gươm, thời tiết đẹp quá! 🌞', lat: 21.0285, lng: 105.8524 },
      { id: 'post-2', user: 'u-demo-3', text: 'Vừa hoàn thành xong project cuối kỳ! 🎉 Cảm ơn mọi người đã giúp đỡ', lat: 21.0050, lng: 105.8430 },
      { id: 'post-3', user: 'u-demo-4', text: 'Chụp được tấm này ở quán cà phê góc phố cổ. Các bạn thấy thế nào? 📸', lat: 21.0380, lng: 105.8400 },
      { id: 'post-4', user: 'u-demo-1', text: 'Đang tìm người đi chạy bộ sáng CN tại Công viên Thống Nhất. Ai join không? 🏃‍♂️', lat: 21.0285, lng: 105.8542 },
    ];

    for (const p of posts) {
      await conn.query(
        'INSERT INTO posts (id, user_id, content, lat, lng, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, p.user, p.text, p.lat, p.lng, new Date(now - Math.random() * 86400000)]
      );
    }

    // Likes
    await conn.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?), (?, ?), (?, ?)', 
      ['post-1', 'u-demo-1', 'post-1', 'u-demo-3', 'post-1', 'u-demo-4']);
    await conn.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?), (?, ?)',
      ['post-2', 'u-demo-1', 'post-2', 'u-demo-2']);
    await conn.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?), (?, ?), (?, ?)',
      ['post-3', 'u-demo-1', 'post-3', 'u-demo-2', 'post-3', 'u-demo-3']);
    await conn.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
      ['post-4', 'u-demo-2']);

    console.log('[Seed] ✅ Posts + likes created');

    // 5. Notifications
    const notifs = [
      { user: 'u-demo-1', type: 'like', title: 'Thích bài viết', body: 'Trần Thị Bích đã thích bài viết của bạn' },
      { user: 'u-demo-1', type: 'like', title: 'Thích bài viết', body: 'Lê Hoàng Nam đã thích bài viết của bạn' },
      { user: 'u-demo-1', type: 'message', title: 'Tin nhắn mới', body: 'Phạm Minh Châu: Đây ạ! Em gửi anh xem nè 🖼️' },
      { user: 'u-demo-1', type: 'nearby', title: 'Người dùng gần đây', body: 'Lê Hoàng Nam đang ở gần bạn (1.2km)' },
      { user: 'u-demo-2', type: 'like', title: 'Thích bài viết', body: 'Nguyễn Văn An đã thích bài viết của bạn', isRead: true },
      { user: 'u-demo-2', type: 'message', title: 'Tin nhắn mới', body: 'Nguyễn Văn An: Ok bạn! Thứ 7 10h sáng nhé ☕', isRead: true },
    ];

    for (const n of notifs) {
      await conn.query(
        'INSERT INTO notifications (user_id, type, title, body, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [n.user, n.type, n.title, n.body, n.isRead || false, new Date(now - Math.random() * 7200000)]
      );
    }

    console.log('[Seed] ✅ Notifications created');

    console.log('\n🎉 SEED COMPLETE!');
    console.log('---');
    console.log('📧 demo@timquanhday.de / demo123456');
    console.log('📧 admin@timquanhday.de / admin123456');
    console.log('📧 nam@timquanhday.de / demo123456');
    console.log('📧 chau@timquanhday.de / demo123456');
    console.log('---');
    console.log('💬 3 conversations with messages');
    console.log('📝 4 posts with likes');
    console.log('🔔 6 notifications');

  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
