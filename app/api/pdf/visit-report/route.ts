/**
 * POST /api/pdf/visit-report
 *
 * Generate a comprehensive visit report PDF.
 * Includes chief complaint, vitals, assessment, plan, diagnoses,
 * medications, lab results, follow-up, and patient instructions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';
import { generateVisitReportPdf } from '@/lib/pdf/templates';
import { rateLimitPDF, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  patient: z.object({
    name: z.string().min(1, 'Patient name is required'),
    nameAr: z.string().optional(),
    mrn: z.string().min(1, 'MRN is required'),
    dob: z.string().optional(),
    gender: z.string().optional(),
  }),
  doctor: z.object({
    name: z.string().min(1, 'Doctor name is required'),
    nameAr: z.string().optional(),
    licenseNo: z.string().optional(),
    specialty: z.string().optional(),
  }),
  facility: z.object({
    name: z.string().min(1),
    nameAr: z.string().optional(),
  }).optional(),
  encounter: z.object({
    date: z.string().min(1, 'Encounter date is required'),
    chiefComplaint: z.string().optional(),
    chiefComplaintAr: z.string().optional(),
    hpi: z.string().optional(),
    vitals: z.object({
      bp: z.string().optional(),
      hr: z.string().optional(),
      temp: z.string().optional(),
      rr: z.string().optional(),
      spo2: z.string().optional(),
      weight: z.string().optional(),
      height: z.string().optional(),
    }).optional(),
    assessment: z.string().optional(),
    assessmentAr: z.string().optional(),
    plan: z.string().optional(),
    planAr: z.string().optional(),
    diagnoses: z.array(z.object({
      code: z.string().optional(),
      description: z.string().min(1),
      descriptionAr: z.string().optional(),
    })).optional(),
    medications: z.array(z.object({
      name: z.string().min(1),
      dose: z.string().min(1),
      frequency: z.string().min(1),
      route: z.string().min(1),
      duration: z.string().min(1),
    })).optional(),
    labResults: z.array(z.object({
      test: z.string().min(1),
      result: z.string().min(1),
      unit: z.string().optional(),
      reference: z.string().optional(),
      flag: z.string().optional(),
    })).optional(),
    followUp: z.string().optional(),
    instructions: z.string().optional(),
    instructionsAr: z.string().optional(),
  }),
  language: z.enum(['ar', 'en']).optional(),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: any) => {
    const rl = await rateLimitPDF({ ip: getRequestIp(req), userId });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestError(
        `Validation failed: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
      );
    }

    const data = {
      ...parsed.data,
      facility: parsed.data.facility || { name: 'Thea Healthcare' },
    };

    const buffer = await generateVisitReportPdf(data);

    // Audit log
    await createAuditLog(
      'pdf_export',
      data.patient.mrn,
      'export_visit_report',
      userId,
      user?.email,
      {
        documentType: 'visit_report',
        patientMrn: data.patient.mrn,
        encounterDate: data.encounter.date,
        diagnosisCount: data.encounter.diagnoses?.length || 0,
      },
      tenantId,
      req,
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="visit-report-${data.patient.mrn}-${Date.now()}.pdf"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' },
);
