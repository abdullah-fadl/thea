import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Default OR rooms — in production these would come from tenant config
const DEFAULT_ROOMS = [
  { name: 'Theater 1', type: 'General', status: 'available' },
  { name: 'Theater 2', type: 'General', status: 'available' },
  { name: 'Theater 3', type: 'Orthopedic', status: 'available' },
  { name: 'Theater 4', type: 'Cardiac', status: 'available' },
  { name: 'Theater 5', type: 'Neurosurgery', status: 'available' },
  { name: 'Theater 6', type: 'Obstetric', status: 'available' },
  { name: 'Minor OR', type: 'Minor Procedures', status: 'available' },
  { name: 'Emergency OR', type: 'Emergency', status: 'available' },
];

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  // Try to load rooms from tenant config (stored in a generic settings collection)
  // Fall back to defaults if not configured
  let rooms = DEFAULT_ROOMS;

  try {
    const config = await (prisma.$queryRaw`SELECT value FROM tenant_configs WHERE "tenantId" = ${tenantId} AND key = 'or_rooms' LIMIT 1` as Promise<Array<{ value: unknown }>>).catch(() => []);
    if (config.length > 0 && Array.isArray(config[0].value)) {
      rooms = config[0].value as typeof DEFAULT_ROOMS;
    }
  } catch {
    // tenantConfig model may not exist yet — use defaults
  }

  // Enrich with current usage (how many cases are in-progress in each room right now)
  const today = new Date().toISOString().slice(0, 10);
  // Get room names from active cases for today
  const activeCasesWithRoom = await prisma.orCase.findMany({
    where: {
      tenantId,
      scheduledDate: new Date(today),
      status: 'IN_PROGRESS',
    },
    select: { id: true, roomName: true },
    take: 100,
  });
  const activeRoomSet = new Set(
    activeCasesWithRoom.map((c) => c.roomName).filter(Boolean)
  );

  const enriched = rooms.map((room) => ({
    ...room,
    status: activeRoomSet.has(room.name) ? 'in-use' : room.status,
  }));

  return NextResponse.json({ rooms: enriched });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' }
);
