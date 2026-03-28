import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { hasPermission, Permission } from '@/lib/auth/rbac';
import { logAuditAccess } from '@/lib/audit';

/**
 * GET /api/audit-logs/:id
 * Get audit log details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verify authentication
    const token = req.cookies.get('accessToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check AUDIT_VIEW permission
    if (!hasPermission(payload.role as any, Permission.AUDIT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get audit log
    const auditLog = await db.auditLog.findUnique({
      where: { id: id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!auditLog) {
      return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
    }

    // Check organization access
    if (auditLog.orgId !== payload.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Log audit log access
    await logAuditAccess(payload.userId, { auditLogId: id });

    return NextResponse.json({ data: auditLog });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}
