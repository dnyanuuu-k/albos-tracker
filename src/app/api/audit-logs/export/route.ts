import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { hasPermission, Permission } from '@/lib/auth/rbac';
import { logAuditAccess } from '@/lib/audit';
import { z } from 'zod';

/**
 * GET /api/audit-logs/export
 * Export audit logs (CSV/PDF)
 */
const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  userId: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.cookies.get('accessToken')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check AUDIT_VIEW permission
    if (!hasPermission(payload.role as any, Permission.AUDIT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const query = exportQuerySchema.parse(Object.fromEntries(searchParams));

    // Log audit export
    await logAuditAccess(payload.userId, {
      action: 'export',
      format: query.format,
      filters: {
        userId: query.userId,
        action: query.action,
        entity: query.entity,
        search: query.search,
      },
    });

    // Build where clause
    const where: any = {
      orgId: payload.orgId,
    };

    if (query.userId) {
      where.actorId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entity) {
      where.entity = {
        contains: query.entity,
        mode: 'insensitive',
      };
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.search) {
      where.OR = [
        { entity: { contains: query.search, mode: 'insensitive' } },
        { newVal: { contains: query.search, mode: 'insensitive' } },
        { ipAddress: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    // Get all matching audit logs (no pagination for export)
    const auditLogs = await db.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10000, // Limit to 10,000 records for export
    });

    if (query.format === 'json') {
      // Return JSON
      return NextResponse.json({
        data: auditLogs,
        exportedAt: new Date().toISOString(),
        total: auditLogs.length,
      });
    }

    // Generate CSV
    const headers = [
      'Timestamp',
      'Actor ID',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Action',
      'Entity',
      'Entity ID',
      'Old Value',
      'New Value',
      'IP Address',
      'User Agent',
    ];

    const rows = auditLogs.map((log) => [
      log.createdAt.toISOString(),
      log.actorId,
      log.actor?.name || '',
      log.actor?.email || '',
      log.actor?.role || '',
      log.action,
      log.entity,
      log.entityId || '',
      log.oldVal || '',
      log.newVal || '',
      log.ipAddress || '',
      log.userAgent || '',
    ]);

    // Escape CSV values
    const escapeCsv = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
