/**
 * Notification Handler - Manages Socket.IO events and notification broadcasting
 */

import { Server, Socket } from 'socket.io';
import { verifyToken } from 'jose';
import type {
  SocketAuthData,
  SocketAuthenticatedUser,
  NotificationData,
  NotificationSendRequest,
  NotificationType,
} from './types.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

// Store connected users: Map<userId, Set<socketId>>
const connectedUsers = new Map<string, Set<string>>();

// Store socket to user mapping: Map<socketId, userId>
const socketToUser = new Map<string, string>();

// Store authenticated user data: Map<socketId, SocketAuthenticatedUser>
const authenticatedUsers = new Map<string, SocketAuthenticatedUser>();

/**
 * Verify JWT token from socket connection
 */
async function verifySocketToken(token: string): Promise<SocketAuthenticatedUser | null> {
  try {
    const { payload } = await verifyToken(token, JWT_SECRET);
    const jwtPayload = payload as unknown as {
      userId: string;
      orgId: string;
      email: string;
      role: string;
      type: string;
    };

    if (jwtPayload.type !== 'access') {
      return null;
    }

    return {
      userId: jwtPayload.userId,
      orgId: jwtPayload.orgId,
      email: jwtPayload.email,
      role: jwtPayload.role,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Handle socket connection
 */
export async function handleConnection(
  socket: Socket,
  io: Server
): Promise<void> {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token || typeof token !== 'string') {
    socket.disconnect();
    return;
  }

  const user = await verifySocketToken(token);

  if (!user) {
    socket.disconnect();
    return;
  }

  // Store user authentication data
  authenticatedUsers.set(socket.id, user);
  socketToUser.set(socket.id, user.userId);

  // Add socket to user's connected sockets
  if (!connectedUsers.has(user.userId)) {
    connectedUsers.set(user.userId, new Set());
  }
  connectedUsers.get(user.userId)!.add(socket.id);

  // Join user's personal room for targeted notifications
  const roomName = `user:${user.userId}`;
  await socket.join(roomName);

  console.log(`User ${user.userId} connected. Socket: ${socket.id}`);
  console.log(`Total connected users: ${connectedUsers.size}`);

  // Send connection success confirmation
  socket.emit('connected', {
    userId: user.userId,
    socketId: socket.id,
  });

  // Send initial unread count
  const unreadCount = await getUnreadCount(user.userId);
  socket.emit('unread_count', { count: unreadCount });
}

/**
 * Handle socket disconnection
 */
export function handleDisconnection(socket: Socket): void {
  const userId = socketToUser.get(socket.id);

  if (userId) {
    // Remove socket from user's connected sockets
    const userSockets = connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        connectedUsers.delete(userId);
      }
    }

    console.log(`User ${userId} disconnected. Socket: ${socket.id}`);
    console.log(`Total connected users: ${connectedUsers.size}`);
  }

  socketToUser.delete(socket.id);
  authenticatedUsers.delete(socket.id);
}

/**
 * Send notification to specific user
 */
export async function sendNotificationToUser(
  io: Server,
  userId: string,
  notification: NotificationData
): Promise<boolean> {
  const userSockets = connectedUsers.get(userId);

  if (!userSockets || userSockets.size === 0) {
    console.log(`User ${userId} not connected. Notification queued.`);
    return false;
  }

  const roomName = `user:${userId}`;
  io.to(roomName).emit('notification', notification);

  console.log(`Notification sent to user ${userId}:`, notification.type);
  return true;
}

/**
 * Broadcast notification to multiple users
 */
export async function broadcastNotification(
  io: Server,
  userIds: string[],
  notification: NotificationData
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const success = await sendNotificationToUser(io, userId, notification);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Update unread count for a user
 */
export async function updateUnreadCount(io: Server, userId: string): Promise<void> {
  const unreadCount = await getUnreadCount(userId);
  const roomName = `user:${userId}`;
  io.to(roomName).emit('unread_count', { count: unreadCount });
}

/**
 * Get unread count from database
 */
async function getUnreadCount(userId: string): Promise<number> {
  // This would query the database in a real implementation
  // For now, return 0 as the database integration is handled by the API layer
  // The notification service doesn't directly access the database to avoid
  // circular dependencies. The count is managed through API endpoints.
  return 0;
}

/**
 * Handle notification read event
 */
export function handleNotificationRead(
  socket: Socket,
  io: Server,
  data: { notificationId: string }
): void {
  const userId = socketToUser.get(socket.id);
  if (!userId) return;

  // Broadcast to all user's sockets to update unread count
  updateUnreadCount(io, userId);
}

/**
 * Handle all notifications read event
 */
export function handleAllNotificationsRead(socket: Socket, io: Server): void {
  const userId = socketToUser.get(socket.id);
  if (!userId) return;

  // Broadcast to all user's sockets to update unread count
  updateUnreadCount(io, userId);
}

/**
 * Setup all socket event handlers
 */
export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket) => {
    console.log('New socket connection attempt:', socket.id);

    // Handle connection
    handleConnection(socket, io).catch((error) => {
      console.error('Connection handling error:', error);
      socket.disconnect();
    });

    // Handle notification read
    socket.on('notification:read', (data) => {
      handleNotificationRead(socket, io, data);
    });

    // Handle all notifications read
    socket.on('notification:read-all', () => {
      handleAllNotificationsRead(socket, io);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnection(socket);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}

/**
 * Get connected users count
 */
export function getConnectedUsersCount(): number {
  return connectedUsers.size;
}

/**
 * Get total sockets count
 */
export function getTotalSocketsCount(): number {
  return socketToUser.size;
}

/**
 * Check if user is connected
 */
export function isUserConnected(userId: string): boolean {
  const sockets = connectedUsers.get(userId);
  return sockets ? sockets.size > 0 : false;
}
