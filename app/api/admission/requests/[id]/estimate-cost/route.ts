import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/admission/requests/[id]/estimate-cost
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      // 1. Fetch admission request
      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      const bedType = request.bedType || 'GENERAL';
      const expectedLOS = request.expectedLOS || 3; // default 3 days

      // 2. Lookup BED items in charge catalog
      const bedCatalogs = await prisma.billingChargeCatalog.findMany({
        where: {
          tenantId,
          itemType: 'BED',
          isActive: true,
        } as any,
        take: 20,
      });

      // 3. Find best match for bed type
      let bedPerDay = 500; // Default fallback: 500 SAR
      let matchedCatalog = null;

      // Try exact match first
      for (const cat of bedCatalogs) {
        const catName = String(cat.name || '').toLowerCase();
        const catCode = String(cat.code || '').toLowerCase();
        const bt = bedType.toLowerCase();
        if (catName.includes(bt) || catCode.includes(bt)) {
          bedPerDay = Number(cat.basePrice) || 500;
          matchedCatalog = cat;
          break;
        }
      }

      // If no match, use first available BED catalog item
      if (!matchedCatalog && bedCatalogs.length > 0) {
        bedPerDay = Number(bedCatalogs[0].basePrice) || 500;
        matchedCatalog = bedCatalogs[0];
      }

      // 4. Bed type multipliers for common types
      const multipliers: Record<string, number> = {
        GENERAL: 1.0,
        ICU: 3.0,
        ISOLATION: 1.5,
        VIP: 2.0,
        NICU: 3.5,
        PICU: 3.0,
      };
      const multiplier = multipliers[bedType] || 1.0;

      // Apply multiplier only if we used a generic BED catalog item
      if (!matchedCatalog || !String(matchedCatalog.name || '').toLowerCase().includes(bedType.toLowerCase())) {
        bedPerDay = bedPerDay * multiplier;
      }

      // 5. Calculate totals
      const totalBed = bedPerDay * expectedLOS;

      // 6. Estimate additional common services
      const additionalServices: Array<{ name: string; nameAr: string; estimatedCost: number }> = [];

      // Look up common admission services
      const commonServiceCodes = ['VIS', 'SRV', 'LAB', 'PRC'];
      for (const prefix of commonServiceCodes) {
        const serviceCat = await prisma.billingChargeCatalog.findFirst({
          where: {
            tenantId,
            isActive: true,
            code: { startsWith: prefix },
            departmentDomain: 'IPD',
          } as any,
        });
        if (serviceCat) {
          additionalServices.push({
            name: serviceCat.name || serviceCat.code,
            nameAr: serviceCat.nameAr || serviceCat.name || serviceCat.code,
            estimatedCost: Number(serviceCat.basePrice) || 0,
          });
        }
      }

      const servicesTotal = additionalServices.reduce((sum, s) => sum + s.estimatedCost, 0);
      const estimatedCost = totalBed + servicesTotal;
      const depositRequired = Math.ceil(estimatedCost * 0.5);

      const breakdown = {
        bedPerDay: Math.round(bedPerDay * 100) / 100,
        expectedLOS,
        bedType,
        totalBed: Math.round(totalBed * 100) / 100,
        additionalServices,
        servicesTotal: Math.round(servicesTotal * 100) / 100,
        total: Math.round(estimatedCost * 100) / 100,
        depositRequired: Math.round(depositRequired * 100) / 100,
        currency: 'SAR',
        catalogItemUsed: matchedCatalog ? { id: matchedCatalog.id, code: matchedCatalog.code, name: matchedCatalog.name } : null,
      };

      // 7. Save estimate on the admission request
      await prisma.admissionRequest.update({
        where: { id },
        data: {
          estimatedCost: Math.round(estimatedCost * 100) / 100,
          estimatedCostBreakdown: breakdown,
          depositRequired: Math.round(depositRequired * 100) / 100,
          updatedByUserId: userId,
        },
      });

      return NextResponse.json({ success: true, ...breakdown });
    } catch (err) {
      logger.error('[admission/requests/[id]/estimate-cost] POST error:', err);
      return NextResponse.json({ error: 'Failed to estimate cost' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);
