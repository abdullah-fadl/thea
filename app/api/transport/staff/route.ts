import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import prisma from '@/lib/db/prisma';
import { getStaffWorkload } from '@/lib/transport/transportEngine';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createStaffSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  name: z.string().min(1, 'name is required'),
  nameAr: z.string().optional(),
  phone: z.string().optional(),
  zone: z.string().optional(),
  shiftStart: z.string().datetime().optional(),
  shiftEnd: z.string().datetime().optional(),
});

const updateStaffStatusSchema = z.object({
  staffId: z.string().min(1, 'staffId is required'),
  status: z.enum(['available', 'busy', 'off_duty', 'break']),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/transport/staff — List staff with workload
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const withWorkload = searchParams.get('workload') === 'true';

    if (withWorkload) {
      const workload = await getStaffWorkload(tenantId);
      return NextResponse.json({ staff: workload });
    }

    const staff = await prisma.transportStaff.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      take: 500,
    });

    return NextResponse.json({ staff });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.view',
  },
);

// ---------------------------------------------------------------------------
// POST /api/transport/staff — Add staff member
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Check if user already exists as transport staff
    const existing = await prisma.transportStaff.findFirst({
      where: { tenantId, userId: data.userId, isActive: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User is already registered as transport staff' },
        { status: 409 },
      );
    }

    const staff = await prisma.transportStaff.create({
      data: {
        tenantId,
        userId: data.userId,
        name: data.name,
        nameAr: data.nameAr ?? null,
        phone: data.phone ?? null,
        zone: data.zone ?? null,
        shiftStart: data.shiftStart ? new Date(data.shiftStart) : null,
        shiftEnd: data.shiftEnd ? new Date(data.shiftEnd) : null,
        status: 'available',
        isActive: true,
      },
    });

    return NextResponse.json({ staff }, { status: 201 });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.manage',
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/transport/staff — Update staff status
// ---------------------------------------------------------------------------

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateStaffStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const staff = await prisma.transportStaff.findFirst({
      where: { id: parsed.data.staffId, tenantId, isActive: true },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    // If setting to available, clear current task
    const updateData: any = { status: parsed.data.status };
    if (parsed.data.status === 'available') {
      updateData.currentTask = null;
    }

    // If setting to off_duty/break while busy, release their current request
    if (
      (parsed.data.status === 'off_duty' || parsed.data.status === 'break') &&
      staff.status === 'busy' &&
      staff.currentTask
    ) {
      // Set the request back to pending
      await prisma.transportRequest.updateMany({
        where: {
          id: staff.currentTask,
          tenantId,
          status: { in: ['assigned'] },
        },
        data: {
          status: 'pending',
          assignedTo: null,
          assignedToName: null,
        },
      });
      updateData.currentTask = null;
    }

    const updated = await prisma.transportStaff.update({
      where: { id: parsed.data.staffId },
      data: updateData,
    });

    return NextResponse.json({ staff: updated });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.manage',
  },
);
