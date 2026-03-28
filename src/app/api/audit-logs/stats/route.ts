import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { hasPermission, Permission } from '@/lib/auth/rbac';
import { logAuditAccess } from '@/lib/audit';

/**
 * GET /api/audit-logs/stats
 * Get audit statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.cookies.get('accessToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check AUDIT_VIEW permission
    if (!hasPermission(payload.role as any, Permission.AUDIT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Log audit stats access
    await logAuditAccess(payload.userId, { action: 'stats' });

    const orgId = payload.orgId;

    // Get total count
    const total = await db.auditLog.count({
      where: { orgId },
    });

    // Get count by action type
    const byAction = await db.auditLog.groupBy({
      by: ['action'],
      where: { orgId },
      _count: true,
      orderBy: {
        _count: {
          action: 'desc',
        },
      },
    });

    // Get count by entity type
    const byEntity = await db.auditLog.groupBy({
      by: ['entity'],
      where: { orgId },
      _count: true,
      orderBy: {
        _count: {
          entity: 'desc',
        },
      },
      take: 10,
    });

    // Get most active users
    const mostActiveUsers = await db.auditLog.groupBy({
      by: ['actorId'],
      where: { orgId },
      _count: true,
      orderBy: {
        _count: {
          actorId: 'desc',
        },
      },
      take: 10,
    });

    // Get user details for most active users
    const userIds = mostActiveUsers.map((u) => u.actorId);
    const users = await db.user.findMany({
      where: {
        id: { in: userIds },
        orgId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });

    const mostActiveUsersWithDetails = mostActiveUsers.map((item) => ({
      user: users.find((u) => u.id === item.actorId) || null,
      count: item._count,
    }));

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await db.auditLog.findMany({
      where: {
        orgId,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // Get daily activity for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyActivity = await db.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as count
      FROM AuditLog
      WHERE orgId = ${orgId}
        AND createdAt >= ${thirtyDaysAgo}
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
    `;

    return NextResponse.json({
      data: {
        total,
        byAction: byAction.map((item) => ({
          action: item.action,
          count: item._count,
        })),
        byEntity: byEntity.map((item) => ({
          entity: item.entity,
          count: item._count,
        })),
        mostActiveUsers: mostActiveUsersWithDetails,
        recentActivity,
        dailyActivity,
      },
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit statistics' },
      { status: 500 }
    );
  }
}
