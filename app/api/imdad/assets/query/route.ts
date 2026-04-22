import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const GET = withAuthTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const subcategory = url.searchParams.get('subcategory');
  const department = url.searchParams.get('department');
  const hospitalId = url.searchParams.get('hospitalId');
  const status = url.searchParams.get('status');
  const networkWide = url.searchParams.get('networkWide') === 'true';

  const where: Record<string, unknown> = { tenantId, isDeleted: false };
  if (category) where.category = category;
  if (subcategory) where.subcategoryCode = subcategory;
  if (department) where.departmentCode = department;
  if (!networkWide && hospitalId) where.hospitalId = hospitalId;
  if (status) where.status = status;

  const assets = await (prisma as any).imdadAsset.findMany({
    where,
    take: 500,
  });

  const totalCount = assets.length;
  const totalValueSAR = assets.reduce((s: number, a: any) => s + (a.currentBookValueSAR || 0), 0);

  // Aggregations
  const byCategory: Record<string, { count: number; valueSAR: number }> = {};
  const byDepartment: Record<string, { count: number; valueSAR: number }> = {};
  const byHospital: Record<string, { count: number; valueSAR: number }> = {};
  const byStatus: Record<string, number> = {};
  const bySubcategory: Record<string, { count: number; valueSAR: number }> = {};

  for (const a of assets) {
    const cat = a.category || 'UNKNOWN';
    byCategory[cat] = byCategory[cat] || { count: 0, valueSAR: 0 };
    byCategory[cat].count++;
    byCategory[cat].valueSAR += a.currentBookValueSAR || 0;

    const dept = a.departmentCode || 'UNKNOWN';
    byDepartment[dept] = byDepartment[dept] || { count: 0, valueSAR: 0 };
    byDepartment[dept].count++;
    byDepartment[dept].valueSAR += a.currentBookValueSAR || 0;

    const hosp = a.hospitalId || 'UNKNOWN';
    byHospital[hosp] = byHospital[hosp] || { count: 0, valueSAR: 0 };
    byHospital[hosp].count++;
    byHospital[hosp].valueSAR += a.currentBookValueSAR || 0;

    byStatus[a.status] = (byStatus[a.status] || 0) + 1;

    const sub = a.subcategoryCode || 'UNKNOWN';
    bySubcategory[sub] = bySubcategory[sub] || { count: 0, valueSAR: 0 };
    bySubcategory[sub].count++;
    bySubcategory[sub].valueSAR += a.currentBookValueSAR || 0;
  }

  return NextResponse.json({
    success: true,
    data: {
      totalCount,
      totalValueSAR,
      byCategory,
      byDepartment,
      byHospital,
      byStatus,
      bySubcategory,
      items: assets.slice(0, 100),
    },
  });
}, { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.asset.view' });
