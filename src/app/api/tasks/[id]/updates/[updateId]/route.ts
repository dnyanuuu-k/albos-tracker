import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { Permission, hasPermission } from '@/lib/auth/rbac';

// PUT /api/tasks/:id/updates/:updateId - Update an update
async function updateTaskUpdate(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const { id: taskId, updateId } = await params;
    const user = req.user!;

    // Validate request body
    const body = await req.json();
    const { updateTaskUpdateSchema, UpdateTaskUpdateInput } = await import('@/lib/validations/task');
    const validatedData: UpdateTaskUpdateInput = updateTaskUpdateSchema.parse(body);

    // Verify update exists
    const existingUpdate = await db.taskUpdate.findUnique({
      where: { id: updateId },
      include: { task: true },
    });

    if (!existingUpdate) {
      return NextResponse.json(
        { error: 'Update not found' },
        { status: 404 }
      );
    }

    // Check if update belongs to the specified task
    if (existingUpdate.taskId !== taskId) {
      return NextResponse.json(
        { error: 'Update does not belong to this task' },
        { status: 400 }
      );
    }

    // Check if user can edit this update
    const isOwner = existingUpdate.userId === user.id;
    const canEditAny = hasPermission(user.role, Permission.TASK_EDIT_ANY);

    if (!isOwner && !canEditAny) {
      return NextResponse.json(
        { error: 'You can only edit your own updates' },
        { status: 403 }
      );
    }

    // Calculate hours difference to update task's actual hours
    let hoursDiff = 0;
    if (validatedData.hours !== undefined) {
      hoursDiff = validatedData.hours - existingUpdate.hours;
    }

    // Prepare update data
    const updateData: any = {};
    if (validatedData.progress !== undefined) updateData.progress = validatedData.progress;
    if (validatedData.hours !== undefined) updateData.hours = validatedData.hours;
    if (validatedData.note !== undefined) updateData.note = validatedData.note;
    if (validatedData.blockers !== undefined) {
      updateData.blockers = validatedData.blockers.length > 0
        ? JSON.stringify(validatedData.blockers)
        : null;
    }

    // Update the update
    const updatedUpdate = await db.taskUpdate.update({
      where: { id: updateId },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Update task's actual hours if hours changed
    if (hoursDiff !== 0) {
      await db.task.update({
        where: { id: taskId },
        data: {
          actualHours: Math.max(0, (existingUpdate.task.actualHours || 0) + hoursDiff),
        },
      });
    }

    // Parse blockers from JSON
    const updateWithParsedBlockers = {
      ...updatedUpdate,
      blockers: updatedUpdate.blockers ? JSON.parse(updatedUpdate.blockers) : [],
    };

    return NextResponse.json(updateWithParsedBlockers);
  } catch (error: any) {
    console.error('Error updating task update:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update task update' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:id/updates/:updateId - Delete an update
async function deleteTaskUpdate(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const { id: taskId, updateId } = await params;
    const user = req.user!;

    // Verify update exists
    const existingUpdate = await db.taskUpdate.findUnique({
      where: { id: updateId },
      include: { task: true },
    });

    if (!existingUpdate) {
      return NextResponse.json(
        { error: 'Update not found' },
        { status: 404 }
      );
    }

    // Check if update belongs to the specified task
    if (existingUpdate.taskId !== taskId) {
      return NextResponse.json(
        { error: 'Update does not belong to this task' },
        { status: 400 }
      );
    }

    // Check if user can delete this update
    const isOwner = existingUpdate.userId === user.id;
    const canDeleteAny = hasPermission(user.role, Permission.TASK_DELETE_ANY);

    if (!isOwner && !canDeleteAny) {
      return NextResponse.json(
        { error: 'You can only delete your own updates' },
        { status: 403 }
      );
    }

    // Delete the update
    await db.taskUpdate.delete({
      where: { id: updateId },
    });

    // Update task's actual hours by subtracting the deleted hours
    await db.task.update({
      where: { id: taskId },
      data: {
        actualHours: Math.max(0, (existingUpdate.task.actualHours || 0) - existingUpdate.hours),
      },
    });

    return NextResponse.json({ message: 'Update deleted successfully' });
  } catch (error) {
    console.error('Error deleting task update:', error);
    return NextResponse.json(
      { error: 'Failed to delete task update' },
      { status: 500 }
    );
  }
}

export const PUT = withAuth(updateTaskUpdate, {
  requirePermission: Permission.TASK_EDIT_OWN,
});

export const DELETE = withAuth(deleteTaskUpdate, {
  requirePermission: Permission.TASK_EDIT_OWN,
});
