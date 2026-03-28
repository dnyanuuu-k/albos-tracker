import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { hasPermission, Permission } from '@/lib/auth/rbac';

// GET /api/users - List users
async function getUsers(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    let users;

    if (hasPermission(user.role, Permission.EMP_VIEW_ALL)) {
      // Admins can see all users
      users = await db.user.findMany({
        where: { orgId: user.orgId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          deptId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          designation: true,
        },
        orderBy: { name: 'asc' },
      });
    } else if (hasPermission(user.role, Permission.EMP_VIEW_DEPT) && user.deptId) {
      // Dept managers can see users in their department
      users = await db.user.findMany({
        where: { orgId: user.orgId, deptId: user.deptId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          deptId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          designation: true,
        },
        orderBy: { name: 'asc' },
      });
    } else {
      // Employees can only see themselves
      users = await db.user.findMany({
        where: { orgId: user.orgId, id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          deptId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          designation: true,
        },
      });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getUsers);
