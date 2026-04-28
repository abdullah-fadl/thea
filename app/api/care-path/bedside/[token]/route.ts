import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET /api/care-path/bedside/[token]
// Public endpoint - returns patient-safe view of daily care path
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const carePath = await prisma.dailyCarePath.findFirst({
      where: { bedsideToken: token, status: 'ACTIVE' },
      include: {
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
      },
    });

    if (!carePath) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    const snapshot = (carePath.patientSnapshot ?? {}) as Record<string, unknown>;

    // Filter out sensitive info for bedside display
    const safeView = {
      id: carePath.id,
      date: carePath.date,
      departmentType: carePath.departmentType,
      status: carePath.status,
      completionPct: carePath.completionPct,
      patient: {
        fullName: snapshot.fullName,
        fullNameAr: snapshot.fullNameAr,
        mrn: snapshot.mrn,
        room: snapshot.room,
        bed: snapshot.bed,
      },
      dietOrder: carePath.dietOrder,
      instructions: carePath.instructions,
      shifts: carePath.shifts,
      tasks: carePath.tasks.map(t => ({
        id: t.id,
        category: t.category,
        scheduledTime: t.scheduledTime,
        // Sanitize medication titles for patient view (remove clinical details)
        title: t.category === 'MEDICATION'
          ? sanitizeMedTitle(t.title)
          : t.title,
        titleAr: t.category === 'MEDICATION' && t.titleAr
          ? sanitizeMedTitle(t.titleAr)
          : t.titleAr,
        status: t.status,
        completedAt: t.completedAt,
        priority: t.priority,
        shiftId: t.shiftId,
      })),
    };

    return NextResponse.json({ path: safeView });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function sanitizeMedTitle(title: string): string {
  // For bedside display: show medication time, hide dosage details
  const parts = title.split(' ');
  if (parts.length > 1) {
    return `${parts[0]} — Medication`;
  }
  return 'Medication';
}
