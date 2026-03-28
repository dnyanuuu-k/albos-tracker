import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';

/**
 * POST /api/employees/:id/activate - Reactivate employee
 */
async function activateEmployee(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = req.user!;
    const { id } = await params;

    // Check if user has permission to reactivate employees
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: 'Only admins can reactivate employees' },
        { status: 403 }
      );
    }

    // Fetch the employee to activate
    const employee = await db.user.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check if user belongs to same organization
    if (employee.orgId !== user.orgId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if employee is already active
    if (employee.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Employee is already active' },
        { status: 400 }
      );
    }

    // Activate employee
    const activatedEmployee = await db.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Remove password hash from response
    const { passwordHash: _, ...sanitizedEmployee } = activatedEmployee;

    return NextResponse.json({
      employee: sanitizedEmployee,
      message: 'Employee activated successfully',
    });
  } catch (error) {
    console.error('Failed to activate employee:', error);
    return NextResponse.json(
      { error: 'Failed to activate employee' },
      { status: 500 }
    );
  }
}

// Export route handler with auth middleware
export const POST = withAuth(activateEmployee, {
  requireMinRole: UserRole.ADMIN,
});
