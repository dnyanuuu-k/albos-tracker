import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { Permission, hasPermission } from '@/lib/auth/rbac';

// DELETE /api/tasks/:id/assignees/:userId - Remove assignee from task
async function removeAssignee(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id: taskId, userId: targetUserId } = await params;
    const user = req.user!;

    // Check if user has permission to assign tasks
    if (!hasPermission(user.role as any, Permission.TASK_ASSIGN)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove assignees' },
        { status: 403 }
      );
    }

    // Fetch task
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        orgId: true,
        deptId: true,
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

    // Find the assignment
    const assignment = await db.taskAssignee.findUnique({
      where: {
        taskId_userId: {
          taskId,
          userId: targetUserId,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Delete the assignment
    await db.taskAssignee.delete({
      where: { id: assignment.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Assignee removed successfully',
    });
  } catch (error) {
    console.error('Error removing assignee:', error);
    return NextResponse.json(
      { error: 'Failed to remove assignee' },
      { status: 500 }
    );
  }
}

export const DELETE = withAuth(removeAssignee, {
  requirePermission: Permission.TASK_ASSIGN,
});
