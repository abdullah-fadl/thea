import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Documents API
 * GET  /api/cvision/documents - List employee documents
 * POST /api/cvision/documents - Create/upload document metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

const DOCUMENT_TYPES = [
  'CONTRACT', 'NATIONAL_ID', 'PASSPORT', 'IQAMA', 'CERTIFICATE',
  'LICENSE', 'MEDICAL', 'INSURANCE', 'CV', 'LETTER',
  'EXPERIENCE_CERTIFICATE', 'TRAINING_CERTIFICATE', 'PHOTO', 'OTHER',
] as const;

// GET - List documents
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const employeeId = searchParams.get('employeeId');
      const type = searchParams.get('type');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
      const skip = (page - 1) * limit;

      const db = await getCVisionDb(tenantId);
      const filter: any = { tenantId, deletedAt: null };
      if (employeeId) filter.employeeId = employeeId;
      if (type) filter.documentType = type;

      const [documents, total] = await Promise.all([
        db.collection('cvision_employee_documents')
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection('cvision_employee_documents').countDocuments(filter),
      ]);

      return NextResponse.json({
        success: true,
        data: documents,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      logger.error('[CVision Documents GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST - Create document record
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const {
        employeeId, documentType, title, titleAr, description,
        fileName, fileSize, mimeType, storageKey,
        expiryDate, issueDate, issuingAuthority, documentNumber,
      } = body;

      if (!employeeId || !documentType || !title) {
        return NextResponse.json(
          { success: false, error: 'employeeId, documentType, and title are required' },
          { status: 400 }
        );
      }

      if (!DOCUMENT_TYPES.includes(documentType)) {
        return NextResponse.json(
          { success: false, error: `Invalid documentType. Must be one of: ${DOCUMENT_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const db = await getCVisionDb(tenantId);

      // Verify employee exists
      const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId, deletedAt: null });
      if (!employee) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
      }

      const docId = uuidv4();
      const document = {
        id: docId,
        tenantId,
        employeeId,
        documentType,
        title,
        titleAr: titleAr || '',
        description: description || '',
        fileName: fileName || '',
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/octet-stream',
        storageKey: storageKey || `docs/${tenantId}/${employeeId}/${docId}`,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        issueDate: issueDate ? new Date(issueDate) : null,
        issuingAuthority: issuingAuthority || '',
        documentNumber: documentNumber || '',
        status: 'ACTIVE',
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      await db.collection('cvision_employee_documents').insertOne(document);

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'document_create', 'document', {
        resourceId: docId,
        metadata: { employeeId, documentType, title },
      });

      return NextResponse.json({ success: true, data: document }, { status: 201 });
    } catch (error: any) {
      logger.error('[CVision Documents POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
