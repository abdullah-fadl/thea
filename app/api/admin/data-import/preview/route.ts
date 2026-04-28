import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import ExcelJS from 'exceljs';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    const columns: string[] = [];
    const rows: any[][] = [];

    worksheet.eachRow((row, rowNumber) => {
      const rowData = row.values as unknown[];
      rowData.shift(); // Remove first empty element

      if (rowNumber === 1) {
        columns.push(...rowData.map(String));
      } else {
        rows.push(rowData);
      }
    });

    return NextResponse.json({
      columns,
      rows,
      totalRows: rows.length,
    });
  } catch (error) {
    logger.error('Preview error', { category: 'api', route: 'POST /api/admin/data-import/preview', error });
    return NextResponse.json(
      { error: 'Failed to preview file' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.data-import' });
