import { query } from '../models/db.js';
import { createNotification } from '../utils/helpers.js';
import { setUserOnline, setUserOffline, setTyping, clearTyping } from './redis.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const onlineUsers = new Map();

export function setupSocket(io) {
  io.on('connection', (socket) => {
    // ─── Auth ──────────────────────────────────────
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      userId = decoded.id;
    } catch {
      socket.disconnect();
      return;
    }

    // ─── Presence ──────────────────────────────────
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    setUserOnline(userId, 120).catch(() => {});
    query('UPDATE users SET last_seen = NOW() WHERE id = ?', [userId]);

    if (onlineUsers.get(userId).size === 1) {
      socket.broadcast.emit('user:online', { userId });
    }
    socket.join(`user:${userId}`);

    socket.on('heartbeat', () => {
      setUserOnline(userId, 120).catch(() => {});
      query('UPDATE users SET last_seen = NOW() WHERE id = ?', [userId]);
    });

    // ─── Message: Send (with ACK, no self-broadcast) ─
    socket.on('message:send', async (data, ack) => {
      const ackFn = typeof ack === 'function' ? ack : () => {};
      try {
        const { conversationId, content, receiverId, type = 'text', replyToId, tempId, attachmentUrl, attachmentName, attachmentSize } = data;
        if (!conversationId || (!content && !attachmentUrl)) {
          return ackFn({ success: false, error: 'Missing required fields', tempId });
        }

        // Dedup: check if already processed (retry safety)
        if (tempId) {
          const existing = await query(
            'SELECT id FROM messages WHERE sender_id = ? AND client_temp_id = ?',
            [userId, tempId]
          );
          if (existing.length > 0) {
            // Already exists — return existing, do NOT re-insert or re-broadcast
            return ackFn({ success: true, messageId: existing[0].id, tempId, duplicate: true });
          }
        }

        const messageId = crypto.randomUUID();
        const msgType = attachmentUrl ? 'image' : type;

        // Build metadata JSON for image attachments
        let metadata = null;
        if (attachmentUrl) {
          metadata = JSON.stringify({
            attachmentUrl,
            attachmentName: attachmentName || null,
            attachmentSize: attachmentSize || null,
          });
        }

        await query(
          'INSERT INTO messages (id, conversation_id, sender_id, content, type, metadata, reply_to_id, client_temp_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [messageId, conversationId, userId, content || '', msgType, metadata, replyToId || null, tempId || null]
        );

        // Get sender info
        const user = await query('SELECT name, avatar FROM users WHERE id = ?', [userId]);
        const message = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: userId,
          content: content || '',
          type: msgType,
          metadata: metadata ? JSON.parse(metadata) : null,
          reply_to_id: replyToId || null,
          is_deleted: false,
          reactions: [],
          reply_preview: null,
          created_at: new Date().toISOString(),
          sender_name: user[0]?.name || 'Unknown',
          sender_avatar: user[0]?.avatar || null,
          status: 'sent',
          client_temp_id: tempId || null,
        };

        // Get reply preview
        if (replyToId) {
          const reply = await query('SELECT id, content, sender_id, is_deleted FROM messages WHERE id = ?', [replyToId]);
          if (reply.length) message.reply_preview = reply[0];
        }

        // Broadcast to conversation room EXCEPT sender (sender gets ACK)
        socket.to(`conversation:${conversationId}`).emit('message:new', message);

        // Notify specific user if needed
        if (receiverId) {
          io.to(`user:${receiverId}`).emit('message:new', message);
          await createNotification(receiverId, 'message', 'Tin nhắn mới', content || 'Đã gửi ảnh', { conversationId });
          io.to(`user:${receiverId}`).emit('notification:new', {
            type: 'message', title: 'Tin nhắn mới', body: content || 'Đã gửi ảnh', data: { conversationId }
          });
        }

        // Update conversation last message
        await query('UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?', [content || '📷 Ảnh', conversationId]);

        // ACK sender with real message ID — sender does NOT get message:new
        ackFn({ success: true, messageId, tempId });
      } catch (err) {
        console.error('[Socket] message:send error:', err);
        ackFn({ success: false, error: 'Internal server error', tempId: data?.tempId });
      }
    });

    // ─── Delete ──────────────────────────────────
    socket.on('message:delete', async (data) => {
      try {
        const { messageId, conversationId } = data;
        if (!messageId) return;
        const msg = await query('SELECT * FROM messages WHERE id = ? AND sender_id = ?', [messageId, userId]);
        if (!msg.length) return;
        await query('UPDATE messages SET is_deleted = 1, content = "Tin nhắn đã được thu hồi" WHERE id = ?', [messageId]);
        io.to(`conversation:${conversationId}`).emit('message:deleted', { messageId, conversationId });
      } catch (err) {
        console.error('[Socket] message:delete error:', err);
      }
    });

    // ─── Reaction ────────────────────────────────
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

        if (existing.length) {
          await query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
            [messageId, userId, emoji]);
        } else {
          await query('INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (UUID(), ?, ?, ?)',
            [messageId, userId, emoji]);
          if (msg[0].sender_id !== userId) {
          await createNotification(msg[0].sender_id, 'like', 'Cảm xúc tin nhắn', `Đã bày tỏ cảm xúc ${emoji}`, { messageId });
          }
        }

        const reactions = await query(`
          SELECT mr.emoji, mr.user_id, u.name as user_name
          FROM message_reactions mr
          JOIN users u ON mr.user_id = u.id
          WHERE mr.message_id = ?
        `, [messageId]);

        io.to(`conversation:${conversationId}`).emit('message:reaction', { messageId, conversationId, reactions });
      } catch (err) {
        console.error('[Socket] message:react error:', err);
      }
    });

    // ─── Typing ─────────────────────────────────
    socket.on('typing:start', (data) => {
      if (!data.conversationId || !data.receiverId) return;
      setTyping(data.conversationId, userId, 5).catch(() => {});
      io.to(`user:${data.receiverId}`).emit('user:typing', { conversationId: data.conversationId, userId });
    });

    socket.on('typing:stop', (data) => {
      if (!data.receiverId) return;
      clearTyping(data.conversationId, userId).catch(() => {});
      io.to(`user:${data.receiverId}`).emit('user:stop-typing', { conversationId: data.conversationId, userId });
    });

    // Backward compat
    socket.on('user:typing', (data) => {
      if (data.receiverId) io.to(`user:${data.receiverId}`).emit('user:typing', { conversationId: data.conversationId, userId });
    });
    socket.on('user:stop-typing', (data) => {
      if (data.receiverId) io.to(`user:${data.receiverId}`).emit('user:stop-typing', { conversationId: data.conversationId, userId });
    });

    // ─── Location ───────────────────────────────
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

    // ─── Conversation Join/Leave ────────────────
    socket.on('conversation:join', async (data) => {
      const { conversationId } = data;
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        await query(`INSERT IGNORE INTO message_reads (message_id, user_id)
          SELECT m.id, ? FROM messages m WHERE m.conversation_id = ? AND m.sender_id != ?`,
          [userId, conversationId, userId]);
      }
    });

    socket.on('conversation:leave', (data) => {
      if (data.conversationId) socket.leave(`conversation:${data.conversationId}`);
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

    // ─── Disconnect ─────────────────────────────
    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          await setUserOffline(userId).catch(() => {});
          query('UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?', [userId]);
          io.emit('user:offline', { userId });
        }
      }
    });
  });
}