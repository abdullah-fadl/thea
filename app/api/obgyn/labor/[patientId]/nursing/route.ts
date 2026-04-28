import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { calculateMEOWS, type MEOWSProteinuria, type MEOWSConsciousness } from '@/lib/clinical/meowsCalculator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/obgyn/labor/[patientId]/nursing
 * Returns all nursing assessments for this patient's active labor episode.
 *
 * POST /api/obgyn/labor/[patientId]/nursing
 * Saves a new nursing assessment with MEOWS calculation.
 * Body: {
 *   bp: string,           // "120/80"
 *   hr: number,           // maternal HR bpm
 *   temp: number,         // °C
 *   rr: number,           // resp rate /min
 *   spo2: number,         // %
 *   consciousness: string, // AVPU
 *   proteinuria: number,  // 0-4
 *   lochia: string,       // 'NONE'|'LIGHT'|'MODERATE'|'HEAVY'|'EXCESSIVE'
 *   fetalHr: number,      // FHR bpm
 *   contractions: number, // per 10 min
 *   dilation: number,     // cm 0-10
 *   effacement: number,   // %
 *   station: number,      // -3 to +3
 *   liquor: string,       // 'CLEAR'|'MECONIUM_THIN'|'MECONIUM_THICK'|'BLOOD'|'ABSENT'
 *   oxytocin: string,     // optional
 *   notes: string,
 * }
 */

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const patientId = String((params as any)?.patientId || '').trim();
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    const entries = await prisma.obgynForm.findMany({
      where: { tenantId, patientId, type: 'labor_nursing' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ entries });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const patientId = String((params as any)?.patientId || '').trim();
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    // Parse BP
    const bpParts = String(body?.bp || '0/0').split('/');
    const systolicBp = Number(bpParts[0]) || 0;
    const diastolicBp = Number(bpParts[1]) || 0;

    // Calculate MEOWS
    const consciousnessValue = (body?.consciousness || 'ALERT') as MEOWSConsciousness;
    const proteinuriaValue = (['NONE','TRACE','PLUS1','PLUS2_OR_MORE'].includes(body?.proteinuria)
      ? body.proteinuria
      : 'NONE') as MEOWSProteinuria;
    const lochiaValue = (body?.lochia || 'NONE') as 'NORMAL' | 'HEAVY' | 'ABSENT';

    const meowsInput = {
      systolicBp,
      diastolicBp,
      hr: Number(body?.hr) || 0,
      rr: Number(body?.rr) || 0,
      temp: Number(body?.temp) || 36.5,
      spo2: Number(body?.spo2) || 98,
      consciousness: consciousnessValue,
      proteinuria: proteinuriaValue,
      lochia: lochiaValue,
    };
    const meowsResult = calculateMEOWS(meowsInput);

    const assessmentData = {
      assessedAt: new Date().toISOString(),
      bp: body?.bp ?? '',
      hr: Number(body?.hr) || null,
      temp: Number(body?.temp) || null,
      rr: Number(body?.rr) || null,
      spo2: Number(body?.spo2) || null,
      consciousness: body?.consciousness ?? 'ALERT',
      proteinuria: Number(body?.proteinuria) || 0,
      lochia: body?.lochia ?? 'NONE',
      fetalHr: Number(body?.fetalHr) || null,
      contractions: Number(body?.contractions) || null,
      dilation: Number(body?.dilation) || null,
      effacement: Number(body?.effacement) || null,
      station: Number(body?.station) || null,
      liquor: body?.liquor ?? 'CLEAR',
      oxytocin: body?.oxytocin ?? '',
      notes: body?.notes ?? '',
      meows: meowsResult.totalScore,
      meowsLevel: meowsResult.riskLevel,
      meowsHasSingleTrigger: meowsResult.hasSingleTrigger,
    };

    const entry = await prisma.obgynForm.create({
      data: {
        tenantId,
        patientId,
        type: 'labor_nursing',
        data: assessmentData,
        createdBy: userId || null,
      },
    });

    return NextResponse.json({
      success: true,
      entry,
      meows: meowsResult,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.edit' }
);
