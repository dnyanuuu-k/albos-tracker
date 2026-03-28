import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { leaderboardSchema } from '@/lib/validations/dashboard';
import { UserRole, TaskStatus, UserStatus } from '@prisma/client';

// GET /api/dashboard/leaderboard - Get top performers
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = leaderboardSchema.parse({
      role: searchParams.get('role') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      period: searchParams.get('period') || 'month',
      limit: searchParams.get('limit') || '10',
      sortBy: searchParams.get('sortBy') || 'tasksCompleted',
    });

    const orgId = user.orgId;
    const userRole = user.role;
    const userDeptId = user.deptId;

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    switch (query.period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Build base query filters
    const taskFilter: any = {
      orgId,
      createdAt: { gte: startDate },
    };

    const userFilter: any = {
      orgId,
      status: UserStatus.ACTIVE,
    };

    // Apply role-based filtering
    if (userRole === UserRole.DEPARTMENT_MANAGER) {
      taskFilter.deptId = userDeptId;
      userFilter.deptId = userDeptId;
    } else if (query.departmentId) {
      taskFilter.deptId = query.departmentId;
      userFilter.deptId = query.departmentId;
    }

    // Get all users in scope
    const users = await db.user.findMany({
      where: userFilter,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        employeeId: true,
        role: true,
        deptId: true,
        department: {
          select: { name: true },
        },
      },
    });

    // Calculate metrics for each user
    const userMetrics = await Promise.all(
      users.map(async (u) => {
        const [assignedTasks, completedTasks, tasksOnTime, taskUpdates] = await Promise.all([
          // Total assigned tasks
          db.task.count({
            where: {
              ...taskFilter,
              assignees: { some: { userId: u.id, isActive: true } },
            },
          }),
          // Completed tasks
          db.task.count({
            where: {
              ...taskFilter,
              assignees: { some: { userId: u.id, isActive: true } },
              status: TaskStatus.COMPLETED,
            },
          }),
          // Tasks completed on time
          db.task.count({
            where: {
              ...taskFilter,
              assignees: { some: { userId: u.id, isActive: true } },
              status: TaskStatus.COMPLETED,
              completedAt: { lte: db.task.fields.dueDate },
            },
          }),
          // Task updates (for hours logged)
          db.taskUpdate.groupBy({
            by: ['userId'],
            where: {
              userId: u.id,
              createdAt: { gte: startDate },
            },
            _sum: { hours: true },
          }),
        ]);

        const totalHours = taskUpdates[0]?._sum?.hours || 0;
        const onTimeRate = completedTasks > 0 ? (tasksOnTime / completedTasks) * 100 : 0;

        return {
          id: u.id,
          name: u.name || 'Unknown',
          email: u.email,
          avatarUrl: u.avatarUrl,
          employeeId: u.employeeId,
          role: u.role,
          department: u.department?.name || 'Unassigned',
          tasksAssigned: assignedTasks,
          tasksCompleted: completedTasks,
          tasksOnTime,
          onTimeRate: Math.round(onTimeRate),
          hoursLogged: totalHours,
        };
      })
    );

    // Sort based on query parameter
    userMetrics.sort((a, b) => {
      switch (query.sortBy) {
        case 'tasksCompleted':
          return b.tasksCompleted - a.tasksCompleted;
        case 'tasksOnTime':
          return b.tasksOnTime - a.tasksOnTime;
        case 'hoursLogged':
          return b.hoursLogged - a.hoursLogged;
        default:
          return b.tasksCompleted - a.tasksCompleted;
      }
    });

    // Limit results
    const leaderboard = userMetrics.slice(0, query.limit);

    return NextResponse.json({
      success: true,
      data: {
        period: query.period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        sortBy: query.sortBy,
        leaderboard,
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
});
