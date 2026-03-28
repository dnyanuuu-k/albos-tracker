/**
 * Mark All Notifications as Read API
 * POST /api/notifications/read-all
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { serverConfig } from '@/lib/server-config';

/**
 * POST /api/notifications/read-all - Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('accessToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (payload.type !== 'access') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Mark all notifications as read
    const result = await db.notification.updateMany({
      where: {
        userId: payload.userId,
        orgId: payload.orgId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    // Notify notification service to update unread count
    try {
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

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
