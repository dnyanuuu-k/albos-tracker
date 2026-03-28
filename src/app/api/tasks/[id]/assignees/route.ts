import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const assignSchema = z.object({
  userId: z.string(),
});

// POST /api/tasks/[id]/assignees - Assign user to task
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
    const result = assignSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    const task = await db.task.findUnique({
      where: { id: id },
      include: { assignees: true },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canAssign = user.role === UserRole.SUPER_ADMIN ||
                     user.role === UserRole.ADMIN ||
                     (user.role === UserRole.DEPT_MANAGER && task.deptId === user.deptId);

    if (!canAssign) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if user to assign exists and is in same org
    const assignee = await db.user.findFirst({
      where: {
        id: result.data.userId,
        orgId: user.orgId,
      },
    });

    if (!assignee) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already assigned
    const alreadyAssigned = task.assignees.some((a) => a.userId === result.data.userId);
    if (alreadyAssigned) {
      return NextResponse.json(
        { error: 'User already assigned to this task' },
        { status: 400 }
      );
    }

    // Create assignment
    const assignment = await db.taskAssignee.create({
      data: {
        taskId: id,
        userId: result.data.userId,
        assignedBy: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: assignment,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to assign user to task:', error);
    return NextResponse.json(
      { error: 'Failed to assign user to task' },
      { status: 500 }
    );
  }
}

export { POST };
