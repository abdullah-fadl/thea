import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

async function getPortalAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('portal_token')?.value;
    if (!token) return null;
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET required');
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload as { patientId: string; tenantId: string };
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  try {
    const auth = await getPortalAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const encounters = await prisma.encounterCore.findMany({
      where: {
        tenantId: auth.tenantId,
        patientId: auth.patientId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        status: true,
        department: true,
        encounterType: true,
        opdEncounter: {
          select: {
            visitType: true,
            clinicExtensions: true,
          },
        },
      },
    });

    const items = encounters.map((e: any) => ({
      encounterId: e.id,
      date: e.createdAt,
      department: e.department || 'OPD',
      type: e.opdEncounter?.visitType || e.encounterType || 'OPD',
      status: e.status,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
