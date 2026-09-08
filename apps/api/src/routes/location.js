import { Router } from 'express';
import { query } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { getNearbyUsers } from '../utils/helpers.js';

const router = Router();

const VALID_RADII = [100, 200, 500, 1000, 5000];

// Update location
router.post('/update', authenticate, async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    await query(
      'INSERT INTO user_locations (user_id, lat, lng, accuracy) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE lat = ?, lng = ?, accuracy = ?',
      [req.user.id, lat, lng, accuracy || null, lat, lng, accuracy || null]
    );

    res.json({ success: true, location: { latitude: lat, longitude: lng, updatedAt: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get nearby users with filters (gender, occupation, school, search)
router.get('/nearby', authenticate, async (req, res) => {
  try {
    const radius = parseInt(req.query.radius || '500');
    if (!VALID_RADII.includes(radius)) {
      return res.status(400).json({ error: `Invalid radius. Allowed: ${VALID_RADII.join(', ')}` });
    }

    const userLoc = await query('SELECT lat, lng FROM user_locations WHERE user_id = ?', [req.user.id]);
    if (!userLoc.length) {
      return res.json({ users: [], radius, message: 'Update your location first' });
    }

    // getNearbyUsers already filters by visible_on_map=1
    let nearby = await getNearbyUsers(userLoc[0].lat, userLoc[0].lng, radius / 1000, req.user.id);

    // Apply profile field filters
    const { gender, occupation, school, search } = req.query;
    if (gender) nearby = nearby.filter(u => u.gender === gender);
    if (occupation) nearby = nearby.filter(u => u.occupation === occupation);
    if (school) nearby = nearby.filter(u => u.school === school);
    if (search) {
      const q = search.toLowerCase();
      nearby = nearby.filter(u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.bio && u.bio.toLowerCase().includes(q)) ||
        (u.occupation && u.occupation.toLowerCase().includes(q)) ||
        (u.school && u.school.toLowerCase().includes(q))
      );
    }

    res.json({ users: nearby, radius });
  } catch (err) {
    console.error('[Location] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;