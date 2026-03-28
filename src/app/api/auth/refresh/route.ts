import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateTokenPair, verifyToken } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found' },
        { status: 401 }
      );
    }

    // Verify refresh token
    const payload = await verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid token type' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { org: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Generate new token pair
    const tokens = await generateTokenPair({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      role: user.role,
    });

    // Set new cookies
    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    response.cookies.set('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);

    // Clear invalid cookies
    const response = NextResponse.json(
      { error: 'Invalid or expired refresh token' },
      { status: 401 }
    );
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');

    return response;
  }
}
