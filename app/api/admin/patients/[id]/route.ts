/**
 * Admin EHR Patients API
 * GET /api/admin/patients/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }, resolvedParams) => {
    try {
      // Resolve params if provided as Promise
      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const patientId = paramsObj?.id as string;

      if (!patientId) {
        return NextResponse.json(
          { error: 'Patient ID is required' },
          { status: 400 }
        );
      }

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      const patient = await prisma.ehrPatient.findFirst({
        where: { tenantId: tenant.id, id: patientId },
      });

      if (!patient) {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        patient,
      });
    } catch (error: any) {
      logger.error('Get patient error', { category: 'api', route: 'GET /api/admin/patients/[id]', error });
      // [SEC-03]
      return NextResponse.json(
        { error: 'Failed to get patient' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.ehr.patients.access' })(request, { params });
}
