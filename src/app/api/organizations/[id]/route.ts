import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  settings: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/organizations/[id] - Get organization details
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

    const organization = await db.organization.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            tasks: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            department: {
              select: {
                name: true,
              },
            },
          },
          take: 10,
        },
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
            _count: {
              select: {
                users: true,
                tasks: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (user.role !== UserRole.SUPER_ADMIN && user.orgId !== organization.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PUT /api/organizations/[id] - Update organization
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

    if (user.role !== UserRole.SUPER_ADMIN && user.orgId !== id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = updateOrgSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // If updating slug, check uniqueness
    if (result.data.slug) {
      const existingOrg = await db.organization.findFirst({
        where: {
          slug: result.data.slug,
          id: { not: id },
        },
      });

      if (existingOrg) {
        return NextResponse.json(
          { error: 'Organization with this slug already exists' },
          { status: 409 }
        );
      }
    }

    const organization = await db.organization.update({
      where: { id: id },
      data: result.data,
    });

    return NextResponse.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error('Failed to update organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id] - Delete organization (Super Admin only)
async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getRequestUser(req);

    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if organization exists
    const org = await db.organization.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: {
            users: true,
            tasks: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if organization has active users or tasks
    if (org._count.users > 0 || org._count.tasks > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with active users or tasks' },
        { status: 400 }
      );
    }

    await db.organization.delete({
      where: { id: id },
    });

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete organization:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}

export { GET, PUT, DELETE };
