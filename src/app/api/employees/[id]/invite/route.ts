import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, UserStatus } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { sendInvitationEmail } from '@/lib/email';
import { serverConfig } from '@/lib/server-config';

// POST /api/employees/[id]/invite - Send invitation to employee
async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      where: { id: id },
      include: { org: true },
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

    // Generate invitation token
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // Create or update invitation
    const invitation = await db.invitation.upsert({
      where: { email: employee.email },
      create: {
        email: employee.email,
        tokenHash,
        role: employee.role,
        deptId: employee.deptId || undefined,
        sentBy: user.id,
        expiresAt,
        orgId: employee.orgId,
      },
      update: {
        tokenHash,
        sentBy: user.id,
        expiresAt,
        usedAt: null,
      },
    });

    const inviteUrl = `${serverConfig.appUrl}/accept-invite?token=${token}`;

    try {
      await sendInvitationEmail(
        employee.email,
        employee.name || 'there',
        employee.org.name,
        inviteUrl
      );
    } catch (err) {
      console.error('[Invite] Email send failed:', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        inviteUrl,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('Failed to send invitation:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}

export { POST };
