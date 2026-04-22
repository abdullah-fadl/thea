import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/fhir/Claim
 *
 * Search claims. Claims are stored in the billing/claims collection.
 * For NPHIES claim submission, use /api/fhir/nphies/claim.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const searchParams = new URL(req.url).searchParams;
    const baseUrl = new URL(req.url).origin;

    const where: Prisma.BillingClaimWhereInput = { tenantId };

    const page = parseInt(searchParams.get('_page') || '1', 10);
    const count = Math.min(parseInt(searchParams.get('_count') || '20', 10), 100);
    const skip = (page - 1) * count;

    const [docs, total] = await Promise.all([
      prisma.billingClaim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: count,
      }),
      prisma.billingClaim.count({ where }),
    ]);

    return NextResponse.json(
      {
        resourceType: 'Bundle',
        type: 'searchset',
        total,
        link: [
          { relation: 'self', url: `${baseUrl}/api/fhir/Claim?_page=${page}&_count=${count}` },
        ],
        entry: docs.map((doc) => {
          const patient = doc.patient as Record<string, unknown> | null;
          const totals = doc.totals as Record<string, unknown> | null;
          return {
            fullUrl: `${baseUrl}/api/fhir/Claim/${doc.id}`,
            resource: {
              resourceType: 'Claim',
              id: doc.id,
              status: 'draft',
              type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
              patient: patient?.id ? { reference: `Patient/${patient.id}` } : undefined,
              created: doc.createdAt ? doc.createdAt.toISOString() : undefined,
              total: totals?.grandTotalActive ? { value: totals.grandTotalActive, currency: 'SAR' } : undefined,
            },
          };
        }),
      },
      { headers: { 'Content-Type': 'application/fhir+json' } },
    );
  }),
  { tenantScoped: true, permissionKey: 'billing.view' },
);
