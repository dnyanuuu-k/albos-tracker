import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { authRateLimiter, getClientIP } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/lib/email';
import { serverConfig } from '@/lib/server-config';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting based on IP
    const ip = getClientIP(req);
    if (!authRateLimiter.check(ip)) {
      const status = authRateLimiter.getStatus(ip);
      const retryAfter = Math.ceil((status.resetTime - Date.now()) / 1000);
      
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    const body = await req.json();

    // Validate request body
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await db.user.findFirst({
      where: {
        email: result.data.email.toLowerCase(),
        status: 'ACTIVE',
      },
      include: {
        org: true,
      },
    });

    if (!user) {
      // Don't reveal whether email exists for security
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Set expiration to 15 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Store token hash in user settings (JSON field)
    const currentSettings = JSON.parse(user.settings || '{}');
    currentSettings.resetToken = tokenHash;
    currentSettings.resetTokenExpiry = expiresAt.toISOString();

    await db.user.update({
      where: { id: user.id },
      data: {
        settings: JSON.stringify(currentSettings),
      },
    });

    const resetLink = `${serverConfig.appUrl}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(user.email, resetLink);
    } catch (err) {
      console.error('[Password Reset] Email send failed:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
