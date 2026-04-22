import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

const querySchema = z.object({
  patientId: z.string().min(1).optional(),
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/audit/patient-access
 *
 * Query who viewed which patient records.
 * Filters: patientId, userId, date range.
 * For compliance officers to audit patient data access.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = req.nextUrl;
    const parsed = querySchema.safeParse({
      patientId: url.searchParams.get('patientId') || undefined,
      userId: url.searchParams.get('userId') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      page: url.searchParams.get('page') || 1,
      limit: url.searchParams.get('limit') || 50,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { patientId, userId, from, to, page, limit } = parsed.data;

    // Build where clause for patient record access logs
    const where: Record<string, any> = {
      tenantId,
      action: 'patient_record_access',
    };

    if (patientId) {
      where.resourceId = patientId;
    }

    if (userId) {
      where.actorUserId = userId;
    }

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const [records, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          actorUserId: true,
          actorRole: true,
          actorEmail: true,
          resourceId: true,
          ip: true,
          method: true,
          path: true,
          metadata: true,
          timestamp: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.audit' },
);
