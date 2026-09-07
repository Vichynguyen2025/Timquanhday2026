import { Router } from 'express';
import { query, queryOne } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
let io = null;
export function setSocketIO(socketIO) { io = socketIO; }

// ─── Admin auth middleware ───────────────────────
async function adminAuth(req, res, next) {
  try {
    const admin = await queryOne(`
      SELECT au.*, ar.name as role_name, ar.permissions
      FROM admin_users au
      JOIN admin_roles ar ON ar.id = au.role_id
      WHERE au.user_id = ? AND au.is_active = 1
    `, [req.user.id]);
    if (!admin) return res.status(403).json({ error: 'Forbidden: not an admin' });
    req.admin = admin;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    const perms = Array.isArray(req.admin?.permissions) ? req.admin.permissions : (JSON.parse(req.admin?.permissions || '[]'));
    if (perms.includes('*') || permissions.some(p => perms.includes(p))) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

async function auditLog(adminUserId, action, entityType, entityId, beforeState, afterState, req) {
  try {
    await query(
      'INSERT INTO admin_audit_logs (id, admin_user_id, action, entity_type, entity_id, before_state, after_state, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), adminUserId, action, entityType, entityId,
       beforeState ? JSON.stringify(beforeState) : null,
       afterState ? JSON.stringify(afterState) : null,
       req?.ip || null, req?.headers?.['user-agent'] || null]
    );
  } catch (err) {
    console.error('[Admin] Audit log error:', err);
  }
}

// ─── DASHBOARD ──────────────────────────────────
router.get('/dashboard', authenticate, adminAuth, requirePermission('users:read','sos:read','*'), async (req, res) => {
  try {
    const [userCount] = await query('SELECT COUNT(*) as c FROM users');
    const [onlineCount] = await query('SELECT COUNT(*) as c FROM users WHERE is_online = 1');
    const [todayReg] = await query('SELECT COUNT(*) as c FROM users WHERE DATE(created_at) = CURDATE()');
    const [lockedCount] = await query('SELECT COUNT(*) as c FROM users WHERE is_locked = 1');
    const [reportedCount] = await query('SELECT COUNT(*) as c FROM reports');
    const [pendingReports] = await query("SELECT COUNT(*) as c FROM reports WHERE status = 'PENDING'");

    const [msgCount] = await query('SELECT COUNT(*) as c FROM messages');
    const [todayMsg] = await query('SELECT COUNT(*) as c FROM messages WHERE DATE(created_at) = CURDATE()');
    const [convCount] = await query('SELECT COUNT(*) as c FROM conversations');

    const [notifCount] = await query('SELECT COUNT(*) as c FROM notifications');
    const [todayNotif] = await query('SELECT COUNT(*) as c FROM notifications WHERE DATE(created_at) = CURDATE()');

    const [activeSos] = await query("SELECT COUNT(*) as c FROM sos_requests WHERE status NOT IN ('COMPLETED','CANCELLED')");
    const [resolvedSos] = await query("SELECT COUNT(*) as c FROM sos_requests WHERE status IN ('COMPLETED','CANCELLED')");
    const [beingHelped] = await query("SELECT COUNT(*) as c FROM sos_responses WHERE status = 'ACCEPTED'");
    const [todaySos] = await query('SELECT COUNT(*) as c FROM sos_requests WHERE DATE(created_at) = CURDATE()');

    const [postCount] = await query('SELECT COUNT(*) as c FROM posts');

    res.json({
      totalUsers: userCount?.c || 0,
      onlineUsers: onlineCount?.c || 0,
      newToday: todayReg?.c || 0,
      lockedUsers: lockedCount?.c || 0,
      totalReports: reportedCount?.c || 0,
      pendingReports: pendingReports?.c || 0,
      totalMessages: msgCount?.c || 0,
      todayMessages: todayMsg?.c || 0,
      activeConversations: convCount?.c || 0,
      totalNotifications: notifCount?.c || 0,
      todayNotifications: todayNotif?.c || 0,
      activeSos: activeSos?.c || 0,
      resolvedSos: resolvedSos?.c || 0,
      beingHelped: beingHelped?.c || 0,
      todaySos: todaySos?.c || 0,
      totalPosts: postCount?.c || 0,
    });
  } catch (err) {
    console.error('[Admin] Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── USERS ──────────────────────────────────────
router.get('/users', authenticate, adminAuth, requirePermission('users:read','*'), async (req, res) => {
  try {
    const { search, filter, page = 1, limit = 20, sort = 'created_at', order = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (filter === 'online') conditions.push('u.is_online = 1');
    else if (filter === 'offline') conditions.push('u.is_online = 0');
    else if (filter === 'locked') conditions.push('u.is_locked = 1');
    else if (filter === 'reported') conditions.push('EXISTS (SELECT 1 FROM reports r WHERE r.reported_user_id = u.id)');
    else if (filter === 'today') conditions.push('DATE(u.created_at) = CURDATE()');

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countResult] = await query(`SELECT COUNT(*) as c FROM users u ${where}`, params);
    const total = countResult?.c || 0;

    const allowedSorts = ['created_at', 'name', 'email', 'last_seen', 'is_online'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const users = await query(`
      SELECT u.id, u.name, u.email, u.phone, u.avatar, u.bio, u.location_enabled, u.is_online, u.is_locked, u.last_seen, u.created_at,
        (SELECT COUNT(*) FROM sos_requests WHERE user_id = u.id) as sos_count,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) as msg_count,
        (SELECT sp.is_provider FROM service_profiles sp WHERE sp.user_id = u.id) as is_provider,
        (SELECT COUNT(*) FROM reports WHERE reported_user_id = u.id) as report_count
      FROM users u ${where}
      ORDER BY u.${sortCol} ${sortOrder}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users/:id', authenticate, adminAuth, requirePermission('users:read','*'), async (req, res) => {
  try {
    const user = await queryOne('SELECT id, name, email, phone, avatar, bio, location_enabled, is_online, is_locked, last_seen, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const sosCount = await query("SELECT COUNT(*) as c FROM sos_requests WHERE user_id = ?", [req.params.id]);
    const helpingCount = await query("SELECT COUNT(*) as c FROM sos_responses WHERE provider_id = ?", [req.params.id]);
    const msgCount = await query('SELECT COUNT(*) as c FROM messages WHERE sender_id = ?', [req.params.id]);
    const postCount = await query('SELECT COUNT(*) as c FROM posts WHERE user_id = ?', [req.params.id]);
    const blocked = await query('SELECT ub.*, u.name as blocked_name FROM user_blocks ub JOIN users u ON u.id = ub.blocked_id WHERE ub.blocker_id = ?', [req.params.id]);
    const reports = await query('SELECT * FROM reports WHERE reported_user_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
    const reportsMade = await query('SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
    res.json({
      ...user,
      stats: { posts: postCount[0]?.c || 0, messages: msgCount[0]?.c || 0, sos: sosCount[0]?.c || 0, helping: helpingCount[0]?.c || 0 },
      blocked, reports, reportsMade
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id', authenticate, adminAuth, requirePermission('users:write','*'), async (req, res) => {
  try {
    const allowedFields = ['name', 'bio', 'avatar', 'location_enabled'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });
    const before = await queryOne('SELECT id, name, bio, avatar, location_enabled FROM users WHERE id = ?', [req.params.id]);
    if (!before) return res.status(404).json({ error: 'User not found' });
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await query(`UPDATE users SET ${setClauses} WHERE id = ?`, [...Object.values(updates), req.params.id]);
    const after = await queryOne('SELECT id, name, email, phone, avatar, bio, location_enabled FROM users WHERE id = ?', [req.params.id]);
    await auditLog(req.admin.id, 'ADMIN_UPDATE_USER', 'user', req.params.id, before, after, req);
    if (io) io.to(`user:${req.params.id}`).emit('user:profile_updated', { userId: req.params.id, changes: after });
    res.json(after);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/lock', authenticate, adminAuth, requirePermission('users:write','*'), async (req, res) => {
  try {
    const user = await queryOne('SELECT id, name, is_locked FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_locked) return res.status(409).json({ error: 'User already locked' });
    await query('UPDATE users SET is_locked = 1 WHERE id = ?', [req.params.id]);
    await auditLog(req.admin.id, 'USER_LOCK', 'user', req.params.id, { is_locked: 0 }, { is_locked: 1 }, req);
    if (io) io.to(`user:${req.params.id}`).emit('user:profile_updated', { userId: req.params.id, changes: { is_locked: 1 } });
    res.json({ locked: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/unlock', authenticate, adminAuth, requirePermission('users:write','*'), async (req, res) => {
  try {
    const user = await queryOne('SELECT id, is_locked FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.is_locked) return res.status(409).json({ error: 'User not locked' });
    await query('UPDATE users SET is_locked = 0 WHERE id = ?', [req.params.id]);
    await auditLog(req.admin.id, 'USER_UNLOCK', 'user', req.params.id, { is_locked: 1 }, { is_locked: 0 }, req);
    if (io) io.to(`user:${req.params.id}`).emit('user:profile_updated', { userId: req.params.id, changes: { is_locked: 0 } });
    res.json({ locked: false });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── SOS ────────────────────────────────────────
router.get('/sos', authenticate, adminAuth, requirePermission('sos:read','*'), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (status) {
      if (status === 'ACTIVE') conditions.push("sr.status NOT IN ('COMPLETED','CANCELLED')");
      else conditions.push('sr.status = ?');
      if (status !== 'ACTIVE') params.push(status);
    }
    if (search) {
      conditions.push('(u.name LIKE ? OR sr.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [countResult] = await query(`SELECT COUNT(*) as c FROM sos_requests sr JOIN users u ON u.id = sr.user_id ${where}`, params);
    const list = await query(`
      SELECT sr.*, u.name as user_name, u.avatar as user_avatar, u.phone as user_phone,
        sc.name as category_name,
        (SELECT COUNT(*) FROM sos_responses WHERE sos_id = sr.id) as response_count,
        (SELECT COUNT(*) FROM sos_media WHERE sos_id = sr.id) as media_count
      FROM sos_requests sr
      JOIN users u ON u.id = sr.user_id
      LEFT JOIN sos_categories sc ON sc.id = sr.category_id
      ${where}
      ORDER BY sr.created_at DESC LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    res.json({ sos: list, total: countResult?.c || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sos/:id', authenticate, adminAuth, requirePermission('sos:read','*'), async (req, res) => {
  try {
    const sos = await queryOne(`
      SELECT sr.*, u.name as user_name, u.avatar as user_avatar, u.phone as user_phone, u.email as user_email,
        sc.name as category_name, sc.icon as category_icon
      FROM sos_requests sr
      JOIN users u ON u.id = sr.user_id
      LEFT JOIN sos_categories sc ON sc.id = sr.category_id
      WHERE sr.id = ?
    `, [req.params.id]);
    if (!sos) return res.status(404).json({ error: 'SOS not found' });
    const responses = await query(`
      SELECT sr.*, u.name as provider_name, u.avatar as provider_avatar, u.phone as provider_phone
      FROM sos_responses sr
      JOIN users u ON u.id = sr.provider_id
      WHERE sr.sos_id = ? ORDER BY sr.created_at DESC
    `, [req.params.id]);
    const media = await query('SELECT * FROM sos_media WHERE sos_id = ?', [req.params.id]);
    const history = await query('SELECT * FROM sos_status_history WHERE sos_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json({ ...sos, responses, media, history });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/sos/:id', authenticate, adminAuth, requirePermission('sos:write','*'), async (req, res) => {
  try {
    const allowedFields = ['status', 'description', 'radius', 'urgency'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' });
    const before = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    if (!before) return res.status(404).json({ error: 'SOS not found' });
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    if (updates.status && ['COMPLETED','CANCELLED'].includes(updates.status)) {
      await query(`UPDATE sos_requests SET ${setClauses}, updated_at = NOW(), closed_at = NOW() WHERE id = ?`, [...Object.values(updates), req.params.id]);
    } else {
      await query(`UPDATE sos_requests SET ${setClauses}, updated_at = NOW() WHERE id = ?`, [...Object.values(updates), req.params.id]);
    }
    if (updates.status) {
      await query('INSERT INTO sos_status_history (id, sos_id, status, note) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), req.params.id, updates.status, 'Admin update']);
    }
    const after = await queryOne('SELECT * FROM sos_requests WHERE id = ?', [req.params.id]);
    await auditLog(req.admin.id, 'ADMIN_UPDATE_SOS', 'sos', req.params.id, before, after, req);
    if (io) io.emit('sos:updated', after);
    res.json(after);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── MESSAGES ──────────────────────────────────
router.get('/messages', authenticate, adminAuth, requirePermission('messages:read','*'), async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE m.content LIKE ?';
      params.push(`%${search}%`);
    }
    const [countResult] = await query(`SELECT COUNT(*) as c FROM messages m ${where}`, params);
    const messages = await query(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      ${where}
      ORDER BY m.created_at DESC LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    res.json({ messages, total: countResult?.c || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── NOTIFICATIONS ──────────────────────────────
router.get('/notifications', authenticate, adminAuth, requirePermission('notifications:read','*'), async (req, res) => {
  try {
    const { search, type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (search) conditions.push('(n.title LIKE ? OR n.body LIKE ?)');
    if (search) params.push(`%${search}%`, `%${search}%`);
    if (type) conditions.push('n.type = ?');
    if (type) params.push(type);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [countResult] = await query(`SELECT COUNT(*) as c FROM notifications n ${where}`, params);
    const notifs = await query(`
      SELECT n.*, u.name as user_name
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    res.json({ notifications: notifs, total: countResult?.c || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notifications/send', authenticate, adminAuth, requirePermission('notifications:write','*'), async (req, res) => {
  try {
    const { userIds, allUsers, type, title, body, data } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    if (!allUsers && (!userIds || !Array.isArray(userIds) || userIds.length === 0)) {
      return res.status(400).json({ error: 'userIds array or allUsers flag required' });
    }
    let targets = [];
    if (allUsers) {
      const rows = await query('SELECT id FROM users');
      targets = rows.map(r => r.id);
    } else {
      targets = userIds;
    }
    const notifIds = [];
    for (const uid of targets) {
      const nid = crypto.randomUUID();
      await query('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)',
        [nid, uid, type || 'system', title, body || null, data ? JSON.stringify(data) : null]);
      notifIds.push(nid);
      if (io) io.to(`user:${uid}`).emit('notification:new', { id: nid, type, title, body, is_read: 0 });
    }
    await auditLog(req.admin.id, 'NOTIFICATION_SEND', 'notification', 'bulk', { userIds: targets.length }, { count: targets.length }, req);
    res.json({ sent: targets.length, notificationIds: notifIds });
  } catch (err) {
    console.error('[Admin] Send notification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── REPORTS ──────────────────────────────────
router.get('/reports', authenticate, adminAuth, requirePermission('reports:read','*'), async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (status) conditions.push('r.status = ?'), params.push(status);
    if (type) conditions.push('r.type = ?'), params.push(type);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [countResult] = await query(`SELECT COUNT(*) as c FROM reports r ${where}`, params);
    const reports = await query(`
      SELECT r.*, rep.name as reporter_name, rep.avatar as reporter_avatar,
        repu.name as reported_name, repu.avatar as reported_avatar,
        m.name as moderator_name
      FROM reports r
      JOIN users rep ON rep.id = r.reporter_id
      JOIN users repu ON repu.id = r.reported_user_id
      LEFT JOIN users m ON m.id = r.moderator_id
      ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    res.json({ reports, total: countResult?.c || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/reports/:id', authenticate, adminAuth, requirePermission('reports:write','*'), async (req, res) => {
  try {
    const { status, resolutionNote } = req.body;
    const report = await queryOne('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const before = { ...report };
    const updates = {};
    if (status) updates.status = status;
    if (resolutionNote !== undefined) updates.resolution_note = resolutionNote;
    updates.moderator_id = req.user.id;
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await query(`UPDATE reports SET ${setClauses} WHERE id = ?`, [...Object.values(updates), req.params.id]);
    const after = await queryOne('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    await auditLog(req.admin.id, 'REPORT_UPDATE', 'report', req.params.id, before, after, req);
    res.json(after);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── ADMINS ─────────────────────────────────────
router.get('/admins', authenticate, adminAuth, requirePermission('admins:read','*'), async (req, res) => {
  try {
    const admins = await query(`
      SELECT au.*, ar.name as role_name, ar.permissions as role_permissions,
        u.name as user_name, u.email, u.avatar
      FROM admin_users au
      JOIN admin_roles ar ON ar.id = au.role_id
      JOIN users u ON u.id = au.user_id
      ORDER BY au.created_at DESC
    `);
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admins', authenticate, adminAuth, requirePermission('admins:write','*'), async (req, res) => {
  try {
    const { userId, roleId } = req.body;
    if (!userId || !roleId) return res.status(400).json({ error: 'userId and roleId required' });
    const existing = await queryOne('SELECT id FROM admin_users WHERE user_id = ?', [userId]);
    if (existing) return res.status(409).json({ error: 'User is already an admin' });
    const role = await queryOne('SELECT id FROM admin_roles WHERE id = ?', [roleId]);
    if (!role) return res.status(400).json({ error: 'Invalid role' });
    const id = crypto.randomUUID();
    await query('INSERT INTO admin_users (id, user_id, role_id, created_by) VALUES (?, ?, ?, ?)', [id, userId, roleId, req.admin.id]);
    await auditLog(req.admin.id, 'ADMIN_CREATE', 'admin_user', id, null, { userId, roleId }, req);
    res.status(201).json({ id, userId, roleId });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/admins/:id', authenticate, adminAuth, requirePermission('admins:write','*'), async (req, res) => {
  try {
    const { roleId, isActive } = req.body;
    const admin = await queryOne('SELECT * FROM admin_users WHERE id = ?', [req.params.id]);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    const before = { ...admin };
    if (roleId) {
      const role = await queryOne('SELECT id FROM admin_roles WHERE id = ?', [roleId]);
      if (!role) return res.status(400).json({ error: 'Invalid role' });
      await query('UPDATE admin_users SET role_id = ? WHERE id = ?', [roleId, req.params.id]);
    }
    if (isActive !== undefined) {
      await query('UPDATE admin_users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, req.params.id]);
    }
    const after = await queryOne('SELECT * FROM admin_users WHERE id = ?', [req.params.id]);
    await auditLog(req.admin.id, roleId ? 'ROLE_CHANGE' : 'ADMIN_UPDATE', 'admin_user', req.params.id, before, after, req);
    res.json(after);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admins/:id', authenticate, adminAuth, requirePermission('admins:write','*'), async (req, res) => {
  try {
    const admin = await queryOne('SELECT * FROM admin_users WHERE id = ?', [req.params.id]);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    if (admin.id === req.admin.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await query('DELETE FROM admin_users WHERE id = ?', [req.params.id]);
    await auditLog(req.admin.id, 'ADMIN_DELETE', 'admin_user', req.params.id, admin, null, req);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/roles', authenticate, adminAuth, requirePermission('admins:read','*'), async (req, res) => {
  try {
    const roles = await query('SELECT * FROM admin_roles ORDER BY created_at');
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── AUDIT LOGS ─────────────────────────────────
router.get('/audit-logs', authenticate, adminAuth, requirePermission('audit_logs:read','*'), async (req, res) => {
  try {
    const { search, action, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (search) conditions.push('(u.name LIKE ? OR al.action LIKE ? OR al.entity_type LIKE ?)');
    if (search) params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    if (action) conditions.push('al.action = ?'), params.push(action);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [countResult] = await query(`SELECT COUNT(*) as c FROM admin_audit_logs al ${where}`, params);
    const logs = await query(`
      SELECT al.*, u.name as admin_name
      FROM admin_audit_logs al
      JOIN admin_users au ON au.id = al.admin_user_id
      JOIN users u ON u.id = au.user_id
      ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    res.json({ logs, total: countResult?.c || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;