/**
 * SCM BC3 Procurement — Contract Expiry Alerts
 *
 * GET  /api/imdad/procurement/contracts/expiry-alerts — Get contracts nearing expiry
 * POST /api/imdad/procurement/contracts/expiry-alerts — Trigger expiry scan & generate alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List contracts nearing expiry
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  organizationId: z.string().uuid().optional(),
  withinDays: z.coerce.number().int().min(1).max(365).default(90),
  includeExpired: z.coerce.boolean().default(false),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, organizationId, withinDays, includeExpired } = parsed;

      const now = new Date();
      const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

      const where: any = {
        tenantId,
        isDeleted: false,
        status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
        endDate: { lte: threshold },
      };

      if (organizationId) where.organizationId = organizationId;

      if (includeExpired) {
        where.status = { in: ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'] };
      } else {
        where.endDate = { gte: now, lte: threshold };
      }

      const [data, total] = await Promise.all([
        prisma.imdadContract.findMany({
          where,
          orderBy: { endDate: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            vendor: { select: { id: true, name: true, code: true } },
          } as any,
        }),
        prisma.imdadContract.count({ where }),
      ]);

      // Enrich with days-until-expiry and urgency
      const enriched = data.map((contract: any) => {
        const endDate = new Date(contract.endDate);
        const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = daysUntilExpiry < 0;

        let urgency: string;
        if (isExpired) urgency = 'EXPIRED';
        else if (daysUntilExpiry <= 30) urgency = 'CRITICAL';
        else if (daysUntilExpiry <= 60) urgency = 'HIGH';
        else if (daysUntilExpiry <= 90) urgency = 'MEDIUM';
        else urgency = 'LOW';

        return {
          ...contract,
          daysUntilExpiry,
          isExpired,
          urgency,
          autoRenew: contract.autoRenew ?? false,
        };
      });

      return NextResponse.json({
        data: enriched,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          critical: enriched.filter((c: any) => c.urgency === 'CRITICAL').length,
          high: enriched.filter((c: any) => c.urgency === 'HIGH').length,
          medium: enriched.filter((c: any) => c.urgency === 'MEDIUM').length,
          expired: enriched.filter((c: any) => c.isExpired).length,
          autoRenewing: enriched.filter((c: any) => c.autoRenew).length,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// POST — Trigger contract expiry scan and generate alert instances
// ---------------------------------------------------------------------------

const scanSchema = z.object({
  organizationId: z.string().uuid(),
  warningDays: z.number().int().min(1).max(365).default(90),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = scanSchema.parse(body);
      const { organizationId, warningDays } = parsed;

      const now = new Date();
      const threshold = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);

      // Find all active contracts expiring within the window
      const expiringContracts = await prisma.imdadContract.findMany({
        where: {
          tenantId,
          organizationId,
          isDeleted: false,
          status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
          endDate: { lte: threshold },
        },
        include: {
          vendor: { select: { id: true, name: true } },
        } as any,
        take: 200,
      });

      let alertsCreated = 0;
      let contractsUpdated = 0;

      for (const contract of expiringContracts) {
        const endDate = new Date(contract.endDate);
        const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = daysUntilExpiry < 0;
        const severity = isExpired ? 'CRITICAL' : daysUntilExpiry <= 30 ? 'HIGH' : daysUntilExpiry <= 60 ? 'MEDIUM' : 'LOW';

        // Update contract status to EXPIRING_SOON if not already
        if (contract.status === 'ACTIVE' && daysUntilExpiry <= warningDays) {
          try {
            await prisma.imdadContract.update({
              where: { id: contract.id },
              data: { status: 'EXPIRING_SOON' as any, updatedBy: userId },
            });
            contractsUpdated++;
          } catch {
            // Ignore update errors
          }
        }

        // Create alert instance
        try {
          await prisma.imdadAlertInstance.create({
            data: {
              tenantId,
              organizationId,
              severity: severity as any,
              status: 'ACTIVE',
              ruleCode: 'CONTRACT_EXPIRY',
              ruleName: 'Contract Expiry Alert',
              message: isExpired
                ? `Contract ${contract.contractNumber} with ${(contract as any).vendor?.name || 'vendor'} has expired`
                : `Contract ${contract.contractNumber} with ${(contract as any).vendor?.name || 'vendor'} expires in ${daysUntilExpiry} days`,
              messageAr: isExpired
                ? `العقد ${contract.contractNumber} مع ${(contract as any).vendor?.name || 'المورد'} قد انتهى`
                : `العقد ${contract.contractNumber} مع ${(contract as any).vendor?.name || 'المورد'} ينتهي خلال ${daysUntilExpiry} يوم`,
              kpiCode: 'CONTRACT_DAYS_REMAINING',
              actualValue: daysUntilExpiry,
              thresholdValue: warningDays,
              firedAt: now,
              createdBy: userId,
            } as any,
          });
          alertsCreated++;
        } catch {
          // Duplicate or constraint error — skip
        }
      }

      await imdadAudit.log({
        tenantId,
        organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'SCAN',
        resourceType: 'CONTRACT_EXPIRY_ALERT',
        resourceId: 'batch-scan',
        boundedContext: 'BC3_PROCUREMENT',
        newData: {
          contractsScanned: expiringContracts.length,
          alertsCreated,
          contractsUpdated,
          scannedAt: now.toISOString(),
        },
        request: req,
      });

      return NextResponse.json({
        summary: {
          contractsScanned: expiringContracts.length,
          alertsCreated,
          contractsUpdated,
          scannedAt: now.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.contract.manage' }
);
