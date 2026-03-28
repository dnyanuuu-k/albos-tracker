import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { Permission } from '@/lib/auth/rbac';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

// JSON bodies often send `null` for empty optional fields; plain `.optional()` rejects null
const createDeptSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().min(1, 'Department code is required'),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
});

// GET /api/departments - List departments
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
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Build query based on user role
    const where: any = {
      orgId: user.orgId,
    };

    if (!includeArchived) {
      where.isArchived = false;
    }

    // Department managers and employees can only see their department
    if (user.role === UserRole.DEPT_MANAGER || user.role === UserRole.EMPLOYEE) {
      if (!user.deptId) {
        return NextResponse.json({
          success: true,
          departments: [],
        });
      }
      where.id = user.deptId;
    }

    const departments = await db.department.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            users: true,
            tasks: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate active (non-completed/non-cancelled) task count per department
    const activeTaskCounts = await db.task.groupBy({
      by: ['deptId'],
      where: {
        orgId: user.orgId,
        deptId: { in: departments.map((d) => d.id) },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      _count: {
        _all: true,
      },
    });
    const activeTaskCountMap = new Map(
      activeTaskCounts.map((row) => [row.deptId, row._count._all])
    );

    // Attach active task count for each department
    const departmentsWithActiveTaskCount = departments.map((dept: any) => ({
      ...dept,
      activeTaskCount: activeTaskCountMap.get(dept.id) || 0,
    }));

    return NextResponse.json({
      success: true,
      departments: departmentsWithActiveTaskCount,
    });
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST /api/departments - Create new department (Admin/Super Admin)
async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const result = createDeptSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Normalize code to avoid case-variant duplicates (DEV vs dev)
    const normalizedCode = result.data.code.trim().toUpperCase();

    // Check if department code is unique within organization
    const existingDept = await db.department.findFirst({
      where: {
        orgId: user.orgId,
        code: normalizedCode,
      },
    });

    if (existingDept) {
      return NextResponse.json(
        { error: 'Department with this code already exists' },
        { status: 409 }
      );
    }

    // Validate parent department if provided
    if (result.data.parentId) {
      const parentDept = await db.department.findFirst({
        where: {
          id: result.data.parentId,
          orgId: user.orgId,
        },
      });

      if (!parentDept) {
        return NextResponse.json(
          { error: 'Parent department not found' },
          { status: 404 }
        );
      }
    }

    // Validate manager if provided
    if (result.data.managerId) {
      const manager = await db.user.findFirst({
        where: {
          id: result.data.managerId,
          orgId: user.orgId,
        },
      });

      if (!manager) {
        return NextResponse.json(
          { error: 'Manager not found' },
          { status: 404 }
        );
      }

      // Schema: managerId is @unique — a user may only manage one department.
      // Clear any existing department that already lists this user as manager before create.
      await db.department.updateMany({
        where: {
          orgId: user.orgId,
          managerId: result.data.managerId,
        },
        data: { managerId: null },
      });
    }

    const department = await db.department.create({
      data: {
        ...result.data,
        code: normalizedCode,
        orgId: user.orgId,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      department,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create department:', error);
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    );
  }
}

export { GET, POST };
