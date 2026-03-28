import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { performanceMetricsSchema } from '@/lib/validations/dashboard';
import { UserRole, TaskStatus, UserStatus } from '@prisma/client';

// GET /api/dashboard/performance - Get performance metrics
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = performanceMetricsSchema.parse({
      userId: searchParams.get('userId') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      period: searchParams.get('period') || 'month',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    const orgId = user.orgId;
    const userRole = user.role;
    const userDeptId = user.deptId;

    // Calculate date range
    let startDate: Date;
    let endDate: Date = new Date();

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      startDate = new Date();
      switch (query.period) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }
    }

    // Build filters
    const taskFilter: any = {
      orgId,
      createdAt: { gte: startDate, lte: endDate },
    };

    const userFilter: any = {
      orgId,
      status: UserStatus.ACTIVE,
    };

    const updateFilter: any = {
      createdAt: { gte: startDate, lte: endDate },
    };

    // Apply role-based filtering
    if (userRole === UserRole.DEPARTMENT_MANAGER) {
      taskFilter.deptId = userDeptId;
      userFilter.deptId = userDeptId;
      updateFilter.task = {
        deptId: userDeptId,
      };
    } else if (userRole === UserRole.EMPLOYEE) {
      // Employees can only see their own performance unless they have a specific permission
      if (!query.userId || query.userId !== user.id) {
        userFilter.id = user.id;
        taskFilter.assignees = { some: { userId: user.id, isActive: true } };
        updateFilter.userId = user.id;
      }
    }

    // Apply additional filters
    if (userRole === UserRole.EMPLOYEE) {
      // Prevent employee from filtering by other users/departments
      if (query.userId && query.userId !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (query.departmentId && user.deptId && query.departmentId !== user.deptId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (query.userId) {
      userFilter.id = query.userId;
      taskFilter.assignees = { some: { userId: query.userId, isActive: true } };
      updateFilter.userId = query.userId;
    }

    if (query.departmentId) {
      taskFilter.deptId = query.departmentId;
      userFilter.deptId = query.departmentId;
    }

    // Fetch performance data
    const [totalTasks, completedTasks, overdueTasks, inProgressTasks, taskUpdates] = await Promise.all([
      // Total tasks
      db.task.count({ where: taskFilter }),

      // Completed tasks
      db.task.count({
        where: { ...taskFilter, status: TaskStatus.COMPLETED },
      }),

      // Overdue tasks
      db.task.count({
        where: {
          ...taskFilter,
          status: { in: [TaskStatus.TO_DO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
          dueDate: { lt: new Date() },
        },
      }),

      // In progress tasks
      db.task.count({
        where: { ...taskFilter, status: TaskStatus.IN_PROGRESS },
      }),

      // Task updates for hours and progress
      db.taskUpdate.findMany({
        where: updateFilter,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
    ]);

    // Calculate metrics
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const overdueRate = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

    const totalHoursLogged = taskUpdates.reduce((sum, update) => sum + (update.hours || 0), 0);
    const averageProgress = taskUpdates.length > 0
      ? Math.round(taskUpdates.reduce((sum, update) => sum + update.progress, 0) / taskUpdates.length)
      : 0;

    // Calculate average task completion time
    const completedTasksData = await db.task.findMany({
      where: {
        ...taskFilter,
        status: TaskStatus.COMPLETED,
        completedAt: { not: null },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
    });

    const avgCompletionDays = completedTasksData.length > 0
      ? Math.round(
          completedTasksData.reduce((sum, task) => {
            const days = task.completedAt
              ? (task.completedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)
              : 0;
            return sum + days;
          }, 0) / completedTasksData.length
        )
      : 0;

    // Group updates by day for trend
    const updatesByDay: { [key: string]: { hours: number; progress: number; count: number } } = {};
    taskUpdates.forEach((update) => {
      const dateStr = update.createdAt.toISOString().split('T')[0];
      if (!updatesByDay[dateStr]) {
        updatesByDay[dateStr] = { hours: 0, progress: 0, count: 0 };
      }
      updatesByDay[dateStr].hours += update.hours || 0;
      updatesByDay[dateStr].progress += update.progress;
      updatesByDay[dateStr].count += 1;
    });

    const trendData = Object.entries(updatesByDay)
      .map(([date, data]) => ({
        date,
        hoursLogged: data.hours,
        averageProgress: Math.round(data.progress / data.count),
        updates: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate consistency streak (consecutive days with updates)
    const sortedDates = Object.keys(updatesByDay).sort().reverse();
    let streak = 0;
    let currentDate = new Date();

    for (const dateStr of sortedDates) {
      const updateDate = new Date(dateStr);
      const diffDays = Math.floor((currentDate.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        streak++;
        currentDate = updateDate;
      } else {
        break;
      }
    }

    // Performance by user (for managers and admins)
    let performanceByUser: any[] = [];
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || userRole === UserRole.DEPARTMENT_MANAGER) {
      const users = await db.user.findMany({
        where: userFilter,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      });

      performanceByUser = await Promise.all(
        users.map(async (u) => {
          const [userTasks, userCompleted, userUpdates] = await Promise.all([
            db.task.count({
              where: {
                ...taskFilter,
                assignees: { some: { userId: u.id, isActive: true } },
              },
            }),
            db.task.count({
              where: {
                ...taskFilter,
                assignees: { some: { userId: u.id, isActive: true } },
                status: TaskStatus.COMPLETED,
              },
            }),
            db.taskUpdate.groupBy({
              by: ['userId'],
              where: {
                userId: u.id,
                createdAt: { gte: startDate, lte: endDate },
              },
              _sum: { hours: true },
            }),
          ]);

          return {
            userId: u.id,
            name: u.name || 'Unknown',
            avatarUrl: u.avatarUrl,
            tasksAssigned: userTasks,
            tasksCompleted: userCompleted,
            completionRate: userTasks > 0 ? Math.round((userCompleted / userTasks) * 100) : 0,
            hoursLogged: userUpdates[0]?._sum?.hours || 0,
          };
        })
      );

      performanceByUser.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTasks,
          completedTasks,
          overdueTasks,
          inProgressTasks,
          completionRate,
          overdueRate,
          totalHoursLogged,
          averageProgress,
          avgCompletionDays,
          consistencyStreak: streak,
        },
        trends: trendData,
        byUser: performanceByUser,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          label: query.period,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
});
