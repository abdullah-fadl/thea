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
    const patientMasterId = searchParams.get('patientMasterId') || undefined;
    const followUpNeeded = searchParams.get('followUpNeeded');

    const records = await prisma.patientEducationRecord.findMany({
      where: {
        tenantId,
        ...(patientMasterId ? { patientMasterId } : {}),
        ...(followUpNeeded === 'true' ? { followUpNeeded: true } : {}),
      },
      orderBy: { educationDate: 'desc' },
      take: 200,
    });

    return NextResponse.json({ records });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patient_education.view' }
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
      educationDate,
      topics,
      method,
      barriers,
      interpreter,
      comprehension,
      followUpNeeded,
      notes,
    } = body;

    if (!patientMasterId) {
      return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
    }

    const record = await prisma.patientEducationRecord.create({
      data: {
        tenantId,
        patientMasterId: String(patientMasterId),
        episodeId: episodeId ? String(episodeId) : null,
        educatorId: userId,
        educationDate: educationDate ? new Date(educationDate) : new Date(),
        topics: topics ?? [],
        method: Array.isArray(method) ? method : (method ? [String(method)] : []),
        barriers: Array.isArray(barriers) ? barriers : (barriers ? [String(barriers)] : []),
        // interpreter is Boolean in schema
        interpreter: Boolean(interpreter),
        comprehension: comprehension ? String(comprehension) : 'VERBALIZED_UNDERSTANDING',
        followUpNeeded: Boolean(followUpNeeded),
        notes: notes ? String(notes) : null,
      },
    });

    return NextResponse.json({ success: true, id: record.id, record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patient_education.manage' }
);
