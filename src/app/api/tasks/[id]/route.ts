import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, TaskStatus, TaskPriority } from '@prisma/client';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  actualHours: z.number().optional(),
});

// GET /api/tasks/[id] - Get task details
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
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            designation: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                designation: true,
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
        updates: {
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
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        subtasks: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
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

    // Normalize tags for the frontend.
    // DB stores JSON array as a string; UI expects a string[].
    const parsedTask = (() => {
      const raw = (task as any).tags;
      if (!raw) return { ...task, tags: [] };
      if (Array.isArray(raw)) return { ...task, tags: raw };
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return { ...task, tags: Array.isArray(parsed) ? parsed : [] };
        } catch {
          return { ...task, tags: [] };
        }
      }
      return { ...task, tags: [] };
    })();

    return NextResponse.json({
      success: true,
      data: parsedTask,
    });
  } catch (error) {
    console.error('Failed to fetch task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] - Update task
async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Check if user can edit
    const isCreator = task.creatorId === user.id;
    const isAssignee = task.assignees.some((a) => a.userId === user.id && a.isActive);
    const canEdit = user.role === UserRole.SUPER_ADMIN ||
                    user.role === UserRole.ADMIN ||
                    (user.role === UserRole.DEPT_MANAGER && task.deptId === user.deptId) ||
                    isAssignee ||
                    isCreator;

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = updateTaskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    const updateData: any = { ...result.data };

    // Parse dates
    if (updateData.dueDate !== undefined) {
      updateData.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }

    // Status: align timestamps with current status (same rules as /status route)
    if (updateData.status !== undefined) {
      const s = updateData.status;
      if (s !== TaskStatus.COMPLETED) {
        updateData.completedAt = null;
      } else {
        updateData.completedAt = new Date();
      }
      if (s !== TaskStatus.APPROVED) {
        updateData.approvedAt = null;
        updateData.approvedBy = null;
      } else {
        updateData.approvedAt = new Date();
        updateData.approvedBy = user.id;
      }
      if (s !== TaskStatus.REJECTED) {
        updateData.rejectedBy = null;
        updateData.rejectedReason = null;
      } else {
        updateData.rejectedBy = user.id;
      }
    }

    const updatedTask = await db.task.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete task
async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Only admins, super admins, and creator can delete
    const canDelete = user.role === UserRole.SUPER_ADMIN ||
                     user.role === UserRole.ADMIN ||
                     task.creatorId === user.id;

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    await db.task.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}

export { GET, PUT, DELETE };
