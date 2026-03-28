import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestUser } from '@/lib/middleware/auth';
import { Permission } from '@/lib/auth/rbac';
import { UserRole, UserStatus, EmploymentType } from '@prisma/client';
import { z } from 'zod';

const createEmployeeSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.nativeEnum(UserRole),
  deptId: z.string().optional(),
  designation: z.string().optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  joinDate: z.string().optional(),
  managerId: z.string().optional(),
  phone: z.string().optional(),
});

// GET /api/employees - List employees with filtering
async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const deptId = searchParams.get('deptId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query based on user role
    const where: any = {
      orgId: user.orgId,
    };

    // Employees and department managers can only see their department
    if (user.role === UserRole.EMPLOYEE || user.role === UserRole.DEPT_MANAGER) {
      if (!user.deptId) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0,
          },
        });
      }
      where.deptId = user.deptId;
    }

    // Apply filters
    if (deptId) {
      if (user.role === UserRole.EMPLOYEE && user.deptId && deptId !== user.deptId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      where.deptId = deptId;
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          employeeId: true,
          role: true,
          status: true,
          designation: true,
          avatarUrl: true,
          deptId: true,
          employmentType: true,
          joinDate: true,
          phone: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              assignedTasks: true,
              createdTasks: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

// POST /api/employees - Create new employee (Admin/Super Admin)
async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = createEmployeeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findFirst({
      where: {
        email: result.data.email.toLowerCase(),
        orgId: user.orgId,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Generate employee ID if not provided
    const employeeId = result.data.employeeId || `EMP${Date.now()}`;

    // Validate department if provided
    if (result.data.deptId) {
      const dept = await db.department.findFirst({
        where: {
          id: result.data.deptId,
          orgId: user.orgId,
        },
      });

      if (!dept) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }
    }

    // Validate manager if provided
    if (result.data.managerId) {
      const manager = await db.user.findFirst({
        where: {
          id: result.data.managerId,
          orgId: user.orgId,
        },
      });

      if (!manager) {
        return NextResponse.json(
          { error: 'Manager not found' },
          { status: 404 }
        );
      }
    }

    const employee = await db.user.create({
      data: {
        ...result.data,
        email: result.data.email.toLowerCase(),
        employeeId,
        orgId: user.orgId,
        status: UserStatus.PENDING, // Pending until they set password
        profileComplete: 0,
      },
      select: {
        id: true,
        email: true,
        name: true,
        employeeId: true,
        role: true,
        status: true,
        designation: true,
        deptId: true,
        employmentType: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: employee,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}

export { GET, POST };
