import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';
import {
  PX_CATEGORIES,
  PX_SEVERITIES,
  PX_SLA_MINUTES,
  PX_STATUSES,
  type PxSeverity,
} from '@/lib/patient-experience/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE_MAX = 100;

const createSchema = z.object({
  categoryKey: z.enum(PX_CATEGORIES).optional(),
  severity: z.enum(PX_SEVERITIES).default('MEDIUM'),
  subjectName: z.string().trim().max(160).optional(),
  subjectMrn: z.string().trim().max(40).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal('')),
  patientId: z.string().uuid().optional(),
  visitId: z.string().uuid().optional(),
  assignedDeptKey: z.string().trim().max(80).optional(),
  assigneeUserId: z.string().uuid().optional(),
  detailsEn: z.string().trim().max(8000).optional(),
  detailsAr: z.string().trim().max(8000).optional(),
});

/**
 * GET /api/patient-experience/cases
 *
 * Filters: status, severity, categoryKey, assigneeUserId, q (subject/mrn),
 *          dateFrom, dateTo, page, limit.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? '';
    const severity = url.searchParams.get('severity') ?? '';
    const categoryKey = url.searchParams.get('categoryKey') ?? '';
    const assigneeUserId = url.searchParams.get('assigneeUserId') ?? '';
    const q = (url.searchParams.get('q') ?? '').trim();
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const limit = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, Number(url.searchParams.get('limit') ?? '25') || 25),
    );

    const where: Record<string, unknown> = { tenantId: tenantUuid, active: true };
    if (status && (PX_STATUSES as readonly string[]).includes(status)) where.status = status;
    if (severity && (PX_SEVERITIES as readonly string[]).includes(severity)) where.severity = severity;
    if (categoryKey && (PX_CATEGORIES as readonly string[]).includes(categoryKey)) where.categoryKey = categoryKey;
    if (assigneeUserId && /^[0-9a-f-]{36}$/i.test(assigneeUserId)) where.assigneeUserId = assigneeUserId;

    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) range.gte = new Date(dateFrom);
      if (dateTo) range.lte = new Date(dateTo);
      where.createdAt = range;
    }

    if (q) {
      where.OR = [
        { subjectName: { contains: q, mode: 'insensitive' } },
        { subjectMrn: { contains: q, mode: 'insensitive' } },
        { detailsEn: { contains: q, mode: 'insensitive' } },
        { detailsAr: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.pxCase.count({ where }),
      prisma.pxCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      page,
      limit,
      total,
      cases: rows,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'px.cases.view',
  },
);

/**
 * POST /api/patient-experience/cases
 *
 * Creates a new case + an opening timeline entry. Sets dueAt from severity SLA.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;
    const severity = data.severity as PxSeverity;
    const dueAt = new Date(Date.now() + PX_SLA_MINUTES[severity] * 60 * 1000);

    const created = await prisma.pxCase.create({
      data: {
        tenantId: tenantUuid,
        status: 'OPEN',
        severity,
        categoryKey: data.categoryKey,
        subjectName: data.subjectName,
        subjectMrn: data.subjectMrn,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail || null,
        patientId: data.patientId,
        visitId: data.visitId,
        assignedDeptKey: data.assignedDeptKey,
        assigneeUserId: data.assigneeUserId,
        createdByUserId: userId,
        detailsEn: data.detailsEn,
        detailsAr: data.detailsAr,
        dueAt,
      },
    });

    await prisma.pxComment.create({
      data: {
        tenantId: tenantUuid,
        caseId: created.id,
        authorUserId: userId,
        authorName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
        kind: 'STATUS_CHANGE',
        body: 'Case opened',
        metadata: { severity, categoryKey: data.categoryKey ?? null },
      },
    });

    return NextResponse.json({ success: true, case: created }, { status: 201 });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'px.cases.create',
  },
);
