import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { activityFeedSchema } from '@/lib/validations/dashboard';
import { UserRole, TaskStatus, TransferStatus, AuditAction } from '@prisma/client';

// GET /api/dashboard/activity - Get recent activity
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = activityFeedSchema.parse({
      limit: searchParams.get('limit') || '20',
      offset: searchParams.get('offset') || '0',
      type: searchParams.get('type') || 'all',
    });

    const orgId = user.orgId;
    const userRole = user.role;
    const userDeptId = user.deptId;

    // Build filters based on type
    const auditLogFilter: any = { orgId };
    const taskFilter: any = { orgId };
    const transferFilter: any = { orgId };

    // Apply role-based filtering
    if (userRole === UserRole.DEPARTMENT_MANAGER) {
      // Filter by department for task and transfer activities
      taskFilter.deptId = userDeptId;
      transferFilter.fromDeptId = userDeptId;
    } else if (userRole === UserRole.EMPLOYEE) {
      // EMPLOYEE should only see their own tasks/transfers and their own audit events
      auditLogFilter.actorId = user.id;
      taskFilter.assignees = { some: { userId: user.id, isActive: true } };
      transferFilter.userId = user.id;
    }

    // Fetch different types of activities
    const [auditLogs, recentTasks, recentTransfers] = await Promise.all([
      // Audit logs
      db.auditLog.findMany({
        where: auditLogFilter,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      }),
      // Recent tasks
      db.task.findMany({
        where: taskFilter,
        orderBy: { createdAt: 'desc' },
        take: Math.floor(query.limit / 2),
        include: {
          creator: {
            select: { id: true, name: true, avatarUrl: true },
          },
          department: {
            select: { id: true, name: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
            take: 3,
          },
        },
      }),
      // Recent transfers
      db.transfer.findMany({
        where: transferFilter,
        orderBy: { createdAt: 'desc' },
        take: Math.floor(query.limit / 2),
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          fromDept: {
            select: { id: true, name: true },
          },
          toDept: {
            select: { id: true, name: true },
          },
          initiator: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    // Normalize activity format
    const activities: any[] = [];

    // Add audit log activities
    auditLogs.forEach((log) => {
      if (query.type === 'all' || query.type === 'user') {
        activities.push({
          id: `audit-${log.id}`,
          type: 'audit',
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          actor: log.actor,
          description: `${log.actor.name || log.actor.email} ${getActionDescription(log.action)} ${log.entity}`,
          timestamp: log.createdAt,
        });
      }
    });

    // Add task activities
    recentTasks.forEach((task) => {
      if (query.type === 'all' || query.type === 'task') {
        activities.push({
          id: `task-${task.id}`,
          type: 'task',
          action: 'created',
          entity: 'task',
          entityId: task.id,
          actor: task.creator,
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            department: task.department,
            assignees: task.assignees.map((a) => a.user),
          },
          description: `New task "${task.title}" created by ${task.creator.name || task.creator.email}`,
          timestamp: task.createdAt,
        });
      }
    });

    // Add transfer activities
    recentTransfers.forEach((transfer) => {
      if (query.type === 'all' || query.type === 'transfer') {
        activities.push({
          id: `transfer-${transfer.id}`,
          type: 'transfer',
          action: transfer.status.toLowerCase(),
          entity: 'transfer',
          entityId: transfer.id,
          actor: transfer.initiator,
          transfer: {
            id: transfer.id,
            user: transfer.user,
            fromDept: transfer.fromDept,
            toDept: transfer.toDept,
            status: transfer.status,
            effectiveDate: transfer.effectiveDate,
          },
          description: `Transfer request for ${transfer.user.name} from ${transfer.fromDept.name} to ${transfer.toDept.name}`,
          timestamp: transfer.createdAt,
        });
      }
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const paginatedActivities = activities.slice(query.offset, query.offset + query.limit);

    return NextResponse.json({
      success: true,
      data: {
        activities: paginatedActivities,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: activities.length,
          hasMore: query.offset + query.limit < activities.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity feed' },
      { status: 500 }
    );
  }
});

function getActionDescription(action: AuditAction): string {
  switch (action) {
    case AuditAction.CREATE:
      return 'created';
    case AuditAction.UPDATE:
      return 'updated';
    case AuditAction.DELETE:
      return 'deleted';
    case AuditAction.LOGIN:
      return 'logged in to';
    case AuditAction.LOGOUT:
      return 'logged out of';
    case AuditAction.INVITE:
      return 'invited';
    case AuditAction.TRANSFER:
      return 'initiated transfer for';
    case AuditAction.APPROVE:
      return 'approved';
    case AuditAction.REJECT:
      return 'rejected';
    default:
      return 'performed action on';
  }
}
