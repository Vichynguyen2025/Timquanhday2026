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
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ?) as unread_count
      FROM conversations c
      JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = ? AND cm.deleted_at IS NULL
      ORDER BY COALESCE(last_message_at, c.created_at) DESC`, [req.user.id, req.user.id]
    );

    // Get participant info for each conversation
    for (const conv of conversations) {
      const members = await query(`
        SELECT u.id, u.name, u.avatar, u.is_online, u.last_seen
        FROM conversation_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.conversation_id = ? AND u.id != ?
      `, [conv.id, req.user.id]);
      conv.participants = members;

      // For private chats, use the other person's name
      if (conv.type === 'private' && members.length > 0) {
        conv.display_name = members[0].name;
        conv.avatar = members[0].avatar || null;
        conv.is_online = members[0].is_online === 1;
      } else {
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