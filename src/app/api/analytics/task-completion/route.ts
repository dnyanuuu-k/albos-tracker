import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { taskCompletionFilterSchema } from '@/lib/validations/analytics';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from 'date-fns';

// Helper function to get date range
function getDateRange(range?: string, startDate?: string, endDate?: string) {
  const now = new Date();

  if (range === 'custom' && startDate && endDate) {
    return {
      start: startOfDay(new Date(startDate)),
      end: endOfDay(new Date(endDate)),
    };
  }

  switch (range) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    case 'week':
      return {
        start: startOfWeek(now),
        end: endOfWeek(now),
      };
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case 'quarter':
      return {
        start: startOfQuarter(now),
        end: endOfQuarter(now),
      };
    case 'year':
      return {
        start: startOfYear(now),
        end: endOfYear(now),
      };
    default:
      // Default to last 30 days
      return {
        start: startOfDay(subDays(now, 30)),
        end: endOfDay(now),
      };
  }
}

// Helper function to group data by date
function groupByDate(
  tasks: any[],
  groupBy: 'day' | 'week' | 'month',
  startDate: Date,
  endDate: Date
) {
  const grouped: Record<string, { completed: number; created: number }> = {};

  // Initialize all dates in range
  let current = new Date(startDate);
  while (current <= endDate) {
    let key: string;
    if (groupBy === 'day') {
      key = format(current, 'yyyy-MM-dd');
      current = new Date(current.setDate(current.getDate() + 1));
    } else if (groupBy === 'week') {
      key = format(startOfWeek(current), 'yyyy-ww');
      current = new Date(current.setDate(current.getDate() + 7));
    } else {
      key = format(current, 'yyyy-MM');
      current = new Date(current.setMonth(current.getMonth() + 1));
    }
    grouped[key] = { completed: 0, created: 0 };
  }

  // Group tasks
  for (const task of tasks) {
    let key: string;
    const taskDate = new Date(task.completedAt || task.createdAt);

    if (groupBy === 'day') {
      key = format(taskDate, 'yyyy-MM-dd');
    } else if (groupBy === 'week') {
      key = format(startOfWeek(taskDate), 'yyyy-ww');
    } else {
      key = format(taskDate, 'yyyy-MM');
    }

    if (grouped[key]) {
      if (task.completedAt) {
        grouped[key].completed++;
      }
      grouped[key].created++;
    }
  }

  return Object.entries(grouped).map(([date, data]) => ({
    date,
    ...data,
    completionRate: data.created > 0 ? ((data.completed / data.created) * 100).toFixed(1) : 0,
  }));
}

// GET /api/analytics/task-completion
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = taskCompletionFilterSchema.parse({
      range: searchParams.get('range') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      userId: searchParams.get('userId') || undefined,
      groupBy: searchParams.get('groupBy') || undefined,
    });

    // Check permissions
    const canViewAll = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
    const canViewDept = user.role === 'DEPT_MANAGER';

    // EMPLOYEE should only see their own tasks (ignore department filters)
    if (user.role === 'EMPLOYEE') {
      if (parsed.departmentId && user.deptId && parsed.departmentId !== user.deptId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (parsed.userId && parsed.userId !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Build query
    const where: any = {
      orgId: user.orgId,
      createdAt: {
        gte: getDateRange(parsed.range, parsed.startDate, parsed.endDate).start,
        lte: getDateRange(parsed.range, parsed.startDate, parsed.endDate).end,
      },
    };

    if (parsed.departmentId) {
      if (canViewDept) {
        if (parsed.departmentId !== user.deptId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        where.deptId = parsed.departmentId;
      }
      // EMPLOYEE: department filters are validated above and we do not apply arbitrary deptId here.
      // Admin/Super Admin: allow applying departmentId.
      if (canViewAll) {
        where.deptId = parsed.departmentId;
      }
    } else if (canViewDept) {
      where.deptId = user.deptId;
    } else if (user.role === 'EMPLOYEE') {
      // Keep employee constrained to their department if available.
      if (user.deptId) where.deptId = user.deptId;
    }

    if (user.role === 'EMPLOYEE') {
      where.assignees = { some: { userId: user.id } };
    } else if (parsed.userId) {
      where.assignees = {
        some: {
          userId: parsed.userId,
        },
      };
    }

    // Fetch tasks
    const tasks = await db.task.findMany({
      where,
      include: {
        assignees: true,
      },
    });

    // Calculate completion rate
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const overdueTasks = tasks.filter(t => t.status === 'OVERDUE').length;

    // Group by date
    const dateRange = getDateRange(parsed.range, parsed.startDate, parsed.endDate);
    const groupedData = groupByDate(tasks, parsed.groupBy || 'day', dateRange.start, dateRange.end);

    // Calculate average completion time
    const completedTasksWithDates = tasks.filter(t => t.completedAt && t.createdAt);
    const avgCompletionTime = completedTasksWithDates.length > 0
      ? completedTasksWithDates.reduce((acc, t) => {
          const created = new Date(t.createdAt).getTime();
          const completed = new Date(t.completedAt!).getTime();
          return acc + (completed - created);
        }, 0) / completedTasksWithDates.length
      : 0;

    return NextResponse.json({
      summary: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0,
        avgCompletionTime: Math.round(avgCompletionTime / (1000 * 60 * 60 * 24)), // days
      },
      timeline: groupedData,
    });
  } catch (error: any) {
    console.error('Task completion analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task completion analytics' },
      { status: 500 }
    );
  }
});
