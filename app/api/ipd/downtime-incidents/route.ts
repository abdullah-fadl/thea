import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  episodeId: z.string().min(1, 'episodeId is required'),
  startedAt: z.string().min(1, 'startedAt is required'),
  endedAt: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

function parseDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  const role = String((user as unknown as Record<string, unknown>)?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const episodeId = String(v.data.episodeId).trim();
  const startedAt = parseDate(body.startedAt);
  const endedAt = parseDate(body.endedAt);
  const notes = String(body.notes || '').trim() || null;
  const missing: string[] = [];
  const invalid: string[] = [];
  if (!episodeId) missing.push('episodeId');
  if (!startedAt) missing.push('startedAt');
  if (body.endedAt && !endedAt) invalid.push('endedAt');
  if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) invalid.push('endedAt');
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const now = new Date();
  const doc = await prisma.ipdDowntimeIncident.create({
    data: {
      tenantId,
      episodeId,
      startedAt: startedAt!,
      endedAt: endedAt || null,
      notes,
      createdAt: now,
      createdByUserId: userId,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_downtime_incident',
    entityId: doc.id,
    action: 'CREATE',
    after: doc,
    ip,
  });

  return NextResponse.json({ success: true, incident: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
