import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { decryptField } from '@/lib/security/fieldEncryption';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const statusParam = req.nextUrl.searchParams.get('status') || '';
    const search = req.nextUrl.searchParams.get('search') || '';

    const where: any = { tenantId };

    if (statusParam) {
      const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
      where.status = { in: statuses };
    }

    if (search) {
      where.OR = [
        { specimenId: { contains: search, mode: 'insensitive' } },
        { patientId: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rawSpecimens = await prisma.labSpecimen.findMany({
      where,
      orderBy: { collectedAt: 'desc' },
      take: 200,
    });

    // Enrich with patient data
    const patientIds = [...new Set(rawSpecimens.map((s: any) => String(s.patientId || '')).filter(Boolean))];
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
        })
      : [];
    const patientsById = patients.reduce<Record<string, any>>((acc, p) => {
      acc[String(p.id || '')] = p;
      return acc;
    }, {});

    const specimens = rawSpecimens.map((s: any) => {
      const patient = patientsById[String(s.patientId || '')] || {};
      return {
        ...s,
        patientName: [decryptField(patient.firstName), decryptField(patient.lastName)].filter(Boolean).join(' ') || s.patientName || 'Unknown',
        mrn: patient.mrn || s.mrn || null,
      };
    });

    return NextResponse.json({ specimens });
  }),
  { tenantScoped: true, permissionKey: 'lab.specimens.view' }
);
