import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { AIEngine, getAISettings } from '@/lib/ai';
import { rateLimitAI, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/summarize-patient
 *
 * Generate an AI-powered patient summary.
 * Body: {
 *   patientId: string,
 *   patientAge?, patientGender?,
 *   -- OR provide data directly: --
 *   diagnoses?, medications?, allergies?,
 *   labs?: [{ test, value, unit, date, flag? }],
 *   radiology?: [{ study, date, impression }],
 *   vitals?: [{ type, value, date }],
 *   notes?: string[]
 * }
 *
 * If patientId is provided, the route fetches data from DB.
 * If data is provided directly, it uses that instead.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const rl = await rateLimitAI({ ip: getRequestIp(req), userId, tenantId });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const settings = await getAISettings(tenantId);
    if (!settings.enabled || !settings.features.patientSummary) {
      return NextResponse.json(
        { error: 'Patient AI summary is not enabled' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));

    // [AI-01] Input size limits for directly-provided data
    if (body.labs && Array.isArray(body.labs) && body.labs.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 labs per request', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (body.notes && Array.isArray(body.notes) && body.notes.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 notes per request', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (body.diagnoses && Array.isArray(body.diagnoses) && body.diagnoses.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 diagnoses per request', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }

    // [AI-01] Require either patientId or some data
    if (!body.patientId && !body.diagnoses && !body.labs && !body.medications) {
      return NextResponse.json(
        { error: 'patientId or clinical data (diagnoses/labs/medications) is required' },
        { status: 400 },
      );
    }

    const engine = new AIEngine({
      tenantId,
      userId,
      providerName: settings.provider,
      model: settings.provider === 'anthropic' ? settings.anthropicModel : settings.openaiModel,
    });

    if (!engine.isAvailable()) {
      return NextResponse.json(
        { error: 'No AI provider is configured.' },
        { status: 503 },
      );
    }

    if (!engine.checkRateLimit(settings.maxRequestsPerMinute)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429 },
      );
    }

    // If patientId is provided, fetch data from DB
    let summaryInput = {
      patientAge: body.patientAge,
      patientGender: body.patientGender,
      diagnoses: body.diagnoses,
      medications: body.medications,
      allergies: body.allergies,
      labs: body.labs,
      radiology: body.radiology,
      vitals: body.vitals,
      notes: body.notes,
    };

    if (body.patientId && !body.diagnoses) {
      // Fetch from DB
      try {
        const [patient, labResults, radiologyReports, allergies, problems] = await Promise.all([
          prisma.patientMaster.findFirst({
            where: { tenantId, id: body.patientId },
            select: { fullName: true, dob: true, gender: true },
          }),
          prisma.labResult.findMany({
            where: { tenantId, patientId: body.patientId },
            select: { testCode: true, testName: true, parameters: true, createdAt: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
          prisma.radiologyReport.findMany({
            where: { tenantId, patientId: body.patientId },
            select: { examName: true, impression: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          prisma.patientAllergy.findMany({
            where: { tenantId, patientId: body.patientId, status: 'active' },
            select: { allergen: true },
          }),
          prisma.patientProblem.findMany({
            where: { tenantId, patientId: body.patientId, status: 'active' },
            select: { problemName: true, icdCode: true },
          }),
        ]);

        if (patient) {
          if (patient.dob) {
            const age = Math.floor(
              (Date.now() - new Date(String(patient.dob)).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
            );
            summaryInput.patientAge = age;
          }
          summaryInput.patientGender = patient.gender as string;
        }

        // Aggregate diagnoses from patient problems and allergies
        summaryInput.diagnoses = problems.map((p) => p.problemName || p.icdCode || '').filter(Boolean);
        summaryInput.allergies = allergies.map((a) => a.allergen).filter(Boolean);

        summaryInput.labs = labResults.map((l: any) => ({
          test: String(l.testCode || l.testName || ''),
          value: l.parameters ? JSON.stringify(l.parameters) : '',
          unit: '',
          date: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : '',
          flag: l.status === 'VERIFIED' ? 'final' : undefined,
        }));

        summaryInput.radiology = radiologyReports.map((r: any) => ({
          study: String(r.examName || ''),
          date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
          impression: String(r.impression || ''),
        }));
      } catch {
        // Fall back to whatever was provided in the body
      }
    }

    const summary = await engine.summarizePatient(summaryInput);

    return NextResponse.json({ summary });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);
