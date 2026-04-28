import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Map of collection names to Prisma model import functions.
 * Since Prisma doesn't support dynamic table access, we route to known models.
 */
async function importToModel(
  modelName: string,
  documents: any[],
  tenantUuid: string,
  userId: string
): Promise<number> {
  // Supported collection imports
  const modelMap: Record<string, () => Promise<number>> = {
    'ehr_patients': async () => {
      const created = await prisma.ehrPatient.createMany({ data: documents.map(d => ({ ...d, tenantId: tenantUuid, createdBy: userId, updatedBy: userId })) });
      return created.count;
    },
    'ehr_encounters': async () => {
      const created = await prisma.ehrEncounter.createMany({ data: documents.map(d => ({ ...d, tenantId: tenantUuid, createdBy: userId })) });
      return created.count;
    },
    'ehr_orders': async () => {
      const created = await prisma.ehrOrder.createMany({ data: documents.map(d => ({ ...d, tenantId: tenantUuid, createdBy: userId })) });
      return created.count;
    },
    'ehr_notes': async () => {
      const created = await prisma.ehrNote.createMany({ data: documents.map(d => ({ ...d, tenantId: tenantUuid, createdBy: userId })) });
      return created.count;
    },
    'ehr_tasks': async () => {
      const created = await prisma.ehrTask.createMany({ data: documents.map(d => ({ ...d, tenantId: tenantUuid, createdBy: userId })) });
      return created.count;
    },
    'departments': async () => {
      const created = await prisma.department.createMany({ data: documents.map(d => ({ ...d, tenantId: tenantUuid, createdBy: userId })) });
      return created.count;
    },
  };

  const importFn = modelMap[modelName];
  if (!importFn) {
    throw new Error(`Unsupported collection for import: ${modelName}. Supported: ${Object.keys(modelMap).join(', ')}`);
  }

  return importFn();
}

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    // Authorization: Only admin or supervisor can import data
    if (!['admin', 'supervisor'].includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admin or supervisor can import data' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const collection = formData.get('collection') as string;

    if (!file || !collection) {
      return NextResponse.json(
        { error: 'File and collection are required' },
        { status: 400 }
      );
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    const columns: string[] = [];
    const documents: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const rowData = row.values as unknown[];
      rowData.shift(); // Remove first empty element

      if (rowNumber === 1) {
        columns.push(...rowData.map(String));
      } else {
        const doc: any = {};

        columns.forEach((col, idx) => {
          const value = rowData[idx];
          if (value !== null && value !== undefined) {
            // Handle date columns
            if (col.toLowerCase().includes('date') && value instanceof Date) {
              doc[col] = value;
            } else {
              doc[col] = value;
            }
          }
        });

        documents.push(doc);
      }
    });

    // Import into PostgreSQL via Prisma with tenant isolation
    let imported = 0;
    if (documents.length > 0) {
      imported = await importToModel(collection, documents, tenant.id, userId);
    }

    await createAuditLog(
      'data_import',
      collection,
      'DATA_IMPORTED',
      userId || 'system',
      undefined,
      { collection, imported, fileName: file.name },
      tenantId
    );

    return NextResponse.json({
      success: true,
      imported,
    });
  } catch (error) {
    logger.error('Import error', { category: 'api', route: 'POST /api/admin/data-import', error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.data.import' });
