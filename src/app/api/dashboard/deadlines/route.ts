import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { deadlinesSchema } from '@/lib/validations/dashboard';
import { UserRole, TaskStatus, TaskPriority } from '@prisma/client';

// GET /api/dashboard/deadlines - Get upcoming deadlines
export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = deadlinesSchema.parse({
      days: searchParams.get('days') || '14',
      departmentId: searchParams.get('departmentId') || undefined,
      userId: searchParams.get('userId') || undefined,
      priority: searchParams.get('priority') || 'all',
    });

    const orgId = user.orgId;
    const userRole = user.role;
    const userDeptId = user.deptId;

    // Calculate date range
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + query.days);

    // Build base query filters
    const taskFilter: any = {
      orgId,
      dueDate: {
        gte: now,
        lte: endDate,
      },
      status: {
        notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
      },
    };

    // Apply role-based filtering
    if (userRole === UserRole.DEPARTMENT_MANAGER) {
      taskFilter.deptId = userDeptId;
    } else if (userRole === UserRole.EMPLOYEE) {
      taskFilter.assignees = { some: { userId: user.id, isActive: true } };
    }

    // Apply additional filters
    if (userRole === UserRole.EMPLOYEE) {
      if (query.userId && query.userId !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (query.departmentId && user.deptId && query.departmentId !== user.deptId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (query.departmentId) {
      taskFilter.deptId = query.departmentId;
    }

    if (query.userId) {
      taskFilter.assignees = { some: { userId: query.userId, isActive: true } };
    }

    if (query.priority !== 'all') {
      taskFilter.priority = query.priority;
    }

    // Fetch upcoming deadlines
    const upcomingTasks = await db.task.findMany({
      where: taskFilter,
      orderBy: { dueDate: 'asc' },
      include: {
        department: {
          select: { id: true, name: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        creator: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate days remaining and urgency
    const deadlinesWithUrgency = upcomingTasks.map((task) => {
      const daysRemaining = Math.ceil((task.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const hoursRemaining = Math.ceil((task.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60));

      let urgency = 'normal';
      if (daysRemaining <= 1) {
        urgency = 'critical';
      } else if (daysRemaining <= 3) {
        urgency = 'high';
      } else if (daysRemaining <= 7) {
        urgency = 'medium';
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        daysRemaining,
        hoursRemaining,
        urgency,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        department: task.department,
        assignees: task.assignees.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          avatarUrl: a.user.avatarUrl,
        })),
        creator: task.creator,
      };
    });

    // Group by urgency
    const groupedDeadlines = {
      critical: deadlinesWithUrgency.filter((d) => d.urgency === 'critical'),
      high: deadlinesWithUrgency.filter((d) => d.urgency === 'high'),
      medium: deadlinesWithUrgency.filter((d) => d.urgency === 'medium'),
      normal: deadlinesWithUrgency.filter((d) => d.urgency === 'normal'),
    };

    return NextResponse.json({
      success: true,
      data: {
        deadlines: deadlinesWithUrgency,
        grouped: groupedDeadlines,
        summary: {
          total: deadlinesWithUrgency.length,
          critical: groupedDeadlines.critical.length,
          high: groupedDeadlines.high.length,
          medium: groupedDeadlines.medium.length,
          normal: groupedDeadlines.normal.length,
        },
        dateRange: {
          from: now.toISOString(),
          to: endDate.toISOString(),
          days: query.days,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching deadlines:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deadlines' },
      { status: 500 }
    );
  }
});
