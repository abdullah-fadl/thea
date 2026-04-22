import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/blood-bank/units
 * List blood units. Supports filtering by bloodType, product, status.
 */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const bloodType = url.searchParams.get('bloodType');
      const product = url.searchParams.get('product');
      const status = url.searchParams.get('status');

      const where: any = { tenantId };
      if (bloodType) where.bloodType = bloodType;
      if (product) where.product = product;
      if (status) where.status = status;

      const units = await prisma.bloodUnit.findMany({
        where,
        orderBy: { expiryDate: 'asc' },
        take: 200,
      });

      return NextResponse.json({ units });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.view' }
);

/**
 * POST /api/blood-bank/units
 * Add a blood unit to inventory.
 */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const { unitNumber, product, bloodType, expiryDate, volume, temperature } = body;

      if (!unitNumber || !product || !bloodType || !expiryDate) {
        return NextResponse.json(
          { error: 'unitNumber, product, bloodType, and expiryDate are required' },
          { status: 400 }
        );
      }

      // Ensure unit number is unique within tenant
      const existing = await prisma.bloodUnit.findFirst({
        where: { unitNumber, tenantId },
      });
      if (existing) {
        return NextResponse.json({ error: 'Unit number already exists' }, { status: 409 });
      }

      const unit = await prisma.bloodUnit.create({
        data: {
          tenantId,
          unitNumber,
          product,
          bloodType,
          expiryDate: new Date(expiryDate),
          volume: volume ?? null,
          temperature: temperature ?? null,
          status: 'AVAILABLE',
          addedBy: userId,
        } as any,
      });

      return NextResponse.json({ unit }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Failed to add unit' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.manage' }
);
