import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { z } from 'zod';
import { hash } from 'bcrypt';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Hash the token to match with stored hash
    const tokenHash = createHash('sha256').update(result.data.token).digest('hex');

    // Find user with valid reset token
    const users = await db.user.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    let userWithValidToken = null;

    for (const user of users) {
      const settings = JSON.parse(user.settings || '{}');
      if (
        settings.resetToken === tokenHash &&
        settings.resetTokenExpiry &&
        new Date(settings.resetTokenExpiry) > new Date()
      ) {
        userWithValidToken = user;
        break;
      }
    }

    if (!userWithValidToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hash(result.data.password, 12);

    // Update user password and clear reset token
    const updatedSettings = JSON.parse(userWithValidToken.settings || '{}');
    delete updatedSettings.resetToken;
    delete updatedSettings.resetTokenExpiry;

    await db.user.update({
      where: { id: userWithValidToken.id },
      data: {
        passwordHash,
        settings: JSON.stringify(updatedSettings),
      },
    });

    // Create notification for the user
    await db.notification.create({
      data: {
        orgId: userWithValidToken.orgId,
        userId: userWithValidToken.id,
        type: 'STATUS_CHANGED',
        title: 'Password Changed',
        message: 'Your password has been successfully changed.',
      },
    });

    // Log password reset for audit
    await db.auditLog.create({
      data: {
        orgId: userWithValidToken.orgId,
        actorId: userWithValidToken.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: userWithValidToken.id,
        oldVal: JSON.stringify({ passwordReset: true }),
        newVal: JSON.stringify({ passwordReset: false }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
