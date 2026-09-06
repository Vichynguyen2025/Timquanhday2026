import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

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

// Block user
router.post('/:id/block', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
    
    const existing = await queryOne('SELECT * FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, id]);
    if (existing) return res.json({ blocked: true, message: 'Already blocked' });
    
    await query('INSERT INTO user_blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)', 
      [crypto.randomUUID(), req.user.id, id]);
    
    res.json({ blocked: true });
  } catch (err) {
    console.error('[Block] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unblock user
router.post('/:id/unblock', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, id]);
    res.json({ blocked: false });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check block status
router.get('/:id/block-status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const blocked = await queryOne(
      'SELECT * FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [req.user.id, id, id, req.user.id]
    );
    res.json({
      isBlocked: !!blocked,
      blockedBy: blocked?.blocker_id === req.user.id ? 'me' : 'them',
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;