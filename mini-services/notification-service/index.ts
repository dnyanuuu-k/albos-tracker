import { Server } from 'socket.io';

const PORT = 3004;

const io = new Server({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store connected users: { userId: Set<socketId> }
const connectedUsers = new Map<string, Set<string>>();

// Store socket to user mapping: { socketId: userId }
const socketToUser = new Map<string, string>();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // User joins their personal room
  socket.on('user:join', (userId: string) => {
    console.log(`User ${userId} joined with socket ${socket.id}`);

    // Store the mapping
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId)!.add(socket.id);
    socketToUser.set(socket.id, userId);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Send success confirmation
    socket.emit('joined', { userId, socketId: socket.id });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    const userId = socketToUser.get(socket.id);
    if (userId) {
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
      socketToUser.delete(socket.id);
    }
  });

  // Test notification
  socket.on('test:notification', (data) => {
    console.log('Test notification received:', data);
    socket.emit('notification', {
      id: `test-${Date.now()}`,
      type: 'TEST',
      title: 'Test Notification',
      message: data.message || 'This is a test notification',
      createdAt: new Date(),
    });
  });
});

// Export function to send notification to a specific user
export function sendNotificationToUser(userId: string, notification: any) {
  const userSockets = connectedUsers.get(userId);
  if (userSockets && userSockets.size > 0) {
    io.to(`user:${userId}`).emit('notification', {
      id: `notif-${Date.now()}`,
      ...notification,
      createdAt: new Date(),
    });
    console.log(`Notification sent to user ${userId}`);
    return true;
  }
  console.log(`User ${userId} not connected, notification not sent`);
  return false;
}

// Export function to send notification to all users in an organization
export function sendNotificationToOrg(orgId: string, notification: any) {
  io.emit('notification', {
    id: `org-notif-${Date.now()}`,
    ...notification,
    createdAt: new Date(),
  });
  console.log(`Organization notification sent to org ${orgId}`);
  return true;
}

// Start server
io.listen(PORT);
console.log(`🔔 Notification service running on port ${PORT}`);

// Export io for external use if needed
export { io };
