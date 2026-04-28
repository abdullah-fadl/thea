import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_STATUSES = ['AVAILABLE', 'RESERVED', 'ISSUED', 'EXPIRED', 'QUARANTINE', 'TRANSFUSED', 'DISCARDED'] as const;
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const VALID_PRODUCTS = ['PRBC', 'FFP', 'PLT', 'CRYO', 'WHOLE_BLOOD'] as const;

/**
 * GET /api/blood-bank/inventory
 * List blood unit inventory with filters: bloodType, component (product), status, expiringWithinDays
 */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const bloodType = url.searchParams.get('bloodType');
      const component = url.searchParams.get('component');
      const status = url.searchParams.get('status');
      const expiringWithinDays = url.searchParams.get('expiringWithinDays');

      const where: any = { tenantId };

      if (bloodType && (BLOOD_TYPES as readonly string[]).includes(bloodType)) {
        where.bloodType = bloodType;
      }
      if (component && (VALID_PRODUCTS as readonly string[]).includes(component)) {
        where.product = component;
      }
      if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
        where.status = status;
      }
      if (expiringWithinDays) {
        const days = parseInt(expiringWithinDays, 10);
        if (!isNaN(days) && days > 0) {
          const now = new Date();
          const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          where.expiryDate = {
            gte: now,
            lte: cutoff,
          };
          // Only show available/reserved units when filtering by expiry
          if (!status) {
            where.status = { in: ['AVAILABLE', 'RESERVED'] };
          }
        }
      }

      const units = await prisma.bloodUnit.findMany({
        where,
        orderBy: { expiryDate: 'asc' },
        take: 500,
      });

      return NextResponse.json({ units });
    } catch (err) {
      logger.error('Failed to fetch blood bank inventory', { error: err, tenantId, category: 'api' });
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.view' }
);
