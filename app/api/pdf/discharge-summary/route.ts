/**
 * POST /api/pdf/discharge-summary
 *
 * Generate a discharge summary PDF.
 * Includes admission/discharge dates, diagnoses, procedures,
 * discharge medications, length of stay, and follow-up instructions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';
import { generateDischargeSummaryPdf } from '@/lib/pdf/templates';
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
  facility: z.object({
    name: z.string().min(1),
    nameAr: z.string().optional(),
  }).optional(),
  admissionDate: z.string().min(1, 'Admission date is required'),
  dischargeDate: z.string().min(1, 'Discharge date is required'),
  attendingDoctor: z.string().min(1, 'Attending doctor is required'),
  admissionDiagnosis: z.string().min(1, 'Admission diagnosis is required'),
  dischargeDiagnosis: z.string().min(1, 'Discharge diagnosis is required'),
  procedures: z.array(z.string()).optional(),
  dischargeMedications: z.array(z.object({
    name: z.string().min(1),
    dose: z.string().min(1),
    frequency: z.string().min(1),
    duration: z.string().min(1),
  })).optional(),
  followUpInstructions: z.string().optional(),
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

    const buffer = await generateDischargeSummaryPdf(data);

    // Audit log
    await createAuditLog(
      'pdf_export',
      data.patient.mrn,
      'export_discharge_summary',
      userId,
      user?.email,
      {
        documentType: 'discharge_summary',
        patientMrn: data.patient.mrn,
        admissionDate: data.admissionDate,
        dischargeDate: data.dischargeDate,
        attendingDoctor: data.attendingDoctor,
        procedureCount: data.procedures?.length || 0,
        dischargeMedCount: data.dischargeMedications?.length || 0,
      },
      tenantId,
      req,
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="discharge-${data.patient.mrn}-${Date.now()}.pdf"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.view' },
);
