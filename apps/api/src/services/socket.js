import { query } from '../models/db.js';
import { createNotification } from '../utils/helpers.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const onlineUsers = new Map(); // userId -> Set<socketId>

export function setupSocket(io) {
  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      userId = decoded.id;
    } catch {
      socket.disconnect();
      return;
    }

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    query('UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?', [userId]);
    socket.broadcast.emit('user:online', { userId });
    socket.join(`user:${userId}`);

    socket.on('heartbeat', () => {
      query('UPDATE users SET last_seen = NOW() WHERE id = ?', [userId]);
    });

    // Send message (with reply support)
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, receiverId, type = 'text', replyToId } = data;
        if (!conversationId || !content) return;

        const messageId = crypto.randomUUID();
        await query(
          'INSERT INTO messages (id, conversation_id, sender_id, content, type, reply_to_id) VALUES (?, ?, ?, ?, ?, ?)',
          [messageId, conversationId, userId, content, type, replyToId || null]
        );

        // Get sender name
        const user = await query('SELECT name, avatar FROM users WHERE id = ?', [userId]);
        const message = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: userId,
          content,
          type,
          reply_to_id: replyToId || null,
          is_deleted: false,
          reactions: [],
          reply_preview: null,
          created_at: new Date().toISOString(),
          sender_name: user[0]?.name || 'Unknown',
          sender_avatar: user[0]?.avatar || null,
        };

        // Get reply preview
        if (replyToId) {
          const reply = await query('SELECT id, content, sender_id, is_deleted FROM messages WHERE id = ?', [replyToId]);
          if (reply.length) {
            message.reply_preview = reply[0];
          }
        }

        io.to(conversationId).emit('message:new', message);
        if (receiverId) {
          io.to(`user:${receiverId}`).emit('message:new', message);
          await createNotification(receiverId, 'message', 'Tin nhắn mới', content, { conversationId });
          io.to(`user:${receiverId}`).emit('notification:new', {
            type: 'message', title: 'Tin nhắn mới', body: content, data: { conversationId }
          });
        }
        await query('UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?', [content, conversationId]);
      } catch (err) {
        console.error('[Socket] message:send error:', err);
      }
    });

    // Delete message
    socket.on('message:delete', async (data) => {
      try {
        const { messageId, conversationId } = data;
        if (!messageId) return;
        const msg = await query('SELECT * FROM messages WHERE id = ? AND sender_id = ?', [messageId, userId]);
        if (!msg.length) return;
        await query('UPDATE messages SET is_deleted = TRUE, content = "Tin nhắn đã được thu hồi" WHERE id = ?', [messageId]);
        io.to(conversationId).emit('message:deleted', { messageId, conversationId });
      } catch (err) {
        console.error('[Socket] message:delete error:', err);
      }
    });

    // Reaction
    socket.on('message:react', async (data) => {
      try {
        const { messageId, conversationId, emoji } = data;
        if (!messageId || !emoji) return;

        const msg = await query('SELECT * FROM messages WHERE id = ?', [messageId]);
        if (!msg.length) return;

        const existing = await query(
          'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
          [messageId, userId, emoji]
        );

        let action;
        if (existing.length) {
          await query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
            [messageId, userId, emoji]);
          action = 'removed';
        } else {
          await query('INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (UUID(), ?, ?, ?)',
            [messageId, userId, emoji]);
          action = 'added';
          if (msg[0].sender_id !== userId) {
            await createNotification(msg[0].sender_id, 'like', 'Cảm xúc tin nhắn', `Đã bày tỏ cảm xúc ${emoji}`, { messageId });
          }
        }

        // Get updated reactions
        const reactions = await query(`
          SELECT mr.emoji, mr.user_id, u.name as user_name
          FROM message_reactions mr
          JOIN users u ON mr.user_id = u.id
          WHERE mr.message_id = ?
        `, [messageId]);

        io.to(conversationId).emit('message:reaction', { messageId, conversationId, reactions });
      } catch (err) {
        console.error('[Socket] message:react error:', err);
      }
    });

    socket.on('user:typing', (data) => {
      if (data.receiverId) {
        io.to(`user:${data.receiverId}`).emit('user:typing', { conversationId: data.conversationId, userId });
      }
    });

    socket.on('user:stop-typing', (data) => {
      if (data.receiverId) {
        io.to(`user:${data.receiverId}`).emit('user:stop-typing', { conversationId: data.conversationId, userId });
      }
    });

    socket.on('location:update', async (data) => {
      try {
        const { lat, lng } = data;
        if (lat && lng) {
          await query('INSERT INTO user_locations (user_id, lat, lng) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE lat = ?, lng = ?',
            [userId, lat, lng, lat, lng]);
          socket.broadcast.emit('location:updated', { userId, lat, lng });
        }
      } catch (err) {}
    });

    socket.on('conversation:read', async (data) => {
      try {
        const { conversationId } = data;
        if (conversationId) {
          await query(`INSERT IGNORE INTO message_reads (message_id, user_id)
            SELECT m.id, ? FROM messages m WHERE m.conversation_id = ? AND m.sender_id != ?`,
            [userId, conversationId, userId]);
        }
      } catch (err) {}
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          query('UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?', [userId]);
          io.emit('user:offline', { userId });
        }
      }
    });
  });
}