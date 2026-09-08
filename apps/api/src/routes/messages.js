import { Router } from 'express';
import { query } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { createNotification } from '../utils/helpers.js';

const router = Router();

// ─── GET /api/messages/unread-count — Total unread messages ──
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const [result] = await query(`
      SELECT COUNT(*) as count FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ? AND cm.deleted_at IS NULL
      WHERE m.sender_id != ?
      AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)
    `, [req.user.id, req.user.id, req.user.id]);
    res.json({ count: result.count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages with cursor pagination
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);

    const messages = await query(`
      SELECT m.id, m.conversation_id, m.sender_id, m.content, m.type, m.metadata,
             m.reply_to_id, m.is_deleted, m.deleted_by, m.edited_at, m.created_at,
             u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_deletions md ON md.message_id = m.id AND md.user_id = ?
      WHERE m.conversation_id = ?
      AND md.id IS NULL
      ${before ? 'AND m.created_at < ?' : ''}
      ORDER BY m.created_at DESC
      LIMIT ?
    `, before ? [req.user.id, conversationId, before, limitNum] : [req.user.id, conversationId, limitNum]);

    // Get reactions
    if (messages.length > 0) {
      const msgIds = messages.map(m => m.id);
      const reactions = await query(`
        SELECT mr.*, u.name as user_name
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id IN (${msgIds.map(() => '?').join(',')})
      `, msgIds);

      const reactionMap = {};
      for (const r of reactions) {
        if (!reactionMap[r.message_id]) reactionMap[r.message_id] = [];
        reactionMap[r.message_id].push({ emoji: r.emoji, userId: r.user_id, userName: r.user_name });
      }

      // Get reply previews
      const replyIds = messages.filter(m => m.reply_to_id).map(m => m.reply_to_id);
      let replyPreviewMap = {};
      if (replyIds.length > 0) {
        const replies = await query(`
          SELECT id, content, sender_id, is_deleted FROM messages WHERE id IN (${replyIds.map(() => '?').join(',')})
        `, replyIds);
        for (const r of replies) {
          replyPreviewMap[r.id] = r;
        }
      }

      for (const msg of messages) {
        msg.reactions = reactionMap[msg.id] || [];
        msg.reply_preview = msg.reply_to_id ? replyPreviewMap[msg.reply_to_id] || null : null;
      }
    }

    // Mark as read
    await query(`INSERT IGNORE INTO message_reads (message_id, user_id)
      SELECT m.id, ? FROM messages m WHERE m.conversation_id = ? AND m.sender_id != ?`,
      [req.user.id, conversationId, req.user.id]);

    res.json(messages.reverse());
  } catch (err) {
    console.error('[Messages] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message (both sides / my side)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { side } = req.query; // 'my' or 'both'
    const msg = await query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (!msg.length) return res.status(404).json({ error: 'Message not found' });

    const isSender = msg[0].sender_id === req.user.id;

    if (side === 'both' && isSender) {
      // Both sides: mark is_deleted + deleted_at globally
      await query('UPDATE messages SET is_deleted = TRUE, content = "Tin nhắn đã được thu hồi", deleted_at = NOW(), deleted_by = ? WHERE id = ?',
        [req.user.id, req.params.id]);
    } else {
      // My side: insert into message_deletions for the current user
      await query('INSERT IGNORE INTO message_deletions (message_id, user_id) VALUES (?, ?)',
        [req.params.id, req.user.id]);
    }

    // Broadcast deletion event to conversation for realtime removal
    const msgConv = await queryOne('SELECT conversation_id FROM messages WHERE id = ?', [req.params.id]);
    if (msgConv && req.app?.get('io')) {
      const io = req.app.get('io');
      io.to(`conversation:${msgConv.conversation_id}`).emit('message:deleted', {
        messageId: req.params.id,
        conversationId: msgConv.conversation_id,
        side: side || 'my',
        userId: req.user.id,
      });
    }

    res.json({ success: true, messageId: req.params.id, side: side || 'my' });
  } catch (err) {
    console.error('[Messages] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch delete messages
router.post('/batch-delete', authenticate, async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds required' });
    }
    const placeholders = messageIds.map(() => '?').join(',');
    const result = await query(
      `UPDATE messages SET is_deleted = TRUE, content = "Tin nhắn đã được thu hồi" WHERE id IN (${placeholders}) AND sender_id = ?`,
      [...messageIds, req.user.id]
    );
    res.json({ success: true, affected: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add reaction
router.post('/:id/reaction', authenticate, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji required' });

    const msg = await query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (!msg.length) return res.status(404).json({ error: 'Message not found' });

    const existing = await query(
      'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [req.params.id, req.user.id, emoji]
    );

    if (existing.length) {
      await query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
        [req.params.id, req.user.id, emoji]);
      res.json({ action: 'removed', emoji });
    } else {
      await query('INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (UUID(), ?, ?, ?)',
        [req.params.id, req.user.id, emoji]);
      if (msg[0].sender_id !== req.user.id) {
        // Message reactions are Messenger domain — no notification created
      }
      res.json({ action: 'added', emoji });
    }
  } catch (err) {
    console.error('[Reaction] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;