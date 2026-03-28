import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const updateDeptSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
});

// GET /api/departments/[id] - Get department details
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

    const department = await db.department.findUnique({
      where: { id: id },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
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
            code: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            designation: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            users: true,
            tasks: true,
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (user.role === UserRole.EMPLOYEE) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (user.role === UserRole.DEPT_MANAGER && user.deptId !== department.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (user.role !== UserRole.SUPER_ADMIN && department.orgId !== user.orgId) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Failed to fetch department:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department' },
      { status: 500 }
    );
  }
}

// PUT /api/departments/[id] - Update department
async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = updateDeptSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Check if department exists
    const existingDept = await db.department.findUnique({
      where: { id: id },
    });

    if (!existingDept) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check organization ownership
    if (existingDept.orgId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // If updating code, check uniqueness
    if (result.data.code) {
      const codeExists = await db.department.findFirst({
        where: {
          orgId: user.orgId,
          code: result.data.code,
          id: { not: id },
        },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: 'Department with this code already exists' },
          { status: 409 }
        );
      }
    }

    // managerId is globally unique: one user can manage at most one department.
    // If assigning a manager who already manages another dept, clear that other row first.
    if (result.data.managerId) {
      await db.department.updateMany({
        where: {
          orgId: existingDept.orgId,
          managerId: result.data.managerId,
          id: { not: id },
        },
        data: { managerId: null },
      });
    }

    const department = await db.department.update({
      where: { id: id },
      data: result.data,
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
      data: department,
    });
  } catch (error) {
    console.error('Failed to update department:', error);
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id] - Delete department (Admin/Super Admin)
async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getRequestUser(req);

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if department exists
    const dept = await db.department.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: {
            users: true,
            tasks: true,
          },
        },
      },
    });

    if (!dept) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check organization ownership
    if (dept.orgId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Prevent deletion if department has active users or tasks
    if (dept._count.users > 0 || dept._count.tasks > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with active users or tasks' },
        { status: 400 }
      );
    }

    await db.department.delete({
      where: { id: id },
    });

    return NextResponse.json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}

export { GET, PUT, DELETE };
