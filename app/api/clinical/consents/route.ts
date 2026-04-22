import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createConsentSchema } from '@/lib/validation/clinical.schema';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const encounterId = String(req.nextUrl.searchParams.get('encounterId') || '').trim();
  const patientId = String(req.nextUrl.searchParams.get('patientId') || '').trim();

  const filter: any = { tenantId };
  if (encounterId) filter.encounterId = encounterId;
  if (patientId) filter.patientId = patientId;

  const items = await prisma.clinicalConsent.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ items });
}), { resourceType: 'consent', sensitive: true, extractPatientId: (req) => req.nextUrl.searchParams.get('patientId'), logResponseMeta: true }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.registration' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createConsentSchema);
  if ('error' in v) return v.error;

  const consentType = String(v.data.consentType || '').trim();
  const patientId = String(v.data.patientId || '').trim();
  const encounterId = v.data.encounterId ? String(v.data.encounterId || '').trim() : null;
  const signatureData = String(v.data.signatureData || '').trim();
  const signedBy = String(v.data.signedBy || '').trim();

  if (!consentType || !patientId || !signatureData || !signedBy) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const now = new Date();
  const consent = await prisma.clinicalConsent.create({
    data: {
      tenantId,
      consentType,
      patientId,
      encounterId,
      signatureData,
      signedBy,
      guardianName: body.guardianName || null,
      guardianRelation: body.guardianRelation || null,
      witnessName: body.witnessName || null,
      notes: body.notes || null,
      signedAt: body.signedAt || now.toISOString(),
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  return NextResponse.json({ consent });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.registration' }
);
