import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { hasPermission, Permission } from '@/lib/auth/rbac';

/**
 * GET /api/transfers/pending - Get pending transfers for current user's approval
 */
async function getPendingTransfers(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    // Check if user has permission to view pending transfers
    if (!hasPermission(user.role, Permission.EMP_TRANSFER)) {
      return NextResponse.json(
        { error: 'You do not have permission to view pending transfers' },
        { status: 403 }
      );
    }

    // Get all pending transfers where user is the target department manager
    const pendingTransfers = await db.transfer.findMany({
      where: {
        orgId: user.orgId,
        status: 'PENDING',
        toDept: {
          managerId: user.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            avatarUrl: true,
            role: true,
            designation: true,
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        fromDept: {
          select: {
            id: true,
            name: true,
            code: true,
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        toDept: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first
    });

    // Check if any transfers are close to or past the 48-hour deadline
    const now = new Date();
    const transfersWithDeadline = pendingTransfers.map((transfer) => {
      const createdAt = new Date(transfer.createdAt);
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      const hoursRemaining = 48 - hoursSinceCreation;

      return {
        ...transfer,
        hoursRemaining: Math.max(0, Math.floor(hoursRemaining)),
        isUrgent: hoursRemaining <= 24 && hoursRemaining > 0,
        isOverdue: hoursRemaining <= 0,
      };
    });

    return NextResponse.json({
      transfers: transfersWithDeadline,
      count: transfersWithDeadline.length,
    });
  } catch (error: any) {
    console.error('Failed to fetch pending transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending transfers' },
      { status: 500 }
    );
  }
}

// Export route handler with auth middleware
export const GET = withAuth(getPendingTransfers, {
  allowPublic: false,
});
