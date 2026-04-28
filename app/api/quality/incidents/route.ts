import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessQuality } from '@/lib/quality/access';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { emit } from '@/lib/events';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessQuality({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const items = await prisma.qualityIncident.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.view' });

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
  if (!canAccessQuality({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    type: z.string().min(1),
    severity: z.string().min(1),
    location: z.string().min(1),
    encounterCoreId: z.string().optional(),
    episodeId: z.string().optional(),
    description: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const type = String(body.type || '').trim();
  const severity = String(body.severity || '').trim().toUpperCase();
  const location = String(body.location || '').trim();
  const encounterCoreId = String(body.encounterCoreId || '').trim() || null;
  const episodeId = String(body.episodeId || '').trim() || null;
  const description = String(body.description || '').trim() || null;

  const missing: string[] = [];
  const invalid: string[] = [];
  if (!type) missing.push('type');
  if (!severity) missing.push('severity');
  if (!location) missing.push('location');
  if (severity && !SEVERITIES.has(severity)) invalid.push('severity');

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const now = new Date();
  const incident = await prisma.qualityIncident.create({
    data: {
      tenantId,
      type,
      severity,
      location,
      encounterCoreId,
      episodeId,
      description,
      status: 'OPEN',
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  await createAuditLog(
    'quality_incident',
    incident.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: incident },
    tenantId
  );

  // Emit incident.reported@v1 — best-effort, never breaks the response.
  try {
    await emit({
      eventName: 'incident.reported',
      version: 1,
      tenantId,
      aggregate: 'quality_incident',
      aggregateId: incident.id,
      payload: {
        incidentId: incident.id,
        tenantId,
        type: incident.type ?? type,
        severity: (incident.severity ?? severity) as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        status: 'OPEN',
        encounterCoreId: incident.encounterCoreId ?? null,
        reportedAt: (incident.createdAt instanceof Date ? incident.createdAt : now).toISOString(),
      },
    });
  } catch (e) {
    logger.error('events.emit_failed', { category: 'sam', eventName: 'incident.reported', error: e });
  }

  return NextResponse.json({ success: true, id: incident.id });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.manage' });
