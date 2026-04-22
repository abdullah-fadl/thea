import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { v4 as uuidv4 } from 'uuid';

const createCultureSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().optional(),
  mrn: z.string().optional(),
  orderId: z.string().optional(),
  specimenType: z.string().min(1),
  specimenSource: z.string().optional(),
  collectionTime: z.string().optional(),
  clinicalInfo: z.string().optional(),
  priority: z.enum(['ROUTINE', 'STAT', 'URGENT']).default('ROUTINE'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const status = req.nextUrl.searchParams.get('status');
    const patientId = req.nextUrl.searchParams.get('patientId');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 200);

    const where: any = { tenantId };
    if (status && status !== 'ALL') where.status = status;
    if (patientId) where.patientId = patientId;

    const cultures = await prisma.labMicroCulture.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Compute summary counts
    const allCultures = await prisma.labMicroCulture.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const g of allCultures) {
      counts[g.status] = g._count.id;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const finalToday = await prisma.labMicroCulture.count({
      where: { tenantId, status: 'FINAL', updatedAt: { gte: todayStart } },
    });

    return NextResponse.json({
      cultures,
      summary: {
        pending: counts['RECEIVED'] ?? 0,
        inProgress: counts['IN_PROGRESS'] ?? 0,
        preliminary: counts['PRELIMINARY'] ?? 0,
        final: counts['FINAL'] ?? 0,
        finalToday,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, createCultureSchema);
    if ('error' in v) return v.error;

    const culture = await prisma.labMicroCulture.create({
      data: {
        id: uuidv4(),
        tenantId,
        patientId: v.data.patientId,
        patientName: v.data.patientName ?? null,
        mrn: v.data.mrn ?? null,
        orderId: v.data.orderId ?? null,
        specimenType: v.data.specimenType,
        specimenSource: v.data.specimenSource ?? null,
        collectionTime: v.data.collectionTime ? new Date(v.data.collectionTime) : null,
        clinicalInfo: v.data.clinicalInfo ?? null,
        priority: v.data.priority,
        status: 'RECEIVED',
        organisms: [],
        sensitivities: [],
        gramStain: null,
        growthStatus: null,
        interpretation: null,
        clinicalSignificance: null,
        infectionControlAlert: false,
        resistanceFlags: [],
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });

    return NextResponse.json({ success: true, culture }, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'lab.view' },
);
