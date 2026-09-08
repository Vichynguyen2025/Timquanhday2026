import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();
let io = null;
export function setSocketIO(socketIO) { io = socketIO; }

// ─── Helper: append cache-busting version to avatar URL ──
function versionedAvatar(avatar, version) {
  if (!avatar) return avatar;
  const sep = avatar.includes('?') ? '&' : '?';
  return `${avatar}${sep}v=${version || 0}`;
}

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

// Update profile (whitelist fields only)
router.patch('/me', authenticate, async (req, res) => {
  try {
    const allowedFields = ['name', 'bio', 'avatar', 'gender', 'birth_year', 'hometown', 'occupation', 'school', 'visible_on_map'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) return res.status(400).json({ error: 'Name is required' });
      updates.name = updates.name.trim();
    }
    if (updates.bio !== undefined && typeof updates.bio === 'string') updates.bio = updates.bio.trim();
    if (updates.avatar !== undefined && updates.avatar && !updates.avatar.startsWith('http')) return res.status(400).json({ error: 'Invalid avatar URL' });

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    // If avatar is being updated, also increment avatar_version
    if (updates.avatar !== undefined) {
      await query('UPDATE users SET avatar = ?, avatar_version = avatar_version + 1 WHERE id = ?', [updates.avatar, req.user.id]);
    } else {
      await query(`UPDATE users SET ${setClauses} WHERE id = ?`, [...values, req.user.id]);
    }
    const user = await queryOne('SELECT id, name, email, phone, avatar, avatar_version, bio, gender, birth_year, hometown, occupation, school, location_enabled, visible_on_map FROM users WHERE id = ?', [req.user.id]);
    // Apply version to avatar URL for cache invalidation
    if (user && user.avatar) {
      user.avatar = versionedAvatar(user.avatar, user.avatar_version);
    }
    // Emit profile update event
    if (io) {
      io.to(`user:${req.user.id}`).emit('user:profile_updated', { userId: req.user.id, changes: user });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle location sharing
router.patch('/location', authenticate, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
    await query('UPDATE users SET location_enabled = ? WHERE id = ?', [enabled ? 1 : 0, req.user.id]);
    // Emit profile update event
    if (io) {
      io.to(`user:${req.user.id}`).emit('user:profile_updated', { userId: req.user.id, changes: { location_enabled: enabled } });
    }
    res.json({ location_enabled: enabled });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await queryOne('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get blocked users
router.get('/blocked', authenticate, async (req, res) => {
  try {
    const blocked = await query(`
      SELECT u.id, u.name, u.avatar, ub.created_at as blocked_at
      FROM user_blocks ub
      JOIN users u ON u.id = ub.blocked_id
      WHERE ub.blocker_id = ?
      ORDER BY ub.created_at DESC
    `, [req.user.id]);
    res.json(blocked);
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