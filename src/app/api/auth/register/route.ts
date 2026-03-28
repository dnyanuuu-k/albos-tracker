import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  orgId: z.string(),
  role: z.nativeEnum(UserRole),
  deptId: z.string().optional(),
});

const tokenRegisterSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if this is a token-based registration (from invitation)
    if (body.token) {
      const result = tokenRegisterSchema.safeParse(body);

      if (!result.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: result.error.errors },
          { status: 400 }
        );
      }

      // Hash the token to match with stored hash
      const tokenHash = createHash('sha256').update(result.data.token).digest('hex');

      // Find the invitation
      const invitation = await db.invitation.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          org: true,
          department: true,
        },
      });

      if (!invitation) {
        return NextResponse.json(
          { error: 'Invalid or expired invitation link' },
          { status: 400 }
        );
      }

      // Register the user using invitation data
      const authResult = await registerUser({
        email: invitation.email,
        password: result.data.password,
        name: result.data.name,
        orgId: invitation.orgId,
        role: invitation.role,
        deptId: invitation.deptId,
      });

      if (!authResult) {
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 400 }
        );
      }

      // Mark invitation as used
      await db.invitation.update({
        where: { id: invitation.id },
        data: {
          usedAt: new Date(),
          acceptedBy: authResult.user.id,
        },
      });

      // Create notification for invitation sender
      await db.notification.create({
        data: {
          orgId: invitation.orgId,
          userId: invitation.sentBy,
          type: 'INVITE_ACCEPTED',
          title: 'Invitation Accepted',
          message: `${authResult.user.name || invitation.email} has accepted your invitation and joined the team.`,
          refEntity: 'User',
          refId: authResult.user.id,
        },
      });

      // Set HTTP-only cookies
      const response = NextResponse.json({
        success: true,
        user: authResult.user,
      });

      response.cookies.set('accessToken', authResult.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60, // 8 hours
        path: '/',
      });

      response.cookies.set('refreshToken', authResult.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      return response;
    }

    // Regular registration (existing code path)
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Register user
    const authResult = await registerUser(result.data);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      );
    }

    // Set HTTP-only cookies
    const response = NextResponse.json({
      success: true,
      user: authResult.user,
    });

    response.cookies.set('accessToken', authResult.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    response.cookies.set('refreshToken', authResult.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
