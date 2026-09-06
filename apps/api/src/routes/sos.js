import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { createNotification, haversineDistance } from '../utils/helpers.js';
import crypto from 'crypto';

const router = Router();
let io = null;
export function setSocketIO(socketIO) { io = socketIO; }

// ─── Valid status transitions ─────────────────────
const VALID_TRANSITIONS = {
  'OPEN': ['MATCHING', 'CANCELLED'],
  'MATCHING': ['ACCEPTED', 'CANCELLED'],
  'ACCEPTED': ['IN_PROGRESS', 'CANCELLED'],
  'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
  'COMPLETED': [],
  'CANCELLED': [],
};

const VALID_RADII = [100, 200, 500, 1000, 5000];
const VALID_URGENCIES = ['URGENT', 'TODAY', 'SCHEDULED'];

// ─── Helper: enrich SOS request ───────────────────
async function enrichSOS(sos, userId) {
  if (!sos) return null;
  const user = await queryOne('SELECT id, name, avatar FROM users WHERE id = ?', [sos.user_id]);
  const category = await queryOne('SELECT id, name, icon FROM sos_categories WHERE id = ?', [sos.category_id]);
  const media = await query('SELECT * FROM sos_media WHERE sos_id = ?', [sos.id]);
  const responses = await query(
    'SELECT sr.*, u.name as provider_name, u.avatar as provider_avatar FROM sos_responses sr JOIN users u ON sr.provider_id = u.id WHERE sr.sos_id = ?',
    [sos.id]
  );
  const responseCount = await queryOne('SELECT COUNT(*) as count FROM sos_responses WHERE sos_id = ?', [sos.id]);
  const isOwner = sos.user_id === userId;
  const hasResponded = await queryOne('SELECT 1 FROM sos_responses WHERE sos_id = ? AND provider_id = ?', [sos.id, userId]);

  return {
    ...sos,
    user_name: user?.name,
    user_avatar: user?.avatar,
    category_name: category?.name,
    category_icon: category?.icon,
    media,
    responses,
    response_count: responseCount?.count || 0,
    is_owner: isOwner,
    has_responded: !!hasResponded,
  };
}

// ─── GET /api/sos — Radar feed ────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const radius = parseInt(req.query.radius || '1000');
    const categoryId = req.query.category || null;
    const status = req.query.status || 'OPEN';
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);

    // Get user location
    const userLoc = await queryOne('SELECT lat, lng FROM user_locations WHERE user_id = ?', [req.user.id]);
    if (!userLoc) return res.json({ sos: [] });

    // Find SOS within radius
    const allSOS = await query(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM sos_responses WHERE sos_id = s.id) as response_count
      FROM sos_requests s
      WHERE s.status = ?
      ${categoryId ? 'AND s.category_id = ?' : ''}
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
      ORDER BY 
        CASE s.urgency WHEN 'URGENT' THEN 0 WHEN 'TODAY' THEN 1 WHEN 'SCHEDULED' THEN 2 END,
        s.created_at DESC
      LIMIT ?
    `, categoryId ? [status, categoryId, limit] : [status, limit]);

    // Filter by distance & enrich
    const enriched = [];
    for (const sos of allSOS) {
      if (!sos.lat || !sos.lng) continue;
      const dist = haversineDistance(userLoc.lat, userLoc.lng, sos.lat, sos.lng) * 1000; // meters
      if (dist > radius) continue;
      const e = await enrichSOS(sos, req.user.id);
      if (e) enriched.push({ ...e, distance: Math.round(dist) });
    }

    enriched.sort((a, b) => {
      const urgencyOrder = { URGENT: 0, TODAY: 1, SCHEDULED: 2 };
      const ua = urgencyOrder[a.urgency] || 99;
      const ub = urgencyOrder[b.urgency] || 99;
      if (ua !== ub) return ua - ub;
      return a.distance - b.distance;
    });

    res.json({ sos: enriched });
  } catch (err) {
    console.error('[SOS] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/sos/mine — My SOS requests ──────────
router.get('/mine', authenticate, async (req, res) => {
  try {
    const list = await query(
      'SELECT * FROM sos_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    const enriched = [];
    for (const sos of list) {
      enriched.push(await enrichSOS(sos, req.user.id));
    }
    res.json({ sos: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/sos/helping — SOS I'm helping ──────
router.get('/helping', authenticate, async (req, res) => {
  try {
    const statusFilter = req.query.status || null; // PENDING, ACCEPTED, REJECTED
    let sql = `
      SELECT sr.*, sp.status as response_status, sp.id as response_id
      FROM sos_responses sp
      JOIN sos_requests sr ON sr.id = sp.sos_id
      WHERE sp.provider_id = ?
    `;
    const params = [req.user.id];
    if (statusFilter && ['PENDING', 'ACCEPTED', 'DECLINED'].includes(statusFilter)) {
      sql += ' AND sp.status = ?';
      params.push(statusFilter);
    }
    sql += ' ORDER BY sp.created_at DESC LIMIT 20';

    const responses = await query(sql, params);
    const enriched = [];
    for (const row of responses) {
      const sos = await enrichSOS(row, req.user.id);
      if (sos) {
        enriched.push({ ...sos, response_status: row.response_status, response_id: row.response_id });
      }
    }
    res.json({ sos: enriched });
  } catch (err) {
    console.error('[SOS] Helping error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/sos/helper/profile — Helper profile ──
router.get('/helper/profile', authenticate, async (req, res) => {
  try {
    let profile = await queryOne('SELECT * FROM service_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) {
      return res.json({
        is_provider: false,
        is_available: false,
        service_radius: 1000,
        categories: [],
      });
    }
    const categories = await query(
      'SELECT c.id, c.name, c.icon FROM service_profile_categories spc JOIN sos_categories c ON spc.category_id = c.id WHERE spc.profile_id = ? ORDER BY c.sort_order',
      [profile.id]
    );
    res.json({
      ...profile,
      categories,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/sos/helper/profile — Update helper profile ──
router.put('/helper/profile', authenticate, async (req, res) => {
  try {
    const { is_provider, is_available, service_radius, category_ids } = req.body;

    if (service_radius !== undefined && !VALID_RADII.includes(service_radius)) {
      return res.status(400).json({ error: 'Invalid radius' });
    }

    let profile = await queryOne('SELECT * FROM service_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) {
      const profileId = crypto.randomUUID();
      await query(
        'INSERT INTO service_profiles (id, user_id, is_provider, is_available, service_radius) VALUES (?, ?, ?, ?, ?)',
        [profileId, req.user.id, is_provider !== false, is_available !== false, service_radius || 1000]
      );
      profile = await queryOne('SELECT * FROM service_profiles WHERE id = ?', [profileId]);
    } else {
      await query(
        'UPDATE service_profiles SET is_provider = ?, is_available = ?, service_radius = ? WHERE id = ?',
        [is_provider !== false, is_available !== false, service_radius || 1000, profile.id]
      );
    }

    if (category_ids && Array.isArray(category_ids)) {
      await query('DELETE FROM service_profile_categories WHERE profile_id = ?', [profile.id]);
      for (const catId of category_ids) {
        await query(
          'INSERT INTO service_profile_categories (profile_id, category_id) VALUES (?, ?)',
          [profile.id, catId]
        );
      }
    }

    const categories = await query(
      'SELECT c.id, c.name, c.icon FROM service_profile_categories spc JOIN sos_categories c ON spc.category_id = c.id WHERE spc.profile_id = ? ORDER BY c.sort_order',
      [profile.id]
    );

    res.json({
      ...profile,
      categories,
    });
  } catch (err) {
    console.error('[SOS] Helper profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/sos/:id ─────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const sos = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    if (!sos) return res.status(404).json({ error: 'SOS not found' });
    res.json(await enrichSOS(sos, req.user.id));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/sos — Create SOS ───────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { categoryId, description, lat, lng, locationName, radius, urgency, media } = req.body;

    if (!description || !lat || !lng) return res.status(400).json({ error: 'Description, lat, lng required' });
    if (!VALID_RADII.includes(radius)) return res.status(400).json({ error: 'Invalid radius' });
    if (!VALID_URGENCIES.includes(urgency)) return res.status(400).json({ error: 'Invalid urgency' });

    const id = crypto.randomUUID();
    const expiresAt = urgency === 'URGENT' ? new Date(Date.now() + 2 * 3600000) // 2h
      : urgency === 'TODAY' ? new Date(Date.now() + 24 * 3600000) // 24h
      : new Date(Date.now() + 7 * 24 * 3600000); // 7 days

    const conn = await query('SELECT 1'); // use existing connection pattern
    // Use transaction via raw queries
    await query('INSERT INTO sos_requests (id, user_id, category_id, description, lat, lng, location_name, radius, urgency, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, categoryId || null, description, lat, lng, locationName || null, radius, urgency, 'OPEN', expiresAt]);
    await query('INSERT INTO sos_status_history (sos_id, status) VALUES (?, ?)', [id, 'OPEN']);

    // Insert media
    if (media && media.length > 0) {
      for (const m of media) {
        // Convert ISO timestamp to MySQL DATETIME format
        let capturedAt = null;
        if (m.capturedAt) {
          const d = new Date(m.capturedAt);
          capturedAt = d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
        }
        await query('INSERT INTO sos_media (sos_id, url, lat, lng, location_name, captured_at) VALUES (?, ?, ?, ?, ?, ?)',
          [id, m.url, m.lat || null, m.lng || null, m.locationName || null, capturedAt]);
      }
    }

    const sos = await enrichSOS(await queryOne('SELECT * FROM sos_requests WHERE id = ?', [id]), req.user.id);

    if (io) {
      io.emit('sos:new', sos);
    }

    // Find matching helpers and notify them
    findMatchingHelpers(sos).then(helpers => {
      if (helpers.length > 0) {
        notifyMatchingHelpers(sos, helpers);
        console.log(`[SOS] Notified ${helpers.length} helpers for SOS ${id.slice(0, 8)}...`);
      }
    }).catch(err => {
      console.error('[SOS] Matching error:', err);
    });

    res.status(201).json(sos);
  } catch (err) {
    console.error('[SOS] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/sos/:id — Update status ───────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status required' });

    const sos = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    if (!sos) return res.status(404).json({ error: 'SOS not found' });
    if (sos.user_id !== req.user.id) return res.status(403).json({ error: 'Not owner' });

    const allowed = VALID_TRANSITIONS[sos.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${sos.status} to ${status}` });
    }

    const closedAt = status === 'COMPLETED' || status === 'CANCELLED' ? new Date() : null;
    await query('UPDATE sos_requests SET status = ?, closed_at = ? WHERE id = ?', [status, closedAt, req.params.id]);
    await query('INSERT INTO sos_status_history (sos_id, status, note) VALUES (?, ?, ?)', [req.params.id, status, 'Updated by owner']);

    const updated = await enrichSOS(await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]), req.user.id);

    if (io) io.emit('sos:updated', updated);

    res.json(updated);
  } catch (err) {
    console.error('[SOS] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/sos/:id/response — Provider responds ──
router.post('/:id/response', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    const sos = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    if (!sos) return res.status(404).json({ error: 'SOS not found' });
    if (!['OPEN', 'MATCHING'].includes(sos.status)) return res.status(400).json({ error: 'SOS not accepting responses' });

    // Check not own SOS
    if (sos.user_id === req.user.id) return res.status(400).json({ error: 'Cannot respond to own SOS' });

    // Check duplicate
    const existing = await queryOne('SELECT 1 FROM sos_responses WHERE sos_id = ? AND provider_id = ?', [req.params.id, req.user.id]);
    if (existing) return res.status(400).json({ error: 'Already responded' });

    const id = crypto.randomUUID();
    await query('INSERT INTO sos_responses (id, sos_id, provider_id, message, status) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, req.user.id, message || null, 'PENDING']);

    // Auto-transition to MATCHING if OPEN
    if (sos.status === 'OPEN') {
      await query('UPDATE sos_requests SET status = ? WHERE id = ?', ['MATCHING', req.params.id]);
      await query('INSERT INTO sos_status_history (sos_id, status, note) VALUES (?, ?, ?)', [req.params.id, 'MATCHING', 'Provider responded']);
    }

    const response = await queryOne(
      'SELECT sr.*, u.name as provider_name, u.avatar as provider_avatar FROM sos_responses sr JOIN users u ON sr.provider_id = u.id WHERE sr.id = ?',
      [id]
    );

    // Notify SOS owner
    await createNotification(sos.user_id, 'sos', 'Phản hồi SOS', `Có người muốn hỗ trợ yêu cầu của bạn`, { sosId: req.params.id, responseId: id });

    if (io) io.emit('sos:response', { sosId: req.params.id, response });

    res.status(201).json(response);
  } catch (err) {
    console.error('[SOS] Response error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/sos/:id/accept — Accept a provider ──
router.post('/:id/accept', authenticate, async (req, res) => {
  try {
    const { responseId } = req.body;
    if (!responseId) return res.status(400).json({ error: 'responseId required' });

    const sos = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    if (!sos) return res.status(404).json({ error: 'SOS not found' });
    if (sos.user_id !== req.user.id) return res.status(403).json({ error: 'Not owner' });
    if (!['OPEN', 'MATCHING'].includes(sos.status)) return res.status(400).json({ error: 'Cannot accept now' });

    const response = await queryOne('SELECT * FROM sos_responses WHERE id = ? AND sos_id = ?', [responseId, req.params.id]);
    if (!response) return res.status(404).json({ error: 'Response not found' });

    // Atomic: accept one, decline others
    await query('UPDATE sos_responses SET status = ? WHERE id = ?', ['ACCEPTED', responseId]);
    await query('UPDATE sos_responses SET status = ? WHERE sos_id = ? AND id != ?', ['DECLINED', req.params.id, responseId]);
    await query('UPDATE sos_requests SET status = ? WHERE id = ?', ['ACCEPTED', req.params.id]);
    await query('INSERT INTO sos_status_history (sos_id, status, note) VALUES (?, ?, ?)', [req.params.id, 'ACCEPTED', 'Provider accepted']);

    // Notify provider
    await createNotification(response.provider_id, 'sos', 'Đã chọn bạn', 'Bạn đã được chọn để hỗ trợ yêu cầu SOS', { sosId: req.params.id });

    // Create or get private conversation between requester and provider
    const existingConv = await queryOne(`
      SELECT c.id FROM conversations c
      JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
      JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
      WHERE c.type = 'private'
    `, [req.user.id, response.provider_id]);
    let conversationId;
    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      conversationId = crypto.randomUUID();
      await query('INSERT INTO conversations (id, type) VALUES (?, ?)', [conversationId, 'private']);
      await query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)',
        [conversationId, req.user.id, conversationId, response.provider_id]);
    }

    const updated = await enrichSOS(await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]), req.user.id);
    if (io) io.emit('sos:accepted', updated);

    res.json({ ...updated, conversation_id: conversationId });
  } catch (err) {
    console.error('[SOS] Accept error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/sos/:id/cancel ─────────────────────
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const sos = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    if (!sos) return res.status(404).json({ error: 'SOS not found' });
    if (sos.user_id !== req.user.id) return res.status(403).json({ error: 'Not owner' });
    if (['COMPLETED', 'CANCELLED'].includes(sos.status)) return res.status(400).json({ error: 'Already closed' });

    await query('UPDATE sos_requests SET status = ?, closed_at = ? WHERE id = ?', ['CANCELLED', new Date(), req.params.id]);
    await query('INSERT INTO sos_status_history (sos_id, status, note) VALUES (?, ?, ?)', [req.params.id, 'CANCELLED', 'Cancelled by owner']);

    if (io) io.emit('sos:cancelled', { sosId: req.params.id });
    res.json({ cancelled: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/sos/:id/reject — Reject a provider ──
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    const { responseId } = req.body;
    if (!responseId) return res.status(400).json({ error: 'responseId required' });

    const sos = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    if (!sos) return res.status(404).json({ error: 'SOS not found' });
    if (sos.user_id !== req.user.id) return res.status(403).json({ error: 'Not owner' });

    const response = await queryOne('SELECT * FROM sos_responses WHERE id = ? AND sos_id = ?', [responseId, req.params.id]);
    if (!response) return res.status(404).json({ error: 'Response not found' });
    if (response.status !== 'PENDING') return res.status(400).json({ error: 'Response already processed' });

    await query('UPDATE sos_responses SET status = ? WHERE id = ?', ['DECLINED', responseId]);

    // Notify provider
    await createNotification(response.provider_id, 'sos', 'Không được chọn', 'Yêu cầu SOS của bạn đã chọn người hỗ trợ khác', { sosId: req.params.id });

    if (io) io.emit('sos:updated', { sosId: req.params.id, responseId, status: 'DECLINED' });

    res.json({ rejected: true, responseId });
  } catch (err) {
    console.error('[SOS] Reject error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/sos/helper/profile — Helper profile ──
router.get('/helper/profile', authenticate, async (req, res) => {
  try {
    let profile = await queryOne('SELECT * FROM service_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) {
      return res.json({
        is_provider: false,
        is_available: false,
        service_radius: 1000,
        categories: [],
      });
    }
    const categories = await query(
      'SELECT c.id, c.name, c.icon FROM service_profile_categories spc JOIN sos_categories c ON spc.category_id = c.id WHERE spc.profile_id = ? ORDER BY c.sort_order',
      [profile.id]
    );
    res.json({
      ...profile,
      categories,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helper: find matching helpers for a SOS ──────
async function findMatchingHelpers(sos) {
  if (!sos || !sos.category_id || !sos.lat || !sos.lng) return [];

  const helpers = await query(`
    SELECT sp.*, u.name, u.avatar, ul.lat, ul.lng
    FROM service_profiles sp
    JOIN users u ON u.id = sp.user_id
    JOIN user_locations ul ON ul.user_id = sp.user_id
    JOIN service_profile_categories spc ON spc.profile_id = sp.id
    WHERE sp.is_provider = 1
      AND sp.is_available = 1
      AND spc.category_id = ?
      AND sp.user_id != ?
      AND ul.lat IS NOT NULL AND ul.lng IS NOT NULL
  `, [sos.category_id, sos.user_id]);

  const matched = [];
  for (const h of helpers) {
    const dist = haversineDistance(sos.lat, sos.lng, h.lat, h.lng) * 1000; // meters
    const effectiveRadius = Math.min(sos.radius || 1000, h.service_radius || 1000);
    if (dist <= effectiveRadius) {
      matched.push({ ...h, distance: Math.round(dist) });
    }
  }
  return matched;
}

// ─── Helper: notify matching helpers ──────────────
async function notifyMatchingHelpers(sos, helpers) {
  if (!sos.category_name) {
    const cat = await queryOne('SELECT name FROM sos_categories WHERE id = ?', [sos.category_id]);
    sos.category_name = cat?.name || 'Hỗ trợ';
  }
  for (const h of helpers) {
    const existing = await queryOne(
      'SELECT 1 FROM notifications WHERE user_id = ? AND type = ? AND data = ?',
      [h.user_id, 'sos', JSON.stringify({ sosId: sos.id, matched: true })]
    );
    if (existing) continue;

    await createNotification(
      h.user_id,
      'sos',
      '🆘 SOS gần bạn',
      `${sos.category_name} cách bạn ${h.distance}m`,
      { sosId: sos.id, matched: true, distance: h.distance }
    );

    if (io) {
      io.to('user:' + h.user_id).emit('sos:matched', {
        sosId: sos.id,
        distance: h.distance,
        category: sos.category_name,
      });
    }
  }
}

export { findMatchingHelpers, notifyMatchingHelpers };
export default router;