import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/implants
// Returns all implant records for the case
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const implants = await prisma.orImplant.findMany({
        where: { tenantId, caseId },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      return NextResponse.json({ implants });
    } catch (e: any) {
      logger.error('[OR implants GET] Failed to fetch implants', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch implants' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/implants
// Adds a new implant record to the case
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const body = await req.json();
      const {
        itemName,
        manufacturer,
        lotNumber,
        serialNumber,
        expiryDate,
        quantity = 1,
        site,
      } = body;

      if (!itemName) {
        return NextResponse.json({ error: 'itemName is required' }, { status: 400 });
      }

      // Verify case belongs to this tenant
      const orCase = await prisma.orCase.findFirst({
        where: { tenantId, id: caseId },
      });
      if (!orCase) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      const implant = await prisma.orImplant.create({
        data: {
          tenantId,
          caseId,
          itemName,
          manufacturer: manufacturer ?? null,
          lotNumber: lotNumber ?? null,
          serialNumber: serialNumber ?? null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          quantity: Number(quantity) || 1,
          site: site ?? null,
          recordedBy: userId,
        },
      });

      return NextResponse.json({ implant }, { status: 201 });
    } catch (e: any) {
      logger.error('[OR implants POST] Failed to add implant record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to add implant record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
