import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PLACE_OF_DEATH = ['ER', 'IPD', 'OPD', 'OTHER'] as const;

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    encounterCoreId: z.string().min(1),
    deathDateTime: z.string().min(1),
    placeOfDeath: z.string().min(1),
    preliminaryCause: z.string().optional(),
    notes: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(body?.encounterCoreId || '').trim();
  const deathDateTimeRaw = String(body?.deathDateTime || '').trim();
  const placeOfDeath = String(body?.placeOfDeath || '').trim().toUpperCase();
  const preliminaryCause = String(body?.preliminaryCause || '').trim();
  const notes = String(body?.notes || '').trim();

  const missing: string[] = [];
  const invalid: string[] = [];
  if (!encounterCoreId) missing.push('encounterCoreId');
  if (!deathDateTimeRaw) missing.push('deathDateTime');
  if (!placeOfDeath) missing.push('placeOfDeath');
  if (placeOfDeath && !PLACE_OF_DEATH.includes(placeOfDeath as any)) invalid.push('placeOfDeath');

  const deathDateTime = deathDateTimeRaw ? new Date(deathDateTimeRaw) : null;
  if (deathDateTimeRaw && (!deathDateTime || Number.isNaN(deathDateTime.getTime()))) {
    invalid.push('deathDateTime');
  }

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { id: encounterCoreId, tenantId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const existing = await prisma.deathDeclaration.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, declaration: existing });
  }

  const declaration = await prisma.deathDeclaration.create({
    data: {
      tenantId,
      patientId: encounter.patientId,
      encounterCoreId,
      declaredAt: deathDateTime || new Date(),
      declaredBy: userId || undefined,
      causeOfDeath: preliminaryCause || undefined,
      placeOfDeath,
      notes: notes || undefined,
    },
  });

  await createAuditLog(
    'death_declaration',
    declaration.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: declaration },
    tenantId
  );

  return NextResponse.json({ success: true, declaration });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' });
