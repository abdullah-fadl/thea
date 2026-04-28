import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';
import { RETENTION_POLICY, isRetentionExpired } from '@/lib/privacy/retention-policy';
import { buildAnonymizationUpdate, PII_FIELDS } from '@/lib/privacy/anonymization';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RetainedCategory {
  category: string;
  reason: string;
  regulation: string;
  retentionPeriod: string;
  recordCount: number;
}

interface DeletedCategory {
  category: string;
  action: 'anonymized' | 'deleted';
  recordCount: number;
}

// ---------------------------------------------------------------------------
// Helper: count records for a patient across clinical tables
// ---------------------------------------------------------------------------

async function countPatientRecords(tenantId: string, patientId: string) {
  const [encounters, orders, notes, consents, opdEncounters] = await Promise.all([
    prisma.ehrEncounter.count({ where: { tenantId, patientId } }),
    prisma.ehrOrder.count({ where: { tenantId, patientId } }),
    prisma.ehrNote.count({ where: { tenantId, patientId } }),
    prisma.clinicalConsent.count({ where: { tenantId, patientId } }),
    prisma.opdEncounter.count({ where: { tenantId, patientId } }),
  ]);

  return { encounters, orders, notes, consents, opdEncounters };
}

// ---------------------------------------------------------------------------
// Helper: Anonymize patient demographics on EhrPatient
// ---------------------------------------------------------------------------

async function anonymizePatientDemographics(
  tenantId: string,
  patientId: string,
): Promise<number> {
  const patient = await prisma.ehrPatient.findFirst({
    where: { tenantId, id: patientId },
  });

  if (!patient) return 0;

  const patientRecord = patient as unknown as Record<string, unknown>;
  const updateData = buildAnonymizationUpdate(patientRecord);

  if (Object.keys(updateData).length === 0) return 0;

  await prisma.ehrPatient.update({
    where: { id: patientId },
    data: updateData,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Helper: Anonymize patient demographics on PatientMaster (if exists)
// ---------------------------------------------------------------------------

async function anonymizePatientMaster(
  tenantId: string,
  patientId: string,
): Promise<number> {
  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientId },
  });

  if (!patient) return 0;

  const patientRecord = patient as unknown as Record<string, unknown>;
  const updateData = buildAnonymizationUpdate(patientRecord);

  if (Object.keys(updateData).length === 0) return 0;

  await prisma.patientMaster.update({
    where: { id: patientId },
    data: updateData,
  });

  return 1;
}

// ---------------------------------------------------------------------------
// POST /api/patients/[id]/erasure/execute
// Execute an approved PDPL erasure request.
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const routeParams = (params && typeof params === 'object')
      ? params as Record<string, string | string[]>
      : {};
    const patientId = String(routeParams.id || '').trim();

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Validate the erasure request
    // -----------------------------------------------------------------------

    const erasureRequest = await prisma.dataErasureRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
        patientId,
      },
    });

    if (!erasureRequest) {
      return NextResponse.json(
        { error: 'Erasure request not found' },
        { status: 404 },
      );
    }

    if (erasureRequest.status !== 'pending' && erasureRequest.status !== 'approved') {
      return NextResponse.json(
        {
          error: `Erasure request cannot be executed in status "${erasureRequest.status}"`,
          currentStatus: erasureRequest.status,
        },
        { status: 400 },
      );
    }

    // Validate patient exists
    const patient = await prisma.ehrPatient.findFirst({
      where: { tenantId, id: patientId },
      select: { id: true, mrn: true, createdAt: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    logger.info('PDPL erasure execution started', {
      category: 'privacy',
      tenantId,
      patientId,
      requestId,
      executedBy: userId,
    });

    // -----------------------------------------------------------------------
    // Determine retention status for each data category
    // -----------------------------------------------------------------------

    const recordCounts = await countPatientRecords(tenantId, patientId);
    const patientCreatedAt = patient.createdAt ?? new Date();

    const retained: RetainedCategory[] = [];
    const deleted: DeletedCategory[] = [];

    // --- Medical records (encounters, orders, notes) ---
    const medicalRecordsRetained = !isRetentionExpired('medical_records', patientCreatedAt);

    if (medicalRecordsRetained) {
      const totalMedical = recordCounts.encounters + recordCounts.orders + recordCounts.notes + recordCounts.opdEncounters;
      if (totalMedical > 0) {
        retained.push({
          category: 'medical_records',
          reason: `Within ${RETENTION_POLICY.medical_records.label} retention period (${RETENTION_POLICY.medical_records.regulation})`,
          regulation: RETENTION_POLICY.medical_records.regulation,
          retentionPeriod: RETENTION_POLICY.medical_records.label,
          recordCount: totalMedical,
        });
      }
    }

    // --- Audit logs: NEVER deleted ---
    const auditLogCount = await prisma.auditLog.count({
      where: {
        tenantId,
        resourceId: patientId,
      },
    });

    if (auditLogCount > 0) {
      retained.push({
        category: 'audit_logs',
        reason: `Audit logs are immutable per ${RETENTION_POLICY.audit_logs.regulation} compliance requirements`,
        regulation: RETENTION_POLICY.audit_logs.regulation,
        retentionPeriod: RETENTION_POLICY.audit_logs.label,
        recordCount: auditLogCount,
      });
    }

    // --- Consent records: always retained ---
    if (recordCounts.consents > 0) {
      retained.push({
        category: 'consent_records',
        reason: `Consent records retained as proof of consent per ${RETENTION_POLICY.consent_records.regulation}`,
        regulation: RETENTION_POLICY.consent_records.regulation,
        retentionPeriod: RETENTION_POLICY.consent_records.label,
        recordCount: recordCounts.consents,
      });
    }

    // -----------------------------------------------------------------------
    // Execute anonymization of PII (contact information)
    // -----------------------------------------------------------------------

    let demographicsAnonymized = 0;

    // Anonymize EhrPatient demographics
    const ehrAnonymized = await anonymizePatientDemographics(tenantId, patientId);
    demographicsAnonymized += ehrAnonymized;

    // Anonymize PatientMaster demographics (if present)
    const masterAnonymized = await anonymizePatientMaster(tenantId, patientId);
    demographicsAnonymized += masterAnonymized;

    if (demographicsAnonymized > 0) {
      deleted.push({
        category: 'contact_information',
        action: 'anonymized',
        recordCount: demographicsAnonymized,
      });
    }

    // Log every anonymized PII field category
    logger.info('PDPL erasure: patient demographics anonymized', {
      category: 'privacy',
      tenantId,
      patientId,
      requestId,
      fieldsAnonymized: PII_FIELDS.slice(),
      recordsAffected: demographicsAnonymized,
    });

    // -----------------------------------------------------------------------
    // Determine final status
    // -----------------------------------------------------------------------

    const finalStatus = retained.length > 0 ? 'partially_completed' : 'completed';
    const now = new Date();

    await prisma.dataErasureRequest.update({
      where: { id: requestId },
      data: {
        status: finalStatus,
        reviewedBy: userId,
        reviewedAt: now,
        completedAt: now,
        retainedData: retained.length > 0 ? retained as any : undefined,
        deletedData: deleted.length > 0 ? deleted as any : undefined,
      },
    });

    // -----------------------------------------------------------------------
    // Comprehensive audit trail
    // -----------------------------------------------------------------------

    await createAuditLog(
      'data_erasure_request',
      requestId,
      'EXECUTE',
      userId,
      user?.email ?? undefined,
      {
        patientId,
        patientMrn: patient.mrn,
        finalStatus,
        retainedCategories: retained.map((r) => r.category),
        deletedCategories: deleted.map((d) => d.category),
        retainedDetails: retained,
        deletedDetails: deleted,
        action: 'pdpl_erasure_executed',
      },
      tenantId,
      req,
    );

    logger.info('PDPL erasure execution completed', {
      category: 'privacy',
      tenantId,
      patientId,
      requestId,
      finalStatus,
      retainedCount: retained.length,
      deletedCount: deleted.length,
      executedBy: userId,
    });

    return NextResponse.json({
      success: true,
      status: finalStatus,
      message:
        finalStatus === 'completed'
          ? 'All eligible patient data has been erased.'
          : 'Erasure partially completed. Some data is retained due to legal requirements.',
      summary: {
        retained,
        deleted,
      },
      requestId,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'admin.data.manage',
  },
);
