import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_RESULTS = ['COMPATIBLE', 'INCOMPATIBLE'] as const;

/**
 * PATCH /api/blood-bank/crossmatch/[requestId]
 * Update crossmatch result (compatible/incompatible, result details, completedBy).
 */
export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }, params) => {
    try {
      const requestId = String((params as Record<string, string>)?.requestId || '').trim();
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
      }

      const existing = await prisma.bloodBankRequest.findFirst({
        where: { id: requestId, tenantId },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Crossmatch request not found' }, { status: 404 });
      }

      const body = await req.json();
      const { result, antibodyScreen, notes, status } = body;

      const updateData: any = { updatedAt: new Date() };

      if (result && VALID_RESULTS.includes(result)) {
        updateData.status = result;
      } else if (status) {
        updateData.status = status;
      }

      // Store crossmatch details in the existing fields
      if (antibodyScreen !== undefined || notes !== undefined) {
        const existingProducts = Array.isArray(existing.products) ? existing.products : [];
        const crossmatchDetails = {
          completedBy: userId,
          completedAt: new Date().toISOString(),
          result: result || status || existing.status,
          antibodyScreen: antibodyScreen ?? null,
          notes: notes ?? null,
        };
        // Append crossmatch result details to products metadata
        updateData.products = [...existingProducts, { _crossmatchResult: crossmatchDetails }];
      }

      const updated = await prisma.bloodBankRequest.update({
        where: { id: requestId },
        data: updateData,
      });

      logger.info('Crossmatch result updated', {
        tenantId,
        userId,
        requestId,
        result: result || status,
        category: 'clinical',
      });

      return NextResponse.json({ request: updated });
    } catch (err) {
      logger.error('Failed to update crossmatch result', { error: err, tenantId, category: 'api' });
      return NextResponse.json({ error: 'Failed to update crossmatch result' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.manage' }
);
