import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { updateFilterSchema, UpdateFilterInput } from '@/lib/validations/task';

async function getMyUpdates(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    const filters: UpdateFilterInput = {
      taskId: searchParams.get('taskId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    };

    const validatedFilters = updateFilterSchema.parse(filters);

    const where: any = {
      userId: user.id,
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

    const skip = (validatedFilters.page - 1) * validatedFilters.limit;
    const orderBy: any = {};
    orderBy[validatedFilters.sortBy] = validatedFilters.sortOrder;

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

    const updatesWithParsedBlockers = updates.map((update) => ({
      ...update,
      blockers: update.blockers ? JSON.parse(update.blockers) : [],
    }));

    const avgProgress =
      updates.length > 0
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
    console.error('Error fetching my updates:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch my updates' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getMyUpdates);
