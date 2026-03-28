import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { Permission, hasPermission } from '@/lib/auth/rbac';
import { updateTaskStatusSchema, UpdateTaskStatusInput } from '@/lib/validations/task';
import { TaskStatus } from '@prisma/client';

// PATCH /api/tasks/:id/status - Update task status
async function updateTaskStatus(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = req.user!;
    const { id } = await params;
    const taskId = id;

    // Validate request body
    const body: UpdateTaskStatusInput = await req.json();
    const validatedData = updateTaskStatusSchema.parse(body);

    // Fetch current task
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        orgId: true,
        deptId: true,
        status: true,
        creatorId: true,
        actualHours: true,
        assignees: {
          where: { userId: user.id, isActive: true },
          select: { id: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check organization access
    if (task.orgId !== user.orgId) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check if user can modify this task
    const isCreator = task.creatorId === user.id;
    const isAssignee = task.assignees.length > 0;
    const canEditAny = hasPermission(user.role, Permission.TASK_EDIT_ANY);
    const canEditOwn = hasPermission(user.role, Permission.TASK_EDIT_OWN);

    if (!canEditAny && !((isCreator || isAssignee) && canEditOwn)) {
      return NextResponse.json(
        { error: 'Cannot modify this task' },
        { status: 403 }
      );
    }

    // Prepare update data (any status allowed; timestamps adjusted below)
    const updateData: any = {
      status: validatedData.status,
    };

    // Clear terminal / review fields when leaving those states
    if (validatedData.status !== TaskStatus.COMPLETED) {
      updateData.completedAt = null;
    }
    if (validatedData.status !== TaskStatus.APPROVED) {
      updateData.approvedAt = null;
      updateData.approvedBy = null;
    }
    if (validatedData.status !== TaskStatus.REJECTED) {
      updateData.rejectedBy = null;
      updateData.rejectedReason = null;
    }

    // Set timestamps based on status
    if (validatedData.status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
      if (task.actualHours == null) {
        const taskWithHours = await db.task.findUnique({
          where: { id: taskId },
          select: { estimatedHours: true },
        });
        if (taskWithHours?.estimatedHours != null) {
          updateData.actualHours = taskWithHours.estimatedHours;
        }
      }
    }

    if (validatedData.status === TaskStatus.APPROVED) {
      updateData.approvedAt = new Date();
      updateData.approvedBy = user.id;
    }

    if (validatedData.status === TaskStatus.REJECTED) {
      updateData.rejectedBy = user.id;
      if (validatedData.reason) {
        updateData.rejectedReason = validatedData.reason;
      }
    }

    // Update task status
    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignees: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Parse tags from JSON
    const taskWithParsedTags = {
      ...updatedTask,
      tags: updatedTask.tags ? JSON.parse(updatedTask.tags) : [],
    };

    // TODO: Create notification for all assignees about status change
    // TODO: Create audit log

    return NextResponse.json(taskWithParsedTags);
  } catch (error: any) {
    console.error('Error updating task status:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update task status' },
      { status: 500 }
    );
  }
}

export const PATCH = withAuth(updateTaskStatus, {
  requirePermission: Permission.TASK_EDIT_OWN,
});

export const PUT = withAuth(updateTaskStatus, {
  requirePermission: Permission.TASK_EDIT_OWN,
});
