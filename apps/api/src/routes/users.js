import { Router } from 'express';
import { query } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Search users
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await query(
      'SELECT id, name, email, avatar, is_online, bio FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 20',
      [`%${q}%`, `%${q}%`, req.user.id]
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile
router.patch('/me', authenticate, async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    await query('UPDATE users SET name = COALESCE(?, name), bio = COALESCE(?, bio), avatar = COALESCE(?, avatar) WHERE id = ?',
      [name, bio, avatar, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
