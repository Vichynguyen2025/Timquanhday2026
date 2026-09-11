import { query } from '../models/db.js';

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function getNearbyUsers(lat, lng, radiusKm, excludeUserId = null) {
  // Get visible users with locations + profile fields for filtering
  const users = await query(`
    SELECT u.id, u.name, u.avatar, u.bio, u.gender, u.occupation, u.school, u.is_online, u.last_seen, ul.lat, ul.lng
    FROM user_locations ul
    JOIN users u ON u.id = ul.user_id
    WHERE ul.lat IS NOT NULL AND u.visible_on_map = 1
    ${excludeUserId ? 'AND u.id != ?' : ''}
  `, excludeUserId ? [excludeUserId] : []);

  return users
    .map(u => {
      const distance = haversineDistance(lat, lng, u.lat, u.lng);
      return { ...u, distance: Math.round(distance * 1000) }; // meters
    })
    .filter(u => u.distance <= radiusKm * 1000)
    .sort((a, b) => a.distance - b.distance);
}

export async function createNotification(userId, type, title, body, data = null, actorId = null) {
  const result = await query(
    'INSERT INTO notifications (user_id, type, title, body, data, actor_id) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, type, title, body, data ? JSON.stringify(data) : null, actorId]
  );
  return result.insertId;
}
