/**
 * Breach Incident Detail API
 * GET   /api/admin/breach-incidents/[incidentId] — Get single incident
 * PATCH /api/admin/breach-incidents/[incidentId] — Update incident
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
// Helpers
// ---------------------------------------------------------------------------

function extractIncidentId(req: NextRequest): string | null {
  const segments = req.nextUrl.pathname.split('/');
  // URL pattern: /api/admin/breach-incidents/[incidentId]
  return segments[segments.length - 1] || null;
}

/** Ordered status flow — index determines allowed transitions (forward only). */
const STATUS_ORDER = ['detected', 'investigating', 'contained', 'resolved', 'reported_to_authority'] as const;
type BreachStatus = (typeof STATUS_ORDER)[number];

function isValidStatus(s: string): s is BreachStatus {
  return (STATUS_ORDER as readonly string[]).includes(s);
}

function canTransition(current: string, next: string): boolean {
  if (!isValidStatus(current) || !isValidStatus(next)) return false;
  const currentIdx = STATUS_ORDER.indexOf(current);
  const nextIdx = STATUS_ORDER.indexOf(next);
  // Allow only forward transitions
  return nextIdx > currentIdx;
}

// ---------------------------------------------------------------------------
// GET — Single incident detail
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const incidentId = extractIncidentId(req);
    if (!incidentId) {
      return NextResponse.json({ error: 'Missing incidentId' }, { status: 400 });
    }

    const incident = await prisma.dataBreachIncident.findFirst({
      where: { id: incidentId, tenantId },
    });

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, incident });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.data.manage' }
);

// ---------------------------------------------------------------------------
// PATCH — Update incident
// ---------------------------------------------------------------------------

interface UpdateBreachBody {
  status?: string;
  rootCause?: string;
  remediation?: string;
  containedAt?: string;
  resolvedAt?: string;
  notifiedAuthority?: boolean;
  notifiedPatients?: boolean;
  affectedRecords?: number;
  affectedPatients?: number;
  dataCategories?: string[];
  notes?: string; // free-text note for timeline entry
}

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const incidentId = extractIncidentId(req);
    if (!incidentId) {
      return NextResponse.json({ error: 'Missing incidentId' }, { status: 400 });
    }

    let body: UpdateBreachBody = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Find the existing incident
    const existing = await prisma.dataBreachIncident.findFirst({
      where: { id: incidentId, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const now = new Date();
    const actorId = userId || 'system';

    // Build update data
    const data: Prisma.DataBreachIncidentUpdateInput = {};
    const timelineEntries: Array<{ date: string; action: string; actor: string; notes: string }> = [];

    // Status transition
    if (typeof body.status === 'string' && body.status !== existing.status) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${STATUS_ORDER.join(', ')}` },
          { status: 400 }
        );
      }
      if (!canTransition(existing.status, body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from "${existing.status}" to "${body.status}". Status can only move forward.` },
          { status: 400 }
        );
      }
      data.status = body.status;
      timelineEntries.push({
        date: now.toISOString(),
        action: `status_changed_to_${body.status}`,
        actor: actorId,
        notes: `Status changed from "${existing.status}" to "${body.status}"`,
      });
    }

    // Root cause
    if (typeof body.rootCause === 'string') {
      data.rootCause = body.rootCause;
      timelineEntries.push({
        date: now.toISOString(),
        action: 'root_cause_updated',
        actor: actorId,
        notes: 'Root cause analysis updated',
      });
    }

    // Remediation
    if (typeof body.remediation === 'string') {
      data.remediation = body.remediation;
      timelineEntries.push({
        date: now.toISOString(),
        action: 'remediation_updated',
        actor: actorId,
        notes: 'Remediation plan updated',
      });
    }

    // Containment timestamp
    if (typeof body.containedAt === 'string') {
      const containedDate = new Date(body.containedAt);
      if (isNaN(containedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid containedAt date' }, { status: 400 });
      }
      data.containedAt = containedDate;
      timelineEntries.push({
        date: now.toISOString(),
        action: 'containment_recorded',
        actor: actorId,
        notes: `Breach contained at ${containedDate.toISOString()}`,
      });
    }

    // Resolution timestamp
    if (typeof body.resolvedAt === 'string') {
      const resolvedDate = new Date(body.resolvedAt);
      if (isNaN(resolvedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid resolvedAt date' }, { status: 400 });
      }
      data.resolvedAt = resolvedDate;
      timelineEntries.push({
        date: now.toISOString(),
        action: 'resolution_recorded',
        actor: actorId,
        notes: `Breach resolved at ${resolvedDate.toISOString()}`,
      });
    }

    // Authority notification
    if (typeof body.notifiedAuthority === 'boolean' && body.notifiedAuthority && !existing.notifiedAuthority) {
      data.notifiedAuthority = true;
      data.authorityNotifiedAt = now;
      timelineEntries.push({
        date: now.toISOString(),
        action: 'authority_notified',
        actor: actorId,
        notes: 'Regulatory authority (SDAIA/NDMO) notified of the breach',
      });
    }

    // Patient notification
    if (typeof body.notifiedPatients === 'boolean' && body.notifiedPatients && !existing.notifiedPatients) {
      data.notifiedPatients = true;
      data.patientsNotifiedAt = now;
      timelineEntries.push({
        date: now.toISOString(),
        action: 'patients_notified',
        actor: actorId,
        notes: 'Affected patients notified of the breach',
      });
    }

    // Affected counts
    if (typeof body.affectedRecords === 'number' && body.affectedRecords >= 0) {
      data.affectedRecords = body.affectedRecords;
    }
    if (typeof body.affectedPatients === 'number' && body.affectedPatients >= 0) {
      data.affectedPatients = body.affectedPatients;
    }

    // Data categories
    if (Array.isArray(body.dataCategories)) {
      data.dataCategories = body.dataCategories.filter((c): c is string => typeof c === 'string');
    }

    // Free-text note
    if (typeof body.notes === 'string' && body.notes.trim()) {
      timelineEntries.push({
        date: now.toISOString(),
        action: 'note_added',
        actor: actorId,
        notes: body.notes.trim(),
      });
    }

    // Merge timeline entries
    if (timelineEntries.length > 0) {
      const existingTimeline = Array.isArray(existing.timeline) ? existing.timeline : [];
      const mergedTimeline = [...existingTimeline, ...timelineEntries];
      data.timeline = mergedTimeline as Prisma.InputJsonValue;
    }

    // Nothing to update
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.dataBreachIncident.update({
      where: { id: incidentId },
      data,
    });

    // Audit log
    await createAuditLog(
      'data_breach_incident',
      incidentId,
      'breach_updated',
      actorId,
      undefined,
      {
        updatedFields: Object.keys(data),
        statusChange: body.status !== existing.status ? { from: existing.status, to: body.status } : undefined,
      },
      tenantId,
      req
    );

    logger.info('Data breach incident updated', {
      category: 'privacy',
      tenantId,
      incidentId,
      updatedFields: Object.keys(data),
    });

    return NextResponse.json({ success: true, incident: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.data.manage' }
);
