import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { canViewUser } from '@/lib/auth/rbac';
import { updateFilterSchema, UpdateFilterInput } from '@/lib/validations/task';

// GET /api/users/:id/updates - Get all updates by a user (with filters)
async function getUserUpdates(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = req.user!;
    const { id: targetUserId } = await params;
    const { searchParams } = new URL(req.url);

    // Parse and validate filters
    const filters: UpdateFilterInput = {
      taskId: searchParams.get('taskId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    };

    // Validate filters
    const validatedFilters = updateFilterSchema.parse(filters);

    // Verify target user exists
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      include: { department: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user can view this user's updates
    if (!canViewUser(user.role, user.deptId, user.id, targetUserId, targetUser.deptId)) {
      return NextResponse.json(
        { error: 'Cannot view this user\'s updates' },
        { status: 403 }
      );
    }

    // Build where clause
    const where: any = {
      userId: targetUserId,
      task: {
        orgId: user.orgId,
      },
    };

    if (validatedFilters.taskId) {
      where.taskId = validatedFilters.taskId;
    }

    if (validatedFilters.dateFrom || validatedFilters.dateTo) {
      where.createdAt = {};
      if (validatedFilters.dateFrom) {
        where.createdAt.gte = new Date(validatedFilters.dateFrom);
      }
      if (validatedFilters.dateTo) {
        where.createdAt.lte = new Date(validatedFilters.dateTo);
      }
    }

    // Calculate pagination
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;

    // Build orderBy
    const orderBy: any = {};
    orderBy[validatedFilters.sortBy] = validatedFilters.sortOrder;

    // Fetch updates
    const [updates, total] = await Promise.all([
      db.taskUpdate.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          task: {
            select: { id: true, title: true, status: true, department: { select: { name: true } } },
          },
        },
        orderBy,
        skip,
        take: validatedFilters.limit,
      }),
      db.taskUpdate.count({ where }),
    ]);

    // Parse blockers from JSON
    const updatesWithParsedBlockers = updates.map((update) => ({
      ...update,
      blockers: update.blockers ? JSON.parse(update.blockers) : [],
    }));

    // Calculate average progress
    const avgProgress = updates.length > 0
      ? Math.round(updates.reduce((sum, u) => sum + u.progress, 0) / updates.length)
      : 0;

    return NextResponse.json({
      updates: updatesWithParsedBlockers,
      pagination: {
        page: validatedFilters.page,
        limit: validatedFilters.limit,
        total,
        totalPages: Math.ceil(total / validatedFilters.limit),
      },
      summary: {
        totalUpdates: total,
        totalHours: updates.reduce((sum, u) => sum + u.hours, 0),
        averageProgress: avgProgress,
      },
    });
  } catch (error: any) {
    console.error('Error fetching user updates:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch user updates' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getUserUpdates);
