# ETMS Notification Service

WebSocket-based real-time notification service for ETMS using Socket.IO.

## Features

- Real-time push notifications via WebSocket
- JWT authentication for secure connections
- Room-based broadcasting per user
- Support for 10 notification types:
  - TASK_ASSIGNED
  - STATUS_CHANGED
  - DUE_REMINDER
  - MENTION
  - TRANSFER_INITIATED
  - TRANSFER_APPROVED
  - INVITE_SENT
  - INVITE_ACCEPTED
  - TASK_REJECTED
  - ESCALATION
- Health check and metrics endpoints
- Graceful shutdown handling

## Installation

```bash
cd mini-services/notification-service
bun install
```

## Running the Service

### Development (with hot reload)

```bash
cd mini-services/notification-service
bun run dev
```

### Production

```bash
cd mini-services/notification-service
bun run start
```

## API Endpoints

### Health Check

```
GET http://localhost:3005/health
```

Response:
```json
{
  "status": "healthy",
  "service": "notification-service",
  "connectedUsers": 5,
  "totalSockets": 7,
  "timestamp": "2026-03-23T12:00:00.000Z"
}
```

### Metrics

```
GET http://localhost:3005/metrics
```

Response:
```json
{
  "connectedUsers": 5,
  "totalSockets": 7,
  "uptime": 3600,
  "memory": {
    "rss": 12345678,
    "heapTotal": 9876543,
    "heapUsed": 5432109
  },
  "timestamp": "2026-03-23T12:00:00.000Z"
}
```

### Internal Endpoints (for Next.js API)

#### Broadcast Notification

```
POST http://localhost:3005/internal/broadcast
Content-Type: application/json

{
  "userId": "user123",
  "notification": {
    "id": "notif123",
    "orgId": "org123",
    "userId": "user123",
    "type": "TASK_ASSIGNED",
    "title": "New Task Assigned",
    "message": "You have been assigned a new task",
    "refEntity": "Task",
    "refId": "task123",
    "readAt": null,
    "createdAt": "2026-03-23T12:00:00.000Z"
  }
}
```

#### Update Unread Count

```
POST http://localhost:3005/internal/update-count
Content-Type: application/json

{
  "userId": "user123"
}
```

## Socket.IO Client Connection

The frontend connects to the notification service via the gateway using the `XTransformPort` query parameter.

### Example Connection

```javascript
import { io } from 'socket.io-client';

// Get JWT token from cookie
const token = getCookie('accessToken');

// Connect via gateway (NEVER use absolute URL or direct port)
const socket = io(`/?XTransformPort=3005`, {
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Listen for events
socket.on('connect', () => {
  console.log('Connected to notification service');
});

socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});

socket.on('unread_count', (data) => {
  console.log('Unread count:', data.count);
});

socket.on('disconnect', () => {
  console.log('Disconnected from notification service');
});
```

## Events

### Client → Server

- `notification:read` - Mark notification as read
- `notification:read-all` - Mark all notifications as read
- `ping` - Connection health check

### Server → Client

- `connected` - Connection established
- `notification` - New notification received
- `unread_count` - Unread count updated
- `pong` - Response to ping

## Environment Variables

- `PORT` - Port to listen on (default: 3005)
- `JWT_SECRET` - Secret for JWT verification (must match main app)
- `NODE_ENV` - Environment (development/production)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

## Gateway Configuration

The service is designed to work with the Caddy gateway configuration:

```caddyfile
:81 {
    @transform_port_query {
        query XTransformPort=*
    }

    handle @transform_port_query {
        reverse_proxy localhost:{query.XTransformPort}
    }
}
```

Frontend MUST connect using `io("/?XTransformPort=3005")` - never use absolute URLs.

## Notification Types

| Type | Description | Icon |
|------|-------------|------|
| TASK_ASSIGNED | User assigned to a task | 📋 |
| STATUS_CHANGED | Task status changed | 🔄 |
| DUE_REMINDER | Task due soon | ⏰ |
| MENTION | User mentioned in comment | 👤 |
| TRANSFER_INITIATED | Department transfer initiated | 📤 |
| TRANSFER_APPROVED | Department transfer approved | ✅ |
| INVITE_SENT | Invitation sent | 📧 |
| INVITE_ACCEPTED | Invitation accepted | 🎉 |
| TASK_REJECTED | Task rejected | ❌ |
| ESCALATION | Task escalated | 🚨 |

## Troubleshooting

### Service won't start

1. Check if port 3005 is already in use:
   ```bash
   lsof -i :3005
   ```

2. Set a different port:
   ```bash
   PORT=3006 bun run dev
   ```

### Connection refused

1. Ensure the notification service is running
2. Check the gateway configuration
3. Verify JWT_SECRET matches between services

### Notifications not appearing

1. Check browser console for socket connection errors
2. Verify JWT token is valid
3. Check notification service logs
4. Ensure user is in correct room

## Monitoring

Monitor the service health:

```bash
# Health check
curl http://localhost:3005/health

# Metrics
curl http://localhost:3005/metrics
```

## License

MIT
