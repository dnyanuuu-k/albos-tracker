import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { taskDistributionFilterSchema } from '@/lib/validations/analytics';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';

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
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
  }
}

// GET /api/analytics/task-distribution
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = taskDistributionFilterSchema.parse({
      range: searchParams.get('range') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      groupBy: searchParams.get('groupBy') || undefined,
    });

    const canViewAll = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
    const canViewDept = user.role === 'DEPT_MANAGER';

    const dateRange = getDateRange(parsed.range, parsed.startDate, parsed.endDate);

    const where: any = {
      orgId: user.orgId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    // EMPLOYEE should only see their own assigned tasks
    if (user.role === 'EMPLOYEE') {
      if (
        parsed.departmentId &&
        user.deptId &&
        parsed.departmentId !== user.deptId
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      where.assignees = { some: { userId: user.id, isActive: true } };

      // Optional: keep the scope consistent with their department
      if (user.deptId) {
        where.deptId = user.deptId;
      }
    }

    if (parsed.departmentId) {
      if (user.role === 'EMPLOYEE') {
        // already validated + already constrained above
      } else if (canViewDept) {
        if (parsed.departmentId !== user.deptId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        where.deptId = parsed.departmentId;
      } else if (canViewAll) {
        where.deptId = parsed.departmentId;
      }
    } else if (canViewDept) {
      where.deptId = user.deptId;
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        department: true,
        assignees: { include: { user: true } },
      },
    });

    const groupBy = parsed.groupBy || 'status';
    let distribution: any[] = [];

    switch (groupBy) {
      case 'status':
        const statusCounts: Record<string, number> = {};
        tasks.forEach(t => {
          statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        });
        distribution = Object.entries(statusCounts).map(([name, value]) => ({
          name: name.replace('_', ' '),
          value,
          percentage: ((value / tasks.length) * 100).toFixed(1),
        }));
        break;

      case 'priority':
        const priorityCounts: Record<string, number> = {};
        tasks.forEach(t => {
          priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
        });
        distribution = Object.entries(priorityCounts).map(([name, value]) => ({
          name,
          value,
          percentage: ((value / tasks.length) * 100).toFixed(1),
        }));
        break;

      case 'department':
        const deptCounts: Record<string, { name: string; count: number }> = {};
        tasks.forEach(t => {
          const deptName = t.department?.name || 'Unassigned';
          if (!deptCounts[t.deptId]) {
            deptCounts[t.deptId] = { name: deptName, count: 0 };
          }
          deptCounts[t.deptId].count++;
        });
        distribution = Object.entries(deptCounts).map(([id, data]) => ({
          id,
          name: data.name,
          value: data.count,
          percentage: ((data.count / tasks.length) * 100).toFixed(1),
        }));
        break;

      case 'category':
        const categoryCounts: Record<string, number> = {};
        tasks.forEach(t => {
          const category = t.category || 'Uncategorized';
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        distribution = Object.entries(categoryCounts)
          .map(([name, value]) => ({
            name,
            value,
            percentage: ((value / tasks.length) * 100).toFixed(1),
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10); // Top 10 categories
        break;
    }

    return NextResponse.json({
      totalTasks: tasks.length,
      groupBy,
      distribution,
    });
  } catch (error: any) {
    console.error('Task distribution analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task distribution analytics' },
      { status: 500 }
    );
  }
});
