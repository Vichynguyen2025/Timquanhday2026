import { Router } from 'express';
import { query } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/notifications/unread-count ──
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const [result] = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ count: result.count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/notifications — with actor info + post content ──
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const notifications = await query(`
      SELECT
        n.*,
        a.name as actor_name,
        a.avatar as actor_avatar,
        p.content as post_content,
        p.media as post_media
      FROM notifications n
      LEFT JOIN users a ON n.actor_id = a.id
      LEFT JOIN posts p ON (
        (n.target_type = 'post' AND n.target_id = p.id)
        OR
        (n.data LIKE CONCAT('%"postId":"', p.id, '"%'))
      )
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.id, limit, offset]);

    const [countResult] = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      notifications,
      unreadCount: countResult.count,
      page,
      hasMore: notifications.length >= limit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/notifications/with-post — đầy đủ post context ──
router.get('/with-post', authenticate, async (req, res) => {
  try {
    const notifications = await query(`
      SELECT
        n.*,
        a.name as actor_name,
        a.avatar as actor_avatar,
        p.content as post_content,
        p.media as post_media
      FROM notifications n
      LEFT JOIN users a ON n.actor_id = a.id
      LEFT JOIN posts p ON (
        (n.target_type = 'post' AND n.target_id = p.id)
        OR
        (n.data LIKE CONCAT('%"postId":"', p.id, '"%'))
      )
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user.id]);

    const unreadCount = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({ notifications, unreadCount: unreadCount[0].count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Mark as read ──
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Mark all as read ──
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;