import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const exportReportSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  sections: z.array(z.enum([
    'patient_info',
    'diagnosis',
    'medications',
    'lab_results',
    'radiology',
    'vitals',
    'visit_notes',
    'orders',
    'procedures',
    'allergies',
  ])).optional().default([
    'patient_info',
    'diagnosis',
    'medications',
    'lab_results',
    'vitals',
    'visit_notes',
    'allergies',
  ]),
  format: z.enum(['json', 'pdf_data']).default('pdf_data'),
});

/**
 * POST /api/opd/reports/export
 * Generate PDF-ready medical report data for an encounter.
 * Aggregates patient info, diagnosis, lab results, medications, vitals, etc.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, exportReportSchema);
    if ('error' in v) return v.error;

    const { encounterCoreId, sections, format } = v.data;

    // Validate encounter
    const encounter = await prisma.encounterCore.findFirst({
      where: { id: encounterCoreId, tenantId },
    });
    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found', errorAr: 'الزيارة غير موجودة' },
        { status: 404 }
      );
    }

    const report: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      generatedBy: user?.displayName || user?.email || null,
      encounterCoreId,
      encounterType: encounter.encounterType,
    };

    // Patient info
    if (sections.includes('patient_info') && encounter.patientId) {
      const patient = await prisma.patientMaster.findFirst({
        where: { id: encounter.patientId, tenantId },
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          dob: true,
          gender: true,
          mrn: true,
          nationality: true,
          nationalId: true,
        },
      });
      report.patient = patient
        ? {
            id: patient.id,
            fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            dob: patient.dob,
            gender: patient.gender,
            mrn: patient.mrn || null,
            nationality: patient.nationality,
          }
        : null;
    }

    // Diagnosis — stored as JSON in OpdVisitNote.diagnoses
    if (sections.includes('diagnosis')) {
      const visitNote = await prisma.opdVisitNote.findFirst({
        where: { encounterCoreId, tenantId },
        orderBy: { createdAt: 'desc' },
        select: { diagnoses: true, createdAt: true },
      });
      const diagnosisItems = Array.isArray(visitNote?.diagnoses) ? visitNote.diagnoses : [];
      report.diagnoses = (diagnosisItems as any[]).map((d: any) => ({
        code: d.code || d.icdCode,
        description: d.description || d.diagnosisText,
        descriptionAr: d.descriptionAr,
        type: d.diagnosisType || d.type,
        severity: d.severity,
        confirmed: d.confirmed,
      }));
    }

    // Medications / Prescriptions
    if (sections.includes('medications')) {
      const prescriptions = await prisma.pharmacyPrescription.findMany({
        where: { tenantId, encounterId: encounterCoreId },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      report.medications = prescriptions.map((p: any) => ({
        id: p.id,
        medication: p.medication,
        genericName: p.genericName,
        dose: p.dose,
        frequency: p.frequency,
        route: p.route,
        duration: p.duration,
        status: p.status,
        instructions: p.instructions,
        prescribedAt: p.createdAt,
      }));
    }

    // Lab results
    if (sections.includes('lab_results')) {
      const labResults = await prisma.labResult.findMany({
        where: { tenantId, encounterId: encounterCoreId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      report.labResults = labResults.map((r: any) => ({
        id: r.id,
        testName: r.testName,
        testCode: r.testCode,
        parameters: r.parameters,
        status: r.status,
        collectedAt: r.collectedAt,
        resultedAt: r.resultedAt,
        verifiedAt: r.verifiedAt,
      }));
    }

    // Vitals
    if (sections.includes('vitals')) {
      const opd = await prisma.opdEncounter.findFirst({
        where: { encounterCoreId, tenantId },
        include: {
          nursingEntries: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      report.vitals = (opd?.nursingEntries || []).map((entry: any) => ({
        id: entry.id,
        vitalSigns: entry.vitalSigns,
        recordedAt: entry.createdAt,
        recordedBy: entry.createdBy,
      }));
    }

    // Visit notes
    if (sections.includes('visit_notes')) {
      const notes = await prisma.opdVisitNote.findMany({
        where: { encounterCoreId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      report.visitNotes = notes.map((n: any) => ({
        id: n.id,
        noteType: n.noteType,
        subjective: n.subjective,
        objective: n.objective,
        assessment: n.assessment,
        plan: n.plan,
        content: n.content,
        createdAt: n.createdAt,
        createdBy: n.authorName || n.createdBy,
      }));
    }

    // Orders
    if (sections.includes('orders')) {
      const orders = await prisma.ordersHub.findMany({
        where: { encounterCoreId, tenantId },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      report.orders = orders.map((o: any) => ({
        id: o.id,
        orderType: o.orderType,
        displayName: o.displayName,
        status: o.status,
        priority: o.priority,
        orderedAt: o.createdAt,
        orderedBy: o.orderedByName,
      }));
    }

    // Allergies
    if (sections.includes('allergies') && encounter.patientId) {
      const allergies = await prisma.patientAllergy.findMany({
        where: { patientId: encounter.patientId, tenantId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      report.allergies = allergies.map((a) => ({
        id: a.id,
        allergen: a.allergen,
        reaction: a.reaction,
        type: a.type,
        severity: a.severity,
      }));
    }

    await createAuditLog(
      'medical_report',
      encounterCoreId,
      'REPORT_EXPORTED',
      userId || 'system',
      user?.email,
      { encounterCoreId, sections, format },
      tenantId
    );

    logger.info('Medical report exported', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/opd/reports/export',
      encounterCoreId,
      sections,
    });

    return NextResponse.json({ success: true, report });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
