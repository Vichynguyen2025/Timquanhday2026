# ADMIN AUDIT REPORT — Tìm Quanh Đây CMS

## A. GitHub
- **Repository**: `Vichynguyen2025/timquanhday2026` (GitHub)
- **Production branch**: `main`
- **Development branch**: `develop`
- **Latest commit**: `0630305` — "fix: Avatar images now display in Feed, ChatList, ChatDetail, SOS screens"
- **Architecture**: Monorepo

## B. Source Directories

```
timquanhday2026/
├── apps/
│   ├── api/          — Node.js/Express backend (port 3001)
│   ├── mobile/       — Flutter app (legacy)
│   ├── mobile-expo/  — Expo React Native app (active, port 19091)
│   └── web/          — React + Vite + TailwindCSS (https://timquanhday.de)
├── database/          — SQL migrations
├── infrastructure/
│   └── nginx/         — Nginx configs
```

## C. VPS (INET 202.92.6.105:24700)

- **Project root**: `/opt/timquanhday/`
- **PM2 processes**:
  - `tqd-api` (id 84) — Node.js API on port 3001
  - `tqd-expo-mobile` (id 92) — Expo on port 19091
  - `tqd-staging` (id 85) — Staging API on port 3001 (different dir)
- **Nginx**: aapanel-managed, config at `/www/server/panel/vhost/nginx/timquanhday.de.conf`
- **SSL**: aapanel cert at `/www/server/panel/vhost/cert/timquanhday.de/`
- **Backend**: Express on port 3001
- **Web frontend**: `/opt/timquanhday/apps/web/dist`
- **Staging**: `/opt/timquanhday/staging/`

## D. MySQL (`timquanhday`)

**Host**: 127.0.0.1:3306, **User**: coffee, **Tables**: 24

| Module | Tables |
|--------|--------|
| Auth/Users | `users`, `user_sessions` |
| Messages | `messages`, `conversations`, `conversation_members`, `message_reads`, `message_reactions` |
| Posts | `posts`, `post_comments`, `post_likes`, `post_saves`, `post_shares` |
| SOS | `sos_requests`, `sos_responses`, `sos_categories`, `sos_media`, `sos_status_history` |
| SOS Helper | `service_profiles`, `service_profile_categories` |
| Social | `friend_requests`, `user_blocks` |
| Location | `user_locations` |
| Notifications | `notifications` |

## E. Existing API Routes

| File | Endpoints |
|------|-----------|
| `auth.js` | POST register/login/refresh/logout, GET /me |
| `users.js` | GET search/blocked, PATCH /me, PATCH /location, POST /change-password, POST block/unblock |
| `conversations.js` | GET /, GET /:id, DELETE /:id |
| `messages.js` | GET /:conversationId, GET /unread-count |
| `notifications.js` | GET /, GET /unread-count, PATCH /:id/read, POST /read-all |
| `posts.js` | Full CRUD + like/save/share/comment (nested routes) |
| `sos.js` | Full CRUD + helper profile + matching engine + accept/reject |
| `location.js` | POST /update, GET /nearby |
| `upload.js` | POST /image |

## F. Authentication
- **Strategy**: JWT (access token + refresh token)
- **Middleware**: `authenticate` checks JWT, attaches `req.user.id`
- **Credentials**: JWT_SECRET, JWT_REFRESH_SECRET in PM2 env vars

## G. Realtime (Socket.IO)

- **Path**: `/ws` (EIO 4, transports: websocket + polling)
- **Redis adapter**: optional (ioredis)
- **Events**: `message:new`, `message:deleted`, `message:reaction`, `message:read`, `notification:new`, `sos:new`, `sos:updated`, `sos:response`, `sos:accepted`, `sos:cancelled`, `user:online`, `user:offline`, `user:profile_updated`, `user:typing`, `user:stop-typing`
- **Rooms**: `user:<userId>`, `conversation:<conversationId>`

## H. CMS Architecture (Proposed)

```
apps/
├── api/
│   └── src/
│       └── routes/
│           └── admin.js     ← NEW: /api/v1/admin/*
│
├── admin/                    ← NEW: React + Vite + Tailwind CMS
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
├── web/
└── mobile-expo/

infrastructure/
└── nginx/
    └── timquanhday.conf      ← MODIFY: add cms.timquanhday.de

database/
└── migration-admin.sql       ← NEW: admin tables
```

## I. Files to Modify

**NEW:**
- `database/migration-admin.sql` — admin_users, admin_roles, admin_permissions, admin_audit_logs, outbox_events
- `apps/api/src/routes/admin.js` — Admin API routes
- `apps/admin/` — Full CMS frontend (React + Vite + Tailwind)
- `infrastructure/nginx/cms.timquanhday.conf` — Subdomain Nginx config

**MODIFY:**
- `apps/api/src/index.js` — Register admin routes + setSocketIO

**DO NOT MODIFY:**
- `apps/mobile-expo/` — Flutter/Expo app
- `apps/web/` — Web app
- Existing database tables
- Existing API routes

## J. Admin Tables (to create)

```sql
admin_roles — id, name (SUPER_ADMIN/ADMIN/MODERATOR/SOS_OPERATOR), permissions JSON
admin_users — id, user_id (FK to users), role_id (FK), created_by, created_at
admin_audit_logs — id, admin_id, action, entity_type, entity_id, before, after, ip, user_agent, created_at
```

## K. Nginx

Add to `/www/server/panel/vhost/nginx/timquanhday.de.conf`:
```nginx
server {
    listen 443 ssl http2;
    server_name cms.timquanhday.de;
    # SSL same cert
    root /opt/timquanhday/apps/admin/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3001; ... }
    location /ws { proxy_pass http://127.0.0.1:3001; ... }
}
```

DNS: CNAME `cms.timquanhday.de` → `202.92.6.105` (or same as main domain)