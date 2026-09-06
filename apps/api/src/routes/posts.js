import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { getNearbyUsers, createNotification } from '../utils/helpers.js';

const router = Router();

// Create post
router.post('/', authenticate, async (req, res) => {
  try {
    const { content, lat, lng } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const result = await query(
      'INSERT INTO posts (user_id, content, lat, lng) VALUES (?, ?, ?, ?)',
      [req.user.id, content, lat || null, lng || null]
    );
    const postId = result.insertId.toString('hex');
    const post = await queryOne('SELECT p.*, u.name as user_name, u.avatar as user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?', [postId]);
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get feed (nearby posts)
router.get('/', authenticate, async (req, res) => {
  try {
    const radius = parseInt(req.query.radius || '500');
    const userLoc = await query('SELECT lat, lng FROM user_locations WHERE user_id = ?', [req.user.id]);
    
    let posts;
    if (userLoc.length) {
      const nearby = await getNearbyUsers(userLoc[0].lat, userLoc[0].lng, radius / 1000);
      const userIds = nearby.map(u => u.id).concat(req.user.id);
      posts = await query(`
        SELECT p.*, u.name as user_name, u.avatar as user_avatar,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id IN (${userIds.map(() => '?').join(',')})
        ORDER BY p.created_at DESC LIMIT 50
      `, [req.user.id, ...userIds]);
    } else {
      posts = [];
    }
    res.json({ posts });
  } catch (err) {
    console.error('[Feed] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like post
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = await queryOne('SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (existing) {
      await query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ liked: false });
    } else {
      await query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
      if (post.user_id !== req.user.id) {
        await createNotification(post.user_id, 'like', 'Thích bài viết', `${req.user.name || 'Ai đó'} đã thích bài viết của bạn`, { postId: req.params.id });
      }
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
