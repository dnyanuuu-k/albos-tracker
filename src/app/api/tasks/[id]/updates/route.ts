import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const updateSchema = z.object({
  progress: z.number().min(0).max(100),
  hours: z.number().min(0),
  note: z.string().optional(),
  blockers: z.string().optional(),
});

// GET /api/tasks/[id]/updates - Get task updates
async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const task = await db.task.findUnique({
      where: { id },
      include: { assignees: true },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canView = task.orgId === user.orgId &&
                    (user.role === UserRole.SUPER_ADMIN ||
                     user.role === UserRole.ADMIN ||
                     user.role === UserRole.DEPT_MANAGER ||
                     task.assignees.some((a) => a.userId === user.id));

    if (!canView) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const updates = await db.taskUpdate.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: updates,
    });
  } catch (error) {
    console.error('Failed to fetch task updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task updates' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/[id]/updates - Create task update
async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    const task = await db.task.findUnique({
      where: { id },
      include: { assignees: true },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check if user is assigned to the task
    const isAssignee = task.assignees.some((a) => a.userId === user.id);
    const canUpdate = user.role === UserRole.SUPER_ADMIN ||
                     user.role === UserRole.ADMIN ||
                     (user.role === UserRole.DEPT_MANAGER && task.deptId === user.deptId) ||
                     isAssignee;

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const update = await db.taskUpdate.create({
      data: {
        taskId: id,
        userId: user.id,
        ...result.data,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update task's actual hours total
    const allUpdates = await db.taskUpdate.findMany({
      where: { taskId: id },
    });
    const totalHours = allUpdates.reduce((sum, u) => sum + u.hours, 0);

    await db.task.update({
      where: { id },
      data: { actualHours: totalHours },
    });

    return NextResponse.json({
      success: true,
      data: update,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create task update:', error);
    return NextResponse.json(
      { error: 'Failed to create task update' },
      { status: 500 }
    );
  }
}

export { GET, POST };
