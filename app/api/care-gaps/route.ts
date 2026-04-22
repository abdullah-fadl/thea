import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/care-gaps?patientId=...&status=OPEN&gapType=LAB_OVERDUE&page=1&limit=20
 *
 * List care gaps with optional filters.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = req.nextUrl;
    const patientId = url.searchParams.get('patientId');
    const status = url.searchParams.get('status');
    const gapType = url.searchParams.get('gapType');
    const priority = url.searchParams.get('priority');
    const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (patientId) where.patientMasterId = patientId;
    if (status) where.status = status;
    if (gapType) where.gapType = gapType;
    if (priority) where.priority = priority;

    const [items, total] = await Promise.all([
      prisma.careGap.findMany({
        where,
        orderBy: [
          { priority: 'asc' }, // STAT first
          { severityScore: 'desc' },
          { detectedAt: 'desc' },
        ],
        skip,
        take: limit,
        include: {
          outreachLogs: {
            orderBy: { sentAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.careGap.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.view', 'opd.doctor.encounter.view'],
  }
);

/**
 * POST /api/care-gaps
 *
 * Create a care gap manually (e.g., from the Doctor Station).
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    const {
      patientMasterId,
      encounterCoreId,
      gapType,
      sourceOrderId,
      sourceOrderKind,
      sourceOrderName,
      sourceOrderNameAr,
      reason,
      reasonAr,
      dueAt,
      priority,
      severityScore,
      meta,
    } = body;

    if (!patientMasterId || !gapType) {
      return NextResponse.json(
        { error: 'patientMasterId and gapType are required' },
        { status: 400 }
      );
    }

    // If sourceOrderId is provided, check for existing gap
    if (sourceOrderId) {
      const existing = await prisma.careGap.findUnique({
        where: {
          tenantId_sourceOrderId: {
            tenantId,
            sourceOrderId,
          },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'DUPLICATE_GAP', message: 'Care gap already exists for this order', existing },
          { status: 409 }
        );
      }
    }

    const gap = await prisma.careGap.create({
      data: {
        tenantId,
        patientMasterId,
        encounterCoreId: encounterCoreId || null,
        gapType,
        sourceOrderId: sourceOrderId || null,
        sourceOrderKind: sourceOrderKind || null,
        sourceOrderName: sourceOrderName || null,
        sourceOrderNameAr: sourceOrderNameAr || null,
        reason: reason || null,
        reasonAr: reasonAr || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        priority: priority || 'ROUTINE',
        severityScore: severityScore || 50,
        status: 'OPEN',
        meta: meta || null,
        createdByUserId: userId,
      },
    });

    return NextResponse.json({ ok: true, gap }, { status: 201 });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.edit', 'opd.doctor.encounter.view'],
  }
);
