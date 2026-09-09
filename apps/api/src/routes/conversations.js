import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// Get conversations with participant info
router.get('/', authenticate, async (req, res) => {
  try {
    const conversations = await query(`
      SELECT c.*,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)) as unread_count
      FROM conversations c
      JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = ? AND cm.deleted_at IS NULL
      ORDER BY COALESCE(last_message_at, c.created_at) DESC`, [req.user.id, req.user.id, req.user.id]
    );

    // Get participant info for each conversation
    for (const conv of conversations) {
      const members = await query(`
        SELECT u.id, u.name, u.avatar, u.is_online, u.last_seen,
          (SELECT nickname FROM conversation_nicknames WHERE conversation_id = ? AND user_id = u.id) as nickname
        FROM conversation_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.conversation_id = ? AND u.id != ?
      `, [conv.id, conv.id, req.user.id]);
      conv.participants = members;

      // For private chats, use the other person's name or nickname
      if (conv.type === 'private' && members.length > 0) {
        // Check if WE set a nickname for them
        const myNick = await queryOne('SELECT nickname FROM conversation_nicknames WHERE conversation_id = ? AND user_id = ?', [conv.id, req.user.id]);
        conv.display_name = myNick?.nickname || members[0].nickname || members[0].name;
        conv.avatar = members[0].avatar || null;
        conv.is_online = members[0].is_online === 1;
      } else if (conv.type === 'group') {
        conv.display_name = conv.name || 'Group';
        conv.is_online = false;
      }
    }

    res.json(conversations);
  } catch (err) {
    console.error('[Conv] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single conversation detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const conv = await queryOne('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Not found' });

    const members = await query(`
      SELECT u.id, u.name, u.avatar, u.bio, u.is_online, u.last_seen
      FROM conversation_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.conversation_id = ?
    `, [req.params.id]);

    res.json({ ...conv, members });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create conversation
router.post('/', authenticate, async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'userId required' });

    const existing = await queryOne(`
      SELECT c.id FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
      WHERE c.type = 'private'
    `, [req.user.id, targetUserId]);
    if (existing) return res.json({ id: existing.id });

    const convId = crypto.randomUUID();
    await query('INSERT INTO conversations (id, type) VALUES (?, ?)', [convId, 'private']);
    await query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)',
      [convId, req.user.id, convId, targetUserId]);
    res.json({ id: convId });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Create group chat ─────────────────────
router.post('/group', authenticate, async (req, res) => {
  try {
    const { name, memberIds, lat, lng } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Group name required' });
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 other members required' });
    }
    // Include creator in members
    const allIds = [req.user.id, ...memberIds.filter(id => id !== req.user.id)];
    const convId = crypto.randomUUID();

    await query(
      'INSERT INTO conversations (id, type, name, lat, lng) VALUES (?, ?, ?, ?, ?)',
      [convId, 'group', name.trim(), lat || null, lng || null]
    );

    const values = allIds.map(uid => `('${convId}', '${uid}')`).join(', ');
    await query(`INSERT INTO conversation_members (conversation_id, user_id) VALUES ${values}`);

    // Emit to all members that a new group was created
    if (req.app?.get('io')) {
      const io = req.app.get('io');
      for (const uid of allIds) {
        io.to(`user:${uid}`).emit('conversation:new', { id: convId });
      }
    }

    res.json({ id: convId, name: name.trim(), type: 'group' });
  } catch (err) {
    console.error('[Group] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Get nearby groups (by group location or member proximity) ──
router.get('/nearby-groups', authenticate, async (req, res) => {
  try {
    const radius = parseInt(req.query.radius || '500');
    const validRadii = [100, 200, 500];
    if (!validRadii.includes(radius)) {
      return res.status(400).json({ error: `Invalid radius. Allowed: ${validRadii.join(', ')}` });
    }

    // Get current user location
    const userLoc = await queryOne('SELECT lat, lng FROM user_locations WHERE user_id = ?', [req.user.id]);
    if (!userLoc) return res.json({ groups: [] });

    const { haversineDistance } = require('../utils/helpers.js');

    // Find groups where user is either NOT a member OR is a member (but didn't soft-delete)
    const candidateGroups = await query(`
      SELECT DISTINCT c.id, c.name, c.type, c.lat as group_lat, c.lng as group_lng, c.created_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM conversations c
      WHERE c.type = 'group'
      AND c.id NOT IN (
        SELECT cm2.conversation_id FROM conversation_members cm2 WHERE cm2.user_id = ? AND cm2.deleted_at IS NOT NULL
      )`, [req.user.id]
    );

    const result = [];
    for (const g of candidateGroups) {
      let minDist = Infinity;

      // Try group's own lat/lng first
      if (g.group_lat && g.group_lng) {
        minDist = haversineDistance(userLoc.lat, userLoc.lng, g.group_lat, g.group_lng) * 1000;
      }

      // Also check nearest member location
      const memberLocs = await query(`
        SELECT ul.lat, ul.lng
        FROM conversation_members cm
        JOIN user_locations ul ON ul.user_id = cm.user_id
        WHERE cm.conversation_id = ? AND cm.user_id != ? AND ul.lat IS NOT NULL
      `, [g.id, req.user.id]);

      for (const ml of memberLocs) {
        const dist = haversineDistance(userLoc.lat, userLoc.lng, ml.lat, ml.lng) * 1000;
        if (dist < minDist) minDist = dist;
      }

      if (minDist <= radius) {
        const members = await query(`
          SELECT u.id, u.name, u.avatar FROM conversation_members cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.conversation_id = ? AND cm.deleted_at IS NULL LIMIT 4
        `, [g.id]);
        result.push({ ...g, distance: Math.round(minDist), members });
      }
    }

    res.json({ groups: result.sort((a, b) => a.distance - b.distance), radius });
  } catch (err) {
    console.error('[NearbyGroups] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Update conversation (name, avatar) ────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatar } = req.body;
    if (!name && !avatar) return res.status(400).json({ error: 'Nothing to update' });

    // Check membership
    const member = await queryOne('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [id, req.user.id]);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
    values.push(id);
    await query(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`, values);

    // Broadcast update to conversation room
    if (req.app?.get('io')) {
      const io = req.app.get('io');
      io.to(`conversation:${id}`).emit('conversation:updated', { conversationId: id, name, avatar });
    }

    res.json({ success: true, conversationId: id, name, avatar });
  } catch (err) {
    console.error('[Conv] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Get nickname ─────────────────────────────
router.get('/:id/nickname', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const nick = await queryOne('SELECT nickname FROM conversation_nicknames WHERE conversation_id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ nickname: nick?.nickname || null });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Set nickname ─────────────────────────────
router.put('/:id/nickname', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname } = req.body;
    if (!nickname || !nickname.trim()) {
      // Remove nickname
      await query('DELETE FROM conversation_nicknames WHERE conversation_id = ? AND user_id = ?', [id, req.user.id]);
      return res.json({ nickname: null });
    }
    await query(
      'INSERT INTO conversation_nicknames (conversation_id, user_id, nickname) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nickname = ?',
      [id, req.user.id, nickname.trim(), nickname.trim()]
    );
    res.json({ nickname: nickname.trim() });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Member list ──────────────────────────────
router.get('/:id/members', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const members = await query(`
      SELECT u.id, u.name, u.avatar, u.is_online, u.last_seen, cm.joined_at
      FROM conversation_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.conversation_id = ? AND cm.deleted_at IS NULL
      ORDER BY cm.joined_at ASC
    `, [id]);
    res.json({ members });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Delete conversation (for current user only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // Soft delete: mark conversation_members.deleted_at for current user
    await query('UPDATE conversation_members SET deleted_at = NOW() WHERE conversation_id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, conversationId: id });
  } catch (err) {
    console.error('[Conversations] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;