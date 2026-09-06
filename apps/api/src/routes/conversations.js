import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get conversations
router.get('/', authenticate, async (req, res) => {
  try {
    const conversations = await query(`
      SELECT c.*,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ?) as unread_count
      FROM conversations c
      JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = ?
      ORDER BY last_message_at DESC`, [req.user.id, req.user.id]
    );
    res.json(conversations);
  } catch (err) {
    console.error('[Conv] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create conversation
router.post('/', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Check if private conversation exists
    const existing = await queryOne(`
      SELECT c.id FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
      WHERE c.type = 'private'
    `, [req.user.id, userId]);
    if (existing) return res.json({ id: existing.id });

    // Create new
    const result = await query('INSERT INTO conversations (type) VALUES (?)', ['private']);
    const convId = result.insertId.toString('hex');
    await query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [convId, req.user.id, convId, userId]);
    res.json({ id: convId });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
