import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, TaskStatus } from '@prisma/client';

function bucketTask(status: TaskStatus, dueDate: Date | null): keyof DeptTaskBuckets {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  const now = new Date();
  if (
    dueDate &&
    new Date(dueDate) < now &&
    status !== 'COMPLETED' &&
    status !== 'CANCELLED'
  ) {
    return 'overdue';
  }
  if (
    status === 'IN_PROGRESS' ||
    status === 'IN_REVIEW' ||
    status === 'APPROVED'
  ) {
    return 'inProgress';
  }
  return 'pending';
}

type DeptTaskBuckets = {
  assigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  cancelled: number;
};

function emptyBuckets(): DeptTaskBuckets {
  return {
    assigned: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0,
    cancelled: 0,
  };
}

/** GET /api/departments/[id]/overview — members + per-member task stats + dept task rollups */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deptId } = await params;
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const department = await db.department.findUnique({
      where: { id: deptId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        parent: { select: { id: true, name: true, code: true } },
        _count: { select: { users: true, tasks: true } },
      },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (user.role === UserRole.EMPLOYEE) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (user.role === UserRole.DEPT_MANAGER && user.deptId !== department.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (user.role !== UserRole.SUPER_ADMIN && department.orgId !== user.orgId) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const members = await db.user.findMany({
      where: { deptId, orgId: department.orgId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        employeeId: true,
        designation: true,
      },
      orderBy: { name: 'asc' },
    });

    const deptTasks = await db.task.findMany({
      where: { deptId, orgId: department.orgId },
      select: {
        id: true,
        status: true,
        dueDate: true,
        title: true,
        priority: true,
        updatedAt: true,
        assignees: {
          where: { isActive: true },
          select: { userId: true },
        },
      },
    });

    const deptRollup = emptyBuckets();
    const memberStats = new Map<string, DeptTaskBuckets>();

    for (const m of members) {
      memberStats.set(m.id, emptyBuckets());
    }

    for (const task of deptTasks) {
      const b = bucketTask(task.status, task.dueDate);
      deptRollup.assigned++;
      deptRollup[b]++;

      for (const a of task.assignees) {
        if (!memberStats.has(a.userId)) {
          memberStats.set(a.userId, emptyBuckets());
        }
        const mb = memberStats.get(a.userId)!;
        mb.assigned++;
        mb[b]++;
      }
    }

    const recentTasks = await db.task.findMany({
      where: { deptId, orgId: department.orgId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        updatedAt: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignees: {
          where: { isActive: true },
          select: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    const memberRows = members.map((m) => ({
      ...m,
      taskStats: memberStats.get(m.id) ?? emptyBuckets(),
    }));

    return NextResponse.json({
      success: true,
      department,
      departmentTaskStats: deptRollup,
      members: memberRows,
      recentTasks,
    });
  } catch (error) {
    console.error('Department overview error:', error);
    return NextResponse.json(
      { error: 'Failed to load department overview' },
      { status: 500 }
    );
  }
}
