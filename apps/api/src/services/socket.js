import { query } from '../models/db.js';
import { createNotification } from '../utils/helpers.js';
import jwt from 'jsonwebtoken';

const onlineUsers = new Map(); // userId -> Set<socketId>

export function setupSocket(io) {
  io.on('connection', (socket) => {
    // Authenticate via token
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    let userId = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      userId = decoded.id;
    } catch {
      socket.disconnect();
      return;
    }

    // Track online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    
    // Update online status
    query('UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?', [userId]);
    socket.broadcast.emit('user:online', { userId });

    // Join user room
    socket.join(`user:${userId}`);

    // Heartbeat
    socket.on('heartbeat', () => {
      query('UPDATE users SET last_seen = NOW() WHERE id = ?', [userId]);
    });

    // Send message
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, receiverId, type = 'text' } = data;
        if (!conversationId || !content) return;

        const result = await query(
          'INSERT INTO messages (conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?)',
          [conversationId, userId, content, type]
        );
        const messageId = result.insertId.toString('hex');
        const message = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: userId,
          content,
          type,
          created_at: new Date().toISOString(),
          sender_name: null,
        };

        // Send to conversation
        io.to(conversationId).emit('message:new', message);
        // Also send to specific user if known
        if (receiverId) {
          io.to(`user:${receiverId}`).emit('message:new', message);
          
          // Create notification
          await createNotification(receiverId, 'message', 'Tin nhắn mới', content, { conversationId });
          io.to(`user:${receiverId}`).emit('notification:new', {
            type: 'message',
            title: 'Tin nhắn mới',
            body: content,
            data: { conversationId }
          });
        }

        // Update conversation last message
        await query('UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?', [content, conversationId]);
      } catch (err) {
        console.error('[Socket] message:send error:', err);
      }
    });

    // Typing
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

    // Location update
    socket.on('location:update', async (data) => {
      try {
        const { lat, lng } = data;
        if (lat && lng) {
          await query(
            'INSERT INTO user_locations (user_id, lat, lng) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE lat = ?, lng = ?',
            [userId, lat, lng, lat, lng]
          );
          socket.broadcast.emit('location:updated', { userId, lat, lng });
        }
      } catch (err) {
        console.error('[Socket] location:update error:', err);
      }
    });

    // Mark conversation read
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

    // Disconnect
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
