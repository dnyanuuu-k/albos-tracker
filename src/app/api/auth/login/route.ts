import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { logLogin, logFailedLogin } from '@/lib/audit';
import { z } from 'zod';
import { authRateLimiter, getClientIP } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  orgSlug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting based on IP
    const ip = getClientIP(req);
    if (!authRateLimiter.check(ip)) {
      const status = authRateLimiter.getStatus(ip);
      const retryAfter = Math.ceil((status.resetTime - Date.now()) / 1000);
      
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': status.resetTime.toString(),
          },
        }
      );
    }

    const body = await req.json();

    // Validate request body
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Authenticate user
    const authResult = await authenticateUser(result.data);

    if (!authResult) {
      // Log failed login attempt
      await logFailedLogin(
        result.data.email,
        'Invalid credentials or account not active'
      );
      return NextResponse.json(
        { error: 'Invalid credentials or account not active' },
        { status: 401 }
      );
    }

    // Log successful login
    await logLogin(authResult.user.orgId, authResult.user.id);

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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
