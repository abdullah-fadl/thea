/**
 * POST /api/pdf/lab-report
 *
 * Generate a laboratory report PDF.
 * Color-coded abnormal flags, auto-paginated results table,
 * flag legend, and bilingual headers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';
import { generateLabReportPdf } from '@/lib/pdf/templates';
import { rateLimitPDF, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const resultSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  testNameAr: z.string().optional(),
  result: z.string().min(1, 'Result value is required'),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  flag: z.enum(['H', 'L', 'HH', 'LL', 'N']).optional(),
});

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
  orderDate: z.string().min(1, 'Order date is required'),
  reportDate: z.string().optional(),
  orderedBy: z.string().min(1, 'Ordering physician is required'),
  results: z.array(resultSchema).min(1, 'At least one result is required'),
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
      reportDate: parsed.data.reportDate || new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }),
    };

    const buffer = await generateLabReportPdf(data);

    // Count abnormal results for audit
    const abnormalCount = data.results.filter(
      (r) => r.flag && r.flag !== 'N',
    ).length;
    const criticalCount = data.results.filter(
      (r) => r.flag === 'HH' || r.flag === 'LL',
    ).length;

    // Audit log
    await createAuditLog(
      'pdf_export',
      data.patient.mrn,
      'export_lab_report',
      userId,
      user?.email,
      {
        documentType: 'lab_report',
        patientMrn: data.patient.mrn,
        resultCount: data.results.length,
        abnormalCount,
        criticalCount,
        orderedBy: data.orderedBy,
      },
      tenantId,
      req,
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="lab-report-${data.patient.mrn}-${Date.now()}.pdf"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.view' },
);
