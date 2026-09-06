import { Router } from 'express';
import { query } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { createNotification } from '../utils/helpers.js';

const router = Router();

// Get messages in conversation
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    const messages = await query(`
      SELECT m.id, m.conversation_id, m.sender_id, m.content, m.type, m.metadata,
             m.reply_to_id, m.is_deleted, m.edited_at, m.created_at,
             u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ${before ? 'AND m.created_at < ?' : ''}
      ORDER BY m.created_at DESC
      LIMIT ?
    `, before ? [conversationId, before, parseInt(limit)] : [conversationId, parseInt(limit)]);

    // Get reactions for these messages
    if (messages.length > 0) {
      const msgIds = messages.map(m => m.id);
      const reactions = await query(`
        SELECT mr.*, u.name as user_name
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id IN (${msgIds.map(() => '?').join(',')})
      `, msgIds);

      // Group reactions by message
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

// Delete message (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const msg = await query('SELECT * FROM messages WHERE id = ? AND sender_id = ?', [req.params.id, req.user.id]);
    if (!msg.length) return res.status(404).json({ error: 'Message not found or unauthorized' });
    await query('UPDATE messages SET is_deleted = TRUE, content = "Tin nhắn đã được thu hồi" WHERE id = ?', [req.params.id]);
    res.json({ success: true });
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

    // Check if reaction exists
    const existing = await query(
      'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [req.params.id, req.user.id, emoji]
    );

    if (existing.length) {
      // Remove reaction
      await query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
        [req.params.id, req.user.id, emoji]);
      res.json({ action: 'removed', emoji });
    } else {
      // Add reaction
      await query(
        'INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (UUID(), ?, ?, ?)',
        [req.params.id, req.user.id, emoji]
      );
      // Notify
      if (msg[0].sender_id !== req.user.id) {
        await createNotification(msg[0].sender_id, 'like', 'Cảm xúc tin nhắn', `${req.user.name || 'Ai đó'} đã bày tỏ cảm xúc ${emoji}`, { messageId: req.params.id });
      }
      res.json({ action: 'added', emoji });
    }
  } catch (err) {
    console.error('[Reaction] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;