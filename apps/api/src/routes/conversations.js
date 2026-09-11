import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { haversineDistance } from '../utils/helpers.js';
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

// ─── Get nearby groups (by address + GPS proximity) ──
router.get('/nearby-groups', authenticate, async (req, res) => {
  try {
    const radius = parseInt(req.query.radius || '500');
    const validRadii = [100, 200, 500];
    if (!validRadii.includes(radius)) {
      return res.status(400).json({ error: `Invalid radius. Allowed: ${validRadii.join(', ')}` });
    }

    // Get current user GPS location
    const userLoc = await queryOne('SELECT lat, lng FROM user_locations WHERE user_id = ?', [req.user.id]);
    // Get user's hometown (province) from profile
    const userProfile = await queryOne('SELECT hometown FROM users WHERE id = ?', [req.user.id]);
    const userProvince = userProfile?.hometown || null;

    // Find groups user is NOT a member of (or soft-deleted)
    const candidateGroups = await query(`
      SELECT DISTINCT c.id, c.name, c.type, c.avatar, c.lat as group_lat, c.lng as group_lng,
        c.ward, c.district, c.province, c.street, c.created_at,
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
      let matchType = null; // 'gps' | 'member_gps' | 'province' | 'district'

      // 1 — Try group's own lat/lng distance
      if (g.group_lat && g.group_lng && userLoc) {
        minDist = haversineDistance(userLoc.lat, userLoc.lng, g.group_lat, g.group_lng) * 1000;
        if (minDist <= radius) matchType = 'gps';
      }

      // 2 — Check member GPS proximity (fallback)
      if (!matchType && userLoc) {
        const memberLocs = await query(`
          SELECT ul.lat, ul.lng
          FROM conversation_members cm
          JOIN user_locations ul ON ul.user_id = cm.user_id
          WHERE cm.conversation_id = ? AND cm.user_id != ? AND ul.lat IS NOT NULL
        `, [g.id, req.user.id]);

        for (const ml of memberLocs) {
          const dist = haversineDistance(userLoc.lat, userLoc.lng, ml.lat, ml.lng) * 1000;
          if (dist < minDist) minDist = dist;
          if (dist <= radius) { matchType = 'member_gps'; break; }
        }
        // Keep the actual minDist for sorting even if not matched by GPS
      }

      // 3 — Match by province (same tỉnh/thành phố)
      if (!matchType && userProvince && g.province && g.province === userProvince) {
        matchType = 'province';
      }

      // 4 — If still no match and no GPS data at all, show recently created groups (fallback)
      if (!matchType && !userLoc && !userProvince) {
        matchType = 'recent';
      }

      if (matchType) {
        const members = await query(`
          SELECT u.id, u.name, u.avatar FROM conversation_members cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.conversation_id = ? AND cm.deleted_at IS NULL LIMIT 4
        `, [g.id]);
        result.push({
          ...g,
          distance: minDist === Infinity ? null : Math.round(minDist),
          address_label: [g.street, g.ward, g.district, g.province].filter(Boolean).join(', '),
          match_type: matchType,
          members
        });
      }
    }

    // Sort: GPS-matched first (by distance), then province-matched, then recent
    const sortOrder = { gps: 0, member_gps: 1, province: 2, district: 3, recent: 4 };
    result.sort((a, b) => {
      const orderDiff = (sortOrder[a.match_type] || 9) - (sortOrder[b.match_type] || 9);
      if (orderDiff !== 0) return orderDiff;
      return (a.distance || 99999) - (b.distance || 99999);
    });

    res.json({ groups: result, radius });
  } catch (err) {
    console.error('[NearbyGroups] Error:', err);
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
    const { name, memberIds, lat, lng, ward, district, province, street } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Group name required' });
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 other members required' });
    }
    // Include creator in members
    const allIds = [req.user.id, ...memberIds.filter(id => id !== req.user.id)];
    const convId = crypto.randomUUID();

    await query(
      'INSERT INTO conversations (id, type, name, lat, lng, ward, district, province, street) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [convId, 'group', name.trim(), lat || null, lng || null, ward || null, district || null, province || null, street || null]
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

// ─── Update conversation (name, avatar, address) ──
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatar, ward, district, province, street, lat, lng } = req.body;
    if (!name && !avatar && !ward && !district && !province && !street && !lat && !lng) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    // Check membership
    const member = await queryOne('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [id, req.user.id]);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
    if (ward !== undefined) { updates.push('ward = ?'); values.push(ward); }
    if (district !== undefined) { updates.push('district = ?'); values.push(district); }
    if (province !== undefined) { updates.push('province = ?'); values.push(province); }
    if (street !== undefined) { updates.push('street = ?'); values.push(street); }
    if (lat !== undefined) { updates.push('lat = ?'); values.push(lat); }
    if (lng !== undefined) { updates.push('lng = ?'); values.push(lng); }
    values.push(id);
    await query(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`, values);

    // Broadcast update to conversation room
    if (req.app?.get('io')) {
      const io = req.app.get('io');
      io.to(`conversation:${id}`).emit('conversation:updated', {
        conversationId: id, name, avatar, ward, district, province, street, lat, lng
      });
    }

    res.json({ success: true, conversationId: id, name, avatar, ward, district, province, street, lat, lng });
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