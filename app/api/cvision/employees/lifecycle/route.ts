import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  createOnboarding, completeOnboardingStep, skipOnboardingStep,
  getOnboardingStatus, getAllOnboardings, getOnboardingTemplates,
  saveOnboardingTemplate, DEFAULT_ONBOARDING_STEPS,
} from '@/lib/cvision/employees/onboarding-engine';
import {
  initiateOffboarding, completeOffboardingItem, calculateFinalSettlement,
  saveExitInterview, completeOffboarding, getOffboarding, getAllOffboardings,
} from '@/lib/cvision/employees/offboarding-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || '';
      const db = await getCVisionDb(tenantId);

      if (action === 'onboarding-status') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const onboarding = await getOnboardingStatus(db, tenantId, employeeId);
        const templateSteps = DEFAULT_ONBOARDING_STEPS;
        return NextResponse.json({ success: true, onboarding, templateSteps });
      }

      if (action === 'onboarding-list') {
        const status = searchParams.get('status') || undefined;
        const onboardings = await getAllOnboardings(db, tenantId, status);
        const empIds = onboardings.map((o: any) => o.employeeId);
        const employees = await db.collection('cvision_employees')
          .find({ tenantId, id: { $in: empIds } })
          .project({ id: 1, firstName: 1, lastName: 1, departmentId: 1, jobTitleId: 1, hireDate: 1, hiredAt: 1 })
          .toArray();
        const deptIds = [...new Set(employees.map((e: any) => e.departmentId).filter(Boolean))];
        const deptDocs = deptIds.length > 0 ? await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray() : [];
        const deptMap = new Map(deptDocs.map((d: any) => [d.id, d.name]));
        const empMap = new Map(employees.map((e: any) => [e.id, {
          ...e,
          fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
          department: deptMap.get(e.departmentId) || null,
        }]));
        const enriched = onboardings.map((o: any) => ({ ...o, employee: empMap.get(o.employeeId) || null }));
        return NextResponse.json({ success: true, onboardings: enriched });
      }

      if (action === 'onboarding-templates') {
        const templates = await getOnboardingTemplates(db, tenantId);
        return NextResponse.json({ success: true, templates });
      }

      if (action === 'offboarding-status') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const offboarding = await getOffboarding(db, tenantId, employeeId);
        return NextResponse.json({ success: true, offboarding });
      }

      if (action === 'offboarding-list') {
        const status = searchParams.get('status') || undefined;
        const offboardings = await getAllOffboardings(db, tenantId, status);
        const empIds = offboardings.map((o: any) => o.employeeId);
        const employees = await db.collection('cvision_employees')
          .find({ tenantId, id: { $in: empIds } })
          .project({ id: 1, firstName: 1, lastName: 1, departmentId: 1, jobTitleId: 1 })
          .toArray();
        const deptIds = [...new Set(employees.map((e: any) => e.departmentId).filter(Boolean))];
        const deptDocs = deptIds.length > 0 ? await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray() : [];
        const deptMap = new Map(deptDocs.map((d: any) => [d.id, d.name]));
        const empMap = new Map(employees.map((e: any) => [e.id, {
          ...e,
          fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
          department: deptMap.get(e.departmentId) || null,
        }]));
        const enriched = offboardings.map((o: any) => ({ ...o, employee: empMap.get(o.employeeId) || null }));
        return NextResponse.json({ success: true, offboardings: enriched });
      }

      if (action === 'documents') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const docs = await db.collection('cvision_employee_documents')
          .find({ tenantId, employeeId }).sort({ uploadedAt: -1 }).limit(100).toArray();
        return NextResponse.json({ success: true, documents: docs });
      }

      if (action === 'timeline') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const history = await db.collection('cvision_employee_status_history')
          .find({ tenantId, employeeId }).sort({ createdAt: -1 }).limit(50).toArray();
        return NextResponse.json({ success: true, history });
      }

      if (action === 'dashboard') {
        const [onboardingActive, offboardingActive, totalEmployees] = await Promise.all([
          db.collection('cvision_employee_onboarding').countDocuments({ tenantId, status: 'IN_PROGRESS' }),
          db.collection('cvision_offboarding').countDocuments({ tenantId, status: { $nin: ['COMPLETED'] } }),
          db.collection('cvision_employees').countDocuments({ tenantId, status: { $in: ['ACTIVE', 'PROBATION', 'Active'] } }),
        ]);
        const recentOnboardings = await db.collection('cvision_employee_onboarding')
          .find({ tenantId }).sort({ startDate: -1 }).limit(5).toArray();
        const recentOffboardings = await db.collection('cvision_offboarding')
          .find({ tenantId }).sort({ initiatedAt: -1 }).limit(5).toArray();
        // Enrich with employee names
        const allEmpIds = [...new Set([
          ...recentOnboardings.map((o: any) => o.employeeId),
          ...recentOffboardings.map((o: any) => o.employeeId),
        ].filter(Boolean))];
        if (allEmpIds.length > 0) {
          const emps = await db.collection('cvision_employees')
            .find({ tenantId, id: { $in: allEmpIds } })
            .project({ id: 1, firstName: 1, lastName: 1 })
            .toArray();
          const nameMap = new Map<string, string>();
          for (const e of emps) {
            const name = `${e.firstName || ''} ${e.lastName || ''}`.trim();
            if (name) { nameMap.set(e.id, name); }
          }
          for (const o of recentOnboardings) o.employeeName = nameMap.get(o.employeeId) || o.employeeId;
          for (const o of recentOffboardings) o.employeeName = nameMap.get(o.employeeId) || o.employeeId;
        }
        return NextResponse.json({ success: true, stats: { onboardingActive, offboardingActive, totalEmployees }, recentOnboardings, recentOffboardings });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[employees/lifecycle GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.employees.read' },
);

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;
      const db = await getCVisionDb(tenantId);

      if (action === 'start-onboarding') {
        const { employeeId, templateId } = body;
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const id = await createOnboarding(db, tenantId, employeeId, templateId);
        return NextResponse.json({ success: true, onboardingId: id });
      }

      if (action === 'complete-onboard-step') {
        const { employeeId, stepId, notes } = body;
        if (!employeeId || !stepId) return NextResponse.json({ success: false, error: 'Missing employeeId/stepId' }, { status: 400 });
        const result = await completeOnboardingStep(db, tenantId, employeeId, stepId, userId, notes);
        return NextResponse.json({ success: true, ...result });
      }

      if (action === 'skip-onboard-step') {
        const { employeeId, stepId, reason } = body;
        if (!employeeId || !stepId) return NextResponse.json({ success: false, error: 'Missing employeeId/stepId' }, { status: 400 });
        const result = await skipOnboardingStep(db, tenantId, employeeId, stepId, userId, reason || 'Skipped');
        return NextResponse.json({ success: true, ...result });
      }

      if (action === 'save-template') {
        const { name, steps, isDefault } = body;
        if (!name || !steps?.length) return NextResponse.json({ success: false, error: 'Missing name/steps' }, { status: 400 });
        const id = await saveOnboardingTemplate(db, tenantId, { name, steps, isDefault: isDefault || false });
        return NextResponse.json({ success: true, templateId: id });
      }

      if (action === 'start-offboarding') {
        const { employeeId, type, reason, lastWorkingDay } = body;
        if (!employeeId || !type || !reason || !lastWorkingDay) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        const id = await initiateOffboarding(db, tenantId, { employeeId, type, reason, lastWorkingDay, initiatedBy: userId });
        return NextResponse.json({ success: true, offboardingId: id });
      }

      if (action === 'complete-offboard-item') {
        const { employeeId, itemId, notes } = body;
        if (!employeeId || !itemId) return NextResponse.json({ success: false, error: 'Missing employeeId/itemId' }, { status: 400 });
        const result = await completeOffboardingItem(db, tenantId, employeeId, itemId, userId, notes);
        return NextResponse.json({ success: true, ...result });
      }

      if (action === 'calculate-settlement') {
        const { employeeId } = body;
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const settlement = await calculateFinalSettlement(db, tenantId, employeeId);
        return NextResponse.json({ success: true, settlement });
      }

      if (action === 'save-exit-interview') {
        const { employeeId, interview } = body;
        if (!employeeId || !interview) return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
        await saveExitInterview(db, tenantId, employeeId, { ...interview, conductedBy: userId, conductedAt: new Date() });
        return NextResponse.json({ success: true });
      }

      if (action === 'complete-offboarding') {
        const { employeeId } = body;
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        await completeOffboarding(db, tenantId, employeeId);
        return NextResponse.json({ success: true });
      }

      if (action === 'upload-document') {
        const { employeeId, docType, fileName, expiryDate } = body;
        if (!employeeId || !docType || !fileName) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        await db.collection('cvision_employee_documents').insertOne({
          tenantId, employeeId, type: docType, fileName,
          uploadedAt: new Date(),
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          status: 'VALID',
          uploadedBy: userId,
        });
        return NextResponse.json({ success: true });
      }

      if (action === 'verify-document') {
        const { documentId } = body;
        if (!documentId) return NextResponse.json({ success: false, error: 'Missing documentId' }, { status: 400 });
        const { ObjectId } = await import('mongodb');
        await db.collection('cvision_employee_documents').updateOne(
          { tenantId, _id: new ObjectId(documentId) },
          { $set: { verifiedBy: userId, verifiedAt: new Date(), status: 'VALID' } },
        );
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[employees/lifecycle POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.employees.write' },
);
