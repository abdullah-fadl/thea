import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { logDataExport } from '@/lib/audit/accessLogger';
import { checkRateLimitRedis, getRequestIp } from '@/lib/security/rateLimit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/** 1 export per hour per user */
const PORTAL_EXPORT_MAX = 1;
const PORTAL_EXPORT_WINDOW_MS = 3_600_000; // 1 hour

// ─── Field stripping ────────────────────────────────────────────────────────────

/** Fields to strip from all exported records */
const INTERNAL_FIELDS = new Set([
  'id',
  'tenantId',
  'createdBy',
  'updatedBy',
  'createdByUserId',
  'recordedByUserId',
  'authoredBy',
  'orderedBy',
  'attendingPhysicianId',
  'witnessName',
  'signatureData',
]);

function stripInternalFields<T extends Record<string, unknown>>(
  record: T,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (INTERNAL_FIELDS.has(key)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function stripMany<T extends Record<string, unknown>>(
  records: T[],
): Record<string, unknown>[] {
  return records.map(stripInternalFields);
}

// ─── GET handler ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate via portal session (reads 'portal-token' cookie)
    const auth = await requirePortalSession(req);
    if (auth instanceof NextResponse) return auth;

    const patientId = auth.patientMasterId;
    if (!patientId) {
      return NextResponse.json({ error: 'No patient linked to this account' }, { status: 403 });
    }

    // 2. Rate limit — 1 per hour per patient
    const rateLimitKey = `portal_export:${patientId}`;
    const rl = await checkRateLimitRedis(rateLimitKey, PORTAL_EXPORT_MAX, PORTAL_EXPORT_WINDOW_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. You can export once per hour.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    // 3. Look up the patient record
    const patient = await prisma.patientMaster.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: patientId,
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient record not found' }, { status: 404 });
    }

    // 4. Gather all patient data in parallel
    const [encounters, orders, notes, consents, opdVisits] = await Promise.all([
      prisma.encounterCore.findMany({
        where: { tenantId: auth.tenantId, patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.ordersHub.findMany({
        where: { tenantId: auth.tenantId, patientMasterId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.opdVisitNote.findMany({
        where: { tenantId: auth.tenantId, patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.clinicalConsent.findMany({
        where: { tenantId: auth.tenantId, patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.opdEncounter.findMany({
        where: { tenantId: auth.tenantId, patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    // 5. Calculate total record count for audit
    const totalRecords =
      1 + encounters.length + orders.length + notes.length + consents.length + opdVisits.length;

    // 6. Build the export payload
    const exportPayload = {
      exportDate: new Date().toISOString(),
      dataSubject: {
        name: patient.fullName || [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
        mrn: patient.mrn ?? undefined,
      },
      sections: {
        demographics: stripInternalFields({
          ...patient,
          // Re-add safe identifiers explicitly
          mrn: patient.mrn,
        } as unknown as Record<string, unknown>),
        encounters: stripMany(encounters as unknown as Record<string, unknown>[]),
        orders: stripMany(orders as unknown as Record<string, unknown>[]),
        clinicalNotes: stripMany(notes as unknown as Record<string, unknown>[]),
        consents: stripMany(consents as unknown as Record<string, unknown>[]),
        opdVisits: stripMany(opdVisits as unknown as Record<string, unknown>[]),
      },
      metadata: {
        pdplVersion: '1.0',
        exportFormat: 'JSON',
        generatedBy: 'Thea EHR - PDPL Data Export',
      },
    };

    // 7. Audit log the export
    const ip = getRequestIp(req);
    logDataExport({
      tenantId: auth.tenantId,
      userId: auth.portalUserId ?? patientId,
      userRole: 'patient',
      userEmail: auth.mobile,
      exportType: 'pdpl_patient_self_service',
      recordCount: totalRecords,
      format: 'JSON',
      ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
      path: '/api/portal/data-export',
    }).catch(() => {
      // Fire-and-forget — audit must never break the export
    });

    logger.info('PDPL patient data export generated', {
      category: 'privacy',
      tenantId: auth.tenantId,
      patientId: patientId,
      recordCount: totalRecords,
    });

    // 8. Return as downloadable JSON
    const body = JSON.stringify(exportPayload, null, 2);
    const fileName = `my-health-data-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Portal data export error', {
      category: 'api',
      route: 'GET /api/portal/data-export',
      error,
    });
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 },
    );
  }
}
