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

// Helper: calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10; // km, 1 decimal
}
async function enrichPost(post, userId) {
  if (!post) return null;
  const isLiked = await queryOne('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?', [post.id, userId]);
  const isSaved = await queryOne('SELECT 1 FROM post_saves WHERE post_id = ? AND user_id = ?', [post.id, userId]);
  const user = await queryOne('SELECT name, avatar FROM users WHERE id = ?', [post.user_id]);
  return {
    ...post,
    user_name: user?.name || post.user_name,
    user_avatar: user?.avatar || post.user_avatar,
    like_count: post.like_count || 0,
    comment_count: post.comment_count || 0,
    share_count: post.share_count || 0,
    save_count: post.save_count || 0,
    is_liked: !!isLiked,
    is_saved: !!isSaved,
  };
}

// ─── Create Post ────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { content, imageUrl, media, lat, lng, locationName } = req.body;
    if (!content && !imageUrl && (!media || media.length === 0)) return res.status(400).json({ error: 'Content or image required' });

    const postId = crypto.randomUUID();
    const postType = media || imageUrl ? 'image' : 'text';
    const mediaJson = media ? JSON.stringify(media) : null;
    const firstImage = media?.[0]?.url || imageUrl || null;
    await query(
      'INSERT INTO posts (id, user_id, content, image_url, media, type, lat, lng, location_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [postId, req.user.id, content || '', firstImage, mediaJson, postType, lat || null, lng || null, locationName || null]
    );

    const post = await enrichPost({
      id: postId, user_id: req.user.id, content: content || '',
      image_url: firstImage, media: mediaJson, type: postType,
      lat: lat || null, lng: lng || null, location_name: locationName || null,
      like_count: 0, comment_count: 0, share_count: 0, save_count: 0, created_at: new Date()
    }, req.user.id);

    // Parse media JSON string to array for consistent response format
    if (post && post.media && typeof post.media === 'string') {
      try { post.media = JSON.parse(post.media); } catch {}
    }

    if (io) {
      io.emit('post:new', post);
    }

    res.status(201).json(post);
  } catch (err) {
    console.error('[Posts] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Get Feed (with cursor pagination) ──────────
router.get('/', authenticate, async (req, res) => {
  try {
    const radius = parseInt(req.query.radius || '500');
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const before = req.query.before || null;
    // Filter by specific user (used by UserProfileScreen)
    const targetUserId = req.query.userId || null;
    // Filter: saved / liked (used by profile tabs)
    const filter = req.query.filter || null;

    let conditions = [];
    let params = [req.user.id, req.user.id];

    // If viewing a specific user's profile → only their posts
    if (targetUserId) {
      conditions.push('p.user_id = ?');
      params.push(targetUserId);
    } else {
      // Otherwise normal feed: filter by radius
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
    }

    // Saved filter — dùng targetUserId nếu có (xem profile người khác)
    if (filter === 'saved') {
      const filterUserId = targetUserId || req.user.id;
      conditions.push('EXISTS (SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.user_id = ?)');
      params.push(filterUserId);
    }
    // Liked filter
    if (filter === 'liked') {
      const filterUserId = targetUserId || req.user.id;
      conditions.push('EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?)');
      params.push(filterUserId);
    }

    if (before) {
      conditions.push('p.created_at < ?');
      params.push(before);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const posts = await query(`
      SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count,
        COALESCE(p.comment_count, 0) as comment_count,
        COALESCE(p.share_count, 0) as share_count,
        COALESCE(p.save_count, 0) as save_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM post_saves WHERE post_id = p.id AND user_id = ?) as is_saved
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ?
    `, [...params, limit]);

    const enriched = posts.map(p => ({
      ...p,
      is_liked: p.is_liked > 0,
      is_saved: p.is_saved > 0,
      distance: null,
    }));

    res.json({ posts: enriched, hasMore: posts.length >= limit });
  } catch (err) {
    console.error('[Feed] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Get Single Post ────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const post = await queryOne(`
      SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count,
        COALESCE(p.comment_count, 0) as comment_count,
        COALESCE(p.share_count, 0) as share_count,
        COALESCE(p.save_count, 0) as save_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM post_saves WHERE post_id = p.id AND user_id = ?) as is_saved
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
    `, [req.user.id, req.user.id, req.params.id]);

    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.is_liked = post.is_liked > 0;
    post.is_saved = post.is_saved > 0;

    res.json(post);
  } catch (err) {
    console.error('[Posts] Get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Update Post ────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!post) return res.status(404).json({ error: 'Post not found or unauthorized' });

    const { content, imageUrl } = req.body;
    if (content !== undefined) await query('UPDATE posts SET content = ? WHERE id = ?', [content, req.params.id]);
    if (imageUrl !== undefined) await query('UPDATE posts SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);

    const updated = await queryOne(
      `SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count, COALESCE(p.comment_count, 0) as comment_count,
        COALESCE(p.share_count, 0) as share_count, COALESCE(p.save_count, 0) as save_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM post_saves WHERE post_id = p.id AND user_id = ?) as is_saved
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
      [req.user.id, req.user.id, req.params.id]
    );
    if (updated) { updated.is_liked = updated.is_liked > 0; updated.is_saved = updated.is_saved > 0; }

    if (io) io.emit('post:updated', updated);

    res.json(updated);
  } catch (err) {
    console.error('[Posts] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Delete Post ────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!post) return res.status(404).json({ error: 'Post not found or unauthorized' });

    await query('DELETE FROM post_likes WHERE post_id = ?', [req.params.id]);
    await query('DELETE FROM post_comments WHERE post_id = ?', [req.params.id]);
    await query('DELETE FROM post_saves WHERE post_id = ?', [req.params.id]);
    await query('DELETE FROM post_shares WHERE post_id = ?', [req.params.id]);
    await query('DELETE FROM posts WHERE id = ?', [req.params.id]);

    if (io) io.emit('post:deleted', { postId: req.params.id });

    res.json({ deleted: true });
  } catch (err) {
    console.error('[Posts] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Like / Unlike ──────────────────────────────
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
        await createNotification(post.user_id, 'like', 'Thích bài viết', `${req.user.name || 'Ai đó'} đã thích bài viết của bạn`, { postId: req.params.id, postContent: post.content?.substring(0, 200), postMedia: post.media }, req.user.id);
      }
      liked = true;
    }

    const updatedPost = await queryOne(
      `SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count, COALESCE(p.comment_count, 0) as comment_count,
        COALESCE(p.share_count, 0) as share_count, COALESCE(p.save_count, 0) as save_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM post_saves WHERE post_id = p.id AND user_id = ?) as is_saved
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
      [req.user.id, req.user.id, req.params.id]
    );
    if (updatedPost) { updatedPost.is_liked = updatedPost.is_liked > 0; updatedPost.is_saved = updatedPost.is_saved > 0; }

    if (io) {
      io.emit(liked ? 'post:liked' : 'post:unliked', {
        postId: req.params.id,
        userId: req.user.id,
        liked,
        post: updatedPost,
      });
    }

    res.json({ liked, post: updatedPost });
  } catch (err) {
    console.error('[Posts] Like error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Comment ────────────────────────────────────
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const post = await queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const commentId = crypto.randomUUID();
    await query(
      'INSERT INTO post_comments (id, post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?, ?)',
      [commentId, req.params.id, req.user.id, content, parentId || null]
    );
    await query('UPDATE posts SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = ?', [req.params.id]);

    const comment = await queryOne(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar FROM post_comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
      [commentId]
    );

    if (post.user_id !== req.user.id) {
      await createNotification(post.user_id, 'comment', 'Bình luận', `${req.user.name || 'Ai đó'} đã bình luận bài viết của bạn`, { postId: req.params.id, commentId, commentContent: content, postContent: post.content?.substring(0, 200), postMedia: post.media }, req.user.id);
    }

    // Update post counts
    const updatedPost = await queryOne(
      `SELECT p.*, COALESCE(p.comment_count, 0) as comment_count, COALESCE(p.like_count, 0) as like_count,
        COALESCE(p.share_count, 0) as share_count, COALESCE(p.save_count, 0) as save_count
      FROM posts p WHERE p.id = ?`, [req.params.id]
    );

    if (io) {
      io.emit('comment:new', { ...comment, post: { ...updatedPost, id: req.params.id } });
    }

    res.status(201).json(comment);
  } catch (err) {
    console.error('[Posts] Comment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Get Comments (with like info) ───────────────
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const comments = await query(`
      SELECT c.*, u.name as user_name, u.avatar as user_avatar,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked
      FROM post_comments c JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [req.user.id, req.params.id]);

    // Convert is_liked to boolean
    const enriched = comments.map(c => ({ ...c, is_liked: c.is_liked > 0 }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Delete Comment ─────────────────────────────
router.delete('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const comment = await queryOne('SELECT * FROM post_comments WHERE id = ? AND user_id = ?', [req.params.commentId, req.user.id]);
    if (!comment) return res.status(404).json({ error: 'Comment not found or unauthorized' });

    const postId = comment.post_id;
    await query('DELETE FROM post_comments WHERE id = ?', [req.params.commentId]);
    await query('UPDATE posts SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0) WHERE id = ?', [postId]);

    if (io) io.emit('comment:deleted', { commentId: req.params.commentId, postId });

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Like / Unlike Comment ──────────────────────
router.post('/comments/:commentId/like', authenticate, async (req, res) => {
  try {
    const comment = await queryOne('SELECT * FROM post_comments WHERE id = ?', [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const existing = await queryOne('SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?', [req.params.commentId, req.user.id]);
    let liked;
    if (existing) {
      await query('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [req.params.commentId, req.user.id]);
      liked = false;
    } else {
      await query('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [req.params.commentId, req.user.id]);
      liked = true;
    }

    const likeCountRes = await queryOne('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?', [req.params.commentId]);
    const likeCount = likeCountRes?.count || 0;

    if (io) {
      io.emit('comment:like', { commentId: req.params.commentId, userId: req.user.id, liked, like_count: likeCount });
    }

    res.json({ liked, like_count: likeCount });
  } catch (err) {
    console.error('[Comments] Like error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Share ──────────────────────────────────────
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await query('INSERT INTO post_shares (post_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
    await query('UPDATE posts SET share_count = COALESCE(share_count, 0) + 1 WHERE id = ?', [req.params.id]);

    if (io) io.emit('post:shared', { postId: req.params.id, userId: req.user.id });

    res.json({ shared: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Save / Unsave post ──────────────────────────
router.post('/:id/save', authenticate, async (req, res) => {
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = await queryOne('SELECT * FROM post_saves WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    let saved;
    if (existing) {
      await query('DELETE FROM post_saves WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
      await query('UPDATE posts SET save_count = GREATEST(COALESCE(save_count, 0) - 1, 0) WHERE id = ?', [req.params.id]);
      saved = false;
    } else {
      const saveId = crypto.randomUUID();
      await query('INSERT INTO post_saves (id, post_id, user_id) VALUES (?, ?, ?)', [saveId, req.params.id, req.user.id]);
      await query('UPDATE posts SET save_count = COALESCE(save_count, 0) + 1 WHERE id = ?', [req.params.id]);
      saved = true;
    }

    const updatedPost = await queryOne(
      `SELECT p.*, u.name as user_name, u.avatar as user_avatar,
        COALESCE(p.like_count, 0) as like_count, COALESCE(p.comment_count, 0) as comment_count,
        COALESCE(p.share_count, 0) as share_count, COALESCE(p.save_count, 0) as save_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM post_saves WHERE post_id = p.id AND user_id = ?) as is_saved
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
      [req.user.id, req.user.id, req.params.id]
    );
    if (updatedPost) {
      updatedPost.is_liked = updatedPost.is_liked > 0;
      updatedPost.is_saved = updatedPost.is_saved > 0;
    }

    res.json({ saved, save_count: updatedPost?.save_count || 0 });
  } catch (err) {
    console.error('[Save] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;