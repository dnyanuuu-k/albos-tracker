import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { sendInvitationEmail } from '@/lib/email';
import { serverConfig } from '@/lib/server-config';

// Validation schema for single invite
const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.nativeEnum(UserRole).default(UserRole.EMPLOYEE),
  deptId: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).default('FULL_TIME'),
});

/**
 * POST /api/employees/invite - Send a single employee invitation
 */
async function inviteEmployee(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const body = await req.json();

    // Validate request body
    const { email, name, role, deptId, employmentType } = inviteSchema.parse(body);
    const normalizedDeptId = deptId?.trim() ? deptId : undefined;

    // Check if user has permission to invite
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Only admins can invite employees' },
        { status: 403 }
      );
    }

    const emailLower = email.toLowerCase();

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        orgId: user.orgId,
        email: emailLower,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check for pending invitation
    const existingInvitation = await db.invitation.findFirst({
      where: {
        orgId: user.orgId,
        email: emailLower,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Pending invitation already exists for this email' },
        { status: 409 }
      );
    }

    // Validate department if provided
    if (normalizedDeptId) {
      const dept = await db.department.findFirst({
        where: {
          id: normalizedDeptId,
          orgId: user.orgId,
        },
      });

      if (!dept) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Set expiration to 72 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const org = await db.organization.findUnique({
      where: { id: user.orgId },
      select: { name: true },
    });

    // Create invitation
    const invitation = await db.invitation.create({
      data: {
        orgId: user.orgId,
        email: emailLower,
        tokenHash,
        role,
        deptId: normalizedDeptId,
        sentBy: user.id,
        expiresAt,
      },
    });

    const setupLink = `${serverConfig.appUrl}/setup?token=${token}`;

    try {
      await sendInvitationEmail(
        emailLower,
        name,
        org?.name || 'Your organization',
        setupLink
      );
    } catch (err) {
      console.error('[Invite] Email send failed:', err);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Invitation sent successfully',
        data: {
          id: invitation.id,
          email: emailLower,
          name,
          role,
          deptId: normalizedDeptId ?? null,
          employmentType,
          setupLink,
        },
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
    console.error('Failed to invite employee:', error);
    return NextResponse.json(
      { error: 'Failed to invite employee' },
      { status: 500 }
    );
  }
}

// Export route handler with auth middleware
export const POST = withAuth(inviteEmployee, {
  requireMinRole: UserRole.ADMIN,
});
