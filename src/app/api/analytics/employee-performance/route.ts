import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { employeePerformanceFilterSchema } from '@/lib/validations/analytics';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';

function getDateRange(range?: string, startDate?: string, endDate?: string) {
  const now = new Date();
  if (range === 'custom' && startDate && endDate) {
    return { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) };
  }
  switch (range) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'week': return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year': return { start: startOfYear(now), end: endOfYear(now) };
    default: return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
  }
}

// GET /api/analytics/employee-performance
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = employeePerformanceFilterSchema.parse({
      range: searchParams.get('range') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      userId: searchParams.get('userId') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
    });

    const canViewAll = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
    const canViewDept = user.role === 'DEPT_MANAGER';
    const dateRange = getDateRange(parsed.range, parsed.startDate, parsed.endDate);

    // Get employees
    const whereUser: any = {
      orgId: user.orgId,
      status: 'ACTIVE',
    };

    // EMPLOYEE should only see their own performance
    if (user.role === 'EMPLOYEE') {
      if (parsed.userId && parsed.userId !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (parsed.departmentId && user.deptId && parsed.departmentId !== user.deptId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      whereUser.id = user.id;
      if (user.deptId) whereUser.deptId = user.deptId;
    } else {

      if (parsed.departmentId) {
        if (canViewDept && parsed.departmentId !== user.deptId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        whereUser.deptId = parsed.departmentId;
      } else if (canViewDept) {
        whereUser.deptId = user.deptId;
      }

      if (parsed.userId) {
        if (canViewAll) {
          whereUser.id = parsed.userId;
        } else if (canViewDept) {
          // Dept managers can only view within their department (deptId already enforced above)
          whereUser.id = parsed.userId;
        }
      }
    }

    const employees = await db.user.findMany({
      where: whereUser,
      include: {
        department: true,
      },
    });

    // Get tasks and updates for each employee
    const performance = await Promise.all(
      employees.map(async (employee) => {
        const assignedTasks = await db.task.findMany({
          where: {
            orgId: user.orgId,
            assignees: { some: { userId: employee.id, isActive: true } },
            createdAt: { gte: dateRange.start, lte: dateRange.end },
          },
        });

        const completedTasks = assignedTasks.filter(t => t.status === 'COMPLETED');
        const overdueTasks = assignedTasks.filter(t => t.status === 'OVERDUE');

        const taskUpdates = await db.taskUpdate.findMany({
          where: {
            userId: employee.id,
            createdAt: { gte: dateRange.start, lte: dateRange.end },
          },
        });

        const totalHours = taskUpdates.reduce((sum, u) => sum + u.hours, 0);
        const avgProgress = taskUpdates.length > 0
          ? taskUpdates.reduce((sum, u) => sum + u.progress, 0) / taskUpdates.length
          : 0;

        // Calculate on-time delivery
        const onTimeTasks = completedTasks.filter(t => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate));

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          avatarUrl: employee.avatarUrl,
          department: employee.department?.name,
          role: employee.role,
          tasksAssigned: assignedTasks.length,
          tasksCompleted: completedTasks.length,
          tasksOverdue: overdueTasks.length,
          hoursLogged: totalHours,
          avgProgress: avgProgress.toFixed(1),
          onTimeDelivery: completedTasks.length > 0
            ? ((onTimeTasks.length / completedTasks.length) * 100).toFixed(1)
            : 0,
          onTimeTasks: onTimeTasks.length,
        };
      })
    );

    // Sort results
    const sortField = parsed.sort || 'tasksCompleted';
    const sortOrder = parsed.order || 'desc';
    performance.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a] as number;
      const bVal = b[sortField as keyof typeof b] as number;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Calculate team averages
    const teamAvg = {
      tasksCompleted: (performance.reduce((sum, p) => sum + p.tasksCompleted, 0) / performance.length).toFixed(1),
      hoursLogged: (performance.reduce((sum, p) => sum + p.hoursLogged, 0) / performance.length).toFixed(1),
      avgProgress: (performance.reduce((sum, p) => sum + parseFloat(p.avgProgress), 0) / performance.length).toFixed(1),
      onTimeDelivery: (performance.reduce((sum, p) => sum + parseFloat(p.onTimeDelivery), 0) / performance.length).toFixed(1),
    };

    return NextResponse.json({
      teamAverage: teamAvg,
      employees: performance,
      totalEmployees: performance.length,
    });
  } catch (error: any) {
    console.error('Employee performance analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch employee performance analytics' },
      { status: 500 }
    );
  }
});
