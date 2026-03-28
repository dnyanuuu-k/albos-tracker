import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { Permission } from '@/lib/auth/rbac';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { sendInvitationEmail } from '@/lib/email';
import { serverConfig } from '@/lib/server-config';

// Validation schema for bulk invite
const bulkInviteSchema = z.object({
  csvData: z.string().min(1, 'CSV data is required'),
  defaultRole: z.nativeEnum(UserRole).default(UserRole.EMPLOYEE),
  defaultDeptId: z.string().optional(),
  defaultEmploymentType: z
    .enum(['FULL_TIME', 'PART_TIME', 'CONTRACT'])
    .optional(),
});

/**
 * POST /api/employees/invite/bulk - Bulk invite employees via CSV
 *
 * CSV format (header row):
 * email,name,role,dept_code,employment_type
 *
 * Example:
 * john@example.com,John Doe,EMPLOYEE,ENG,FULL_TIME
 * jane@example.com,Jane Smith,EMPLOYEE,MKT,PART_TIME
 */
async function bulkInviteEmployees(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const body = await req.json();

    // Validate request body
    const { csvData, defaultRole, defaultDeptId, defaultEmploymentType } =
      bulkInviteSchema.parse(body);

    // Check if user has permission to invite
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: 'Only admins can invite employees' },
        { status: 403 }
      );
    }

    // Parse CSV
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    // Validate headers
    const requiredHeaders = ['email', 'name'];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required CSV columns: ${missingHeaders.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Get column indices
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('name');
    const roleIdx = headers.indexOf('role');
    const deptCodeIdx = headers.indexOf('dept_code');
    const employmentTypeIdx = headers.indexOf('employment_type');

    // Parse rows
    const rows = lines.slice(1).filter((line) => line.trim());
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      skipped: [] as any[],
    };

    // Get all departments for lookup
    const departments = await db.department.findMany({
      where: { orgId: user.orgId },
      select: { id: true, code: true },
    });

    const deptByCode = new Map(
      departments.map((d) => [d.code.toLowerCase(), d.id])
    );

    // Get default department if specified
    let defaultDepartment = null;
    if (defaultDeptId) {
      defaultDepartment = await db.department.findFirst({
        where: { id: defaultDeptId, orgId: user.orgId },
      });
      if (!defaultDepartment) {
        return NextResponse.json(
          { error: 'Default department not found' },
          { status: 404 }
        );
      }
    }

    const org = await db.organization.findUnique({
      where: { id: user.orgId },
      select: { name: true },
    });

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const values = rows[i].split(',').map((v) => v.trim());

      const email = values[emailIdx]?.toLowerCase();
      const name = values[nameIdx];
      const role =
        roleIdx >= 0 && values[roleIdx]
          ? values[roleIdx]
          : defaultRole;
      const deptCode = deptCodeIdx >= 0 ? values[deptCodeIdx]?.toLowerCase() : null;
      const employmentType =
        employmentTypeIdx >= 0 && values[employmentTypeIdx]
          ? values[employmentTypeIdx]
          : defaultEmploymentType;

      // Validate email and name
      if (!email || !name || !email.includes('@')) {
        results.failed.push({
          row: i + 2,
          email,
          name,
          error: 'Invalid email or name',
        });
        continue;
      }

      // Validate role
      if (!Object.values(UserRole).includes(role as UserRole)) {
        results.failed.push({
          row: i + 2,
          email,
          name,
          error: `Invalid role: ${role}`,
        });
        continue;
      }

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: {
          orgId: user.orgId,
          email,
        },
      });

      if (existingUser) {
        results.skipped.push({
          row: i + 2,
          email,
          name,
          reason: 'User already exists',
        });
        continue;
      }

      // Check for pending invitation
      const existingInvitation = await db.invitation.findFirst({
        where: {
          orgId: user.orgId,
          email,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        results.skipped.push({
          row: i + 2,
          email,
          name,
          reason: 'Pending invitation already exists',
        });
        continue;
      }

      // Resolve department
      let deptId = null;
      if (deptCode) {
        deptId = deptByCode.get(deptCode);
      }
      if (!deptId && defaultDepartment) {
        deptId = defaultDepartment.id;
      }

      // Generate secure token
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      // Set expiration to 72 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      // Create invitation
      const invitation = await db.invitation.create({
        data: {
          orgId: user.orgId,
          email,
          tokenHash,
          role: role as UserRole,
          deptId,
          sentBy: user.id,
          expiresAt,
        },
      });

      const setupLink = `${serverConfig.appUrl}/setup?token=${token}`;

      try {
        await sendInvitationEmail(
          email,
          name,
          org?.name || 'Your organization',
          setupLink
        );
      } catch (err) {
        console.error(`[Bulk Invite] Row ${i + 2} email failed:`, err);
      }

      results.successful.push({
        row: i + 2,
        email,
        name,
        role,
        departmentCode: deptCode || (defaultDepartment?.code || null),
        setupLink,
      });
    }

    return NextResponse.json(
      {
        summary: {
          total: rows.length,
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
        },
        results,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to process bulk invite:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk invite' },
      { status: 500 }
    );
  }
}

// Export route handler with auth middleware
export const POST = withAuth(bulkInviteEmployees, {
  requireMinRole: UserRole.ADMIN,
});
