/**
 * POST /api/pdf/prescription
 *
 * Generate a medical prescription PDF.
 * Accepts structured prescription data and returns an inline PDF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';
import { generatePrescriptionPdf } from '@/lib/pdf/templates';
import { rateLimitPDF, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const medicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  nameAr: z.string().optional(),
  dose: z.string().min(1, 'Dose is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  route: z.string().min(1, 'Route is required'),
  duration: z.string().min(1, 'Duration is required'),
  instructions: z.string().optional(),
});

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
  medications: z.array(medicationSchema).min(1, 'At least one medication is required'),
  date: z.string().optional(),
  visitId: z.string().optional(),
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
      date: parsed.data.date || new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }),
    };

    const buffer = await generatePrescriptionPdf(data);

    // Audit log
    await createAuditLog(
      'pdf_export',
      data.patient.mrn,
      'export_prescription',
      userId,
      user?.email,
      {
        documentType: 'prescription',
        patientMrn: data.patient.mrn,
        medicationCount: data.medications.length,
        visitId: data.visitId,
      },
      tenantId,
      req,
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="prescription-${data.patient.mrn}-${Date.now()}.pdf"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' },
);
