import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');

  // [P-02] Fetch departments, beds, and admissions with limits + parallel execution
  const bedsWhere: any = { isActive: { not: false }, tenantId };
  if (departmentId) bedsWhere.departmentId = departmentId;

  const [departments, beds, currentAdmissions] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true, tenantId },
      take: 500,
    }),
    prisma.ipdBed.findMany({ where: bedsWhere, take: 2000 }),
    prisma.ipdAdmission.findMany({
      where: { dischargeDate: null, isActive: true, tenantId },
      take: 2000,
    }),
  ]);

  // Create a map of bedId to admission
  const admissionMap = new Map();
  currentAdmissions.forEach((admission: any) => {
    admissionMap.set(admission.bedId, admission);
  });

  // Enrich beds with admission data and department info
  const enrichedBeds = beds.map((bed: any) => {
    const admission = admissionMap.get(bed.id);
    const department = departments.find((d: any) => d.id === bed.departmentId);

    return {
      ...bed,
      departmentName: department?.name || 'Unknown',
      status: admission ? 'occupied' : 'vacant',
      admission: admission ? {
        patientId: admission.patientId,
        patientName: admission.patientName,
        admissionDate: admission.admissionDate,
        admissionTime: admission.admissionTime,
        doctorName: admission.doctorName,
        diagnosis: admission.diagnosis,
      } : null,
    };
  });

  // Group beds by department
  const bedsByDepartment: Record<string, any[]> = {};
  enrichedBeds.forEach((bed: any) => {
    const deptName = bed.departmentName;
    if (!bedsByDepartment[deptName]) {
      bedsByDepartment[deptName] = [];
    }
    bedsByDepartment[deptName].push(bed);
  });

  // Calculate statistics
  const totalBeds = enrichedBeds.length;
  const occupiedBeds = enrichedBeds.filter(b => b.status === 'occupied').length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return NextResponse.json({
    beds: enrichedBeds,
    bedsByDepartment,
    statistics: {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
    },
    departments: departments.map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.code,
    })),
  });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' },
);
