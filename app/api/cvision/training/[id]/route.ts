import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Training Detail API
 * GET    /api/cvision/training/:id - Get training course details
 * PATCH  /api/cvision/training/:id - Update training course
 * DELETE /api/cvision/training/:id - Deactivate training course
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

// GET - Get training course by ID with enrollments
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      if (!id) return NextResponse.json({ ok: false, error: 'Course ID required' }, { status: 400 });

      const db = await getCVisionDb(tenantId);
      const courseCol = db.collection('cvision_training_courses');
      const enrollCol = db.collection('cvision_training_enrollments');

      let course = await courseCol.findOne({ tenantId, id });
      if (!course) course = await courseCol.findOne({ tenantId, courseId: id });
      if (!course) return NextResponse.json({ ok: false, error: 'Course not found' }, { status: 404 });

      const courseId = (course as any).courseId || (course as any).id || id;
      const enrollments = await enrollCol.find({ tenantId, courseId }).sort({ createdAt: -1 }).limit(500).toArray();

      // Resolve employee names
      const empIds = [...new Set(enrollments.map((e: any) => e.employeeId))];
      const employees = empIds.length > 0
        ? await db.collection('cvision_employees').find({ tenantId, id: { $in: empIds } }).project({ id: 1, firstName: 1, lastName: 1, email: 1 }).toArray()
        : [];
      const empMap = new Map(employees.map((e: any) => [e.id, `${e.firstName || ''} ${e.lastName || ''}`.trim()]));

      const enrichedEnrollments = enrollments.map((e: any) => ({
        ...e,
        employeeName: empMap.get(e.employeeId) || e.employeeName || e.employeeId,
      }));

      const stats = {
        totalEnrolled: enrollments.filter((e: any) => ['ENROLLED', 'ATTENDED', 'COMPLETED'].includes(e.status)).length,
        completed: enrollments.filter((e: any) => e.status === 'COMPLETED').length,
        failed: enrollments.filter((e: any) => e.status === 'FAILED').length,
        withdrawn: enrollments.filter((e: any) => e.status === 'WITHDRAWN').length,
        avgScore: enrollments.filter((e: any) => e.score != null).reduce((s: number, e: any, _, a: any[]) => s + (e.score / a.length), 0),
      };

      return NextResponse.json({
        ok: true,
        data: {
          ...course,
          courseId,
          title: (course as any).title || (course as any).name,
          titleAr: (course as any).titleAr || (course as any).nameAr,
          enrollments: enrichedEnrollments,
          stats,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Training GET/:id]', error?.message || String(error));
      return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.TRAINING_READ }
);

// PATCH - Update training course
export const PATCH = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) return ctxResult;
      const ctx = ctxResult;
      if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAINING_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAINING_WRITE');

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      if (!id) return NextResponse.json({ ok: false, error: 'Course ID required' }, { status: 400 });

      const body = await request.json();
      const db = await getCVisionDb(tenantId);
      const courseCol = db.collection('cvision_training_courses');

      let existing = await courseCol.findOne({ tenantId, id });
      if (!existing) existing = await courseCol.findOne({ tenantId, courseId: id });
      if (!existing) return NextResponse.json({ ok: false, error: 'Course not found' }, { status: 404 });

      const allowedFields = ['title', 'titleAr', 'name', 'nameAr', 'description', 'category', 'provider', 'duration', 'cost', 'currency', 'isExternal', 'isMandatory', 'maxParticipants', 'isActive'];
      const updates: any = { updatedAt: new Date(), updatedBy: userId };
      for (const field of allowedFields) {
        if (body[field] !== undefined) updates[field] = body[field];
      }

      const filterKey = (existing as any).courseId ? 'courseId' : 'id';
      await courseCol.updateOne({ tenantId, [filterKey]: id }, { $set: updates });

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'training_course_update', 'training', {
        resourceId: id,
        changes: { after: updates },
      });

      return NextResponse.json({ ok: true, data: { id, ...updates } });
    } catch (error: any) {
      logger.error('[CVision Training PATCH/:id]', error?.message || String(error));
      return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.TRAINING_WRITE }
);

// DELETE - Deactivate training course
export const DELETE = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) return ctxResult;
      const ctx = ctxResult;
      if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAINING_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAINING_WRITE');

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      if (!id) return NextResponse.json({ ok: false, error: 'Course ID required' }, { status: 400 });

      const db = await getCVisionDb(tenantId);
      const courseCol = db.collection('cvision_training_courses');

      let existing = await courseCol.findOne({ tenantId, id });
      if (!existing) existing = await courseCol.findOne({ tenantId, courseId: id });
      if (!existing) return NextResponse.json({ ok: false, error: 'Course not found' }, { status: 404 });

      const filterKey = (existing as any).courseId ? 'courseId' : 'id';
      await courseCol.updateOne({ tenantId, [filterKey]: id }, { $set: { isActive: false, updatedAt: new Date(), updatedBy: userId } });

      // Withdraw active enrollments
      await db.collection('cvision_training_enrollments').updateMany(
        { tenantId, courseId: id, status: 'ENROLLED' },
        { $set: { status: 'WITHDRAWN', updatedAt: new Date() } }
      );

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'training_course_deactivate', 'training', {
        resourceId: id,
      });

      return NextResponse.json({ ok: true, message: 'Course deactivated' });
    } catch (error: any) {
      logger.error('[CVision Training DELETE/:id]', error?.message || String(error));
      return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.TRAINING_WRITE }
);
