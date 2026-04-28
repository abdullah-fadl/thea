import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logPatientAccess } from '@/lib/audit/patientAccessLogger';
import { shadowEvaluate } from '@/lib/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/lab/results
 *
 * List lab results. Supports filtering by orderId, patientId, status.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role, hospitalId }) => {
    const orderId = req.nextUrl.searchParams.get('orderId');
    const patientId = req.nextUrl.searchParams.get('patientId');
    const status = req.nextUrl.searchParams.get('status');
    const search = req.nextUrl.searchParams.get('search') || '';

    void shadowEvaluate({ legacyDecision: 'allow', action: 'View', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role, hospitalId: hospitalId ?? '' } }, resource: { id: orderId || patientId || tenantId, type: 'Thea::ClinicalEncounter', attrs: { tenantId, hospitalId: hospitalId ?? '', status: String(status ?? ''), patientId: String(patientId ?? '') } } });

    const where: any = { tenantId };
    if (orderId) where.orderId = orderId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { testCode: { contains: search, mode: 'insensitive' } },
        { testName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const results = await prisma.labResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Fire-and-forget patient access audit (only when filtering by patient)
    if (patientId) {
      logPatientAccess({
        tenantId,
        userId,
        userRole: user?.role || 'unknown',
        userEmail: user?.email,
        patientId,
        accessType: 'view',
        resourceType: 'lab_results',
        path: '/api/lab/results',
      });
    }

    return NextResponse.json({ results });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.view' }
);
