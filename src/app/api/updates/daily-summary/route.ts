import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { Permission, hasPermission } from '@/lib/auth/rbac';
import { UserRole } from '@prisma/client';

// GET /api/updates/daily-summary - Get daily summary for managers
async function getDailySummary(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    // Parse date parameters (default to today)
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    // Get start and end of the target date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build where clause based on user role
    const taskWhere: any = {
      orgId: user.orgId,
    };

    if (user.role === UserRole.DEPT_MANAGER && user.deptId) {
      taskWhere.deptId = user.deptId;
    }

    // Fetch updates for the day
    const updates = await db.taskUpdate.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        task: taskWhere,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, deptId: true },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            department: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse blockers from JSON
    const updatesWithParsedBlockers = updates.map((update) => ({
      ...update,
      blockers: update.blockers ? JSON.parse(update.blockers) : [],
    }));

    // Group by department
    const byDepartment = new Map();
    updates.forEach((update) => {
      const deptId = update.task.department.id;
      const deptName = update.task.department.name;
      if (!byDepartment.has(deptId)) {
        byDepartment.set(deptId, {
          department: { id: deptId, name: deptName },
          updates: [],
          totalHours: 0,
          avgProgress: 0,
        });
      }
      const deptData = byDepartment.get(deptId);
      deptData.updates.push(update);
      deptData.totalHours += update.hours;
    });

    // Calculate average progress per department
    byDepartment.forEach((deptData) => {
      deptData.avgProgress = deptData.updates.length > 0
        ? Math.round(deptData.updates.reduce((sum, u) => sum + u.progress, 0) / deptData.updates.length)
        : 0;
    });

    // Group by user
    const byUser = new Map();
    updates.forEach((update) => {
      const userId = update.user.id;
      if (!byUser.has(userId)) {
        byUser.set(userId, {
          user: update.user,
          updates: [],
          totalHours: 0,
          avgProgress: 0,
        });
      }
      const userData = byUser.get(userId);
      userData.updates.push(update);
      userData.totalHours += update.hours;
    });

    // Calculate average progress per user
    byUser.forEach((userData) => {
      userData.avgProgress = userData.updates.length > 0
        ? Math.round(userData.updates.reduce((sum, u) => sum + u.progress, 0) / userData.updates.length)
        : 0;
    });

    // Find users who haven't submitted updates today
    let missedUpdates: any[] = [];
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      // Get all active users in the org
      const allUsers = await db.user.findMany({
        where: {
          orgId: user.orgId,
          status: 'ACTIVE',
        },
        select: { id: true, name: true, email: true, avatarUrl: true, deptId: true },
      });

      // Find users who submitted updates today
      const usersWithUpdates = new Set(updates.map((u) => u.userId));

      // Filter users without updates
      missedUpdates = allUsers
        .filter((u) => !usersWithUpdates.has(u.id))
        .map((u) => ({
          user: u,
          lastUpdate: null, // Could fetch last update date if needed
        }));
    } else if (user.role === UserRole.DEPT_MANAGER && user.deptId) {
      // Get all active users in the department
      const deptUsers = await db.user.findMany({
        where: {
          orgId: user.orgId,
          deptId: user.deptId,
          status: 'ACTIVE',
        },
        select: { id: true, name: true, email: true, avatarUrl: true, deptId: true },
      });

      // Find users who submitted updates today
      const usersWithUpdates = new Set(updates.map((u) => u.userId));

      // Filter users without updates
      missedUpdates = deptUsers
        .filter((u) => !usersWithUpdates.has(u.id))
        .map((u) => ({
          user: u,
          lastUpdate: null,
        }));
    }

    // Calculate overall summary
    const summary = {
      date: targetDate.toISOString().split('T')[0],
      totalUpdates: updates.length,
      totalHours: updates.reduce((sum, u) => sum + u.hours, 0),
      averageProgress: updates.length > 0
        ? Math.round(updates.reduce((sum, u) => sum + u.progress, 0) / updates.length)
        : 0,
      totalUsers: byUser.size,
      usersWithUpdates: byUser.size,
      usersMissedUpdates: missedUpdates.length,
      totalBlockers: updates.reduce((sum, u) => sum + (u.blockers ? JSON.parse(u.blockers).length : 0), 0),
    };

    // TODO: Send daily summary email to managers (mock for now)
    // TODO: Send missed update reminders to employees (mock for now)

    return NextResponse.json({
      summary,
      updates: updatesWithParsedBlockers,
      byDepartment: Array.from(byDepartment.values()),
      byUser: Array.from(byUser.values()),
      missedUpdates,
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily summary' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getDailySummary, {
  requireMinRole: UserRole.DEPT_MANAGER,
});
