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

export async function GET(req: NextRequest) {
  try {
    const auth = await getPortalAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const carePath = await prisma.dailyCarePath.findFirst({
      where: {
        tenantId: auth.tenantId,
        patientMasterId: auth.patientId,
        date: dateOnly,
        status: 'ACTIVE',
      },
      include: {
        shifts: {
          orderBy: { startTime: 'asc' },
          select: {
            id: true,
            shiftType: true,
            nurseName: true,
            nurseNameAr: true,
            startTime: true,
            endTime: true,
            totalTasks: true,
            completedTasks: true,
          },
        },
        tasks: {
          orderBy: { scheduledTime: 'asc' },
          select: {
            id: true,
            category: true,
            scheduledTime: true,
            title: true,
            titleAr: true,
            status: true,
            completedAt: true,
            priority: true,
            shiftId: true,
          },
        },
      },
    });

    if (!carePath) {
      return NextResponse.json({ path: null });
    }

    const snapshot = (carePath.patientSnapshot ?? {}) as Record<string, unknown>;

    // Sanitize for patient view - remove clinical details from medication titles
    const safeTasks = carePath.tasks.map(t => ({
      ...t,
      title: t.category === 'MEDICATION' ? sanitizeMedTitle(t.title) : t.title,
      titleAr: t.category === 'MEDICATION' && t.titleAr ? sanitizeMedTitle(t.titleAr) : t.titleAr,
    }));

    return NextResponse.json({
      path: {
        id: carePath.id,
        date: carePath.date,
        departmentType: carePath.departmentType,
        completionPct: carePath.completionPct,
        patient: {
          fullName: snapshot.fullName,
          fullNameAr: snapshot.fullNameAr,
        },
        dietOrder: carePath.dietOrder,
        instructions: carePath.instructions,
        shifts: carePath.shifts,
        tasks: safeTasks,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function sanitizeMedTitle(title: string): string {
  const parts = title.split(' ');
  return parts.length > 1 ? `${parts[0]} — Medication` : 'Medication';
}
