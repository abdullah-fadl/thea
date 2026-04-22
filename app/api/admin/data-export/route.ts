import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { logger } from '@/lib/monitoring/logger';
import { rateLimitExport, getRequestIp } from '@/lib/security/rateLimit';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

/**
 * Fetch documents from a known Prisma model by collection name.
 * Since Prisma doesn't support dynamic table access, we route to known models.
 */
async function fetchFromModel(modelName: string, tenantUuid: string, limit: number = 1000): Promise<any[]> {
  const modelMap: Record<string, () => Promise<any[]>> = {
    'ehr_patients': () => prisma.ehrPatient.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'ehr_encounters': () => prisma.ehrEncounter.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'ehr_orders': () => prisma.ehrOrder.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'ehr_notes': () => prisma.ehrNote.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'ehr_tasks': () => prisma.ehrTask.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'ehr_privileges': () => prisma.ehrPrivilege.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'ehr_audit_logs': () => prisma.ehrAuditLog.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'ehr_users': () => prisma.ehrUser.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'departments': () => prisma.department.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'users': () => prisma.user.findMany({ where: { tenantId: tenantUuid }, take: limit, select: {
      id: true, email: true, firstName: true, lastName: true, displayName: true,
      role: true, department: true, staffId: true, employeeNo: true,
      isActive: true, createdAt: true, updatedAt: true,
    }}),
    'opd_census': () => prisma.opdCensus.findMany({ where: { tenantId: tenantUuid }, take: limit }),
    'opd_daily_data': () => prisma.opdDailyData.findMany({ where: { tenantId: tenantUuid }, take: limit }),
  };

  const fetchFn = modelMap[modelName];
  if (!fetchFn) {
    throw new Error(`Unsupported collection for export: ${modelName}. Supported: ${Object.keys(modelMap).join(', ')}`);
  }

  return fetchFn();
}

export const GET = withAuthTenant(async (req, { user, tenantId, role, userId }) => {
  const rl = await rateLimitExport({ ip: getRequestIp(req), userId });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    // Only admin/supervisor can export, or platform roles for cross-tenant export
    const isPlatformRole = ['thea-owner', 'platform', 'owner'].includes(role);
    if (!isPlatformRole && !['admin', 'supervisor'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection is required' },
        { status: 400 }
      );
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Fetch data from PostgreSQL via Prisma with tenant isolation
    const documents = await fetchFromModel(collection, tenant.id);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    if (documents.length > 0) {
      // Get all unique keys from documents
      const allKeys = new Set<string>();
      documents.forEach((doc: any) => {
        Object.keys(doc).forEach(key => {
          allKeys.add(key);
        });
      });

      const columns = Array.from(allKeys);
      worksheet.columns = columns.map(key => ({ header: key, key, width: 15 }));

      // Add data rows
      documents.forEach((doc: any) => {
        const row: any = {};
        columns.forEach(key => {
          const value = doc[key];
          if (value instanceof Date) {
            row[key] = value.toISOString().split('T')[0];
          } else if (typeof value === 'object' && value !== null) {
            row[key] = JSON.stringify(value);
          } else {
            row[key] = value;
          }
        });
        worksheet.addRow(row);
      });
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Audit log — data export is a high-risk PII operation
    await createAuditLog(
      'data_export', collection, 'export_collection',
      userId, user?.email,
      { collection, recordCount: documents.length, format: 'xlsx' },
      tenantId, req,
    ).catch(() => {});

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${collection}_export.xlsx`,
      },
    });
  } catch (error) {
    logger.error('Export error', { category: 'api', route: 'GET /api/admin/data-export', error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.data.export' });
