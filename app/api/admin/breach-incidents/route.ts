/**
 * Breach Incident Management API
 * GET  /api/admin/breach-incidents — List all breach incidents for the tenant
 * POST /api/admin/breach-incidents — Report a new breach incident
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET — List breach incidents
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where: Prisma.DataBreachIncidentWhereInput = { tenantId };
    if (status) {
      where.status = status;
    }

    const incidents = await prisma.dataBreachIncident.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, incidents, count: incidents.length });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.data.manage' }
);

// ---------------------------------------------------------------------------
// POST — Report a new breach incident
// ---------------------------------------------------------------------------

interface CreateBreachBody {
  title?: string;
  description?: string;
  severity?: string;
  affectedRecords?: number;
  affectedPatients?: number;
  dataCategories?: string[];
}

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: CreateBreachBody = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const severity = typeof body.severity === 'string' && VALID_SEVERITIES.includes(body.severity)
      ? body.severity
      : 'medium';

    const affectedRecords = typeof body.affectedRecords === 'number' && body.affectedRecords >= 0
      ? body.affectedRecords
      : 0;

    const affectedPatients = typeof body.affectedPatients === 'number' && body.affectedPatients >= 0
      ? body.affectedPatients
      : 0;

    const dataCategories = Array.isArray(body.dataCategories)
      ? body.dataCategories.filter((c): c is string => typeof c === 'string')
      : [];

    const now = new Date();
    const actorId = userId || 'system';

    const initialTimeline: Prisma.InputJsonValue = [
      {
        date: now.toISOString(),
        action: 'incident_reported',
        actor: actorId,
        notes: `Breach incident reported: ${title}`,
      },
    ];

    const incident = await prisma.dataBreachIncident.create({
      data: {
        tenantId,
        title,
        description,
        severity,
        status: 'detected',
        detectedAt: now,
        detectedBy: actorId,
        affectedRecords,
        affectedPatients,
        dataCategories,
        timeline: initialTimeline,
      },
    });

    // Audit log
    await createAuditLog(
      'data_breach_incident',
      incident.id,
      'breach_reported',
      actorId,
      undefined,
      { title, severity, affectedRecords, affectedPatients, dataCategories },
      tenantId,
      req
    );

    logger.info('Data breach incident reported', {
      category: 'privacy',
      tenantId,
      incidentId: incident.id,
      severity,
    });

    return NextResponse.json({ success: true, incident }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.data.manage' }
);
