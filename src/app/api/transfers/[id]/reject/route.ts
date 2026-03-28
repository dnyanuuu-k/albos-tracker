import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import { rejectTransferSchema } from '@/lib/validations/transfer';
import { NotificationType } from '@prisma/client';

/**
 * PUT /api/transfers/:id/reject - Reject transfer
 */
async function rejectTransfer(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = req.user!;
    const { id } = await params;
    const body = await req.json();

    // Validate request body
    const { reason } = rejectTransferSchema.parse(body);

    // Fetch transfer with all related data
    const transfer = await db.transfer.findFirst({
      where: {
        id,
        orgId: user.orgId,
      },
      include: {
        user: true,
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
        { error: 'Transfer is not in pending status' },
        { status: 400 }
      );
    }

    // Check if user is the target department manager
    if (transfer.toDept.managerId !== user.id) {
      return NextResponse.json(
        { error: 'Only the target department manager can reject this transfer' },
        { status: 403 }
      );
    }

    // Update transfer status to REJECTED
    const updatedTransfer = await db.transfer.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: user.id,
        rejectedAt: new Date(),
        rejectedReason: reason,
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

    // Create notification for the employee
    await db.notification.create({
      data: {
        orgId: user.orgId,
        userId: transfer.userId,
        type: NotificationType.TRANSFER_INITIATED, // Using same type for rejection
        title: 'Transfer Rejected',
        message: `Your transfer to ${transfer.toDept.name} has been rejected`,
        refEntity: 'Transfer',
        refId: transfer.id,
      },
    });

    // Create notification for the initiator (if different from employee)
    if (transfer.initiatedBy !== transfer.userId) {
      await db.notification.create({
        data: {
          orgId: user.orgId,
          userId: transfer.initiatedBy,
          type: NotificationType.TRANSFER_INITIATED,
          title: 'Transfer Rejected',
          message: `Transfer request for ${transfer.user.name} has been rejected`,
          refEntity: 'Transfer',
          refId: transfer.id,
        },
      });
    }

    // Log to console (mock email)
    console.log('=== TRANSFER REJECTED ===');
    console.log('Employee:', transfer.user.email);
    console.log('From:', transfer.fromDept.name);
    console.log('To:', transfer.toDept.name);
    console.log('Rejected By:', user.email);
    console.log('Reason:', reason);
    console.log('=======================');

    return NextResponse.json({
      transfer: updatedTransfer,
      message: 'Transfer rejected successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to reject transfer:', error);
    return NextResponse.json(
      { error: 'Failed to reject transfer' },
      { status: 500 }
    );
  }
}

// Export route handler with auth middleware
export const PUT = withAuth(rejectTransfer, {
  allowPublic: false,
});
