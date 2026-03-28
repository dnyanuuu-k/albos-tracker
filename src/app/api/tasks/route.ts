import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, TaskPriority, TaskStatus, RecurrenceType, UserStatus } from '@prisma/client';
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  recurrenceType: z.nativeEnum(RecurrenceType).default(RecurrenceType.NONE),
  recurrenceConfig: z.string().optional(),
  deptId: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
});

// GET /api/tasks - List tasks with filtering
async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const deptId = searchParams.get('deptId');
    const assigneeId = searchParams.get('assigneeId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query based on user role
    const where: any = {
      orgId: user.orgId,
    };

    // Employees can only see their assigned tasks
    if (user.role === UserRole.EMPLOYEE) {
      where.assignees = {
        some: {
          userId: user.id,
        },
      };
    }
    // Department managers can see their department's tasks
    else if (user.role === UserRole.DEPT_MANAGER) {
      where.deptId = user.deptId;
    }

    // Apply filters
    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (deptId && (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN)) {
      where.deptId = deptId;
    }

    if (assigneeId) {
      if (user.role === UserRole.EMPLOYEE) {
        // Employees always see only their assignments; ignore forged assigneeId
        where.assignees = { some: { userId: user.id } };
      } else {
        where.assignees = {
          some: {
            userId: assigneeId,
          },
        };
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
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
                },
              },
            },
          },
          updates: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              assignees: true,
              updates: true,
              comments: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.task.count({ where }),
    ]);

    const parsedTasks = (tasks as any[]).map((t) => {
      const raw = t.tags;
      if (!raw) return { ...t, tags: [] };
      if (Array.isArray(raw)) return { ...t, tags: raw };
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return { ...t, tags: Array.isArray(parsed) ? parsed : [] };
        } catch {
          return { ...t, tags: [] };
        }
      }
      return { ...t, tags: [] };
    });

    return NextResponse.json({
      success: true,
      data: parsedTasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create new task
async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = createTaskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    // Determine department
    let deptId = result.data.deptId || user.deptId;
    if (!deptId) {
      return NextResponse.json(
        { error: 'Department is required' },
        { status: 400 }
      );
    }

    // Validate department
    const dept = await db.department.findFirst({
      where: {
        id: deptId,
        orgId: user.orgId,
      },
    });

    if (!dept) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    const requestedAssigneeIds = result.data.assigneeIds; // can be undefined or string[]
    const assigneeIdsProvided = requestedAssigneeIds !== undefined;

    // Check permissions
    const canCreate =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.DEPT_MANAGER && deptId === user.deptId) ||
      (user.role === UserRole.EMPLOYEE &&
        deptId === user.deptId &&
        (!assigneeIdsProvided ||
          (requestedAssigneeIds?.length ?? 0) === 0 ||
          requestedAssigneeIds?.every((id) => id === user.id)));

    if (!canCreate) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate assignees
    const resolveAssigneeIds = async () => {
      // If caller did not send assignees at all:
      // - EMPLOYEE => self-assign
      // - Others => no assignees unless explicitly provided
      if (!assigneeIdsProvided) {
        if (user.role === UserRole.EMPLOYEE) return [user.id];
        return [];
      }

      // Caller explicitly provided `assigneeIds` (may be empty array).
      const provided = requestedAssigneeIds ?? [];
      if (provided.length === 0) {
        if (user.role === UserRole.EMPLOYEE) return [user.id];
        // Explicit empty means "no selection" -> don't silently expand to all members.
        return [];
      }

      return provided;
    };

    let assigneeIds = await resolveAssigneeIds();

    if (assigneeIds.length === 0) {
      if (user.role === UserRole.EMPLOYEE) {
        // Should not happen due to permission check, but keep it safe.
        assigneeIds = [user.id];
      }
    }

    const assignees = await db.user.findMany({
      where: {
        id: { in: assigneeIds },
        orgId: user.orgId,
        // Keep assignments scoped to the selected department.
        deptId,
      },
      select: { id: true },
    });

    if (assignees.length !== assigneeIds.length) {
      return NextResponse.json(
        { error: 'One or more assignees not found in selected department' },
        { status: 404 }
      );
    }

    // Create task with assignments
    const { assigneeIds: _ignoredAssignees, deptId: _ignoredDeptId, dependencies, ...taskData } =
      result.data;

    const normalizedDependencies =
      dependencies && dependencies.length > 0 ? JSON.stringify(dependencies) : null;

    const task = await db.task.create({
      data: {
        ...taskData,
        deptId,
        orgId: user.orgId,
        creatorId: user.id,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        status: TaskStatus.TO_DO,
        // Stored as JSON string in DB.
        dependencies: normalizedDependencies,
        assignees: {
          create: assigneeIds.map((assigneeId) => ({
            userId: assigneeId,
            assignedBy: user.id,
          })),
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
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
      data: task,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

export { GET, POST };
