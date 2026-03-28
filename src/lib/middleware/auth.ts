import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { hasPermission, hasRoleLevel, Permission, UserRole } from '@/lib/auth/rbac';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    orgId: string;
    email: string;
    role: UserRole;
    deptId?: string | null;
    name?: string | null;
  };
}

/**
 * Middleware to authenticate user from JWT token
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, ...args: any[]) => Promise<NextResponse>,
  options: {
    requirePermission?: Permission;
    requireMinRole?: UserRole;
    allowPublic?: boolean;
  } = {}
) {
  return async (req: NextRequest, ...args: any[]) => {
    const { requirePermission, requireMinRole, allowPublic = false } = options;

    // If public access is allowed, try to get user but don't fail
    if (allowPublic) {
      const token = req.cookies.get('accessToken')?.value;
      if (token) {
        const user = await getUserFromToken(token);
        if (user) {
          const { passwordHash: _, ...userWithoutPassword } = user;
          (req as AuthenticatedRequest).user = userWithoutPassword;
        }
      }
      return handler(req as AuthenticatedRequest, ...args);
    }

    // Get token from cookie
    const token = req.cookies.get('accessToken')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Remove password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    (req as AuthenticatedRequest).user = userWithoutPassword;

    // Check minimum role requirement
    if (requireMinRole && !hasRoleLevel(user.role, requireMinRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check permission requirement
    if (requirePermission && !hasPermission(user.role, requirePermission)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return handler(req as AuthenticatedRequest, ...args);
  };
}

/**
 * Helper to check if user is authenticated in a route handler
 */
export async function getRequestUser(req: NextRequest) {
  const token = req.cookies.get('accessToken')?.value;
  if (!token) return null;

  const user = await getUserFromToken(token);
  if (!user) return null;

  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Helper to check user permissions in a route handler
 */
export async function checkUserPermission(
  req: NextRequest,
  permission: Permission
): Promise<boolean> {
  const user = await getRequestUser(req);
  if (!user) return false;

  return hasPermission(user.role, permission);
}

/**
 * Helper to check user role level in a route handler
 */
export async function checkUserRoleLevel(
  req: NextRequest,
  minRole: UserRole
): Promise<boolean> {
  const user = await getRequestUser(req);
  if (!user) return false;

  return hasRoleLevel(user.role, minRole);
}
