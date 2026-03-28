import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { approveTransferSchema } from '@/lib/validations/transfer';
import { NotificationType } from '@prisma/client';

/**
 * PUT /api/transfers/:id/approve - Approve transfer
 */
async function approveTransfer(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = req.user!;
    const { id } = await params;
    const body = await req.json();

    // Validate request body
    const { note } = approveTransferSchema.parse(body);

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
        { error: 'Only the target department manager can approve this transfer' },
        { status: 403 }
      );
    }

    // Check if the effective date has passed (should not happen as it's validated on create)
    if (transfer.effectiveDate < new Date()) {
      return NextResponse.json(
        { error: 'Transfer effective date has passed' },
        { status: 400 }
      );
    }

    // Process task reassignments if provided
    if (transfer.taskReassignments) {
      try {
        const taskReassignments = JSON.parse(transfer.taskReassignments);

        for (const [taskId, newAssigneeId] of Object.entries(taskReassignments)) {
          // Remove old assignee (the transferring employee)
          await db.taskAssignee.deleteMany({
            where: {
              taskId,
              userId: transfer.userId,
            },
          });

          // Add new assignee if provided
          if (newAssigneeId) {
            await db.taskAssignee.create({
              data: {
                taskId,
                userId: newAssigneeId as string,
                assignedBy: user.id,
              },
            });
          }
        }
      } catch (e) {
        console.error('Failed to process task reassignments:', e);
        return NextResponse.json(
          { error: 'Failed to process task reassignments' },
          { status: 500 }
        );
      }
    }

    // Update user's department
    await db.user.update({
      where: { id: transfer.userId },
      data: {
        deptId: transfer.toDeptId,
        updatedAt: new Date(),
      },
    });

    // Update transfer status to APPROVED
    const updatedTransfer = await db.transfer.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
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
        type: NotificationType.TRANSFER_APPROVED,
        title: 'Transfer Approved',
        message: `Your transfer to ${transfer.toDept.name} has been approved`,
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
          type: NotificationType.TRANSFER_APPROVED,
          title: 'Transfer Approved',
          message: `Transfer request for ${transfer.user.name} has been approved`,
          refEntity: 'Transfer',
          refId: transfer.id,
        },
      });
    }

    // Create notification for the from department manager
    if (transfer.fromDept.managerId && transfer.fromDept.managerId !== user.id) {
      await db.notification.create({
        data: {
          orgId: user.orgId,
          userId: transfer.fromDept.managerId,
          type: NotificationType.TRANSFER_APPROVED,
          title: 'Employee Transferred Out',
          message: `${transfer.user.name} has been transferred to ${transfer.toDept.name}`,
          refEntity: 'Transfer',
          refId: transfer.id,
        },
      });
    }

    // Log to console (mock email)
    console.log('=== TRANSFER APPROVED ===');
    console.log('Employee:', transfer.user.email);
    console.log('From:', transfer.fromDept.name);
    console.log('To:', transfer.toDept.name);
    console.log('Effective Date:', transfer.effectiveDate.toISOString().split('T')[0]);
    console.log('Approved By:', user.email);
    if (note) console.log('Note:', note);
    console.log('=======================');

    return NextResponse.json({
      transfer: updatedTransfer,
      message: 'Transfer approved successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to approve transfer:', error);
    return NextResponse.json(
      { error: 'Failed to approve transfer' },
      { status: 500 }
    );
  }
}

// Export route handler with auth middleware
export const PUT = withAuth(approveTransfer, {
  allowPublic: false,
});
