import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const buildBodyTagNumber = (date: Date, encounterCoreId: string) => {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `M-${yyyy}${mm}${dd}-${String(encounterCoreId).slice(0, 4).toUpperCase()}`;
};

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    encounterCoreId: z.string().min(1),
    finalizeReason: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(body?.encounterCoreId || '').trim();
  const finalizeReason = String(body?.finalizeReason || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'Validation failed', missing: ['encounterCoreId'], invalid: [] }, { status: 400 });
  }

  const declaration = await prisma.deathDeclaration.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!declaration) {
    return NextResponse.json({ error: 'Death declaration not found' }, { status: 409 });
  }

  if (declaration.finalisedAt) {
    const existingCase = await prisma.mortuaryCase.findFirst({
      where: { tenantId, encounterCoreId },
    });
    return NextResponse.json({ success: true, noOp: true, declaration, mortuaryCase: existingCase || null });
  }

  const now = new Date();
  await prisma.deathDeclaration.update({
    where: { id: declaration.id },
    data: { finalisedAt: now, finalisedBy: userId || null, isFinalised: true },
  });

  await createAuditLog(
    'death_declaration',
    String(declaration.id || encounterCoreId),
    'FINALIZE',
    userId || 'system',
    user?.email,
    { before: declaration, after: { ...declaration, finalisedAt: now, finalisedBy: userId || null, isFinalised: true } },
    tenantId
  );

  let mortuaryCase = await prisma.mortuaryCase.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!mortuaryCase) {
    const bodyTagNumber = buildBodyTagNumber(now, encounterCoreId);
    mortuaryCase = await prisma.mortuaryCase.create({
      data: {
        id: bodyTagNumber,
        tenantId,
        encounterCoreId,
        patientMasterId: String(declaration.patientId || ''),
        createdAt: now,
        createdByUserId: userId || null,
        status: 'OPEN',
        bodyTagNumber,
        location: { morgueRoom: '', shelf: '' } as Prisma.InputJsonValue,
      },
    });
    await createAuditLog(
      'mortuary_case',
      mortuaryCase.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: mortuaryCase },
      tenantId
    );
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (encounter && encounter.status !== 'CLOSED') {
    const patch: Record<string, unknown> = {
      status: 'CLOSED',
      closedAt: now,
      closedByUserId: userId || null,
    };
    await prisma.encounterCore.update({
      where: { id: encounterCoreId },
      data: patch,
    });
    await createAuditLog(
      'encounter_core',
      encounterCoreId,
      'CLOSE',
      userId || 'system',
      user?.email,
      { before: encounter, after: { ...encounter, ...patch } },
      tenantId
    );
  }

  const updatedDeclaration = await prisma.deathDeclaration.findFirst({
    where: { tenantId, encounterCoreId },
  });

  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, encounterId: encounterCoreId },
  });
  if (episode) {
    await prisma.ipdEpisode.updateMany({
      where: { tenantId, encounterId: encounterCoreId },
      data: { status: 'DECEASED', closedAt: now, updatedAt: now, updatedByUserId: userId || null },
    });
    await prisma.ipdAdmission.updateMany({
      where: { tenantId, encounterId: encounterCoreId, releasedAt: null, isActive: true },
      data: { releasedAt: now, releasedByUserId: userId || null, isActive: false },
    });
  }

  return NextResponse.json({ success: true, declaration: updatedDeclaration, mortuaryCase });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' });
