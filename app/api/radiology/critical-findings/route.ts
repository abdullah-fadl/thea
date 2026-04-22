import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ─── Schemas ────────────────────────────────────────────────────────── */
const createCriticalFindingSchema = z.object({
  orderId: z.string().min(1),
  studyType: z.string().optional(),
  modality: z.string().optional(),
  finding: z.string().min(1, 'finding is required'),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  mrn: z.string().optional(),
  encounterId: z.string().optional(),
  radiologistName: z.string().optional(),
  severity: z.enum(['CRITICAL', 'URGENT']).default('CRITICAL'),
}).passthrough();

const acknowledgeFindingSchema = z.object({
  findingId: z.string().min(1, 'findingId is required'),
  communicationMethod: z.enum(['phone', 'in_person', 'secure_message']).optional(),
  referringPhysicianId: z.string().optional(),
  referringPhysicianName: z.string().optional(),
  communicationNotes: z.string().optional(),
}).passthrough();

/**
 * GET /api/radiology/critical-findings
 *
 * List radiology critical findings with optional filters.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const status = req.nextUrl.searchParams.get('status'); // 'unacknowledged' | 'acknowledged' | null (all)
    const dateFrom = req.nextUrl.searchParams.get('dateFrom');
    const dateTo = req.nextUrl.searchParams.get('dateTo');

    const where: any = {
      tenantId,
      source: 'radiology',
    };

    if (status === 'unacknowledged') {
      where.acknowledgedAt = null;
    } else if (status === 'acknowledged') {
      where.acknowledgedAt = { not: null };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    // Re-use LabCriticalAlert model with source='radiology'
    const findings = await prisma.labCriticalAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Compute stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const unacknowledged = findings.filter((f: any) => !f.acknowledgedAt).length;
    const acknowledgedToday = findings.filter(
      (f: any) => f.acknowledgedAt && new Date(f.acknowledgedAt) >= todayStart
    ).length;
    const thisWeek = findings.filter((f: any) => new Date(f.createdAt) >= weekStart).length;

    // Compute average communication time in minutes for acknowledged findings
    const ackFindings = findings.filter((f: any) => f.acknowledgedAt);
    const avgCommTime =
      ackFindings.length > 0
        ? Math.round(
            ackFindings.reduce(
              (sum: number, f: any) =>
                sum + (new Date(f.acknowledgedAt).getTime() - new Date(f.createdAt).getTime()),
              0
            ) /
              ackFindings.length /
              60000
          )
        : 0;

    return NextResponse.json({
      findings,
      stats: {
        unacknowledged,
        acknowledgedToday,
        avgCommTimeMinutes: avgCommTime,
        totalThisWeek: thisWeek,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);

/**
 * POST /api/radiology/critical-findings
 *
 * Create a new radiology critical finding alert.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, createCriticalFindingSchema);
    if ('error' in v) return v.error;

    const {
      orderId,
      studyType,
      modality,
      finding,
      patientId,
      patientName,
      mrn,
      encounterId,
      radiologistName,
      severity,
    } = v.data;

    const alert = await prisma.labCriticalAlert.create({
      data: {
        id: uuidv4(),
        tenantId,
        orderId: orderId || null,
        testCode: modality || null,
        testName: studyType || null,
        patientId: patientId || null,
        patientName: patientName || null,
        mrn: mrn || null,
        encounterId: encounterId || null,
        value: finding,
        unit: null,
        criticalType: severity,
        threshold: null,
        source: 'radiology',
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    });

    return NextResponse.json({ success: true, alert });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);

/**
 * PUT /api/radiology/critical-findings
 *
 * Acknowledge a radiology critical finding.
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, acknowledgeFindingSchema);
    if ('error' in v) return v.error;

    const { findingId, communicationMethod, referringPhysicianName, communicationNotes } = v.data;

    // Verify the finding exists and belongs to this tenant
    const existing = await prisma.labCriticalAlert.findFirst({
      where: { id: findingId, tenantId, source: 'radiology' },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    await prisma.labCriticalAlert.updateMany({
      where: { id: findingId, tenantId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        // Store communication details in threshold field as JSON (re-using available column)
        threshold: JSON.stringify({
          communicationMethod,
          referringPhysicianName,
          communicationNotes,
          acknowledgedByName: user?.displayName || user?.email || null,
        }),
      },
    });

    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);
