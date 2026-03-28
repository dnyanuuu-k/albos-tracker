import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, getRequestUser } from '@/lib/middleware/auth';
import { Permission } from '@/lib/auth/rbac';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().min(1, 'Slug is required'),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  settings: z.string().optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().min(1, 'Slug is required'),
});

// GET /api/organizations - Get current user's organization or list all (Super Admin)
async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Super admins can list all organizations
    if (user.role === UserRole.SUPER_ADMIN) {
      const organizations = await db.organization.findMany({
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              tasks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        data: organizations,
      });
    }

    // Other users can only see their own organization
    const organization = await db.organization.findUnique({
      where: { id: user.orgId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            users: true,
            departments: true,
            tasks: true,
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

    return NextResponse.json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

// POST /api/organizations - Create new organization (Super Admin only)
async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = createOrgSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Check if slug is unique
    const existingOrg = await db.organization.findUnique({
      where: { slug: result.data.slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization with this slug already exists' },
        { status: 409 }
      );
    }

    const organization = await db.organization.create({
      data: {
        ...result.data,
        settings: result.data.settings || '{}',
      },
    });

    return NextResponse.json({
      success: true,
      data: organization,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}

// PUT /api/organizations - Update current user's organization (Super Admin only)
async function PUT(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user || user.role !== UserRole.SUPER_ADMIN) {
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

    // Check if slug is unique (if changing)
    if (result.data.slug !== user.orgId) {
      const existingOrg = await db.organization.findUnique({
        where: { slug: result.data.slug },
      });

      if (existingOrg && existingOrg.id !== user.orgId) {
        return NextResponse.json(
          { error: 'Organization with this slug already exists' },
          { status: 409 }
        );
      }
    }

    const organization = await db.organization.update({
      where: { id: user.orgId },
      data: {
        name: result.data.name,
        slug: result.data.slug,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            users: true,
            departments: true,
            tasks: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error('Failed to update organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

export { GET, POST, PUT };
