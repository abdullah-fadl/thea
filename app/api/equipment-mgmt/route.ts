import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const location = searchParams.get('location') || undefined;
    const search = (searchParams.get('q') || '').trim().toLowerCase();

    const where: any = { tenantId };
    if (category) where.category = category;
    if (status) where.status = status;
    if (location) where.location = location;

    const equipment = await prisma.equipment.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 500,
      include: {
        maintenanceRecords: {
          where: { nextDueDate: { not: null } },
          orderBy: { nextDueDate: 'asc' },
          take: 1,
          select: { id: true, nextDueDate: true, maintenanceType: true },
        },
        issues: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true },
        },
      },
    });

    // Enrich with next maintenance and open issue count
    let items = equipment.map((eq: any) => {
      const nextMaint = eq.maintenanceRecords?.[0]?.nextDueDate || null;
      const openIssueCount = eq.issues?.length || 0;
      const warrantyExpired = eq.warrantyExpiry ? new Date(eq.warrantyExpiry) < new Date() : false;
      const warrantyExpiringSoon = eq.warrantyExpiry
        ? new Date(eq.warrantyExpiry) < new Date(Date.now() + 30 * 86400000) && !warrantyExpired
        : false;
      const maintenanceOverdue = nextMaint ? new Date(nextMaint) < new Date() : false;

      // Remove included relations from top-level
      const { maintenanceRecords: _m, issues: _i, ...rest } = eq;

      return {
        ...rest,
        nextMaintenanceDate: nextMaint,
        openIssueCount,
        warrantyExpired,
        warrantyExpiringSoon,
        maintenanceOverdue,
      };
    });

    // Client-side search on name, assetTag, manufacturer, location, serialNumber
    if (search) {
      items = items.filter((eq: any) =>
        (eq.name || '').toLowerCase().includes(search) ||
        (eq.assetTag || '').toLowerCase().includes(search) ||
        (eq.manufacturer || '').toLowerCase().includes(search) ||
        (eq.serialNumber || '').toLowerCase().includes(search) ||
        (eq.location || '').toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ equipment: items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      assetTag,
      name,
      category,
      manufacturer,
      model,
      serialNumber,
      purchaseDate,
      warrantyExpiry,
      location,
      notes,
    } = body;

    if (!assetTag || !name || !category) {
      return NextResponse.json({ error: 'assetTag, name, and category are required' }, { status: 400 });
    }

    const VALID_CATEGORIES = new Set(['VENTILATOR', 'MONITOR', 'PUMP', 'IMAGING', 'LAB', 'SURGICAL', 'DEFIBRILLATOR', 'OTHER']);
    if (!VALID_CATEGORIES.has(String(category).toUpperCase())) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const item = await prisma.equipment.create({
      data: {
        tenantId,
        assetTag: String(assetTag),
        name: String(name),
        category: String(category).toUpperCase(),
        manufacturer: manufacturer ? String(manufacturer) : null,
        model: model ? String(model) : null,
        serialNumber: serialNumber ? String(serialNumber) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        location: location ? String(location) : null,
        status: 'OPERATIONAL',
        notes: notes ? String(notes) : null,
        createdByUserId: userId,
      },
    });

    return NextResponse.json({ success: true, id: item.id, equipment: item });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.manage' }
);
