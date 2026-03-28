import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const commentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  parentId: z.string().optional(),
  mentions: z.string().optional(),
});

// GET /api/tasks/[id]/comments - Get task comments
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

    const comments = await db.taskComment.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        replies: {
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
      },
      where: {
        parentId: null, // Only top-level comments
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Failed to fetch task comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task comments' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/[id]/comments - Create comment
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
    const result = commentSchema.safeParse(body);

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

    // Check if user is assigned to the task
    const isAssignee = task.assignees.some((a) => a.userId === user.id);
    const canComment = task.orgId === user.orgId &&
                      (user.role === UserRole.SUPER_ADMIN ||
                       user.role === UserRole.ADMIN ||
                       user.role === UserRole.DEPT_MANAGER ||
                       isAssignee);

    if (!canComment) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate parent comment if provided
    if (result.data.parentId) {
      const parentComment = await db.taskComment.findUnique({
        where: { id: result.data.parentId },
      });

      if (!parentComment || parentComment.taskId !== id) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }
    }

    const comment = await db.taskComment.create({
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

    return NextResponse.json({
      success: true,
      data: comment,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}

export { GET, POST };
