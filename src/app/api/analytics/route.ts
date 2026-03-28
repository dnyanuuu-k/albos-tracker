import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, TaskStatus } from '@prisma/client';

// GET /api/analytics - Get analytics data
async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const deptId = searchParams.get('deptId');

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Build department filter based on user role
    const deptFilter: any = {};
    if (user.role === UserRole.DEPT_MANAGER) {
      deptFilter.deptId = user.deptId;
    } else if (deptId && (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN)) {
      deptFilter.deptId = deptId;
    }

    // EMPLOYEE should only see their own tasks
    const employeeTaskFilter: any =
      user.role === UserRole.EMPLOYEE
        ? {
            assignees: {
              some: {
                userId: user.id,
              },
            },
          }
        : {};

    // Fetch all relevant data in parallel
    const [
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      completedTasks,
      overdueTasks,
      departmentStats,
      topPerformers,
    ] = await Promise.all([
      // Total tasks
      db.task.count({
        where: {
          orgId: user.orgId,
          ...deptFilter,
          ...employeeTaskFilter,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
      }),

      // Tasks by status
      db.task.groupBy({
        by: ['status'],
        where: {
          orgId: user.orgId,
          ...deptFilter,
          ...employeeTaskFilter,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        _count: true,
      }),

      // Tasks by priority
      db.task.groupBy({
        by: ['priority'],
        where: {
          orgId: user.orgId,
          ...deptFilter,
          ...employeeTaskFilter,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        _count: true,
      }),

      // Completed tasks
      db.task.count({
        where: {
          orgId: user.orgId,
          ...deptFilter,
          ...employeeTaskFilter,
          status: TaskStatus.COMPLETED,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
      }),

      // Overdue tasks
      db.task.count({
        where: {
          orgId: user.orgId,
          ...deptFilter,
          ...employeeTaskFilter,
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
          dueDate: { lt: new Date() },
        },
      }),

      // Department stats (only for admins and super admins)
      user.role !== UserRole.EMPLOYEE
        ? db.department.findMany({
            where: {
              orgId: user.orgId,
              ...(user.role === UserRole.DEPT_MANAGER ? { id: user.deptId } : {}),
            },
            select: {
              id: true,
              name: true,
              code: true,
              _count: {
                select: {
                  users: true,
                  tasks: true,
                },
              },
            },
          })
        : Promise.resolve([]),

      // Top performers
      db.taskUpdate.groupBy({
        by: ['userId'],
        where: {
          task: {
            orgId: user.orgId,
            ...deptFilter,
          },
          ...(user.role === UserRole.EMPLOYEE ? { userId: user.id } : {}),
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        _count: true,
        _sum: {
          hours: true,
        },
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    // Get user details for top performers
    const performerIds = topPerformers.map((p) => p.userId);
    const performers = await db.user.findMany({
      where: {
        id: { in: performerIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: {
          select: {
            name: true,
          },
        },
      },
    });

    // Merge performer data
    const topPerformersWithData = topPerformers.map((perf) => {
      const userData = performers.find((u) => u.id === perf.userId);
      return {
        userId: perf.userId,
        name: userData?.name || 'Unknown',
        email: userData?.email,
        avatarUrl: userData?.avatarUrl,
        department: userData?.department?.name,
        updatesCount: perf._count,
        totalHours: perf._sum.hours || 0,
      };
    });

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalTasks,
          completedTasks,
          overdueTasks,
          completionRate,
        },
        tasksByStatus: tasksByStatus.map((item) => ({
          status: item.status,
          count: item._count,
        })),
        tasksByPriority: tasksByPriority.map((item) => ({
          priority: item.priority,
          count: item._count,
        })),
        departmentStats,
        topPerformers: topPerformersWithData,
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export { GET };
