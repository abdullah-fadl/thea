import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { shadowEvaluate } from '@/lib/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, role, hospitalId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const record = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
  });

  void shadowEvaluate({ legacyDecision: 'allow', action: 'View', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role, hospitalId: hospitalId ?? '' } }, resource: { id: encounterCoreId, type: 'Thea::ClinicalEncounter', attrs: { tenantId, hospitalId: hospitalId ?? '', status: String((record as any)?.status ?? ''), patientId: String((record as any)?.patientId ?? '') } } });

  // Fetch booking for provider/specialty info (works for both normal and healed paths)
  const booking = await prisma.opdBooking.findFirst({
    where: { tenantId, encounterCoreId },
    orderBy: { createdAt: 'desc' },
  });

  let providerInfo: {
    providerId: string | null;
    providerName: string | null;
    providerNameAr: string | null;
    specialtyCode: string | null;
  } | null = null;

  if (booking?.resourceId) {
    const resource = await prisma.schedulingResource.findFirst({
      where: { tenantId, id: booking.resourceId },
    });
    if (resource?.resourceRefProviderId) {
      const provider = await prisma.clinicalInfraProvider.findFirst({
        where: { tenantId, id: resource.resourceRefProviderId },
      });
      providerInfo = {
        providerId: provider?.id || null,
        providerName: provider?.displayName || null,
        providerNameAr: null,
        specialtyCode: booking.specialtyCode || resource.specialtyCode || provider?.specialtyCode || null,
      };
    } else {
      // Resource exists but no linked provider — use resource display name directly
      providerInfo = {
        providerId: null,
        providerName: resource?.displayName || null,
        providerNameAr: resource?.nameAr || null,
        specialtyCode: booking.specialtyCode || resource?.specialtyCode || null,
      };
    }
  } else if (booking?.specialtyCode) {
    // No resource linked, but booking has specialty info
    providerInfo = {
      providerId: null,
      providerName: null,
      providerNameAr: null,
      specialtyCode: booking.specialtyCode,
    };
  }

  if (!record) {
    const encounterCore = await prisma.encounterCore.findFirst({
      where: { tenantId, id: encounterCoreId },
    });
    if (!encounterCore) {
      return NextResponse.json(
        {
          error: 'OPD encounter not found',
          code: 'OPD_ENCOUNTER_MISSING',
          encounterCoreId,
          tenantId,
        },
        { status: 404 }
      );
    }
    if (String(encounterCore.encounterType || '') !== 'OPD') {
      return NextResponse.json(
        {
          error: 'Encounter is not OPD',
          code: 'OPD_ENCOUNTER_TYPE_MISMATCH',
          encounterCoreId,
          tenantId,
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const healed = await prisma.opdEncounter.upsert({
      where: { encounterCoreId },
      create: {
        tenantId,
        encounterCoreId,
        patientId: encounterCore.patientId,
        status: 'OPEN',
        arrivalState: 'NOT_ARRIVED',
        createdAt: encounterCore.createdAt || now,
        updatedAt: now,
        createdByUserId: encounterCore.createdByUserId || null,
      },
      update: {},
    });
    return NextResponse.json({ opd: healed, healed: true, provider: providerInfo });
  }

  return NextResponse.json({ opd: record, provider: providerInfo });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, role, hospitalId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const record = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!record) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  void shadowEvaluate({ legacyDecision: 'allow', action: 'Update', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role, hospitalId: hospitalId ?? '' } }, resource: { id: encounterCoreId, type: 'Thea::ClinicalEncounter', attrs: { tenantId, hospitalId: hospitalId ?? '', status: String((record as any)?.status ?? ''), patientId: String((record as any)?.patientId ?? '') } } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Build a safe update payload — only allow known fields
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if ('followUp' in body && typeof body.followUp === 'object') {
    update.followUp = body.followUp;
  }
  if ('status' in body && typeof body.status === 'string') {
    update.status = body.status;
  }
  if ('notes' in body && typeof body.notes === 'string') {
    update.notes = body.notes;
  }

  const updated = await prisma.opdEncounter.update({
    where: { id: record.id },
    data: update,
  });

  return NextResponse.json({ success: true, opd: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.edit' }
);
