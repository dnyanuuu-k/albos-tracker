import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { cancelTransferSchema } from '@/lib/validations/transfer';

/**
 * PUT /api/transfers/:id/cancel - Cancel transfer
 */
async function cancelTransfer(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = req.user!;
    const { id } = await params;
    const body = await req.json();

    // Validate request body (reason is optional)
    const { reason } = cancelTransferSchema.parse(body);

    // Fetch transfer
    const transfer = await db.transfer.findFirst({
      where: {
        id,
        orgId: user.orgId,
      },
      include: {
        user: true,
        initiator: true,
        fromDept: true,
        toDept: true,
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Check if transfer is in PENDING status
    if (transfer.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending transfers can be cancelled' },
        { status: 400 }
      );
    }

    // Check if user has permission to cancel
    // Can cancel if: is the initiator, is the employee being transferred, or is admin/super admin
    const canCancel =
      user.id === transfer.initiatedBy ||
      user.id === transfer.userId ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN;

    if (!canCancel) {
      return NextResponse.json(
        { error: 'You do not have permission to cancel this transfer' },
        { status: 403 }
      );
    }

    // Update transfer status to CANCELLED
    const updatedTransfer = await db.transfer.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fromDept: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        toDept: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Create notification for the target department manager if the transfer was cancelled by someone else
    if (user.id !== transfer.toDept.managerId && transfer.toDept.managerId) {
      await db.notification.create({
        data: {
          orgId: user.orgId,
          userId: transfer.toDept.managerId,
          type: 'TRANSFER_INITIATED' as any, // Using existing type
          title: 'Transfer Cancelled',
          message: `Transfer request for ${transfer.user.name} has been cancelled`,
          refEntity: 'Transfer',
          refId: transfer.id,
        },
      });
    }

    // Log to console (mock email)
    console.log('=== TRANSFER CANCELLED ===');
    console.log('Employee:', transfer.user.email);
    console.log('From:', transfer.fromDept.name);
    console.log('To:', transfer.toDept.name);
    console.log('Cancelled By:', user.email);
    if (reason) console.log('Reason:', reason);
    console.log('=========================');

    return NextResponse.json({
      transfer: updatedTransfer,
      message: 'Transfer cancelled successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to cancel transfer:', error);
    return NextResponse.json(
      { error: 'Failed to cancel transfer' },
      { status: 500 }
    );
  }
}

// Export route handler with auth middleware
export const PUT = withAuth(cancelTransfer, {
  allowPublic: false,
});
