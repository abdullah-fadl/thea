import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    try {
      await requireTenantContext(req, tenantId);
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }
    const { searchParams } = new URL(req.url);
    const lowConfidenceOnly = searchParams.get('lowConfidenceOnly') === 'true';
    const status = searchParams.get('status') as 'needs-review' | 'auto-approved' | null;

    const where: any = {
      tenantId,
      isActive: true,
    };

    if (status) {
      where.tagsStatus = status;
    } else {
      where.tagsStatus = 'needs-review';
    }

    const policies = await prisma.policyDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Filter by confidence if requested
    let filteredPolicies = policies;
    if (lowConfidenceOnly) {
      filteredPolicies = policies.filter((pol: any) => {
        const aiTags = pol.aiTags;
        if (!aiTags || !aiTags.overallConfidence) return true;
        return aiTags.overallConfidence < 0.85;
      });
    }

    // Format response
    const formattedPolicies = filteredPolicies.map((pol: any) => ({
      id: pol.id,
      documentId: pol.documentId,
      title: pol.title,
      filename: pol.originalFileName,
      aiTags: pol.aiTags || null,
      tagsStatus: pol.tagsStatus || 'needs-review',
      uploadedAt: pol.createdAt,
    }));

    return NextResponse.json({
      policies: formattedPolicies,
      total: formattedPolicies.length,
    });
  } catch (error) {
    logger.error('Tag review queue error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'policies.tag-review' });
