import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDatabase } from './models/db.js';
import { setupSocket } from './services/socket.js';
import { getRedis, getRedisAdapter } from './services/redis.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import locationRoutes from './routes/location.js';
import notificationRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import postRoutes from './routes/posts.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true },
  path: '/ws',
  addTrailingSlash: false,
});

// Initialize Redis adapter
(async () => {
  try {
    const adapter = await getRedisAdapter();
    if (adapter) {
      io.adapter(adapter);
      console.log('[Redis] Socket.IO adapter ready');
    }
  } catch (err) {
    console.log('[Redis] Adapter not available, running without (single-process mode)');
  }
})();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/posts', postRoutes);

// Socket.IO
setupSocket(io);

// Init DB then start
const PORT = process.env.PORT || 3001;
initDatabase().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`[API] Running on port ${PORT}`);
    console.log(`[WS] Socket.IO ready on /ws`);
  });
}).catch(err => {
  console.error('[DB] Init failed:', err.message);
  process.exit(1);
});
