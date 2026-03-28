import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { logLogout } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    // Get user info from token for audit logging
    const token = req.cookies.get('accessToken')?.value;
    let userId = null;
    
    if (token) {
      try {
        const payload = await verifyToken(token);
        if (payload) {
          userId = payload.userId;
          const orgId = payload.orgId;
          // Log logout
          await logLogout(orgId, userId);
        }
      } catch (error) {
        // Token invalid, but still clear cookies
        console.error('Error verifying token during logout:', error);
      }
    }

    // Clear cookies
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
