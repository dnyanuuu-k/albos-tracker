import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { dashboardStatsSchema } from '@/lib/validations/dashboard';
import { UserRole, TaskStatus, UserStatus, TransferStatus } from '@prisma/client';

// GET /api/dashboard/stats - Get role-specific statistics
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = dashboardStatsSchema.parse({
      role: searchParams.get('role') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      userId: searchParams.get('userId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    const orgId = user.orgId;
    const userRole = user.role;
    const userDeptId = user.deptId;

    // Build base query filters based on role
    const userFilter: any = { orgId, status: UserStatus.ACTIVE };
    const taskFilter: any = { orgId };
    const transferFilter: any = { orgId };

    // Apply role-based filtering
    if (userRole === UserRole.DEPARTMENT_MANAGER) {
      taskFilter.deptId = userDeptId;
      userFilter.deptId = userDeptId;
      transferFilter.fromDeptId = userDeptId;
    } else if (userRole === UserRole.EMPLOYEE) {
      taskFilter.assignees = { some: { userId: user.id } };
      userFilter.id = user.id;
    }

    // Apply date filters if provided
    const dateFilter: any = {};
    if (query.startDate || query.endDate) {
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
    }

    // Execute queries in parallel
    const [
      totalUsers,
      totalDepartments,
      totalTasks,
      totalTransfers,
      tasksByStatus,
      tasksByPriority,
      completedTasks,
      overdueTasks,
      pendingTransfers,
      usersByRole,
      recentTasks,
    ] = await Promise.all([
      // Total users
      db.user.count({ where: userFilter }),

      // Total departments
      db.department.count({
        where: {
          orgId,
          ...(userRole === UserRole.DEPARTMENT_MANAGER ? { id: userDeptId } : {}),
          isArchived: false,
        },
      }),

      // Total tasks
      db.task.count({ where: taskFilter }),

      // Total transfers
      db.transfer.count({ where: transferFilter }),

      // Tasks by status
      db.task.groupBy({
        by: ['status'],
        where: taskFilter,
        _count: true,
      }),

      // Tasks by priority
      db.task.groupBy({
        by: ['priority'],
        where: taskFilter,
        _count: true,
      }),

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

      // Pending transfers
      db.transfer.count({
        where: {
          ...transferFilter,
          status: TransferStatus.PENDING,
          ...(userRole === UserRole.DEPARTMENT_MANAGER ? { toDeptId: userDeptId } : {}),
        },
      }),

      // Users by role
      db.user.groupBy({
        by: ['role'],
        where: { orgId, status: UserStatus.ACTIVE },
        _count: true,
      }),

      // Recent tasks
      db.task.findMany({
        where: taskFilter,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          department: { select: { name: true } },
          assignees: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            take: 3,
          },
        },
      }),
    ]);

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Get department names for task distribution (for admins and super admins)
    let taskDistributionByDepartment: any[] = [];
    let overdueByDepartment: any[] = [];

    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      const tasksByDepartment = await db.task.groupBy({
        by: ['deptId'],
        where: { orgId, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
        _count: true,
      });

      const departments = await db.department.findMany({
        where: { orgId, id: { in: tasksByDepartment.map((t: any) => t.deptId) } },
        select: { id: true, name: true },
      });

      taskDistributionByDepartment = tasksByDepartment.map((t: any) => ({
        departmentId: t.deptId,
        departmentName: departments.find((d) => d.id === t.deptId)?.name || 'Unknown',
        count: t._count,
      }));

      // Get overdue tasks by department
      const overdueTasksByDept = await db.task.groupBy({
        by: ['deptId'],
        where: {
          orgId,
          status: { in: [TaskStatus.TO_DO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
          dueDate: { lt: new Date() },
        },
        _count: true,
      });

      const overdueDepts = await db.department.findMany({
        where: { orgId, id: { in: overdueTasksByDept.map((t: any) => t.deptId) } },
        select: { id: true, name: true },
      });

      overdueByDepartment = overdueTasksByDept.map((t: any) => ({
        departmentId: t.deptId,
        departmentName: overdueDepts.find((d) => d.id === t.deptId)?.name || 'Unknown',
        overdueCount: t._count,
      }));
    }

    // Calculate completion rate trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const completionTrend = await db.task.groupBy({
      by: ['completedAt'],
      where: {
        ...taskFilter,
        status: TaskStatus.COMPLETED,
        completedAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });

    // Group by day
    const trendByDay: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendByDay[dateStr] = 0;
    }

    completionTrend.forEach((item) => {
      if (item.completedAt) {
        const dateStr = item.completedAt.toISOString().split('T')[0];
        if (trendByDay[dateStr] !== undefined) {
          trendByDay[dateStr] = item._count;
        }
      }
    });

    const trendData = Object.entries(trendByDay).map(([date, count]) => ({
      date,
      completed: count,
    }));

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          totalUsers,
          totalDepartments,
          totalTasks,
          totalTransfers,
          completionRate,
        },
        tasks: {
          byStatus: tasksByStatus.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
          }, {} as Record<string, number>),
          byPriority: tasksByPriority.reduce((acc, item) => {
            acc[item.priority] = item._count;
            return acc;
          }, {} as Record<string, number>),
          byDepartment: taskDistributionByDepartment,
          overdue: overdueTasks,
          overdueByDepartment,
          recent: recentTasks,
        },
        transfers: {
          total: totalTransfers,
          pending: pendingTransfers,
        },
        users: {
          byRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = item._count;
            return acc;
          }, {} as Record<string, number>),
        },
        trends: {
          completionRate: trendData,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
});
