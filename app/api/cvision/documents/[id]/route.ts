import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Document Detail API
 * GET    /api/cvision/documents/:id - Get document details
 * PATCH  /api/cvision/documents/:id - Update document
 * DELETE /api/cvision/documents/:id - Soft-delete document
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

// GET - Get single document
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      if (!id) return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 });

      const db = await getCVisionDb(tenantId);
      const doc = await db.collection('cvision_employee_documents').findOne({ tenantId, id, deletedAt: null });
      if (!doc) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });

      // Enrich with employee name
      const emp = (doc as any).employeeId
        ? await db.collection('cvision_employees').findOne({ tenantId, id: (doc as any).employeeId })
        : null;

      return NextResponse.json({
        success: true,
        data: {
          ...doc,
          employeeName: emp ? `${(emp as any).firstName || ''} ${(emp as any).lastName || ''}`.trim() : null,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Documents GET/:id]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// PATCH - Update document
export const PATCH = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      if (!id) return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 });

      const body = await request.json();
      const db = await getCVisionDb(tenantId);

      const existing = await db.collection('cvision_employee_documents').findOne({ tenantId, id, deletedAt: null });
      if (!existing) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });

      const allowedFields = ['title', 'titleAr', 'description', 'documentType', 'expiryDate', 'issueDate', 'issuingAuthority', 'documentNumber', 'status'];
      const updates: any = { updatedAt: new Date(), updatedBy: userId };
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = field.includes('Date') && body[field] ? new Date(body[field]) : body[field];
        }
      }

      await db.collection('cvision_employee_documents').updateOne(
        { tenantId, id },
        { $set: updates }
      );

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'document_update', 'document', {
        resourceId: id,
        changes: { before: { title: (existing as any).title }, after: updates },
      });

      return NextResponse.json({ success: true, data: { id, ...updates } });
    } catch (error: any) {
      logger.error('[CVision Documents PATCH/:id]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);

// DELETE - Soft delete document
export const DELETE = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      if (!id) return NextResponse.json({ success: false, error: 'Document ID required' }, { status: 400 });

      const db = await getCVisionDb(tenantId);

      const existing = await db.collection('cvision_employee_documents').findOne({ tenantId, id, deletedAt: null });
      if (!existing) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });

      await db.collection('cvision_employee_documents').updateOne(
        { tenantId, id },
        { $set: { deletedAt: new Date(), deletedBy: userId, status: 'DELETED' } }
      );

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'document_delete', 'document', {
        resourceId: id,
        metadata: { documentType: (existing as any).documentType, title: (existing as any).title },
      });

      return NextResponse.json({ success: true, message: 'Document deleted' });
    } catch (error: any) {
      logger.error('[CVision Documents DELETE/:id]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_DELETE }
);
