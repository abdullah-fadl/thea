import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { env } from '@/lib/env';
import { RiskRun } from '@/lib/models/Practice';
import type { Department } from '@/lib/models/Department';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { validateBody } from '@/lib/validation/helpers';
import { riskDetectorRunSchema } from '@/lib/validation/sam.schema';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    try {
      await requireTenantContext(req, tenantId);
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }
    const body = await req.json();
    const v = validateBody(body, riskDetectorRunSchema);
    if ('error' in v) return v.error;
    const validated = v.data;

    // Get practices with tenant isolation
    const practices = await prisma.practice.findMany({
      where: {
        tenantId,
        id: { in: validated.practiceIds },
        status: 'active',
      },
    });

    if (practices.length === 0) {
      return NextResponse.json(
        { error: 'No practices found' },
        { status: 404 }
      );
    }

    // Get relevant policies with tenant isolation:
    // - Policies tagged with selected departmentId OR scope=HospitalWide
    const relevantPolicies = await prisma.policyDocument.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { departmentIds: { has: validated.departmentId } },
          { scope: 'HospitalWide' },
        ],
      },
    });

    // Get department name for context with tenant isolation
    let departmentName = validated.departmentId;
    try {
      const dept = await prisma.department.findFirst({
        where: {
          tenantId,
          id: validated.departmentId,
          isActive: true,
        },
      });
      if (dept) {
        departmentName = dept.name || validated.departmentId;
      }
    } catch (err) {
      logger.warn('Could not fetch department name:', { error: err });
    }

    // Prepare payload for thea-engine
    const theaEnginePayload = {
      department: departmentName,
      setting: validated.setting,
      practices: practices.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        frequency: p.frequency,
      })),
      policies: relevantPolicies.map((pol: any) => ({
        id: pol.id,
        documentId: pol.documentId,
        title: pol.title || pol.originalFileName,
      })),
    };

    // Call thea-engine with tenantId in header
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/risk-detector/analyze`;

    logger.info('[risk-detector/run] Calling thea-engine:', { theaEngineUrl });
    logger.info('[risk-detector/run] Payload:', {
      department: theaEnginePayload.department,
      setting: theaEnginePayload.setting,
      practicesCount: theaEnginePayload.practices.length,
      policiesCount: theaEnginePayload.policies.length,
    });

    let response;
    try {
      response = await fetch(theaEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify(theaEnginePayload),
      });
    } catch (fetchError) {
      logger.error('[risk-detector/run] Failed to connect to thea-engine:', { error: fetchError });
      return NextResponse.json(
        {
          serviceUnavailable: true,
          error: 'Policy Engine service is not available. AI gap analysis is disabled.',
        },
        { status: 200 }
      );
    }

    const responseText = await response.text();

    if (!response.ok) {
      logger.error(`[risk-detector/run] Policy Engine returned ${response.status}:`, { body: responseText.substring(0, 500) });
      return NextResponse.json(
        { error: `Policy Engine error: ${responseText.substring(0, 200)}` },
        { status: response.status }
      );
    }

    let analysisResults;
    try {
      logger.info('[risk-detector/run] Policy Engine response length:', { length: responseText.length });
      analysisResults = JSON.parse(responseText);
      logger.info('[risk-detector/run] Parsed analysis results:', {
        practicesCount: analysisResults?.practices?.length || 0,
        hasMetadata: !!analysisResults?.metadata,
      });
    } catch (jsonError) {
      logger.error('[risk-detector/run] Failed to parse thea-engine response as JSON:', { error: jsonError });
      logger.error('[risk-detector/run] Response text (first 500 chars):', { body: responseText.substring(0, 500) });
      return NextResponse.json(
        { error: `Policy Engine returned invalid JSON: ${responseText.substring(0, 200)}` },
        { status: 500 }
      );
    }

    // Store RiskRun
    const riskRun = {
      tenantId,
      departmentId: validated.departmentId,
      setting: validated.setting,
      createdBy: userId,
      inputPracticeIds: validated.practiceIds,
      resultsJson: analysisResults as Prisma.InputJsonValue,
      createdAt: new Date(),
    };

    let runId: string;
    try {
      const created = await prisma.riskRun.create({ data: riskRun as never });
      runId = (created as Record<string, unknown>).id as string;
    } catch (dbError) {
      logger.error('Failed to store risk run in database:', { error: dbError });
      // Return the analysis results even if DB storage fails
      return NextResponse.json({
        success: true,
        runId: 'unknown',
        results: analysisResults,
        warning: 'Analysis completed but failed to store in database',
      });
    }

    return NextResponse.json({
      success: true,
      runId,
      results: analysisResults,
    });
  } catch (error) {
    logger.error('Run risk analysis error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'risk-detector.run' });
