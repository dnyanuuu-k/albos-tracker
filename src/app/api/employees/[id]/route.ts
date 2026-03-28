import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, UserStatus, EmploymentType } from '@prisma/client';
import { z } from 'zod';

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  deptId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  role: z.nativeEnum(UserRole).optional(),
  employmentType: z.nativeEnum(EmploymentType).nullable().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  avatarUrl: z.string().optional(),
  // Frontend stores notification preference toggles as a JSON string.
  // Persist it verbatim (after validating it's valid JSON).
  settings: z.string().optional(),
});

// GET /api/employees/[id] - Get employee details
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

    const employee = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        employeeId: true,
        role: true,
        status: true,
        designation: true,
        avatarUrl: true,
        deptId: true,
        managerId: true,
        employmentType: true,
        orgId: true,
        joinDate: true,
        profileComplete: true,
        createdAt: true,
        lastLoginAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            managerId: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            role: true,
          },
        },
        directReports: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            assignedTasks: true,
            createdTasks: true,
            taskUpdates: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canView = user.id === employee.id ||
                    user.role === UserRole.SUPER_ADMIN ||
                    (user.role === UserRole.ADMIN && user.orgId === employee.orgId) ||
                    (user.role === UserRole.DEPT_MANAGER && user.deptId === employee.deptId);

    if (!canView) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error('Failed to fetch employee:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

// PUT /api/employees/[id] - Update employee
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

    const employee = await db.user.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Determine what can be updated based on role
    const isSelf = user.id === id;
    const isAdminOrSuper = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    const isDeptManager = user.role === UserRole.DEPT_MANAGER && user.deptId === employee.deptId;

    if (!isSelf && !isAdminOrSuper && !isDeptManager) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = updateEmployeeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Restrict certain fields
    const updateData: any = { ...result.data };

    // Employees can only update their own basic info
    if (isSelf && !isAdminOrSuper) {
      const allowedFields = ['name', 'phone', 'avatarUrl', 'settings'];
      Object.keys(updateData).forEach((key) => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
    }

    // Department managers cannot change role or org
    if (isDeptManager && !isAdminOrSuper) {
      delete updateData.role;
      delete updateData.orgId;
    }

    // Validate department if provided
    if (updateData.deptId) {
      const dept = await db.department.findFirst({
        where: {
          id: updateData.deptId,
          orgId: employee.orgId,
        },
      });

      if (!dept) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }
    }

    // Validate manager if provided
    if (updateData.managerId) {
      const manager = await db.user.findFirst({
        where: {
          id: updateData.managerId,
          orgId: employee.orgId,
        },
      });

      if (!manager) {
        return NextResponse.json(
          { error: 'Manager not found' },
          { status: 404 }
        );
      }
    }

    const updatedEmployee = await db.user.update({
      where: { id },
      data: (() => {
        // Validate JSON settings payload (if provided).
        if (typeof updateData.settings === 'string') {
          try {
            JSON.parse(updateData.settings);
          } catch {
            throw new Error('Invalid settings JSON');
          }
        }
        return updateData;
      })(),
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        designation: true,
        deptId: true,
        employmentType: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error('Failed to update employee:', error);
    if (error instanceof Error && error.message === 'Invalid settings JSON') {
      return NextResponse.json(
        { error: 'Invalid input: settings must be valid JSON' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/[id] - Deactivate employee (soft delete)
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

    const employee = await db.user.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    if (employee.orgId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Soft delete by setting status to INACTIVE
    await db.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });

    return NextResponse.json({
      success: true,
      message: 'Employee deactivated successfully',
    });
  } catch (error) {
    console.error('Failed to deactivate employee:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate employee' },
      { status: 500 }
    );
  }
}

export { GET, PUT, DELETE };
