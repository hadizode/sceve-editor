# API Contract

## REST Endpoints

### Session Management

#### POST /api/session/create
ایجاد جلسه بازی جدید (توسط بات تلگرام فراخوانی می‌شود).

**Request:**
```json
{
  "projectId": "string",
  "players": [
    { "telegramId": "string", "name": "string" }
  ]
}
```

**Response:**
```json
{
  "token": "jwt-string",
  "sessionId": "string",
  "expiresAt": "ISO-8601"
}
```

JWT معتبر ۴ ساعت.

#### POST /api/session/:token/validate
اعتبارسنجی توکن جلسه.

**Response:**
```json
{
  "valid": true,
  "session": { ... }
}
```

#### GET /api/session/:token/state
دریافت وضعیت فعلی جلسه.

**Response:**
```json
{
  "currentSceneId": "string",
  "discoveredObjects": { "sceneId": ["objectId", ...] },
  "inventory": ["itemId", ...],
  "completedScenes": ["sceneId", ...],
  "players": [{ "telegramId": "string", "name": "string", "online": boolean }]
}
```

### Scene Management (Studio)

#### POST /api/scene/save
ذخیره صحنه.

**Request:**
```json
{
  "scene": { ... Scene object ... }
}
```

#### GET /api/scene/:roomId
دریافت صحنه (برای بازیکن).

### WebSocket

#### WS /ws/session/:token

اتصال بلادرنگ. رویدادها:

- `object-discovered` - یک بازیکن شیئی را کشف کرد
- `player-join` - بازیکن جدید وارد شد
- `player-leave` - بازیکن خارج شد
- `player-ready` - بازیکن آماده شد
- `room-complete` - اتاق کامل شد
- `game-complete` - بازی تمام شد

**قوانین:**
- First-click-wins: اولین کلیک‌کننده شیء را کشف می‌کند
- بقیه پیام "already discovered" دریافت می‌کنند
- Presence: آنلاین/آفلاین هر بازیکن broadcast می‌شود

## Project Management

#### GET /api/projects
لیست پروژه‌ها

#### POST /api/projects
ایجاد پروژه

#### PUT /api/projects/:id
بروزرسانی پروژه

#### DELETE /api/projects/:id
حذف پروژه

## Image Upload

#### POST /api/upload/image
آپلود تصویر. Response: `{ "url": "/uploads/..." }`

## Version History

#### GET /api/projects/:id/versions
لیست نسخه‌ها

#### POST /api/projects/:id/versions/:versionId/restore
بازگردانی نسخه
