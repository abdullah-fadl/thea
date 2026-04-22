import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ── GET — Fetch discharge summary for an episode ─────────────────────────────
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const routeParams = params || {};
    const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    const summary = await prisma.enhancedDischargeSummary.findFirst({
      where: { tenantId, episodeId },
    });

    return NextResponse.json({ summary: summary || null });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

// ── POST — Create or update discharge summary ───────────────────────────────
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const routeParams = params || {};
    const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Verify episode exists
    const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const now = new Date();

    // Check if summary already exists
    const existing = await prisma.enhancedDischargeSummary.findFirst({
      where: { tenantId, episodeId },
    });

    const payload = {
      tenantId,
      episodeId,
      // Admission info
      admissionDate: body.admissionDate || null,
      dischargeDate: body.dischargeDate || null,
      attendingPhysician: body.attendingPhysician || null,
      admittingDiagnosis: body.admittingDiagnosis || null,
      // Discharge diagnoses
      dischargeDiagnoses: body.dischargeDiagnoses || [],
      // Procedures
      procedures: body.procedures || [],
      // Hospital course
      hospitalCourse: body.hospitalCourse || null,
      // Significant findings
      significantFindings: body.significantFindings || null,
      // Consultations
      consultations: body.consultations || [],
      // Condition at discharge
      conditionAtDischarge: body.conditionAtDischarge || null,
      // Discharge medications
      dischargeMedications: body.dischargeMedications || [],
      // Med reconciliation
      medReconciliation: body.medReconciliation || [],
      // Follow-up
      followUp: body.followUp || [],
      // Pending results
      pendingResults: body.pendingResults || [],
      // Patient instructions
      patientInstructions: body.patientInstructions || {},
      // Patient education
      patientEducation: body.patientEducation || [],
      // Status
      status: body.status || 'DRAFT',
      // Metadata
      lastUpdatedBy: userId,
      updatedAt: now,
    };

    let summary;
    if (existing) {
      summary = await prisma.enhancedDischargeSummary.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      summary = await prisma.enhancedDischargeSummary.create({
        data: {
          ...payload,
          createdBy: userId,
          createdAt: now,
        } as any,
      });
    }

    // Transition episode to DISCHARGE_READY when summary is signed/completed
    const summaryStatus = String(summary.status || '').toUpperCase();
    if (summaryStatus === 'COMPLETED' || summaryStatus === 'SIGNED') {
      const currentEpisodeStatus = String(episode.status || '').toUpperCase();
      if (currentEpisodeStatus !== 'DISCHARGE_READY' && currentEpisodeStatus !== 'DISCHARGED') {
        await prisma.ipdEpisode.update({
          where: { id: episode.id },
          data: { status: 'DISCHARGE_READY', updatedAt: new Date(), updatedByUserId: userId || null },
        });
      }
    }

    return NextResponse.json({ success: true, summary });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
