import { Router } from 'express';
import { query } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get messages in conversation
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    const messages = await query(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ${before ? 'AND m.created_at < ?' : ''}
      ORDER BY m.created_at DESC
      LIMIT ?
    `, before ? [conversationId, before, parseInt(limit)] : [conversationId, parseInt(limit)]);

    // Mark as read
    await query(`INSERT IGNORE INTO message_reads (message_id, user_id)
      SELECT m.id, ? FROM messages m WHERE m.conversation_id = ? AND m.sender_id != ?`,
      [req.user.id, conversationId, req.user.id]);

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
