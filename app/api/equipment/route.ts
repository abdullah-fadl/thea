import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createEquipmentSchema = z.object({
  name: z.string().min(1),
  assetTag: z.string().min(1),
  category: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.enum(['OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'CALIBRATION_DUE']).default('OPERATIONAL'),
  location: z.string().optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    const equipment = await prisma.equipment.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ equipment });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (request: NextRequest, { tenantId, userId }) => {
    const body = await request.json();
    const data = createEquipmentSchema.parse(body);

    // Check if equipment assetTag already exists within tenant
    const existing = await prisma.equipment.findFirst({
      where: { tenantId, assetTag: data.assetTag },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Equipment with this asset tag already exists' },
        { status: 400 },
      );
    }

    const newEquipment = await prisma.equipment.create({
      data: {
        tenantId,
        name: data.name,
        assetTag: data.assetTag,
        category: data.category,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        status: data.status,
        location: data.location || null,
        createdByUserId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      equipment: newEquipment,
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);
