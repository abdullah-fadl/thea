import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { shadowEvaluate } from '@/lib/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — list all beds for this tenant with occupancy
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, hospitalId, userId, role }) => {
    // Cedar shadow-eval: legacy already allowed (we're inside the handler).
    // Cedar evaluates in parallel; result is logged but NEVER returned to caller.
    void shadowEvaluate({ legacyDecision: 'allow', action: 'Read', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role, hospitalId: hospitalId ?? '' } }, resource: { id: tenantId, type: 'Thea::HospitalResource', attrs: { tenantId, hospitalId: hospitalId ?? '' } } });

    const wardFilter = req.nextUrl.searchParams.get('ward');

    const beds = await prisma.ipdBed.findMany({
      where: {
        tenantId,
        ...(hospitalId ? { hospitalId } : {}),
        ...(wardFilter ? { ward: wardFilter } : {}),
      },
      orderBy: [{ ward: 'asc' }, { bedLabel: 'asc' }],
      take: 200,
    });

    const activeAdmissions = await prisma.ipdAdmission.findMany({
      where: { tenantId, releasedAt: null, isActive: true },
      select: { bedId: true },
      take: 200,
    });
    const occupied = new Set(activeAdmissions.map((a: any) => String(a.bedId || '')).filter(Boolean));

    const items = beds.map((bed: any) => ({
      id: bed.id,
      bedLabel: bed.bedLabel || bed.label || bed.id,
      ward: bed.ward || null,
      room: bed.room || bed.roomLabel || null,
      unit: bed.unit || bed.unitLabel || null,
      departmentId: bed.departmentId || null,
      departmentName: bed.departmentName || null,
      isActive: bed.isActive !== false,
      createdAt: bed.createdAt,
      status: occupied.has(String(bed.id)) ? 'OCCUPIED' : (bed.isActive !== false ? 'AVAILABLE' : 'INACTIVE'),
    }));

    // Group by ward
    const wards = [...new Set(items.map(b => b.ward ?? 'General'))].sort();

    return NextResponse.json({ beds: items, wards });
  }),
  { tenantScoped: true, permissionKey: 'ipd.admin.view', hospitalScoped: true }
);

// POST — create a new bed
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { bedLabel, ward, room, unit, departmentId, departmentName } = body;
    if (!bedLabel) return NextResponse.json({ error: 'bedLabel is required' }, { status: 400 });

    const bed = await prisma.ipdBed.create({
      data: {
        tenantId,
        bedLabel: String(bedLabel).trim(),
        ward: ward ? String(ward).trim() : null,
        room: room ? String(room).trim() : null,
        unit: unit ? String(unit).trim() : null,
        departmentId: departmentId ? String(departmentId).trim() : null,
        departmentName: departmentName ? String(departmentName).trim() : null,
        isActive: true,
      },
    });

    return NextResponse.json({ bed }, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'ipd.admin.edit' }
);
