import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const infectionType = searchParams.get('infectionType') || undefined;
    const outcome = searchParams.get('outcome') || undefined;
    const activeIsolation = searchParams.get('activeIsolation');
    const notifiable = searchParams.get('notifiable');

    const records = await prisma.infectionSurveillance.findMany({
      where: {
        tenantId,
        ...(infectionType ? { infectionType } : {}),
        ...(outcome ? { outcome } : {}),
        ...(notifiable === 'true' ? { notifiable: true } : {}),
        ...(activeIsolation === 'true'
          ? { isolationPrecautions: { isEmpty: false }, outcome: { not: 'RESOLVED' } }
          : {}),
      },
      orderBy: { reportDate: 'desc' },
      take: 200,
    });

    return NextResponse.json({ records });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      patientMasterId,
      episodeId,
      reportDate,
      infectionType,
      onset,
      organism,
      sensitivityProfile,
      isolationPrecautions,
      treatmentStarted,
      treatment,
      outcome,
      notifiable,
      notes,
    } = body;

    if (!patientMasterId || !infectionType) {
      return NextResponse.json({ error: 'patientMasterId and infectionType are required' }, { status: 400 });
    }

    const record = await prisma.infectionSurveillance.create({
      data: {
        tenantId,
        patientMasterId: String(patientMasterId),
        episodeId: episodeId ? String(episodeId) : null,
        reportedBy: userId,
        reportDate: reportDate ? new Date(reportDate) : new Date(),
        infectionType: String(infectionType),
        // onset is a string enum: COMMUNITY | HEALTHCARE_ASSOCIATED
        onset: onset ? String(onset) : 'COMMUNITY',
        organism: organism ? String(organism) : null,
        sensitivityProfile: sensitivityProfile ?? null,
        isolationPrecautions: Array.isArray(isolationPrecautions) ? isolationPrecautions : [],
        // treatmentStarted is Boolean
        treatmentStarted: Boolean(treatmentStarted),
        treatment: treatment ? String(treatment) : null,
        outcome: outcome ? String(outcome) : 'ACTIVE',
        notifiable: Boolean(notifiable),
        notes: notes ? String(notes) : null,
      },
    });

    return NextResponse.json({ success: true, id: record.id, record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);
