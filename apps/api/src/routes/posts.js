import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { getNearbyUsers, createNotification } from '../utils/helpers.js';
import crypto from 'crypto';

const router = Router();

let io = null;
export function setSocketIO(socketIO) {
  io = socketIO;
}

// Create post
router.post('/', authenticate, async (req, res) => {
  try {
    const { content, imageUrl, lat, lng } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: 'Content or image required' });

    const postId = crypto.randomUUID();
    const postType = imageUrl ? 'image' : 'text';
    await query(
      'INSERT INTO posts (id, user_id, content, image_url, type, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [postId, req.user.id, content || '', imageUrl || null, postType, lat || null, lng || null]
    );

    const post = await queryOne(
      `SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count, COALESCE(p.comment_count, 0) as comment_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
      [req.user.id, postId]
    );

    // Broadcast to all connected users
    if (io) {
      io.emit('post:new', post);
    }

    res.status(201).json(post);
  } catch (err) {
    console.error('[Posts] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get feed (nearby posts) with cursor pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const radius = parseInt(req.query.radius || '500');
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const before = req.query.before || null;

    let posts;
    let conditions = [];
    let params = [req.user.id];

    // If user has location, filter by radius
    const userLoc = await query('SELECT lat, lng FROM user_locations WHERE user_id = ?', [req.user.id]);
    let userIds = [req.user.id];

    if (userLoc.length) {
      const nearby = await getNearbyUsers(userLoc[0].lat, userLoc[0].lng, radius / 1000);
      const nearbyIds = nearby.map(u => u.id);
      userIds = [...new Set([...nearbyIds, req.user.id])];
    }

    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      conditions.push(`p.user_id IN (${placeholders})`);
      params.push(...userIds);
    }

    if (before) {
      conditions.push('p.created_at < ?');
      params.push(before);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    posts = await query(`
      SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count, COALESCE(p.comment_count, 0) as comment_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ?
    `, [...params, limit]);

    // Convert is_liked from count to boolean
    posts = posts.map(p => ({ ...p, is_liked: p.is_liked > 0 }));

    res.json({ posts, hasMore: posts.length >= limit });
  } catch (err) {
    console.error('[Feed] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/unlike post
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = await queryOne('SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    let liked;
    if (existing) {
      await query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
      await query('UPDATE posts SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0) WHERE id = ?', [req.params.id]);
      liked = false;
    } else {
      await query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
      await query('UPDATE posts SET like_count = COALESCE(like_count, 0) + 1 WHERE id = ?', [req.params.id]);
      if (post.user_id !== req.user.id) {
        await createNotification(post.user_id, 'like', 'Thích bài viết', `${req.user.name || 'Ai đó'} đã thích bài viết của bạn`, { postId: req.params.id });
      }
      liked = true;
    }

    const updatedPost = await queryOne(
      `SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count, COALESCE(p.comment_count, 0) as comment_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
      [req.user.id, req.params.id]
    );

    if (io) {
      io.emit('post:liked', {
        postId: req.params.id,
        userId: req.user.id,
        liked,
        post: updatedPost ? { ...updatedPost, is_liked: updatedPost.is_liked > 0 } : null,
      });
    }

    res.json({ liked, post: updatedPost ? { ...updatedPost, is_liked: updatedPost.is_liked > 0 } : null });
  } catch (err) {
    console.error('[Posts] Like error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete post
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!post) return res.status(404).json({ error: 'Post not found or unauthorized' });

    await query('DELETE FROM post_likes WHERE post_id = ?', [req.params.id]);
    await query('DELETE FROM posts WHERE id = ?', [req.params.id]);

    if (io) {
      io.emit('post:deleted', { postId: req.params.id });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error('[Posts] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;