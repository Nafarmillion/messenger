# Messenger Backend API Documentation

## Overview

This is a RESTful API backend for a multi-user messenger application built with NestJS, PostgreSQL, Prisma, and Socket.io.

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL 16
- **ORM**: Prisma 7 (with @prisma/adapter-pg)
- **Authentication**: JWT (Access + Refresh tokens)
- **Real-time**: Socket.io
- **Password Hashing**: bcrypt

## Deployment

### Local Development

```bash
# Start database
docker compose up -d

# Start backend
cd backend && pnpm run start:dev

# Start frontend
cd frontend && pnpm run dev
```

### Deploy with ngrok (Share with friends)

1. **Install ngrok:**
```bash
sudo pacman -S ngrok
ngrok config add-authtoken <your-token>
```

2. **Start backend:**
```bash
cd backend && pnpm run start:dev
```

3. **Start ngrok:**
```bash
./start-ngrok.sh
# Or manually:
ngrok http 3000
```

4. **Update frontend `.env.local`:**
```env
NEXT_PUBLIC_API_URL=https://YOUR-URL.ngrok-free.app
NEXT_PUBLIC_WS_URL=wss://YOUR-URL.ngrok-free.app/messenger
```

5. **Start frontend:**
```bash
cd frontend && pnpm run dev
```

6. **Share the ngrok URL with your friend!**

⚠️ Note: Free ngrok URLs change on each restart.

### Prerequisites

- Node.js 18+
- pnpm
- Docker (for PostgreSQL)

### Installation

1. **Install dependencies**:
```bash
pnpm install
```

2. **Start PostgreSQL**:
```bash
docker compose up -d
```

3. **Run migrations**:
```bash
pnpm prisma migrate dev
```

4. **Generate Prisma Client**:
```bash
pnpm prisma generate
```

5. **Start the server**:
```bash
pnpm run start:dev
```

The API will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/messenger?schema=public"

# JWT
JWT_ACCESS_SECRET="your-super-secret-access-token-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-token-key"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Server
PORT=3000
```

## Database Schema

### Tables

#### users
- `id` (UUID, PK) - Unique user identifier
- `username` (String, Unique) - User's username
- `first_name` (String) - First name
- `last_name` (String) - Last name
- `phone` (String, Unique, Nullable) - Phone number
- `email` (String, Unique, Nullable) - Email address
- `password_hash` (String) - Hashed password
- `is_online` (Boolean) - Online status
- `last_seen` (Timestamp) - Last seen timestamp
- `setting_show_status` (Boolean) - Privacy: show online status
- `setting_show_last_seen` (Boolean) - Privacy: show last seen
- `created_at`, `updated_at` (Timestamp)

#### sessions
- `id` (UUID, PK) - Session identifier
- `user_id` (UUID, FK) - User who owns the session
- `token_hash` (String) - Hashed refresh token
- `expires_at` (Timestamp) - Token expiration
- `device_info` (String, Nullable) - Device information
- `created_at` (Timestamp)

#### chats
- `id` (UUID, PK) - Chat identifier
- `is_group` (Boolean) - Is this a group chat?
- `name` (String, Nullable) - Group name (for groups)
- `created_at`, `updated_at` (Timestamp)

#### chat_members
- `id` (UUID, PK) - Membership identifier
- `chat_id` (UUID, FK) - Chat reference
- `user_id` (UUID, FK) - User reference
- `role` (Enum: OWNER, ADMIN, MODERATOR, MEMBER)
- `created_at` (Timestamp)

#### messages
- `id` (UUID, PK) - Message identifier
- `chat_id` (UUID, FK) - Chat reference
- `sender_id` (UUID, FK) - Sender reference
- `content` (Text) - Message content
- `is_edited` (Boolean) - Was message edited?
- `created_at`, `updated_at` (Timestamp)

## API Endpoints

### Authentication

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",  // Optional, either email or phone required
  "password": "securepassword123"
}
```

#### Login with Email
```http
POST /auth/login/email
Content-Type: application/json
X-Device-Info: Chrome on Windows  // Optional

{
  "email": "john@example.com",
  "password": "securepassword123"
}

Response:
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

#### Login with Phone
```http
POST /auth/login/phone
Content-Type: application/json
X-Device-Info: Chrome on Windows  // Optional

{
  "phone": "+1234567890",
  "password": "securepassword123"
}
```

#### Refresh Tokens
```http
POST /auth/refresh
Content-Type: application/json
X-Device-Info: Chrome on Windows  // Optional

{
  "refreshToken": "eyJhbG..."
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "refreshToken": "eyJhbG..."
}
```

#### Logout from All Devices
```http
POST /auth/logout/all
Authorization: Bearer <accessToken>
```

### Users

#### Get Current User
```http
GET /users/me
Authorization: Bearer <accessToken>
```

#### Get User by Username
```http
GET /users/:username
Authorization: Bearer <accessToken>
```

#### Get All Users (with search)
```http
GET /users?search=john&limit=20
Authorization: Bearer <accessToken>
```

#### Update Profile
```http
PUT /users/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Doe",
  "username": "jane_doe"
}
```

#### Update Privacy Settings
```http
PUT /users/me/settings
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "settingShowStatus": false,
  "settingShowLastSeen": false
}
```

#### Change Password
```http
PUT /users/me/password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

#### Delete Account
```http
DELETE /users/me
Authorization: Bearer <accessToken>
```

### Chats

#### Get All Chats
```http
GET /chats
Authorization: Bearer <accessToken>
```

#### Get Chat by ID
```http
GET /chats/:id
Authorization: Bearer <accessToken>
```

#### Create Chat
```http
POST /chats
Authorization: Bearer <accessToken>
Content-Type: application/json

// Private chat
{
  "isGroup": false,
  "memberIds": ["user-uuid"]
}

// Group chat
{
  "isGroup": true,
  "name": "My Group",
  "memberIds": ["user-uuid-1", "user-uuid-2"]
}
```

#### Update Group Name
```http
PUT /chats/:id
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "New Group Name"
}
```

#### Add Member to Group
```http
POST /chats/:id/members
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "userId": "user-uuid",
  "role": "MEMBER"  // Optional, defaults to MEMBER
}
```

#### Remove Member from Group
```http
DELETE /chats/:id/members/:memberId
Authorization: Bearer <accessToken>
```

#### Leave Group
```http
POST /chats/:id/leave
Authorization: Bearer <accessToken>
```

#### Update Member Role
```http
PUT /chats/:id/members/:memberId/role
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "role": "ADMIN"  // OWNER, ADMIN, MODERATOR, MEMBER
}
```

#### Transfer Ownership
```http
POST /chats/:id/transfer/:newOwnerId
Authorization: Bearer <accessToken>
```

#### Delete Chat
```http
DELETE /chats/:id
Authorization: Bearer <accessToken>
```

### Messages

#### Get Messages (with pagination)
```http
GET /chats/:chatId/messages?limit=50&before=2024-01-01T00:00:00Z&after=2023-01-01T00:00:00Z
Authorization: Bearer <accessToken>
```

#### Send Message
```http
POST /chats/:chatId/messages
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "content": "Hello, World!"
}
```

#### Get Message by ID
```http
GET /chats/:chatId/messages/:id
Authorization: Bearer <accessToken>
```

#### Edit Message
```http
PUT /chats/:chatId/messages/:id
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "content": "Edited message"
}
```

#### Delete Message
```http
DELETE /chats/:chatId/messages/:id
Authorization: Bearer <accessToken>
```

## WebSocket Events

Connect to: `ws://localhost:3000/messenger`

### Connection

```javascript
const socket = io('ws://localhost:3000/messenger', {
  auth: {
    token: 'your-jwt-access-token'
  }
});
```

### Client → Server Events

#### Join Chat Room
```javascript
socket.emit('join_chat', { chatId: 'chat-uuid' });
```

#### Leave Chat Room
```javascript
socket.emit('leave_chat', { chatId: 'chat-uuid' });
```

#### Start Typing
```javascript
socket.emit('typing_start', { chatId: 'chat-uuid' });
```

#### Stop Typing
```javascript
socket.emit('typing_stop', { chatId: 'chat-uuid' });
```

### Server → Client Events

#### New Message
```javascript
socket.on('new_message', (message) => {
  console.log('New message:', message);
});
```

#### Message Edited
```javascript
socket.on('message_edited', (message) => {
  console.log('Message edited:', message);
});
```

#### Message Deleted
```javascript
socket.on('message_deleted', ({ messageId }) => {
  console.log('Message deleted:', messageId);
});
```

#### User Status Changed
```javascript
socket.on('user_status', ({ userId, isOnline, lastSeen }) => {
  console.log('User status:', userId, isOnline, lastSeen);
});
```

#### User Typing
```javascript
socket.on('user_typing', ({ userId, chatId, isTyping }) => {
  console.log('User typing:', userId, isTyping);
});
```

## Role-Based Access Control (RBAC)

### Group Roles

| Role | Permissions |
|------|-------------|
| **OWNER** | Full control. Can delete group, transfer ownership, manage all members and roles. Cannot be removed. |
| **ADMIN** | Can remove members, change group name, update member roles (except OWNER). |
| **MODERATOR** | Can change group name only. |
| **MEMBER** | Can add new members, leave the group. |

### Permission Matrix

| Action | OWNER | ADMIN | MODERATOR | MEMBER |
|--------|-------|-------|-----------|--------|
| Delete group | ✅ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Change group name | ✅ | ✅ | ✅ | ❌ |
| Update member roles | ✅ | ✅ | ❌ | ❌ |
| Add members | ✅ | ✅ | ✅ | ✅ |
| Leave group | ✅ | ✅ | ✅ | ✅ |

## Privacy Settings

Users can control their visibility:

- `setting_show_status`: If `false`, `isOnline` field will be omitted from user profiles for other users
- `setting_show_last_seen`: If `false`, `lastSeen` field will be omitted from user profiles for other users

Note: These settings don't affect the user's own view of their profile.

## Security

- Passwords are hashed with bcrypt (10 rounds)
- Refresh tokens are stored hashed in the database
- JWT access tokens expire after 15 minutes (configurable)
- JWT refresh tokens expire after 7 days (configurable)
- All endpoints except auth require Bearer token authentication
- WebSocket connections require valid JWT token

## Development

### Run in development mode
```bash
pnpm run start:dev
```

### Run in debug mode
```bash
pnpm run start:debug
```

### Run tests
```bash
pnpm run test
pnpm run test:e2e
```

### Build for production
```bash
pnpm run build
pnpm run start:prod
```

### Database commands
```bash
# Create new migration
pnpm prisma migrate dev --name description

# Reset database
pnpm prisma migrate reset

# Open Prisma Studio
pnpm prisma studio

# Format schema
pnpm prisma format
```

## Project Structure

```
src/
├── auth/           # Authentication module (JWT, registration, login)
├── users/          # Users module (profile, settings)
├── chats/          # Chats module (groups, private chats, RBAC)
├── messages/       # Messages module (CRUD operations)
├── gateway/        # WebSocket gateway (real-time updates)
├── prisma/         # Prisma service
├── common/         # Shared utilities (guards, decorators, constants)
└── main.ts         # Application entry point
```

## Next.js Frontend Integration

For your Next.js frontend, you'll need to:

1. Store tokens securely (httpOnly cookies recommended)
2. Implement token refresh logic
3. Set up Socket.io client for real-time updates
4. Handle reconnection logic for WebSocket
5. Implement optimistic updates for messages

Example Socket.io client setup for Next.js:
```typescript
// lib/socket.ts
import { io } from 'socket.io-client';

export const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/messenger', {
  autoConnect: false,
  auth: {
    token: '', // Set after login
  },
});
```

## Troubleshooting

### Port 5433 already in use
Change the port in `docker-compose.yml` and update `DATABASE_URL` in `.env`

### Prisma client not generated
Run `pnpm prisma generate`

### WebSocket connection fails
- Check CORS settings in `main.ts`
- Ensure firewall allows WebSocket connections
- Verify JWT token is valid

### Migration errors
Run `pnpm prisma migrate reset` to reset the database (development only)
