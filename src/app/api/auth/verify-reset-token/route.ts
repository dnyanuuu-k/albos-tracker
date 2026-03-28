import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { z } from 'zod';

const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const result = verifyTokenSchema.safeParse(body);

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

    for (const user of users) {
      const settings = JSON.parse(user.settings || '{}');
      if (
        settings.resetToken === tokenHash &&
        settings.resetTokenExpiry &&
        new Date(settings.resetTokenExpiry) > new Date()
      ) {
        return NextResponse.json({
          success: true,
          email: user.email,
        });
      }
    }

    return NextResponse.json(
      { error: 'Invalid or expired reset token' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to verify reset token:', error);
    return NextResponse.json(
      { error: 'Failed to verify reset token' },
      { status: 500 }
    );
  }
}
