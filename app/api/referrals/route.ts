import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, role }) => {
  const params = req.nextUrl.searchParams;
  const direction = params.get('direction') || 'outgoing';
  const status = params.get('status');
  const search = params.get('search');
  const scope = params.get('scope') || 'mine';

  const isAdmin = role === 'admin' || role === 'thea-owner';
  const isAdminView = scope === 'all' && isAdmin;

  const where: any = { tenantId };
  const andParts: any[] = [];

  if (!isAdminView) {
    if (direction === 'outgoing') {
      andParts.push({
        OR: [
          { fromProviderId: userId },
          { createdBy: userId },
        ],
      });
    } else {
      // Also match referrals where toProviderId is a ClinicalInfraProvider ID linked to this user via email
      const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      const linkedProviderIds: string[] = [];
      if (userRecord?.email) {
        const linked = await prisma.clinicalInfraProvider.findMany({
          where: { email: { equals: userRecord.email, mode: 'insensitive' } },
          select: { id: true },
        });
        linkedProviderIds.push(...linked.map((p: { id: string }) => p.id));
      }
      andParts.push({
        OR: [
          { toProviderId: userId },
          { toUserId: userId },
          ...(linkedProviderIds.length > 0 ? [{ toProviderId: { in: linkedProviderIds } }] : []),
        ],
      });
    }
  }

  if (status) where.status = status;

  if (search) {
    andParts.push({
      OR: [
        { patientName: { contains: search, mode: 'insensitive' } },
        { patientMrn: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (andParts.length > 0) where.AND = andParts;

  const referrals = await prisma.referral.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ items: referrals, isAdminView });
}, { tenantScoped: true, permissionKey: 'referral.view' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json().catch(() => ({}));
  const bodySchema = z.object({
    patientName: z.string().optional(),
    patientMrn: z.string().optional(),
    fromProviderId: z.string().optional(),
    fromProviderName: z.string().optional(),
    fromSpecialtyCode: z.string().optional(),
    fromSpecialtyName: z.string().optional(),
    toProviderId: z.string().optional(),
    toProviderName: z.string().optional(),
    transferBilling: z.boolean().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  // Resolve toProviderId: if it's a ClinicalInfraProvider ID, find the linked user
  let resolvedToProviderId: string | null = body.toProviderId ?? null;
  if (body.toProviderId) {
    const providerRecord = await prisma.clinicalInfraProvider.findUnique({
      where: { id: body.toProviderId },
      select: { email: true },
    });
    if (providerRecord?.email) {
      const linkedUser = await prisma.user.findFirst({
        where: { tenantId, email: { equals: providerRecord.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (linkedUser) resolvedToProviderId = linkedUser.id;
    }
  }

  const referral = await prisma.referral.create({
    data: {
      tenantId,
      // Patient
      patientName: body.patientName ?? null,
      patientMrn: body.patientMrn ?? null,
      patientMasterId: body.patientId ?? body.patientMasterId ?? null,
      // Encounter — dialog sends `encounterId`, schema field is `encounterCoreId`
      encounterCoreId: body.encounterId ?? body.encounterCoreId ?? null,
      // Type & priority (stored in `urgency`)
      type: body.type ?? null,
      urgency: body.priority ?? body.urgency ?? null,
      reason: body.reason ?? null,
      clinicalNotes: body.clinicalSummary ?? body.clinicalNotes ?? null,
      diagnosisCodes: body.diagnosisCodes ?? null,
      // From
      fromProviderId: body.fromProviderId ?? userId,
      fromProviderName: body.fromProviderName ?? null,
      fromSpecialtyCode: body.fromSpecialtyCode ?? null,
      fromSpecialtyName: body.fromSpecialtyName ?? null,
      // To
      toProviderId: resolvedToProviderId,
      toProviderName: body.toProviderName ?? null,
      toSpecialtyCode: body.toSpecialtyCode ?? null,
      toSpecialtyName: body.toSpecialtyName ?? null,
      externalFacility: body.toFacilityName ?? body.externalFacility ?? null,
      transferBilling: body.transferBilling ?? false,
      // Meta
      status: 'PENDING',
      createdBy: userId,
    },
  });
  const referralId = referral.id;

  if (resolvedToProviderId) {
    await prisma.notification.create({
      data: {
        tenantId,
        recipientUserId: resolvedToProviderId,
        recipientType: 'user',
        type: 'in-app',
        kind: 'ALERT',
        scope: 'OPD',
        title: 'تحويل جديد',
        message: `تحويل جديد من ${body.fromProviderName} - ${body.patientName}`,
        status: 'OPEN',
        metadata: { referralId } as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({ success: true, referralId });
}, { tenantScoped: true, permissionKey: 'referral.create' });
