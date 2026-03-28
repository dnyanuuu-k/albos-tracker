import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';

/**
 * POST /api/departments/:id/archive
 * Archive department (ADMIN/SUPER_ADMIN only)
 */
async function archiveDepartment(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: departmentId } = await params;
    const user = req.user!;

    // Only ADMIN and SUPER_ADMIN can archive departments
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only Admin and Super Admin can archive departments' },
        { status: 403 }
      );
    }

    // Check if department exists
    const existingDepartment = await db.department.findUnique({
      where: { id: departmentId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            code: true,
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

    if (!existingDepartment) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Ensure department belongs to user's organization
    if (existingDepartment.orgId !== user.orgId) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check if already archived
    if (existingDepartment.isArchived) {
      return NextResponse.json(
        { error: 'Department is already archived' },
        { status: 400 }
      );
    }

    // Archive department
    const archivedDepartment = await db.department.update({
      where: { id: departmentId },
      data: {
        isArchived: true,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            code: true,
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

    // Count active tasks
    const activeTaskCount = await db.task.count({
      where: {
        deptId: departmentId,
        status: {
          in: ['TO_DO', 'IN_PROGRESS', 'IN_REVIEW'],
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Department archived successfully',
      department: {
        ...archivedDepartment,
        activeTaskCount,
      },
    });
  } catch (error) {
    console.error('Archive department error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export the route handler with auth middleware
export const POST = withAuth(archiveDepartment);
