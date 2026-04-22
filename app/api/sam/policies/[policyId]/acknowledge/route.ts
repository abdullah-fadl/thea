import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const acknowledgeSchema = z.object({
  version: z.number().optional(),
});

/**
 * GET /api/sam/policies/[policyId]/acknowledge — List acknowledgments for a policy
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = String((resolvedParams as Record<string, string>)?.policyId || '').trim();
      if (!policyId) {
        return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
      }

      const acknowledgments = await prisma.policyAcknowledgment.findMany({
        where: { tenantId, policyId },
        orderBy: { acknowledgedAt: 'desc' },
        take: 500,
      });

      // Get total users who should acknowledge (simplified: all tenant users)
      const totalUsers = await prisma.user.count({
        where: { tenantId, isActive: true },
      });

      return NextResponse.json({
        acknowledgments,
        summary: {
          acknowledged: acknowledgments.length,
          totalRequired: totalUsers,
          pending: totalUsers - acknowledgments.length,
          completionRate: totalUsers > 0 ? Math.round((acknowledgments.length / totalUsers) * 100) : 0,
        },
      });
    } catch (error: unknown) {
      logger.error('Acknowledgment list error:', { error });
      return NextResponse.json({ error: 'Failed to list acknowledgments' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.list' }
);

/**
 * POST /api/sam/policies/[policyId]/acknowledge — Acknowledge a policy
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId, user }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = String((resolvedParams as Record<string, string>)?.policyId || '').trim();
      if (!policyId) {
        return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
      }

      const body = await req.json().catch(() => ({}));
      const v = validateBody(body, acknowledgeSchema);
      if ('error' in v) return v.error;

      // Check if already acknowledged
      const existing = await prisma.policyAcknowledgment.findFirst({
        where: { tenantId, policyId, userId },
      });
      if (existing) {
        return NextResponse.json({ error: 'Policy already acknowledged' }, { status: 409 });
      }

      // Get IP from request
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

      const acknowledgment = await prisma.policyAcknowledgment.create({
        data: {
          tenantId,
          policyId,
          userId,
          userName: (user as any)?.nameEn || (user as any)?.name || '',
          userEmail: (user as any)?.email || '',
          version: v.data.version,
          ipAddress: ip,
        },
      });

      return NextResponse.json({ acknowledgment }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Acknowledgment create error:', { error });
      return NextResponse.json({ error: 'Failed to acknowledge policy' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);
