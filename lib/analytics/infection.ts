/**
 * Infection Surveillance -- HAI tracking and outbreak detection.
 * Monitors hospital-acquired infections, tracks antimicrobial resistance patterns.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// --- Types ------------------------------------------------------------------

export interface InfectionEvent {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId: string;
  type: InfectionType;
  organism?: string;
  site?: string;
  onsetDate: string;
  isHAI: boolean; // Hospital-Acquired Infection
  department: string;
  status: 'suspected' | 'confirmed' | 'ruled_out' | 'resolved';
  resistancePattern?: string[];
  isolationRequired: boolean;
  isolationType?: 'contact' | 'droplet' | 'airborne' | 'combined';
  reportedBy: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InfectionType =
  | 'SSI'      // Surgical Site Infection
  | 'CLABSI'   // Central Line-Associated BSI
  | 'CAUTI'    // Catheter-Associated UTI
  | 'VAP'      // Ventilator-Associated Pneumonia
  | 'CDI'      // C. difficile Infection
  | 'MRSA'     // Methicillin-Resistant S. aureus
  | 'VRE'      // Vancomycin-Resistant Enterococcus
  | 'OTHER';

export interface SurveillanceSummary {
  period: { start: Date; end: Date };
  totalInfections: number;
  haiCount: number;
  haiRate: number; // per 1000 patient days
  byType: { type: InfectionType; count: number; rate: number }[];
  byDepartment: { department: string; count: number; rate: number }[];
  byOrganism: { organism: string; count: number; resistanceRate: number }[];
  alerts: SurveillanceAlert[];
  monthlyTrend: { month: string; haiCount: number; rate: number }[];
}

export interface SurveillanceAlert {
  id: string;
  type: 'outbreak' | 'threshold_exceeded' | 'cluster' | 'new_resistance';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageAr: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

// --- Surveillance Functions -------------------------------------------------

export async function reportInfection(
  tenantId: string,
  userId: string,
  data: Omit<InfectionEvent, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
): Promise<InfectionEvent> {
  const row = await prisma.infectionEvent.create({
    data: {
      tenantId,
      patientId: data.patientId,
      encounterId: data.encounterId,
      type: data.type,
      organism: data.organism,
      site: data.site,
      onsetDate: new Date(data.onsetDate),
      isHAI: data.isHAI,
      department: data.department,
      status: data.status,
      resistancePattern: data.resistancePattern || [],
      isolationRequired: data.isolationRequired,
      isolationType: data.isolationType,
      reportedBy: userId,
      notes: data.notes,
    },
  });

  const event: InfectionEvent = {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId || '',
    encounterId: row.encounterId || '',
    type: (row.type as InfectionType) || 'OTHER',
    organism: row.organism || undefined,
    site: row.site || undefined,
    onsetDate: row.onsetDate ? row.onsetDate.toISOString().split('T')[0] : '',
    isHAI: row.isHAI,
    department: row.department || '',
    status: row.status as InfectionEvent['status'],
    resistancePattern: row.resistancePattern || undefined,
    isolationRequired: row.isolationRequired,
    isolationType: (row.isolationType as InfectionEvent['isolationType']) || undefined,
    reportedBy: row.reportedBy || userId,
    notes: row.notes || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  // Check for cluster/outbreak
  await checkForOutbreak(tenantId, event);

  return event;
}

export async function updateInfectionStatus(
  tenantId: string,
  eventId: string,
  status: InfectionEvent['status'],
  notes?: string,
): Promise<boolean> {
  const result = await prisma.infectionEvent.updateMany({
    where: { tenantId, id: eventId },
    data: {
      status,
      ...(notes ? { notes } : {}),
    },
  });
  return result.count > 0;
}

export async function getSurveillanceSummary(
  tenantId: string,
  range: { start: Date; end: Date },
): Promise<SurveillanceSummary> {
  const rows = await prisma.infectionEvent.findMany({
    where: {
      tenantId,
      onsetDate: {
        gte: new Date(range.start.toISOString().split('T')[0]),
        lte: new Date(range.end.toISOString().split('T')[0]),
      },
      status: { not: 'ruled_out' },
    },
  });

  // Map to local type
  const infections = rows.map((r) => ({
    id: r.id,
    type: (r.type as InfectionType) || 'OTHER',
    organism: r.organism || 'Unknown',
    department: r.department || '',
    isHAI: r.isHAI,
    resistancePattern: r.resistancePattern || [],
  }));

  // Estimate patient days (encounters * avg LOS)
  const encounterCount = await prisma.encounterCore.count({
    where: {
      tenantId,
      encounterType: 'IPD',
      createdAt: { gte: range.start, lte: range.end },
    },
  });
  const patientDays = Math.max(encounterCount * 5, 1); // rough estimate: 5 days avg

  const haiInfections = infections.filter((i) => i.isHAI);

  // By type
  const typeMap = new Map<string, number>();
  for (const inf of haiInfections) {
    typeMap.set(inf.type, (typeMap.get(inf.type) || 0) + 1);
  }

  // By department
  const deptMap = new Map<string, number>();
  for (const inf of infections) {
    deptMap.set(inf.department, (deptMap.get(inf.department) || 0) + 1);
  }

  // By organism
  const orgMap = new Map<string, { count: number; resistant: number }>();
  for (const inf of infections) {
    const org = inf.organism;
    const existing = orgMap.get(org) || { count: 0, resistant: 0 };
    existing.count++;
    if (inf.resistancePattern && inf.resistancePattern.length > 0) existing.resistant++;
    orgMap.set(org, existing);
  }

  // Monthly trend (last 12 months)
  const monthlyTrend: { month: string; haiCount: number; rate: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(range.end);
    monthStart.setMonth(monthStart.getMonth() - i, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const monthInf = await prisma.infectionEvent.count({
      where: {
        tenantId,
        isHAI: true,
        onsetDate: {
          gte: new Date(monthStart.toISOString().split('T')[0]),
          lt: new Date(monthEnd.toISOString().split('T')[0]),
        },
        status: { not: 'ruled_out' },
      },
    });

    monthlyTrend.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      haiCount: monthInf,
      rate: Math.round((monthInf / patientDays) * 1000 * 10) / 10,
    });
  }

  // Get active alerts
  const alertRows = await prisma.surveillanceAlert.findMany({
    where: {
      tenantId,
      createdAt: { gte: range.start },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const alerts: SurveillanceAlert[] = alertRows.map((a) => ({
    id: a.id,
    type: (a.type as SurveillanceAlert['type']) || 'cluster',
    severity: (a.severity as SurveillanceAlert['severity']) || 'info',
    message: a.message || '',
    messageAr: a.messageAr || '',
    details: (a.details as Record<string, unknown>) || {},
    createdAt: a.createdAt,
  }));

  return {
    period: range,
    totalInfections: infections.length,
    haiCount: haiInfections.length,
    haiRate: Math.round((haiInfections.length / patientDays) * 1000 * 10) / 10,
    byType: Array.from(typeMap.entries()).map(([type, count]) => ({
      type: type as InfectionType,
      count,
      rate: Math.round((count / patientDays) * 1000 * 10) / 10,
    })),
    byDepartment: Array.from(deptMap.entries()).map(([department, count]) => ({
      department,
      count,
      rate: Math.round((count / patientDays) * 1000 * 10) / 10,
    })),
    byOrganism: Array.from(orgMap.entries()).map(([organism, d]) => ({
      organism,
      count: d.count,
      resistanceRate: d.count > 0 ? Math.round((d.resistant / d.count) * 100) : 0,
    })),
    alerts,
    monthlyTrend,
  };
}

// --- Outbreak Detection -----------------------------------------------------

async function checkForOutbreak(
  tenantId: string,
  event: InfectionEvent,
): Promise<void> {
  // Check for cluster: same organism, same department, last 14 days
  if (!event.organism) return;

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const similar = await prisma.infectionEvent.count({
    where: {
      tenantId,
      organism: event.organism,
      department: event.department,
      status: { not: 'ruled_out' },
      createdAt: { gte: twoWeeksAgo },
    },
  });

  // Alert if 3+ cases of same organism in same department in 14 days
  if (similar >= 3) {
    await prisma.surveillanceAlert.create({
      data: {
        tenantId,
        type: 'cluster',
        severity: similar >= 5 ? 'critical' : 'warning',
        message: `Cluster detected: ${similar} cases of ${event.organism} in ${event.department} in last 14 days`,
        messageAr: `\u062A\u062C\u0645\u0639 \u0645\u0643\u062A\u0634\u0641: ${similar} \u062D\u0627\u0644\u0627\u062A ${event.organism} \u0641\u064A ${event.department}`,
        details: {
          organism: event.organism,
          department: event.department,
          caseCount: similar,
          latestEventId: event.id,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

// --- List / Search ----------------------------------------------------------

export async function listInfections(
  tenantId: string,
  filters?: {
    type?: InfectionType;
    department?: string;
    status?: string;
    isHAI?: boolean;
    limit?: number;
  },
): Promise<InfectionEvent[]> {
  const where: Record<string, unknown> = { tenantId };
  if (filters?.type) where.type = filters.type;
  if (filters?.department) where.department = filters.department;
  if (filters?.status) where.status = filters.status;
  if (filters?.isHAI !== undefined) where.isHAI = filters.isHAI;

  const rows = await prisma.infectionEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 100,
  });

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    patientId: r.patientId || '',
    encounterId: r.encounterId || '',
    type: (r.type as InfectionType) || 'OTHER',
    organism: r.organism || undefined,
    site: r.site || undefined,
    onsetDate: r.onsetDate ? r.onsetDate.toISOString().split('T')[0] : '',
    isHAI: r.isHAI,
    department: r.department || '',
    status: r.status as InfectionEvent['status'],
    resistancePattern: r.resistancePattern || undefined,
    isolationRequired: r.isolationRequired,
    isolationType: (r.isolationType as InfectionEvent['isolationType']) || undefined,
    reportedBy: r.reportedBy || '',
    notes: r.notes || undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}
