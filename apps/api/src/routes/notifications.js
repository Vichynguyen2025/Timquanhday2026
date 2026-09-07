import { Router } from 'express';
import { query } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/notifications/unread-count — Total unread notifications ──
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

// Get notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const unreadCount = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ notifications, unreadCount: unreadCount[0].count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
