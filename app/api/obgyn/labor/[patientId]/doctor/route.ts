import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/obgyn/labor/[patientId]/doctor
 * Returns all doctor assessments for this patient.
 *
 * POST /api/obgyn/labor/[patientId]/doctor
 * Saves a doctor assessment.
 * Body: {
 *   dilation: number,
 *   station: number,
 *   effacement: number,
 *   membranesStatus: string,
 *   plan: string,
 *   deliveryDecision: 'AWAIT'|'AUGMENT'|'CSECTION'|'INSTRUMENTAL'|'NORMAL',
 *   bishopScore: number,
 *   soapSubjective: string,
 *   soapObjective: string,
 *   soapAssessment: string,
 *   soapPlan: string,
 *   prescriptions: string,
 *   notes: string,
 * }
 */

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const patientId = String((params as Record<string, string>)?.patientId || '').trim();
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    const entries = await prisma.obgynForm.findMany({
      where: { tenantId, patientId, type: 'labor_doctor' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ entries });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const patientId = String((params as Record<string, string>)?.patientId || '').trim();
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    const assessmentData = {
      assessedAt: new Date().toISOString(),
      dilation: Number(body?.dilation) || null,
      station: body?.station !== undefined ? Number(body.station) : null,
      effacement: Number(body?.effacement) || null,
      membranesStatus: body?.membranesStatus ?? '',
      plan: body?.plan ?? '',
      deliveryDecision: body?.deliveryDecision ?? 'AWAIT',
      bishopScore: body?.bishopScore !== undefined ? Number(body.bishopScore) : null,
      soapSubjective: body?.soapSubjective ?? '',
      soapObjective: body?.soapObjective ?? '',
      soapAssessment: body?.soapAssessment ?? '',
      soapPlan: body?.soapPlan ?? '',
      prescriptions: body?.prescriptions ?? '',
      notes: body?.notes ?? '',
    };

    const entry = await prisma.obgynForm.create({
      data: {
        tenantId,
        patientId,
        type: 'labor_doctor',
        data: assessmentData as Record<string, unknown>,
        createdBy: userId || null,
      } as Parameters<typeof prisma.obgynForm.create>[0]['data'],
    });

    return NextResponse.json({ success: true, entry });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.edit' }
);
