/**
 * Mark Notification as Read API
 * POST /api/notifications/:id/read
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { serverConfig } from '@/lib/server-config';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/notifications/:id/read - Mark notification as read
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Verify authentication
    const token = request.cookies.get('accessToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (payload.type !== 'access') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Mark notification as read
    const notification = await db.notification.updateMany({
      where: {
        id,
        userId: payload.userId,
        orgId: payload.orgId,
      },
      data: {
        readAt: new Date(),
      },
    });

    if (notification.count === 0) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Notify notification service to update unread count
    // The notification service will broadcast the updated count to all user sockets
    try {
      // Internal HTTP call to notification service
      await fetch(`${serverConfig.notificationServiceUrl}/internal/update-count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: payload.userId }),
      }).catch(() => {
        // Ignore errors - notification service might not be running
      });
    } catch (error) {
      // Ignore errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
