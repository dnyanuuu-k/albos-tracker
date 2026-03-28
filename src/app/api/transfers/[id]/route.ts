import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole, TransferStatus } from '@prisma/client';
import { z } from 'zod';

const updateTransferSchema = z.object({
  status: z.nativeEnum(TransferStatus),
  rejectedReason: z.string().optional(),
});

// GET /api/transfers/[id] - Get transfer details
async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const transfer = await db.transfer.findUnique({
      where: { id: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            department: {
              select: {
                name: true,
              },
            },
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
            managerId: true,
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Check permissions
    let canView = false;
    if (transfer.orgId === user.orgId) {
      if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
        canView = true;
      } else if (user.role === UserRole.DEPT_MANAGER) {
        // Dept manager can see transfers involving their department
        canView =
          transfer.userId === user.id ||
          transfer.fromDeptId === user.deptId ||
          transfer.toDeptId === user.deptId;
      } else if (user.role === UserRole.EMPLOYEE) {
        // Employee can only see transfers related to themselves
        canView = transfer.userId === user.id || transfer.initiatedBy === user.id;
      }
    }

    if (!canView) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    console.error('Failed to fetch transfer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer' },
      { status: 500 }
    );
  }
}

// PUT /api/transfers/[id] - Approve or reject transfer
async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = updateTransferSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    const transfer = await db.transfer.findUnique({
      where: { id: id },
      include: { toDept: true },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Check if transfer is still pending
    if (transfer.status !== TransferStatus.PENDING) {
      return NextResponse.json(
        { error: 'Transfer has already been processed' },
        { status: 400 }
      );
    }

    // Only target department manager, admin, or super admin can approve/reject
    const canApprove = user.role === UserRole.SUPER_ADMIN ||
                      user.role === UserRole.ADMIN ||
                      (user.role === UserRole.DEPT_MANAGER && transfer.toDept.managerId === user.id);

    if (!canApprove) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const updateData: any = {
      status: result.data.status,
    };

    if (result.data.status === TransferStatus.APPROVED) {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();

      // Update user's department
      await db.user.update({
        where: { id: transfer.userId },
        data: { deptId: transfer.toDeptId },
      });
    } else if (result.data.status === TransferStatus.REJECTED) {
      updateData.rejectedBy = user.id;
      updateData.rejectedAt = new Date();
      updateData.rejectedReason = result.data.rejectedReason;
    }

    const updatedTransfer = await db.transfer.update({
      where: { id: id },
      data: updateData,
      include: {
        user: {
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
          },
        },
        toDept: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedTransfer,
    });
  } catch (error) {
    console.error('Failed to update transfer:', error);
    return NextResponse.json(
      { error: 'Failed to update transfer' },
      { status: 500 }
    );
  }
}

export { GET, PUT };
