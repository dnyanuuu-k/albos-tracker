import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, TransferStatus } from '@prisma/client';
import { z } from 'zod';

const createTransferSchema = z.object({
  userId: z.string(),
  toDeptId: z.string(),
  effectiveDate: z.string(),
  reason: z.string().optional(),
  taskReassignments: z.record(z.string(), z.string()).optional(),
});

// GET /api/transfers - List transfers
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
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {
      orgId: user.orgId,
    };

    // Employees can only see their own transfers
    if (user.role === UserRole.EMPLOYEE) {
      where.userId = user.id;
    }
    // Department managers can see transfers involving their department
    else if (user.role === UserRole.DEPT_MANAGER) {
      where.OR = [
        { fromDeptId: user.deptId },
        { toDeptId: user.deptId },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Prevent employees from using `userId` query param to view others
    if (userId) {
      if (user.role === UserRole.EMPLOYEE) {
        if (userId !== user.id) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
      } else {
        where.userId = userId;
      }
    }

    // Search by user name or email
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeId: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [transfers, total] = await Promise.all([
      db.transfer.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeId: true,
              avatarUrl: true,
            },
          },
          fromDept: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          toDept: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          initiator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transfer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Failed to fetch transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      { status: 500 }
    );
  }
}

// POST /api/transfers - Initiate transfer
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
    const result = createTransferSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    // Check permissions (Admin and Department Manager can initiate)
    const canInitiate = user.role === UserRole.SUPER_ADMIN ||
                      user.role === UserRole.ADMIN ||
                      user.role === UserRole.DEPT_MANAGER;

    if (!canInitiate) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get user to transfer
    const userToTransfer = await db.user.findUnique({
      where: { id: result.data.userId },
      include: { department: true },
    });

    if (!userToTransfer) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (userToTransfer.orgId !== user.orgId) {
      return NextResponse.json(
        { error: 'User is not in your organization' },
        { status: 400 }
      );
    }

    // Department managers can only initiate transfers from their department
    if (user.role === UserRole.DEPT_MANAGER && userToTransfer.deptId !== user.deptId) {
      return NextResponse.json(
        { error: 'You can only initiate transfers from your department' },
        { status: 403 }
      );
    }

    // Validate target department
    const targetDept = await db.department.findFirst({
      where: {
        id: result.data.toDeptId,
        orgId: user.orgId,
      },
    });

    if (!targetDept) {
      return NextResponse.json(
        { error: 'Target department not found' },
        { status: 404 }
      );
    }

    // Check if transferring to same department
    if (userToTransfer.deptId === result.data.toDeptId) {
      return NextResponse.json(
        { error: 'Cannot transfer to the same department' },
        { status: 400 }
      );
    }

    // Check for pending transfer
    const pendingTransfer = await db.transfer.findFirst({
      where: {
        userId: result.data.userId,
        status: TransferStatus.PENDING,
      },
    });

    if (pendingTransfer) {
      return NextResponse.json(
        { error: 'User already has a pending transfer request' },
        { status: 400 }
      );
    }

    const transfer = await db.transfer.create({
      data: {
        orgId: user.orgId,
        userId: result.data.userId,
        fromDeptId: userToTransfer.deptId!,
        toDeptId: result.data.toDeptId,
        effectiveDate: new Date(result.data.effectiveDate),
        reason: result.data.reason,
        initiatedBy: user.id,
        taskReassignments: result.data.taskReassignments
          ? JSON.stringify(result.data.taskReassignments)
          : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fromDept: {
          select: {
            id: true,
            name: true,
          },
        },
        toDept: {
          select: {
            id: true,
            name: true,
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: transfer,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 }
    );
  }
}

export { GET, POST };
