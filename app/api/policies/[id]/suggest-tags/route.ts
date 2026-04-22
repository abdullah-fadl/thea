import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AITagsResponse {
  departments?: Array<{ id: string; label: string; confidence: number }>;
  setting?: { value: string; confidence: number };
  type?: { value: string; confidence: number };
  scope?: { value: string; confidence: number };
  overallConfidence?: number;
  model?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;

      if (!policyId) {
        return NextResponse.json(
          { error: 'Document ID is required' },
          { status: 400 }
        );
      }

      try {
        await requireTenantContext(req, tenantId);
      } catch (error) {
        if (error instanceof OrgProfileRequiredError) {
          return buildOrgProfileRequiredResponse();
        }
      }

    // Get policy document
    const policy = await prisma.policyDocument.findFirst({
      where: { tenantId, id: policyId, isActive: true },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Get first page text for context (if available)
    let sampleText = '';
    try {
      const firstChunks = await prisma.policyChunk.findMany({
        where: {
          tenantId,
          documentId: policyId,
        },
        orderBy: { chunkIndex: 'asc' },
        take: 1,
      });
      const firstChunk = firstChunks[0];
      if ((firstChunk as Record<string, unknown>)?.text) {
        sampleText = ((firstChunk as Record<string, unknown>).text as string).substring(0, 2000);
      }
    } catch (err) {
      logger.warn('Could not fetch sample text:', { error: err });
    }

    // Call thea-engine for tag suggestions
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/tags/suggest`;

    let response;
    try {
      response = await fetch(theaEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          filename: (policy as Record<string, unknown>).originalFileName || (policy as Record<string, unknown>).title,
          sample_text: sampleText,
        }),
      });
    } catch (fetchError) {
      logger.error('Failed to connect to thea-engine:', { error: fetchError });
      return NextResponse.json(
        {
          serviceUnavailable: true,
          error: 'Document engine service is not available. Automated tagging is disabled.',
          aiTags: null,
        },
        { status: 200 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Document engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const aiTagsData: AITagsResponse = await response.json();

    // Calculate overall confidence
    const confidences: number[] = [];
    if (aiTagsData.setting?.confidence) confidences.push(aiTagsData.setting.confidence);
    if (aiTagsData.type?.confidence) confidences.push(aiTagsData.type.confidence);
    if (aiTagsData.scope?.confidence) confidences.push(aiTagsData.scope.confidence);
    if (aiTagsData.departments) {
      aiTagsData.departments.forEach(d => confidences.push(d.confidence));
    }
    const overallConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    const tagsStatus = 'needs-review';

    const aiTags = {
      ...aiTagsData,
      overallConfidence,
      createdAt: new Date().toISOString(),
    };

    // Update policy with AI tags (stored in classification JSON field)
    await prisma.policyDocument.updateMany({
      where: { tenantId, id: policyId },
      data: {
        classification: aiTags as Prisma.InputJsonValue,
        tagsStatus,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      aiTags,
      tagsStatus,
    });
  } catch (error) {
    logger.error('Suggest tags error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  }),
  { tenantScoped: true, permissionKey: 'policies.tag' })(request);
}
