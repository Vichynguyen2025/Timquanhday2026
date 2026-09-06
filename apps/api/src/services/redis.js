import Redis from 'ioredis';

let redis = null;
let pubClient = null;
let subClient = null;

export function getRedis() {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on('error', (err) => console.error('[Redis] Error:', err.message));
    redis.on('ready', () => console.log('[Redis] Connected'));
  }
  return redis;
}

export async function getRedisAdapter() {
  if (!pubClient) {
    pubClient = getRedis().duplicate();
    subClient = getRedis().duplicate();
    const { createAdapter } = await import('@socket.io/redis-adapter');
    return createAdapter(pubClient, subClient);
  }
  return null;
}

// Presence: user online/offline
export async function setUserOnline(userId, ttl = 120) {
  const r = getRedis();
  await r.setex(`presence:user:${userId}`, ttl, 'online');
  await r.sadd('presence:active_users', userId);
}

export async function setUserOffline(userId) {
  const r = getRedis();
  await r.del(`presence:user:${userId}`);
  await r.srem('presence:active_users', userId);
}

export async function isUserOnline(userId) {
  const r = getRedis();
  return await r.exists(`presence:user:${userId}`);
}

export async function getOnlineUsers(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const r = getRedis();
  const results = await Promise.all(userIds.map(uid => r.exists(`presence:user:${uid}`)));
  return userIds.filter((_, i) => results[i] === 1);
}

// Typing state
export async function setTyping(conversationId, userId, ttl = 5) {
  const r = getRedis();
  await r.setex(`typing:${conversationId}:${userId}`, ttl, '1');
}

export async function clearTyping(conversationId, userId) {
  const r = getRedis();
  await r.del(`typing:${conversationId}:${userId}`);
}

export async function getTypingUsers(conversationId) {
  const r = getRedis();
  const keys = await r.keys(`typing:${conversationId}:*`);
  return keys.map(k => k.split(':').pop());
}

export async function closeRedis() {
  if (redis) { await redis.quit(); redis = null; }
  if (pubClient) { await pubClient.quit(); pubClient = null; }
  if (subClient) { await subClient.quit(); subClient = null; }
}
