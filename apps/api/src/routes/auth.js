import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../models/db.js';
import { authenticate, generateTokens } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

import crypto from 'crypto';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone || '']);
    if (existing) return res.status(409).json({ error: 'Email or phone already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    await query(
      'INSERT INTO users (id, name, email, phone, password) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, phone || null, hashed]
    );

    const tokens = generateTokens(userId);
    await query('INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [userId, tokens.refreshToken]);

    const user = await queryOne('SELECT id, name, email, phone, avatar, bio FROM users WHERE id = ?', [userId]);
    res.status(201).json({ user, ...tokens });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await queryOne('SELECT * FROM users WHERE email = ? OR phone = ?', [email, email]);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const tokens = generateTokens(user.id);
    await query('INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [user.id, tokens.refreshToken]);
    await query('UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?', [user.id]);

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, ...tokens });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
    const session = await queryOne('SELECT * FROM user_sessions WHERE refresh_token = ? AND user_id = ?', [refreshToken, decoded.id]);
    if (!session) return res.status(401).json({ error: 'Invalid refresh token' });

    const tokens = generateTokens(decoded.id);
    await query('UPDATE user_sessions SET refresh_token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE id = ?',
      [tokens.refreshToken, session.id]);

    res.json(tokens);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await query('UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?', [req.user.id]);
    await query('DELETE FROM user_sessions WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Me (full profile)
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, name, email, phone, avatar, avatar_version, bio, location_enabled, is_online, last_seen, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Apply version to avatar URL for cache invalidation
    if (user.avatar) {
      const sep = user.avatar.includes('?') ? '&' : '?';
      user.avatar = `${user.avatar}${sep}v=${user.avatar_version || 0}`;
    }

    // Get service profile (SOS provider settings)
    const sp = await queryOne('SELECT * FROM service_profiles WHERE user_id = ?', [req.user.id]);

    // Get stats
    const [postCount] = await query('SELECT COUNT(*) as c FROM posts WHERE user_id = ?', [req.user.id]);
    const [likeCount] = await query('SELECT COUNT(*) as c FROM post_likes WHERE user_id = ?', [req.user.id]);
    const [saveCount] = await query('SELECT COUNT(*) as c FROM post_saves WHERE user_id = ?', [req.user.id]);
    const [sosCount] = await query('SELECT COUNT(*) as c FROM sos_requests WHERE user_id = ?', [req.user.id]);
    const [helpingCount] = await query('SELECT COUNT(*) as c FROM sos_responses WHERE provider_id = ?', [req.user.id]);

    // Get SOS categories if provider
    let categories = [];
    if (sp) {
      const catRows = await query(`
        SELECT sc.id, sc.name FROM service_profile_categories spc
        JOIN sos_categories sc ON sc.id = spc.category_id
        WHERE spc.profile_id = ?
      `, [sp.id]);
      categories = catRows;
    }

    // Get blocked users count
    const [blockedCount] = await query('SELECT COUNT(*) as c FROM user_blocks WHERE blocker_id = ?', [req.user.id]);

    res.json({
      ...user,
      service_profile: sp ? { ...sp, categories } : null,
      stats: {
        posts: postCount?.c || 0,
        likes: likeCount?.c || 0,
        saves: saveCount?.c || 0,
        sos_requests: sosCount?.c || 0,
        sos_helping: helpingCount?.c || 0,
        blocked: blockedCount?.c || 0,
      },
    });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
