/**
 * Admin EHR Patients API
 * GET /api/admin/ehr/patients/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Patient } from '@/lib/ehr/models';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const patientId = resolvedParams.id;

      if (!patientId) {
        return NextResponse.json(
          { error: 'Patient ID is required' },
          { status: 400 }
        );
      }

      // Resolve tenant UUID
      const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

      // Get patient - with tenant isolation
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
        patient: patient as unknown as Patient,
      });
    } catch (error: any) {
      logger.error('Get patient error', { category: 'api', route: 'GET /api/admin/ehr/patients/[id]', error });
      // [SEC-03]
      return NextResponse.json(
        { error: 'Failed to get patient' },
        { status: 500 }
      );
    }
  }, { permissionKey: 'admin.ehr.patients' })(request);
}
