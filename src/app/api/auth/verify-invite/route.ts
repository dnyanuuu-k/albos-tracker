import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Hash the token to match with stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find the invitation
    const invitation = await db.invitation.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation link' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      invite: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        name: invitation.acceptedBy || '',
        organization: invitation.org,
        department: invitation.department,
      },
    });
  } catch (error) {
    console.error('Failed to verify invitation:', error);
    return NextResponse.json(
      { error: 'Failed to verify invitation' },
      { status: 500 }
    );
  }
}
